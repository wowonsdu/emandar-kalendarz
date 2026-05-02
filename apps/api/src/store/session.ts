import crypto from "node:crypto";
import { Pool } from "pg";

export type SmsChallenge = {
  code: string;
  expiresAt: string;
  phone: string;
  requestedAt: string;
  usedAt?: string;
};

export type AuthSession = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type UploadPurpose = "avatar" | "enrollment-photo" | "event-image";

export type UploadRecord = {
  id: string;
  ownerUserId: string;
  purpose: UploadPurpose;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  storagePath: string;
  publicUrl: string;
  width: number;
  height: number;
};

export type AuditLogInput = {
  actorUserId: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
};

export type NotificationDeliveryInput = {
  channel: string;
  recipient: string;
  provider?: string | null;
  providerMessageId?: string | null;
  status: string;
  error?: string | null;
  payload?: Record<string, unknown>;
};

export type SignedActionTokenInput = {
  action: string;
  entityType: string;
  entityId: string;
  ttlSeconds: number;
  payload?: Record<string, unknown>;
};

export type SignedActionTokenRecord = {
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string | null;
  payload: Record<string, unknown>;
};

export type SecurityStore = {
  close(): Promise<void>;
  cleanupExpiredSessions(): Promise<void>;
  createSmsChallenge(phone: string, code: string, ttlSeconds: number, requestIp?: string): Promise<SmsChallenge>;
  consumeSmsChallenge(phone: string): Promise<SmsChallenge | null>;
  createSession(userId: string, ttlSeconds: number): Promise<AuthSession>;
  getSession(sessionId: string | undefined): Promise<AuthSession | null>;
  deleteSession(sessionId: string | undefined): Promise<void>;
  createRegistrationToken(phone: string, ttlSeconds: number): Promise<string>;
  consumeRegistrationToken(token: string, phone: string): Promise<boolean>;
  createUpload(record: UploadRecord): Promise<void>;
  getUploadByIdOrUrl(value: string | undefined | null): Promise<UploadRecord | null>;
  createSignedActionToken(input: SignedActionTokenInput): Promise<string>;
  getSignedActionToken(token: string): Promise<SignedActionTokenRecord | null>;
  consumeSignedActionToken(
    token: string,
    expected: { action: string; entityType?: string; entityId?: string },
  ): Promise<SignedActionTokenRecord | null>;
  recordAudit(input: AuditLogInput): Promise<void>;
  recordNotificationDelivery(input: NotificationDeliveryInput): Promise<void>;
};

function nowIso() {
  return new Date().toISOString();
}

function expiresAtIso(ttlSeconds: number) {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

function createSecret() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export class InMemoryAuthStore implements SecurityStore {
  private smsChallenges = new Map<string, SmsChallenge>();
  private sessions = new Map<string, AuthSession>();
  private registrationTokens = new Map<string, { phone: string; expiresAt: string; usedAt?: string }>();
  private uploads = new Map<string, UploadRecord>();
  private uploadsByUrl = new Map<string, UploadRecord>();
  private signedActionTokens = new Map<string, SignedActionTokenRecord>();
  readonly auditLog: AuditLogInput[] = [];
  readonly notificationDeliveries: NotificationDeliveryInput[] = [];

  async close() {
    return undefined;
  }

  async cleanupExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (Date.parse(session.expiresAt) <= now) {
        this.sessions.delete(id);
      }
    }
  }

  async createSmsChallenge(phone: string, code: string, ttlSeconds = 300) {
    const requestedAt = nowIso();
    const challenge = {
      code,
      expiresAt: expiresAtIso(ttlSeconds),
      phone,
      requestedAt,
    };
    this.smsChallenges.set(phone, challenge);
    return challenge;
  }

  async consumeSmsChallenge(phone: string) {
    const challenge = this.smsChallenges.get(phone) ?? null;
    this.smsChallenges.delete(phone);
    if (!challenge || Date.parse(challenge.expiresAt) < Date.now()) {
      return null;
    }
    return challenge;
  }

  async createSession(userId: string, ttlSeconds: number) {
    const session: AuthSession = {
      id: createSecret(),
      userId,
      createdAt: nowIso(),
      expiresAt: expiresAtIso(ttlSeconds),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async getSession(sessionId: string | undefined) {
    if (!sessionId) {
      return null;
    }

    const session = this.sessions.get(sessionId) ?? null;
    if (!session || Date.parse(session.expiresAt) < Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  async deleteSession(sessionId: string | undefined) {
    if (sessionId) {
      this.sessions.delete(sessionId);
    }
  }

  async createRegistrationToken(phone: string, ttlSeconds: number) {
    const token = createSecret();
    this.registrationTokens.set(hashToken(token), {
      phone,
      expiresAt: expiresAtIso(ttlSeconds),
    });
    return token;
  }

  async consumeRegistrationToken(token: string, phone: string) {
    const hash = hashToken(token);
    const record = this.registrationTokens.get(hash);
    if (!record || record.usedAt || record.phone !== phone || Date.parse(record.expiresAt) < Date.now()) {
      return false;
    }
    record.usedAt = nowIso();
    return true;
  }

  async createUpload(record: UploadRecord) {
    this.uploads.set(record.id, record);
    this.uploadsByUrl.set(record.publicUrl, record);
  }

  async getUploadByIdOrUrl(value: string | undefined | null) {
    if (!value) {
      return null;
    }
    return this.uploads.get(value) ?? this.uploadsByUrl.get(value) ?? null;
  }

  async createSignedActionToken(input: SignedActionTokenInput) {
    const token = createSecret();
    this.signedActionTokens.set(hashToken(token), {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      createdAt: nowIso(),
      expiresAt: expiresAtIso(input.ttlSeconds),
      usedAt: null,
      payload: input.payload ?? {},
    });
    return token;
  }

  async getSignedActionToken(token: string) {
    const record = this.signedActionTokens.get(hashToken(token)) ?? null;
    if (!record || record.usedAt || Date.parse(record.expiresAt) <= Date.now()) {
      return null;
    }
    return { ...record, payload: { ...record.payload } };
  }

  async consumeSignedActionToken(
    token: string,
    expected: { action: string; entityType?: string; entityId?: string },
  ) {
    const record = this.signedActionTokens.get(hashToken(token)) ?? null;
    if (
      !record ||
      record.usedAt ||
      record.action !== expected.action ||
      (expected.entityType && record.entityType !== expected.entityType) ||
      (expected.entityId && record.entityId !== expected.entityId) ||
      Date.parse(record.expiresAt) <= Date.now()
    ) {
      return null;
    }
    record.usedAt = nowIso();
    return { ...record, payload: { ...record.payload } };
  }

  async recordAudit(input: AuditLogInput) {
    this.auditLog.push(input);
  }

  async recordNotificationDelivery(input: NotificationDeliveryInput) {
    this.notificationDeliveries.push(input);
  }
}

export class PgAuthStore implements SecurityStore {
  constructor(private pool: Pool) {}

  static fromDatabaseUrl(databaseUrl: string) {
    return new PgAuthStore(new Pool({ connectionString: databaseUrl }));
  }

  async close() {
    await this.pool.end();
  }

  async cleanupExpiredSessions() {
    await this.pool.query("delete from auth_sessions where expires_at is not null and expires_at <= now()");
  }

  async createSmsChallenge(phone: string, code: string, ttlSeconds = 300, requestIp?: string) {
    const expiresAt = expiresAtIso(ttlSeconds);
    await this.pool.query(
      `insert into sms_challenges (phone, code, requested_at, expires_at, used_at, request_ip)
       values ($1, $2, now(), $3, null, $4)
       on conflict (phone) do update set code = excluded.code, requested_at = now(), expires_at = excluded.expires_at, used_at = null, request_ip = excluded.request_ip`,
      [phone, code, expiresAt, requestIp ?? null],
    );
    return {
      code,
      expiresAt,
      phone,
      requestedAt: nowIso(),
    };
  }

  async consumeSmsChallenge(phone: string) {
    const result = await this.pool.query<{
      code: string;
      expires_at: Date;
      phone: string;
      requested_at: Date;
      used_at: Date | null;
    }>(
      `update sms_challenges
       set used_at = now()
       where phone = $1 and used_at is null and (expires_at is null or expires_at > now())
       returning phone, code, requested_at, expires_at, used_at`,
      [phone],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      code: row.code,
      expiresAt: row.expires_at.toISOString(),
      phone: row.phone,
      requestedAt: row.requested_at.toISOString(),
      usedAt: row.used_at?.toISOString(),
    };
  }

  async createSession(userId: string, ttlSeconds: number) {
    const session: AuthSession = {
      id: createSecret(),
      userId,
      createdAt: nowIso(),
      expiresAt: expiresAtIso(ttlSeconds),
    };
    await this.pool.query(
      "insert into auth_sessions (id, user_id, created_at, expires_at) values ($1, $2, now(), $3)",
      [session.id, userId, session.expiresAt],
    );
    return session;
  }

  async getSession(sessionId: string | undefined) {
    if (!sessionId) {
      return null;
    }
    const result = await this.pool.query<{ id: string; user_id: string; created_at: Date; expires_at: Date }>(
      `select id, user_id, created_at, expires_at
       from auth_sessions
       where id = $1 and (expires_at is null or expires_at > now())`,
      [sessionId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
    };
  }

  async deleteSession(sessionId: string | undefined) {
    if (!sessionId) {
      return;
    }
    await this.pool.query("delete from auth_sessions where id = $1", [sessionId]);
  }

  async createRegistrationToken(phone: string, ttlSeconds: number) {
    const token = createSecret();
    await this.pool.query(
      `insert into registration_tokens (token_hash, phone, expires_at)
       values ($1, $2, $3)`,
      [hashToken(token), phone, expiresAtIso(ttlSeconds)],
    );
    return token;
  }

  async consumeRegistrationToken(token: string, phone: string) {
    const result = await this.pool.query(
      `update registration_tokens
       set used_at = now()
       where token_hash = $1 and phone = $2 and used_at is null and expires_at > now()
       returning token_hash`,
      [hashToken(token), phone],
    );
    return result.rowCount === 1;
  }

  async createUpload(record: UploadRecord) {
    await this.pool.query(
      `insert into uploads
       (id, owner_user_id, purpose, original_filename, content_type, byte_size, storage_path, public_url, payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        record.id,
        record.ownerUserId,
        record.purpose,
        record.originalFilename,
        record.contentType,
        record.byteSize,
        record.storagePath,
        record.publicUrl,
        JSON.stringify({ width: record.width, height: record.height }),
      ],
    );
  }

  async getUploadByIdOrUrl(value: string | undefined | null) {
    if (!value) {
      return null;
    }
    const result = await this.pool.query<{
      id: string;
      owner_user_id: string;
      purpose: UploadPurpose;
      original_filename: string;
      content_type: string;
      byte_size: number;
      storage_path: string;
      public_url: string;
      payload: { width?: number; height?: number };
    }>(
      `select id, owner_user_id, purpose, original_filename, content_type, byte_size, storage_path, public_url, payload
       from uploads
       where id = $1 or public_url = $1`,
      [value],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      purpose: row.purpose,
      originalFilename: row.original_filename,
      contentType: row.content_type,
      byteSize: Number(row.byte_size),
      storagePath: row.storage_path,
      publicUrl: row.public_url,
      width: Number(row.payload?.width ?? 0),
      height: Number(row.payload?.height ?? 0),
    };
  }

  async createSignedActionToken(input: SignedActionTokenInput) {
    const token = createSecret();
    await this.pool.query(
      `insert into signed_action_tokens (token_hash, action, entity_type, entity_id, expires_at, payload)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        hashToken(token),
        input.action,
        input.entityType,
        input.entityId,
        expiresAtIso(input.ttlSeconds),
        JSON.stringify(input.payload ?? {}),
      ],
    );
    return token;
  }

  async getSignedActionToken(token: string) {
    const result = await this.pool.query<{
      action: string;
      entity_type: string;
      entity_id: string;
      created_at: Date;
      expires_at: Date;
      used_at: Date | null;
      payload: Record<string, unknown>;
    }>(
      `select action, entity_type, entity_id, created_at, expires_at, used_at, payload
       from signed_action_tokens
       where token_hash = $1 and used_at is null and expires_at > now()`,
      [hashToken(token)],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      usedAt: row.used_at?.toISOString() ?? null,
      payload: row.payload ?? {},
    };
  }

  async consumeSignedActionToken(
    token: string,
    expected: { action: string; entityType?: string; entityId?: string },
  ) {
    const result = await this.pool.query<{
      action: string;
      entity_type: string;
      entity_id: string;
      created_at: Date;
      expires_at: Date;
      used_at: Date | null;
      payload: Record<string, unknown>;
    }>(
      `update signed_action_tokens
       set used_at = now()
       where token_hash = $1
         and action = $2
         and ($3::text is null or entity_type = $3)
         and ($4::text is null or entity_id = $4)
         and used_at is null
         and expires_at > now()
       returning action, entity_type, entity_id, created_at, expires_at, used_at, payload`,
      [hashToken(token), expected.action, expected.entityType ?? null, expected.entityId ?? null],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      usedAt: row.used_at?.toISOString() ?? null,
      payload: row.payload ?? {},
    };
  }

  async recordAudit(input: AuditLogInput) {
    await this.pool.query(
      `insert into audit_log (id, actor_user_id, action, entity_type, entity_id, payload)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        `audit-${crypto.randomUUID()}`,
        input.actorUserId,
        input.action,
        input.entityType ?? null,
        input.entityId ?? null,
        JSON.stringify(input.payload ?? {}),
      ],
    );
  }

  async recordNotificationDelivery(input: NotificationDeliveryInput) {
    await this.pool.query(
      `insert into notification_deliveries
       (id, channel, recipient, provider, provider_message_id, status, error, payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        `delivery-${crypto.randomUUID()}`,
        input.channel,
        input.recipient,
        input.provider ?? null,
        input.providerMessageId ?? null,
        input.status,
        input.error ?? null,
        JSON.stringify(input.payload ?? {}),
      ],
    );
  }
}
