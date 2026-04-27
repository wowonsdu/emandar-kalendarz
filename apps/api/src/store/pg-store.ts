import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { persistedCollectionKeys, type PersistedCollectionKey } from "@emandar/shared";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { cloneValue, normalizeStore } from "./default-store.js";
import type { DemoStoreRecord, JsonRecord, StoreRepository, StoreSnapshot } from "./types.js";

type DbClient = ReturnType<typeof drizzle>;

const collectionTableNames: Record<PersistedCollectionKey, string> = {
  users: "users",
  trainers: "trainers",
  organizers: "organizers",
  participantProfiles: "participant_profiles",
  groups: "groups",
  groupMembers: "group_members",
  eventParticipants: "event_participants",
  relations: "trainer_organizer_relations",
  trainingEvents: "training_events",
  publicTrainingEvents: "public_training_events",
  enrollmentRequests: "enrollment_requests",
  notifications: "notifications",
  appSettings: "app_settings",
};

export class PgStoreRepository implements StoreRepository {
  private db: DbClient;

  constructor(private pool: Pool) {
    this.db = drizzle(pool);
  }

  static fromDatabaseUrl(databaseUrl: string) {
    return new PgStoreRepository(new Pool({ connectionString: databaseUrl }));
  }

  async close() {
    await this.pool.end();
  }

  async migrate() {
    const migrationsDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../migrations",
    );
    const migration = await readFile(path.join(migrationsDir, "0001_initial.sql"), "utf8");
    await this.pool.query(migration);
  }

  async getVersion() {
    await this.ensureMetaRow();
    const result = await this.pool.query<{ version: number }>(
      "select version from store_meta where id = 1",
    );
    return Number(result.rows[0]?.version ?? 1);
  }

  async patchCollections(
    baseVersion: number,
    collections: Partial<Record<PersistedCollectionKey, unknown[] | JsonRecord>>,
  ) {
    await this.ensureMetaRow();
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const meta = await client.query<{ version: number }>(
        "select version from store_meta where id = 1 for update",
      );
      const currentVersion = Number(meta.rows[0]?.version ?? 1);
      if (baseVersion !== currentVersion) {
        await client.query("rollback");
        return { conflictVersion: currentVersion };
      }

      const writtenCollections = Object.keys(collections) as PersistedCollectionKey[];
      for (const key of writtenCollections) {
        await this.writeCollectionWithClient(client, key, collections[key] ?? []);
        if (key === "users") {
          await this.syncRolesWithClient(client, collections[key] ?? []);
        }
      }

      const nextVersion = writtenCollections.length > 0 ? currentVersion + 1 : currentVersion;
      if (nextVersion !== currentVersion) {
        await client.query(
          "update store_meta set version = $1, updated_at = now() where id = 1",
          [nextVersion],
        );
      }

      await client.query("commit");
      return {
        version: nextVersion,
        writtenCollections,
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async readSnapshot(): Promise<StoreSnapshot> {
    await this.ensureMetaRow();
    const entries = await Promise.all(
      persistedCollectionKeys.map(async (key) => [key, await this.readCollection(key)] as const),
    );

    return {
      store: normalizeStore(Object.fromEntries(entries)),
      version: await this.getVersion(),
    };
  }

  async seedFromStore(store: DemoStoreRecord, options: { reset?: boolean } = {}) {
    await this.ensureMetaRow();
    const current = await this.readSnapshot();
    const hasData = persistedCollectionKeys.some((key) => {
      const value = current.store[key];
      return Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0;
    });

    if (hasData && !options.reset) {
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query("begin");
      for (const key of persistedCollectionKeys) {
        await this.writeCollectionWithClient(client, key, store[key]);
        if (key === "users") {
          await this.syncRolesWithClient(client, store[key]);
        }
      }
      await client.query("update store_meta set version = version + 1, updated_at = now() where id = 1");
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  private async ensureMetaRow() {
    await this.pool.query(
      "insert into store_meta (id, version) values (1, 1) on conflict (id) do nothing",
    );
  }

  private async readCollection(key: PersistedCollectionKey) {
    const table = collectionTableNames[key];
    if (key === "appSettings") {
      const result = await this.pool.query<{ payload: JsonRecord }>(
        `select payload from ${table} where id = 'singleton'`,
      );
      return result.rows[0]?.payload ?? {};
    }

    const result = await this.pool.query<{ payload: JsonRecord }>(
      `select payload from ${table} order by position asc, id asc`,
    );
    return result.rows.map((row) => row.payload);
  }

  private async writeCollectionWithClient(
    client: Pick<Pool, "query">,
    key: PersistedCollectionKey,
    value: unknown[] | JsonRecord,
  ) {
    const table = collectionTableNames[key];
    await client.query(`delete from ${table}`);

    if (key === "appSettings") {
      await client.query(`insert into ${table} (id, payload) values ($1, $2::jsonb)`, [
        "singleton",
        JSON.stringify(cloneValue(value)),
      ]);
      return;
    }

    const rows = Array.isArray(value) ? value : [];
    for (const [index, item] of rows.entries()) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const payload = item as JsonRecord;
      const id = String(payload.id ?? `${key}-${index}`);
      await client.query(
        `insert into ${table} (id, position, payload) values ($1, $2, $3::jsonb)`,
        [id, index, JSON.stringify(payload)],
      );
    }
  }

  private async syncRolesWithClient(client: Pick<Pool, "query">, users: unknown[] | JsonRecord) {
    await client.query("delete from roles");
    await client.query("delete from user_roles");
    const rows = Array.isArray(users) ? users : [];

    for (const user of rows) {
      if (!user || typeof user !== "object") {
        continue;
      }

      const payload = user as { id?: unknown; role?: unknown; roles?: unknown };
      const userId = typeof payload.id === "string" ? payload.id : "";
      if (!userId) {
        continue;
      }

      const roles = new Set<string>();
      if (typeof payload.role === "string") {
        roles.add(payload.role);
      }
      if (Array.isArray(payload.roles)) {
        payload.roles.forEach((role) => {
          if (typeof role === "string") {
            roles.add(role);
          }
        });
      }

      for (const role of roles) {
        await client.query("insert into roles (user_id, role) values ($1, $2)", [userId, role]);
        await client.query("insert into user_roles (user_id, role) values ($1, $2)", [userId, role]);
      }
    }
  }
}
