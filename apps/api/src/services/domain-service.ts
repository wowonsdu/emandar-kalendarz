import crypto from "node:crypto";
import { persistedCollectionKeys, type AppRole, type PersistedCollectionKey } from "@emandar/shared";
import { isSamePhone, normalizePhoneLookupKey } from "../auth/phone.js";
import { cloneValue, normalizeStore } from "../store/default-store.js";
import type { DemoStoreRecord, StoreRepository } from "../store/types.js";

type RecordAny = Record<string, any>;

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function arrayOf(store: DemoStoreRecord, key: PersistedCollectionKey) {
  const value = store[key];
  return Array.isArray(value) ? (value as RecordAny[]) : [];
}

function settings(store: DemoStoreRecord) {
  return (store.appSettings && !Array.isArray(store.appSettings) ? store.appSettings : {}) as RecordAny;
}

function findById(store: DemoStoreRecord, key: PersistedCollectionKey, id: string | undefined | null) {
  if (!id) {
    return null;
  }
  return arrayOf(store, key).find((item) => item.id === id) ?? null;
}

function normalizeRoles(user: RecordAny): AppRole[] {
  const roles = new Set<AppRole>();
  if (typeof user.role === "string") {
    roles.add(user.role as AppRole);
  }
  if (Array.isArray(user.roles)) {
    user.roles.forEach((role) => {
      if (typeof role === "string") {
        roles.add(role as AppRole);
      }
    });
  }
  if (roles.size === 0) {
    roles.add("participant");
  }
  return [...roles];
}

function hasRole(user: RecordAny, role: AppRole) {
  const roles = normalizeRoles(user);
  if (roles.includes("admin")) {
    return true;
  }
  if (role === "moderator") {
    return roles.includes("moderator");
  }
  const order: AppRole[] = ["participant", "organizer", "trainer", "admin"];
  const highest = Math.max(...roles.map((item) => order.indexOf(item)).filter((index) => index >= 0), 0);
  return highest >= order.indexOf(role);
}

function requireActor(store: DemoStoreRecord, actorUserId: string | null) {
  const actor = findById(store, "users", actorUserId);
  if (!actor) {
    throw new Error("Musisz być zalogowany.");
  }
  return actor;
}

function ensureRole(user: RecordAny, role: AppRole) {
  const roles = new Set(normalizeRoles(user));
  roles.add(role);
  user.roles = [...roles];
  user.role = user.roles.includes("admin")
    ? "admin"
    : user.roles.includes("trainer")
      ? "trainer"
      : user.roles.includes("organizer")
        ? "organizer"
        : "participant";
  user.primaryRole = user.role;
}

function buildParticipantProfileId(phone: string) {
  return `participant-${normalizePhoneLookupKey(phone) || crypto.randomUUID()}`;
}

function upsertParticipantProfileFromUser(store: DemoStoreRecord, user: RecordAny, input: RecordAny = {}) {
  const profiles = arrayOf(store, "participantProfiles");
  const phone = String(input.phone ?? user.phone ?? "");
  const profileId = user.participantProfileId || buildParticipantProfileId(phone);
  user.participantProfileId = profileId;
  const existing = profiles.find((profile) => profile.id === profileId);
  const payload = {
    id: profileId,
    linkedUserId: user.id,
    displayName: String(input.displayName ?? user.displayName ?? "").trim() || phone,
    phone,
    phoneLookupKey: normalizePhoneLookupKey(phone),
    email: user.email ?? null,
    notes: input.notes ?? user.notes ?? "",
    referralSource: input.referralSource ?? user.referralSource,
    avatarUrl: input.avatarUrl ?? user.avatarUrl,
    avatarPath: input.avatarPath ?? user.avatarPath,
    avatarCrop: input.avatarCrop ?? user.avatarCrop,
    confirmationStatus: "confirmed",
    status: "active",
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  if (existing) {
    Object.assign(existing, payload);
  } else {
    profiles.unshift(payload);
  }
  store.participantProfiles = profiles;
  return payload;
}

function recomputePublicEvents(store: DemoStoreRecord) {
  store.publicTrainingEvents = arrayOf(store, "trainingEvents").filter(
    (event) => event.isPublished && !event.archivedAt,
  );
}

function recomputeEventCounts(store: DemoStoreRecord, eventId: string) {
  const event = findById(store, "trainingEvents", eventId);
  if (!event) {
    return;
  }
  const participants = arrayOf(store, "eventParticipants").filter((item) => item.eventId === eventId);
  event.assignedCount = participants.filter((item) =>
    ["invited", "confirmed"].includes(String(item.status)),
  ).length;
  event.reserveCount = participants.filter((item) => item.status === "rezerwowy").length;
  event.enrolledCount = participants.filter((item) => item.status !== "removed").length;
}

function assertCanManageEvent(actor: RecordAny, event: RecordAny) {
  if (
    hasRole(actor, "admin") ||
    event.trainerUserId === actor.id ||
    event.organizerUserId === actor.id ||
    event.creatorUserId === actor.id
  ) {
    return;
  }
  throw new Error("Nie możesz zarządzać tym wydarzeniem.");
}

function assertCanModerateEvents(actor: RecordAny) {
  if (hasRole(actor, "admin") || hasRole(actor, "moderator")) {
    return;
  }
  throw new Error("Brak uprawnień moderatora.");
}

function assertCanManageOrModerateEvent(actor: RecordAny, event: RecordAny) {
  try {
    assertCanManageEvent(actor, event);
  } catch (error) {
    assertCanModerateEvents(actor);
  }
}

function cleanFileFields<T extends RecordAny>(input: T): T {
  const next = { ...input };
  delete next.avatarFile;
  delete next.photoFile;
  return next;
}

export class DomainService {
  constructor(private store: StoreRepository) {}

  async publicStore() {
    const snapshot = await this.store.readSnapshot();
    const store = normalizeStore(snapshot.store);
    recomputePublicEvents(store);
    return {
      trainers: arrayOf(store, "trainers").filter((trainer) => trainer.isVisible !== false),
      organizers: arrayOf(store, "organizers").filter((organizer) => organizer.isVisible !== false),
      publicTrainingEvents: cloneValue(store.publicTrainingEvents),
      trainingEvents: cloneValue(store.publicTrainingEvents),
      appSettings: cloneValue(settings(store)),
    };
  }

  async privateStore(actorUserId: string | null) {
    const snapshot = await this.store.readSnapshot();
    const store = normalizeStore(snapshot.store);
    requireActor(store, actorUserId);
    return cloneValue(store);
  }

  async user(actorUserId: string | null, userId = actorUserId) {
    const snapshot = await this.store.readSnapshot();
    const store = normalizeStore(snapshot.store);
    const actor = requireActor(store, actorUserId);
    if (userId !== actor.id && !hasRole(actor, "admin")) {
      throw new Error("Nie możesz pobrać tego profilu.");
    }
    return cloneValue(findById(store, "users", userId) ?? null);
  }

  async mutate<T>(actorUserId: string | null, updater: (store: DemoStoreRecord, actor: RecordAny | null) => T) {
    const snapshot = await this.store.readSnapshot();
    const store = normalizeStore(cloneValue(snapshot.store));
    const actor = actorUserId ? requireActor(store, actorUserId) : null;
    const result = updater(store, actor);
    recomputePublicEvents(store);
    const collections = Object.fromEntries(
      persistedCollectionKeys.map((key) => [key, store[key]]),
    ) as Partial<Record<PersistedCollectionKey, unknown[] | Record<string, unknown>>>;
    const saved = await this.store.patchCollections(snapshot.version, collections);
    if ("conflictVersion" in saved) {
      throw new Error("Dane zostały zmienione w innym oknie. Odśwież widok i spróbuj ponownie.");
    }
    return result;
  }

  async createOrUpdatePhoneParticipant(phone: string, input: RecordAny = {}) {
    return this.mutate(null, (store) => {
      const users = arrayOf(store, "users");
      let user = users.find((item) => isSamePhone(item.phone, phone));
      const accountCreated = !user;
      if (!user) {
        user = {
          id: createId("user-participant"),
          role: "participant",
          roles: ["participant"],
          primaryRole: "participant",
          displayName: input.displayName?.trim() || phone,
          phone,
          authProvider: "phone",
          phoneVerifiedAt: nowIso(),
          status: "active",
          createdAt: nowIso(),
        };
        users.unshift(user);
        store.users = users;
      }
      ensureRole(user, "participant");
      Object.assign(user, cleanFileFields(input), {
        phone,
        phoneVerifiedAt: user.phoneVerifiedAt ?? nowIso(),
        status: "active",
      });
      upsertParticipantProfileFromUser(store, user, { ...input, phone });
      return { ok: true as const, userId: user.id, accountCreated };
    });
  }

  async confirmEnrollmentAttendanceByEntity(entityId: string, decision: "confirm" | "decline") {
    return this.mutate(null, (store) => {
      const nextStatus = decision === "decline" ? "declined" : "confirmed";
      const participant = findById(store, "eventParticipants", entityId);
      if (participant) {
        participant.attendanceConfirmationStatus = nextStatus;
        participant.attendanceConfirmationRespondedAt = nowIso();
        if (nextStatus === "declined") participant.status = "declined";
        recomputeEventCounts(store, participant.eventId);
        return { ok: true as const, entityType: "event_participant", entityId };
      }
      const request = findById(store, "enrollmentRequests", entityId);
      if (!request) throw new Error("Nie znaleziono potwierdzenia uczestnictwa.");
      request.attendanceConfirmationStatus = nextStatus;
      request.attendanceConfirmationRespondedAt = nowIso();
      return { ok: true as const, entityType: "enrollment_request", entityId };
    });
  }

  async getCommunityEventReviewByEntity(eventId: string) {
    const snapshot = await this.store.readSnapshot();
    const store = normalizeStore(snapshot.store);
    const event = findById(store, "trainingEvents", eventId);
    if (!event || event.brandStatus !== "supported") throw new Error("Nie znaleziono wydarzenia do moderacji.");
    return {
      ok: true as const,
      event,
      creatorName: event.creatorDisplayName || "Autor wydarzenia",
      creatorPhone: event.creatorPhone || findById(store, "users", event.creatorUserId)?.phone || "",
    };
  }

  async reviewCommunityEventByEntity(
    eventId: string,
    input: { decision: "accepted" | "rejected"; message?: string },
    actorUserId: string | null,
  ) {
    return this.mutate(actorUserId, (store, actor) => {
      const event = findById(store, "trainingEvents", eventId);
      if (!event || event.brandStatus !== "supported") throw new Error("Nie znaleziono wydarzenia do moderacji.");
      if (actor) {
        assertCanModerateEvents(actor);
      }
      event.publicationApprovalStatus = input.decision;
      event.publicationReviewMessage = input.message?.trim();
      event.publicationReviewedAt = nowIso();
      event.publicationReviewedByUserId = actor?.id ?? "signed-token";
      event.isPublished = input.decision === "accepted";
      event.workflowStatus = input.decision === "accepted" ? "published" : "rejected";
      return { ok: true as const, eventId: event.id };
    });
  }

  async runCommand(name: string, args: unknown[], actorUserId: string | null) {
    switch (name) {
      case "ensurePhoneParticipantProfileForFlow": {
        const seedTrainerId = typeof args[0] === "string" ? args[0] : undefined;
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor) {
            throw new Error("Najpierw potwierdź numer telefonu.");
          }
          const accountCreated = !actor.participantProfileId;
          ensureRole(actor, "participant");
          upsertParticipantProfileFromUser(store, actor, { phone: actor.phone });
          if (seedTrainerId) {
            actor.selectedTrainerIds = [...new Set([...(actor.selectedTrainerIds ?? []), seedTrainerId])];
          }
          return { ok: true as const, userId: actor.id, accountCreated };
        });
      }
      case "registerParticipant": {
        const input = cleanFileFields((args[0] ?? {}) as RecordAny);
        return this.createOrUpdatePhoneParticipant(String(input.phone ?? ""), {
          ...input,
          participantOnboardingCompletedAt: nowIso(),
          trainingDataConsentAcceptedAt: input.trainingDataConsentAccepted ? nowIso() : undefined,
        });
      }
      case "submitEnrollment": {
        const input = cleanFileFields((args[0] ?? {}) as RecordAny);
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor) throw new Error("Musisz być zalogowany.");
          const event = findById(store, "trainingEvents", input.eventId);
          if (!event) throw new Error("Nie znaleziono wydarzenia.");
          ensureRole(actor, "participant");
          const participant = upsertParticipantProfileFromUser(store, actor, {
            displayName: input.imieNazwisko || actor.displayName,
            phone: input.telefon || actor.phone,
            referralSource: input.polecenieOdKogo,
            notes: input.wiadomosc,
          });
          const requests = arrayOf(store, "enrollmentRequests");
          if (
            requests.some(
              (request) =>
                request.eventId === event.id &&
                request.participantProfileId === participant.id &&
                request.participantStatus !== "cancelled",
            )
          ) {
            throw new Error("To zgłoszenie jest już zapisane.");
          }
          requests.unshift({
            id: createId("enrollment"),
            eventId: event.id,
            trainerId: event.trainerId ?? null,
            organizerId: event.organizerId ?? null,
            submitterUid: actor.id,
            participantProfileId: participant.id,
            normalizedPhone: normalizePhoneLookupKey(input.telefon || actor.phone),
            trainerUserId: event.trainerUserId ?? null,
            organizerUserId: event.organizerUserId ?? null,
            intent: "participating",
            imieNazwisko: String(input.imieNazwisko ?? actor.displayName).trim(),
            telefon: String(input.telefon ?? actor.phone).trim(),
            polecenieOdKogo: String(input.polecenieOdKogo ?? "").trim(),
            wiadomosc: String(input.wiadomosc ?? "").trim(),
            photoStatus: input.photoPath ? "ready" : "pending",
            photoPath: input.photoPath,
            photoUploadedAt: input.photoPath ? nowIso() : undefined,
            finalStatus: "pending",
            participantStatus: "active",
            createdAt: nowIso(),
          });
          store.enrollmentRequests = requests;
        });
      }
      case "manageEnrollmentRequest":
      case "decideEnrollment": {
        const input =
          name === "decideEnrollment"
            ? { requestId: args[0], decision: args[2] ?? args[1] }
            : ((args[0] ?? {}) as RecordAny);
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor) throw new Error("Musisz być zalogowany.");
          const request = findById(store, "enrollmentRequests", String(input.requestId));
          if (!request) throw new Error("Nie znaleziono zgłoszenia.");
          const event = findById(store, "trainingEvents", request.eventId);
          if (!event) throw new Error("Nie znaleziono wydarzenia.");
          assertCanManageEvent(actor, event);
          request.finalStatus = input.decision === "rejected" ? "rejected" : input.decision === "accepted" ? "accepted" : "pending";
          request.participantStatus = request.finalStatus === "rejected" ? "cancelled" : "active";
          if (request.finalStatus === "accepted") {
            const participants = arrayOf(store, "eventParticipants");
            const participant = findById(store, "participantProfiles", request.participantProfileId);
            const participantId = `participant-${event.id}-${request.participantProfileId}`;
            const existing = participants.find((item) => item.id === participantId);
            const payload = {
              id: participantId,
              eventId: event.id,
              eventTitle: event.title || event.location,
              groupId: event.groupId ?? "",
              groupName: event.groupName ?? event.title ?? event.location,
              organizerId: event.organizerId ?? "",
              organizerUserId: event.organizerUserId ?? "",
              trainerId: event.trainerId ?? "",
              trainerUserId: event.trainerUserId ?? "",
              participantProfileId: request.participantProfileId,
              participantDisplayName: participant?.displayName ?? request.imieNazwisko,
              participantPhone: participant?.phone ?? request.telefon,
              participantUserId: participant?.linkedUserId ?? request.submitterUid ?? null,
              priority: "regularni",
              status: input.acceptedParticipantStatus ?? "confirmed",
              source: "public-form",
              invitedAt: existing?.invitedAt ?? nowIso(),
              updatedAt: nowIso(),
            };
            if (existing) Object.assign(existing, payload);
            else participants.unshift(payload);
            request.eventParticipantId = participantId;
            store.eventParticipants = participants;
          }
          recomputeEventCounts(store, event.id);
        });
      }
      case "createGroup": {
        const input = (args[0] ?? {}) as RecordAny;
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor || !hasRole(actor, "organizer")) throw new Error("Brak uprawnień organizatora.");
          const trainer = findById(store, "trainers", input.trainerId);
          const organizer =
            findById(store, "organizers", actor.organizerProfileId) ??
            ({ id: actor.organizerProfileId ?? `organizer-${actor.id}`, userId: actor.id, displayName: actor.displayName } as RecordAny);
          if (!findById(store, "organizers", organizer.id)) {
            arrayOf(store, "organizers").unshift(organizer);
          }
          const groupId = createId("group");
          arrayOf(store, "groups").unshift({
            ...input,
            id: groupId,
            organizerId: organizer.id,
            organizerUserId: actor.id,
            trainerUserId: trainer?.userId,
            status: "active",
            createdAt: nowIso(),
          });
          return { ok: true as const, groupId };
        });
      }
      case "updateGroup":
      case "archiveGroup": {
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor) throw new Error("Musisz być zalogowany.");
          const input = name === "archiveGroup" ? { groupId: args[0], status: "archived" } : ((args[0] ?? {}) as RecordAny);
          const group = findById(store, "groups", String(input.groupId));
          if (!group) throw new Error("Nie znaleziono grupy.");
          if (!hasRole(actor, "admin") && group.organizerUserId !== actor.id && group.trainerUserId !== actor.id) {
            throw new Error("Nie możesz zarządzać tą grupą.");
          }
          Object.assign(group, cleanFileFields(input), { id: group.id, updatedAt: nowIso() });
          if (name === "archiveGroup") group.archivedAt = nowIso();
        });
      }
      case "addGroupMember": {
        const input = (args[0] ?? {}) as RecordAny;
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor) throw new Error("Musisz być zalogowany.");
          const group = findById(store, "groups", input.groupId);
          if (!group) throw new Error("Nie znaleziono grupy.");
          const participant =
            findById(store, "participantProfiles", input.participantProfileId) ??
            upsertParticipantProfileFromUser(store, { id: createId("user-shadow"), phone: input.phone, displayName: input.displayName }, input);
          arrayOf(store, "groupMembers").unshift({
            id: createId("member"),
            groupId: group.id,
            organizerId: group.organizerId,
            organizerUserId: group.organizerUserId,
            trainerId: group.trainerId,
            trainerUserId: group.trainerUserId,
            participantProfileId: participant.id,
            participantUserId: participant.linkedUserId ?? null,
            participantDisplayName: participant.displayName,
            participantPhone: participant.phone,
            priority: input.priority ?? "regularni",
            membershipStatus: "active",
            notes: input.notes,
            joinedAt: nowIso(),
          });
        });
      }
      case "createOrUpdateOrganizerParticipantProfile": {
        const input = (args[0] ?? {}) as RecordAny;
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor) throw new Error("Musisz być zalogowany.");
          const shadowUser = {
            id: createId("user-shadow"),
            phone: input.phone,
            displayName: input.displayName,
            notes: input.notes,
            referralSource: input.referralSource,
          };
          upsertParticipantProfileFromUser(store, shadowUser, input);
        });
      }
      case "updateGroupMember":
      case "removeGroupMember": {
        return this.mutate(actorUserId, (store) => {
          const input = name === "removeGroupMember" ? { memberId: args[0], membershipStatus: "removed" } : ((args[0] ?? {}) as RecordAny);
          const member = findById(store, "groupMembers", String(input.memberId));
          if (!member) throw new Error("Nie znaleziono uczestnika grupy.");
          Object.assign(member, input, { id: member.id, updatedAt: nowIso() });
          if (name === "removeGroupMember") member.removedAt = nowIso();
        });
      }
      case "createTrainingEvent": {
        const input = (args[0] ?? {}) as RecordAny;
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor) throw new Error("Musisz być zalogowany.");
          const trainer = findById(store, "trainers", input.trainerId ?? actor.trainerProfileId);
          const organizer = findById(store, "organizers", input.organizerId ?? actor.organizerProfileId);
          if (!hasRole(actor, "organizer") && !hasRole(actor, "trainer")) throw new Error("Brak uprawnień.");
          const eventId = createId("event");
          const scheduleDays = Array.isArray(input.scheduleDays) ? input.scheduleDays : [];
          const firstDay = scheduleDays[0] ?? {};
          arrayOf(store, "trainingEvents").unshift({
            ...cleanFileFields(input),
            id: eventId,
            title: input.title?.trim() || input.location || "Nowe wydarzenie",
            trainerId: trainer?.id ?? input.trainerId ?? null,
            trainerUserId: trainer?.userId ?? (actor.trainerProfileId ? actor.id : null),
            organizerId: organizer?.id ?? input.organizerId ?? null,
            organizerUserId: organizer?.userId ?? (actor.organizerProfileId ? actor.id : null),
            creatorUserId: actor.id,
            creatorDisplayName: actor.displayName,
            creatorPhone: actor.phone,
            startsAt: firstDay.startsAt ?? nowIso(),
            endsAt: firstDay.endsAt ?? firstDay.startsAt ?? nowIso(),
            scheduleDays,
            enrolledCount: 0,
            assignedCount: 0,
            reserveCount: 0,
            imageHint: input.imageHint ?? "",
            brandStatus: input.brandStatus ?? "official",
            status: input.status ?? "active",
            workflowStatus: input.isPublished ? "published" : "draft-requested",
            createdAt: nowIso(),
          });
        });
      }
      case "archiveTrainingEvent":
      case "unpublishTrainingEvent":
      case "publishTrainingEvent":
      case "deleteTrainingEvent": {
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor) throw new Error("Musisz być zalogowany.");
          const event = findById(store, "trainingEvents", String(args[0]));
          if (!event) throw new Error("Nie znaleziono wydarzenia.");
          if (name === "unpublishTrainingEvent" || name === "deleteTrainingEvent") {
            assertCanManageOrModerateEvent(actor, event);
          } else {
            assertCanManageEvent(actor, event);
          }
          if (name === "deleteTrainingEvent") {
            store.trainingEvents = arrayOf(store, "trainingEvents").filter((item) => item.id !== event.id);
            store.eventParticipants = arrayOf(store, "eventParticipants").filter((item) => item.eventId !== event.id);
            store.enrollmentRequests = arrayOf(store, "enrollmentRequests").filter((item) => item.eventId !== event.id);
            return;
          }
          if (name === "archiveTrainingEvent") {
            event.archivedAt = nowIso();
            event.archivedByRole = actor.role;
            event.status = "cancelled";
            event.isPublished = false;
          }
          if (name === "unpublishTrainingEvent") {
            event.isPublished = false;
          }
          if (name === "publishTrainingEvent") {
            event.isPublished = true;
            event.workflowStatus = "published";
            event.publicationApprovalStatus = "accepted";
          }
        });
      }
      case "updateTrainingEventManagement":
      case "updateTrainingEventBrandStatus":
      case "decideTrainingEventCollaboration": {
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor) throw new Error("Musisz być zalogowany.");
          const input = (args[0] ?? {}) as RecordAny;
          const event = findById(store, "trainingEvents", input.eventId);
          if (!event) throw new Error("Nie znaleziono wydarzenia.");
          if (input.publicationDecision && event.brandStatus === "supported") {
            assertCanModerateEvents(actor);
          } else {
            assertCanManageEvent(actor, event);
          }
          Object.assign(event, cleanFileFields(input), { updatedAt: nowIso() });
          if (input.status) event.status = input.status;
          if (input.brandStatus) event.brandStatus = input.brandStatus;
          if (input.publicationDecision) {
            event.publicationApprovalStatus = input.publicationDecision;
            event.publicationReviewMessage = input.publicationReviewMessage;
            event.publicationReviewedAt = nowIso();
            event.publicationReviewedByUserId = actor.id;
            event.isPublished = input.publicationDecision === "accepted";
          }
          recomputeEventCounts(store, event.id);
        });
      }
      case "updateTrainerBrandStatus": {
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor || !hasRole(actor, "admin")) throw new Error("Brak uprawnień administratora.");
          const input = (args[0] ?? {}) as RecordAny;
          const trainer = findById(store, "trainers", input.trainerId);
          if (!trainer) throw new Error("Nie znaleziono profilu trenera.");
          trainer.brandStatus = input.brandStatus;
          trainer.updatedAt = nowIso();
        });
      }
      case "addEventParticipant":
      case "updateEventParticipantStatus":
      case "finalizeEventRoster": {
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor) throw new Error("Musisz być zalogowany.");
          if (name === "finalizeEventRoster") {
            const event = findById(store, "trainingEvents", String(args[0]));
            if (!event) throw new Error("Nie znaleziono wydarzenia.");
            assertCanManageEvent(actor, event);
            event.rosterFinalizedAt = nowIso();
            event.rosterFinalizedByUserId = actor.id;
            return;
          }
          const input = (args[0] ?? {}) as RecordAny;
          if (name === "updateEventParticipantStatus") {
            const participant = findById(store, "eventParticipants", input.eventParticipantId);
            if (!participant) throw new Error("Nie znaleziono uczestnika.");
            participant.status = input.status;
            participant.updatedAt = nowIso();
            recomputeEventCounts(store, participant.eventId);
            return;
          }
          const event = findById(store, "trainingEvents", input.eventId);
          const profile = findById(store, "participantProfiles", input.participantProfileId);
          if (!event || !profile) throw new Error("Nie znaleziono danych.");
          arrayOf(store, "eventParticipants").unshift({
            id: createId("event-participant"),
            eventId: event.id,
            eventTitle: event.title,
            groupId: event.groupId ?? "",
            groupName: event.groupName ?? event.title,
            organizerId: event.organizerId ?? "",
            organizerUserId: event.organizerUserId ?? "",
            trainerId: event.trainerId ?? "",
            trainerUserId: event.trainerUserId ?? "",
            participantProfileId: profile.id,
            participantDisplayName: profile.displayName,
            participantPhone: profile.phone,
            participantUserId: profile.linkedUserId ?? null,
            priority: "regularni",
            status: input.overCapacity ? "rezerwowy" : "invited",
            source: "organizer",
            overCapacity: Boolean(input.overCapacity),
            invitedAt: nowIso(),
          });
          recomputeEventCounts(store, event.id);
        });
      }
      case "connectOrganizerToTrainerWithCode": {
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor) throw new Error("Musisz być zalogowany.");
          ensureRole(actor, "organizer");
          const code = String(args[0] ?? "").trim().toUpperCase();
          const expectedTrainerId = typeof args[1] === "string" ? args[1] : undefined;
          const trainer = arrayOf(store, "trainers").find(
            (item) =>
              (!expectedTrainerId || item.id === expectedTrainerId) &&
              String(item.authorizationCode || item.slug || "").toUpperCase() === code,
          );
          if (!trainer) throw new Error("Nieprawidłowy kod Przekazującego Wiedzę.");
          let organizer = findById(store, "organizers", actor.organizerProfileId);
          let organizerProfileCreated = false;
          if (!organizer) {
            organizerProfileCreated = true;
            organizer = {
              id: actor.organizerProfileId || `organizer-${actor.id}`,
              userId: actor.id,
              displayName: actor.displayName,
              description: actor.notes ?? "",
              isVisible: true,
            };
            actor.organizerProfileId = organizer.id;
            arrayOf(store, "organizers").unshift(organizer);
          }
          const relationId = `${trainer.id}__${organizer.id}`;
          const relations = arrayOf(store, "relations");
          const relation = relations.find((item) => item.id === relationId);
          const payload = {
            id: relationId,
            trainerId: trainer.id,
            organizerId: organizer.id,
            trainerUserId: trainer.userId,
            organizerUserId: actor.id,
            status: "approved",
            requestedBy: "organizer",
            createdAt: relation?.createdAt ?? nowIso(),
          };
          if (relation) Object.assign(relation, payload);
          else relations.unshift(payload);
          return { ok: true as const, trainerId: trainer.id, organizerProfileCreated };
        });
      }
      case "detachRelation": {
        return this.mutate(actorUserId, (store) => {
          const relation = findById(store, "relations", String(args[0]));
          if (!relation) throw new Error("Nie znaleziono relacji.");
          relation.status = "detached";
          relation.detachedAt = nowIso();
          relation.archivedLinkedEvents = Boolean(args[2] ?? args[1]);
        });
      }
      case "updateTrainerProfile":
      case "updateOrganizerProfile":
      case "updateCommunityOrganizerProfile":
      case "updateParticipantProfile":
      case "updateTrainerNotificationSettings":
      case "updateOrganizerNotificationSettings":
      case "updateUserNotificationSettings":
      case "completeParticipantOnboarding": {
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor) throw new Error("Musisz być zalogowany.");
          const input = cleanFileFields((args[0] ?? {}) as RecordAny);
          if (name === "updateTrainerProfile" || name === "updateTrainerNotificationSettings") {
            const trainer = findById(store, "trainers", actor.trainerProfileId);
            if (!trainer) throw new Error("Nie znaleziono profilu trenera.");
            Object.assign(trainer, input, { updatedAt: nowIso() });
          } else if (name === "updateOrganizerProfile" || name === "updateOrganizerNotificationSettings") {
            const organizer = findById(store, "organizers", actor.organizerProfileId);
            if (!organizer) throw new Error("Nie znaleziono profilu organizatora.");
            Object.assign(organizer, input, { updatedAt: nowIso() });
          } else if (name === "updateCommunityOrganizerProfile") {
            const organizer = findById(store, "organizers", actor.organizerProfileId);
            if (!organizer) throw new Error("Nie znaleziono profilu organizatora.");
            organizer.communityProfile = input;
          } else if (name === "updateParticipantProfile" || name === "completeParticipantOnboarding") {
            Object.assign(actor, input, {
              participantOnboardingCompletedAt: name === "completeParticipantOnboarding" ? nowIso() : actor.participantOnboardingCompletedAt,
            });
            upsertParticipantProfileFromUser(store, actor, input);
          } else {
            actor.notificationSettings = input;
          }
        });
      }
      case "updateUserModeratorRole":
      case "updateUserOrganizerFunctionsBlocked": {
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor || !hasRole(actor, "admin")) throw new Error("Brak uprawnień administratora.");
          const user = findById(store, "users", String(args[0]));
          if (!user) throw new Error("Nie znaleziono użytkownika.");
          if (name === "updateUserModeratorRole") {
            const roles = new Set(normalizeRoles(user));
            if (args[1]) roles.add("moderator");
            else roles.delete("moderator");
            user.roles = [...roles];
          } else if (args[1]) {
            user.organizerFunctionsBlockedAt = nowIso();
            user.organizerFunctionsBlockedByUserId = actor.id;
          } else {
            delete user.organizerFunctionsBlockedAt;
            delete user.organizerFunctionsBlockedByUserId;
          }
        });
      }
      case "updateAppSettings": {
        const input = (args[0] ?? {}) as RecordAny;
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor || !hasRole(actor, "admin")) throw new Error("Brak uprawnień administratora.");
          store.appSettings = { ...settings(store), ...input };
        });
      }
      case "confirmEnrollmentAttendance": {
        return this.confirmEnrollmentAttendanceByEntity(
          String(args[0] ?? ""),
          args[1] === "decline" ? "decline" : "confirm",
        );
      }
      case "getCommunityEventReview": {
        return this.getCommunityEventReviewByEntity(String(args[0]));
      }
      case "reviewCommunityEvent": {
        const input = (args[0] ?? {}) as RecordAny;
        return this.reviewCommunityEventByEntity(
          String(input.token ?? ""),
          {
            decision: input.decision === "rejected" ? "rejected" : "accepted",
            message: typeof input.message === "string" ? input.message : "",
          },
          actorUserId,
        );
      }
      case "manageOwnGroupEventParticipation": {
        const input = (args[0] ?? {}) as RecordAny;
        return this.mutate(actorUserId, (store, actor) => {
          if (!actor) throw new Error("Musisz być zalogowany.");
          const participant = findById(store, "eventParticipants", input.eventParticipantId);
          if (!participant) throw new Error("Nie znaleziono uczestnictwa.");
          if (participant.participantUserId !== actor.id && !hasRole(actor, "admin")) {
            throw new Error("Nie możesz zmienić tego uczestnictwa.");
          }
          participant.status = input.action === "cancel" ? "declined" : participant.status;
          participant.updatedAt = nowIso();
        });
      }
      case "uploadCommunityEventImages": {
        return [];
      }
      default:
        throw new Error(`Nieobsługiwana akcja API: ${name}`);
    }
  }
}
