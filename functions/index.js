import { createHash, randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import ICAL from "ical.js";

initializeApp();

const db = getFirestore();
const auth = getAuth();
const storage = getStorage();
const FUNCTION_REGION = "europe-west1";
const collections = {
  users: "users",
  trainers: "trainers",
  organizers: "organizers",
  relations: "trainerOrganizerRelations",
  trainingEvents: "trainingEvents",
  availabilitySlots: "availabilitySlots",
  trainerCalendarFeeds: "trainerCalendarFeeds",
  trainerExternalBusyMonths: "trainerExternalBusyMonths",
  enrollmentRequests: "enrollmentRequests",
  notifications: "notifications",
  smsDispatches: "smsDispatches",
  accountRequests: "accountRequests",
  trainerAccountApprovals: "trainerAccountApprovals",
  appMeta: "app_meta",
};
const shouldEnforceAppCheck =
  process.env.FUNCTIONS_EMULATOR !== "true" &&
  process.env.ENFORCE_APP_CHECK === "true";
const PROXY_BASE_URL = "https://api.allorigins.win/raw?url=";
const PUBLIC_APP_BASE_URL =
  asString(process.env.EMANDAR_PUBLIC_BASE_URL) ||
  asString(process.env.PUBLIC_APP_BASE_URL) ||
  (process.env.FUNCTIONS_EMULATOR === "true"
    ? "http://127.0.0.1:5173"
    : "https://panel.ceo/emandar");

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function buildAccountApprovalId(requesterUserId, targetTrainerId) {
  return `${requesterUserId}__${targetTrainerId}`;
}

function buildPhoneAccountRequestId(userId) {
  return `phone-registration__${userId}`;
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function requiredString(value, message) {
  const normalized = asString(value);
  if (!normalized) {
    throw new HttpsError("invalid-argument", message);
  }
  return normalized;
}

function asNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizePendingRoles(value) {
  return Array.from(
    new Set(
      Array.isArray(value)
        ? value.filter((role) => role === "trainer" || role === "organizer")
        : [],
    ),
  );
}

function normalizeStringList(value) {
  return Array.from(
    new Set(
      Array.isArray(value)
        ? value.map((item) => asString(item)).filter(Boolean)
        : [],
    ),
  );
}

function normalizeEventImages(value) {
  const images = Array.isArray(value) ? value : [];

  if (images.length > 8) {
    throw new HttpsError("invalid-argument", "Do wydarzenia możesz dodać maksymalnie 8 zdjęć.");
  }

  return images.map((image, index) => {
    const id = requiredString(image?.id, `Brak identyfikatora zdjęcia nr ${index + 1}.`);
    const url = requiredString(image?.url, `Brak adresu zdjęcia nr ${index + 1}.`);
    const storagePath = requiredString(
      image?.storagePath,
      `Brak ścieżki magazynowania zdjęcia nr ${index + 1}.`,
    );
    const width = Math.max(1, Math.round(asNumber(image?.width, 0)));
    const height = Math.max(1, Math.round(asNumber(image?.height, 0)));

    return {
      id,
      url,
      storagePath,
      width,
      height,
    };
  });
}

function normalizePhoneLookupKey(value) {
  const trimmed = asString(value);
  if (!trimmed) {
    return "";
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    return digits;
  }

  if (digits.startsWith("00")) {
    return digits.slice(2);
  }

  if (digits.length === 9) {
    return `48${digits}`;
  }

  return digits;
}

function resolveAccountApprovalStatus(approvals) {
  if (approvals.some((approval) => approval.status === "accepted")) {
    return "approved";
  }

  if (approvals.length > 0 && approvals.every((approval) => approval.status === "rejected")) {
    return "rejected";
  }

  return "pending";
}

function resolveUnlockedRoles(pendingRoles, approvalStatus) {
  if (approvalStatus !== "approved") {
    return ["participant"];
  }

  return Array.from(new Set(["participant", ...pendingRoles]));
}

function resolvePreferredRole(pendingRoles, approvalStatus) {
  if (approvalStatus !== "approved") {
    return "participant";
  }

  if (pendingRoles.includes("organizer")) {
    return "organizer";
  }

  if (pendingRoles.includes("trainer")) {
    return "trainer";
  }

  return "participant";
}

async function getPublicSettings() {
  const snapshot = await db.collection(collections.appMeta).doc("publicSettings").get();
  return snapshot.exists ? snapshot.data() : {};
}

function normalizeRoleList(value) {
  return Array.from(
    new Set(
      Array.isArray(value)
        ? value.filter(
            (role) =>
              role === "trainer" ||
              role === "organizer" ||
              role === "admin" ||
              role === "participant",
          )
        : [],
    ),
  );
}

function normalizeRequestedRoles(value) {
  return Array.from(
    new Set(
      Array.isArray(value)
        ? value.filter(
            (role) =>
              role === "trainer" ||
              role === "organizer" ||
              role === "participant",
          )
        : [],
    ),
  );
}

function resolveBrandStatus(value) {
  return value === "supported" ? "supported" : "official";
}

function isCommunityBrandStatus(value) {
  return resolveBrandStatus(value) === "supported";
}

function resolveTrainingEventStatus(value) {
  return value === "confirmed" || value === "cancelled" ? value : "active";
}

function resolveMinimumParticipants(event) {
  const minimumParticipants = asNumber(event.minimumParticipants, event.capacity);
  return Math.max(1, Math.min(asNumber(event.capacity, 1), minimumParticipants || asNumber(event.capacity, 1)));
}

function deriveEnrollmentFinalStatus(
  trainerDecision,
  organizerDecision,
  requiresOrganizerApproval = true,
) {
  if (!requiresOrganizerApproval) {
    if (trainerDecision === "rejected") {
      return "rejected";
    }

    if (trainerDecision === "accepted") {
      return "accepted";
    }

    return "pending";
  }

  if (trainerDecision === "rejected" || organizerDecision === "rejected") {
    return "rejected";
  }

  if (trainerDecision === "accepted" && organizerDecision === "accepted") {
    return "accepted";
  }

  if (trainerDecision === "accepted" || organizerDecision === "accepted") {
    return "partial";
  }

  return "pending";
}

function resolveParticipantEnrollmentStatus(value) {
  return value === "cancelled" ? "cancelled" : "active";
}

function resolveOrganizerCollaborationStatus(event) {
  if (
    event.organizerCollaborationStatus === "accepted" ||
    event.organizerCollaborationStatus === "pending" ||
    event.organizerCollaborationStatus === "rejected" ||
    event.organizerCollaborationStatus === "not-required"
  ) {
    return event.organizerCollaborationStatus;
  }

  if (isCommunityBrandStatus(event.brandStatus) || event.selfManagedByTrainer || !event.organizerId) {
    return "not-required";
  }

  return "accepted";
}

function resolveTrainerCollaborationStatus(event) {
  if (
    event.trainerCollaborationStatus === "accepted" ||
    event.trainerCollaborationStatus === "pending" ||
    event.trainerCollaborationStatus === "rejected"
  ) {
    return event.trainerCollaborationStatus;
  }

  return "accepted";
}

function isSelfManagedTrainingEvent(event) {
  return isCommunityBrandStatus(event.brandStatus) || event.selfManagedByTrainer === true || !event.organizerId;
}

function isTrainingEventArchived(event) {
  return Boolean(event.archivedAt);
}

function isTrainingEventCollaborationAccepted(event) {
  if (isSelfManagedTrainingEvent(event)) {
    return true;
  }

  return (
    resolveTrainerCollaborationStatus(event) === "accepted" &&
    resolveOrganizerCollaborationStatus(event) === "accepted"
  );
}

function normalizeEventTags(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((tag) => asString(tag))
        .filter(Boolean),
    ),
  );
}

function normalizeScheduleDays(scheduleDays) {
  const normalizedDays = (Array.isArray(scheduleDays) ? scheduleDays : []).map((day) => {
    const startsAt = new Date(requiredString(day?.startsAt, "Podaj poprawny termin szkolenia."));
    const endsAt = new Date(requiredString(day?.endsAt, "Podaj poprawny termin szkolenia."));

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new HttpsError("invalid-argument", "Podaj poprawne daty szkolenia.");
    }

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new HttpsError("invalid-argument", "Każdy dzień szkolenia musi kończyć się po starcie.");
    }

    return {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };
  });

  if (normalizedDays.length === 0) {
    throw new HttpsError("invalid-argument", "Dodaj przynajmniej jeden dzień szkolenia.");
  }

  const sortedDays = [...normalizedDays].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );

  sortedDays.forEach((day, index) => {
    if (index === 0) {
      return;
    }

    const previousDay = new Date(sortedDays[index - 1].startsAt);
    const currentDay = new Date(day.startsAt);
    previousDay.setUTCHours(0, 0, 0, 0);
    currentDay.setUTCHours(0, 0, 0, 0);

    const diff = Math.round((currentDay.getTime() - previousDay.getTime()) / (1000 * 60 * 60 * 24));
    if (diff !== 1) {
      throw new HttpsError("invalid-argument", "Dni szkolenia muszą następować kolejno po sobie.");
    }
  });

  return sortedDays;
}

function getDefaultNotificationSettings() {
  return {
    reminderLeadDays: 7,
    sendToTrainer: true,
    sendToOrganizer: true,
    sendToParticipants: true,
    requireParticipantSmsConfirmation: false,
    reminderSmsTemplate:
      "Przypomnienie o szkoleniu {{event_title}} dnia {{event_date}} w {{event_location}}.",
    confirmationSmsTemplate:
      "Czy bierzesz udział w szkoleniu {{event_title}} dnia {{event_date}}? Tak: {{confirm_url}} Nie: {{decline_url}}",
  };
}

function normalizeNotificationSettings(value) {
  const defaults = getDefaultNotificationSettings();

  return {
    reminderLeadDays:
      typeof value?.reminderLeadDays === "number" && Number.isFinite(value.reminderLeadDays)
        ? Math.max(1, Math.min(30, Math.round(value.reminderLeadDays)))
        : defaults.reminderLeadDays,
    sendToTrainer:
      typeof value?.sendToTrainer === "boolean" ? value.sendToTrainer : defaults.sendToTrainer,
    sendToOrganizer:
      typeof value?.sendToOrganizer === "boolean"
        ? value.sendToOrganizer
        : defaults.sendToOrganizer,
    sendToParticipants:
      typeof value?.sendToParticipants === "boolean"
        ? value.sendToParticipants
        : defaults.sendToParticipants,
    requireParticipantSmsConfirmation:
      typeof value?.requireParticipantSmsConfirmation === "boolean"
        ? value.requireParticipantSmsConfirmation
        : defaults.requireParticipantSmsConfirmation,
    reminderSmsTemplate:
      typeof value?.reminderSmsTemplate === "string" && value.reminderSmsTemplate.trim()
        ? value.reminderSmsTemplate.trim()
        : defaults.reminderSmsTemplate,
    confirmationSmsTemplate:
      typeof value?.confirmationSmsTemplate === "string" && value.confirmationSmsTemplate.trim()
        ? value.confirmationSmsTemplate.trim()
        : defaults.confirmationSmsTemplate,
  };
}

function sanitizeNotificationSettingsInput(input) {
  const normalized = normalizeNotificationSettings(input);

  return {
    ...normalized,
    sendToParticipants:
      normalized.requireParticipantSmsConfirmation || normalized.sendToParticipants,
  };
}

function resolveNotificationSettingsOwnerRole(event) {
  if (event.organizerId && !isCommunityBrandStatus(event.brandStatus) && !event.selfManagedByTrainer) {
    return "organizer";
  }

  return "trainer";
}

function resolveAttendanceConfirmationStatus(value) {
  return value === "pending" || value === "confirmed" || value === "declined"
    ? value
    : "not-required";
}

function hashAttendanceToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function hashReviewToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function hashTrainerAuthorizationCode(code) {
  return createHash("sha256").update(requiredString(code, "Podaj kod trenera.")).digest("hex");
}

async function findOfficialTrainerByAuthorizationCode(code) {
  const authorizationCodeHash = hashTrainerAuthorizationCode(code);
  const snapshot = await db
    .collection(collections.trainers)
    .where("authorizationCodeHash", "==", authorizationCodeHash)
    .limit(2)
    .get();
  const matches = snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter((trainer) => !isCommunityBrandStatus(trainer.brandStatus));

  if (matches.length === 0) {
    throw new HttpsError("invalid-argument", "Kod trenera jest nieprawidłowy.");
  }

  if (matches.length > 1) {
    throw new HttpsError(
      "failed-precondition",
      "Ten kod trenera nie jest jednoznaczny. Ustaw nowy kod i spróbuj ponownie.",
    );
  }

  return matches[0];
}

function buildAttendanceDecisionUrl(token, decision) {
  return `${PUBLIC_APP_BASE_URL.replace(/\/$/, "")}/potwierdzenie-udzialu/${token}/${decision}`;
}

function buildCommunityEventReviewUrl(token) {
  return `${PUBLIC_APP_BASE_URL.replace(/\/$/, "")}/moderacja-wydarzenia/${token}`;
}

function formatEventDateForSms(event) {
  const firstDay = getTrainingEventScheduleDays(event)[0] ?? {
    startsAt: event.startsAt,
  };

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(firstDay.startsAt));
}

function renderSmsTemplate(template, values) {
  return String(template)
    .replaceAll("{{event_title}}", values.eventTitle ?? "")
    .replaceAll("{{event_date}}", values.eventDate ?? "")
    .replaceAll("{{event_location}}", values.eventLocation ?? "")
    .replaceAll("{{recipient_name}}", values.recipientName ?? "")
    .replaceAll("{{confirm_url}}", values.confirmUrl ?? "")
    .replaceAll("{{decline_url}}", values.declineUrl ?? "")
    .trim();
}

function buildAttendanceResetFields() {
  return {
    attendanceConfirmationStatus: "not-required",
    attendanceConfirmationRequestedAt: FieldValue.delete(),
    attendanceConfirmationRespondedAt: FieldValue.delete(),
    attendanceConfirmationTokenHash: FieldValue.delete(),
    attendanceConfirmationExpiresAt: FieldValue.delete(),
  };
}

function slugifyDisplayName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildRelationId(trainerId, organizerId) {
  return `${trainerId}__${organizerId}`;
}

async function requireDocument(collectionName, id, message) {
  const snapshot = await db.collection(collectionName).doc(id).get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", message);
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

async function findDocument(collectionName, id) {
  if (!id) {
    return null;
  }

  const snapshot = await db.collection(collectionName).doc(id).get();
  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function hasRole(user, role) {
  const roles = normalizeRoleList(user.roles);
  if (roles.length > 0) {
    return roles.includes(role);
  }

  return user.role === role || user.primaryRole === role;
}

async function requireCurrentUser(context, { allowAnonymous = false } = {}) {
  if (!context.auth?.uid) {
    throw new HttpsError("unauthenticated", "Zaloguj się ponownie i spróbuj jeszcze raz.");
  }

  const user = await db.collection(collections.users).doc(context.auth.uid).get();
  if (!allowAnonymous && !user.exists) {
    throw new HttpsError("permission-denied", "To konto nie ma jeszcze profilu aplikacyjnego.");
  }

  return {
    uid: context.auth.uid,
    user: user.exists ? { id: user.id, ...user.data() } : null,
  };
}

async function requireTrainerProfile(trainerId) {
  return requireDocument(collections.trainers, trainerId, "Nie znaleziono profilu Przekazującego Wiedzę.");
}

async function requireOrganizerProfile(organizerId) {
  return requireDocument(collections.organizers, organizerId, "Nie znaleziono profilu organizatora.");
}

async function requireEvent(eventId) {
  return requireDocument(collections.trainingEvents, eventId, "Nie znaleziono szkolenia.");
}

async function findTrainerProfile(trainerId) {
  return findDocument(collections.trainers, trainerId);
}

async function findOrganizerProfile(organizerId) {
  return findDocument(collections.organizers, organizerId);
}

async function findEvent(eventId) {
  return findDocument(collections.trainingEvents, eventId);
}

async function findAppUser(userId) {
  return findDocument(collections.users, userId);
}

async function requireAppUser(userId) {
  return requireDocument(collections.users, userId, "Nie znaleziono konta użytkownika.");
}

async function syncUserAccountApprovalState(userId) {
  const userRef = db.collection(collections.users).doc(userId);
  const userSnapshot = await userRef.get();

  if (!userSnapshot.exists) {
    return null;
  }

  const user = {
    id: userSnapshot.id,
    ...userSnapshot.data(),
  };
  const pendingRoles = normalizePendingRoles(user.pendingRoles);
  const selectedTrainerIds = normalizeStringList(user.selectedTrainerIds);
  const approvalsSnapshot = await db
    .collection(collections.trainerAccountApprovals)
    .where("requesterUserId", "==", userId)
    .get();
  const approvals = approvalsSnapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));
  const approvedTrainerIds = approvals
    .filter((approval) => approval.status === "accepted")
    .map((approval) => approval.targetTrainerId);
  const approvalStatus =
    approvals.length === 0 && user.accountApprovalStatus === "approved"
      ? "approved"
      : resolveAccountApprovalStatus(approvals);
  const unlockedRoles = resolveUnlockedRoles(pendingRoles, approvalStatus);
  const preferredRole = resolvePreferredRole(pendingRoles, approvalStatus);
  const nextPrimaryRole = unlockedRoles.includes(user.primaryRole) ? user.primaryRole : preferredRole;
  const nextRole = unlockedRoles.includes(user.role) ? user.role : nextPrimaryRole;

  await userRef.set(
    {
      accountApprovalStatus: approvalStatus,
      approvedTrainerIds,
      pendingRoles,
      selectedTrainerIds,
      roles: unlockedRoles,
      primaryRole: nextPrimaryRole,
      role: nextRole,
    },
    { merge: true },
  );

  return {
    ...user,
    accountApprovalStatus: approvalStatus,
    approvedTrainerIds,
    pendingRoles,
    selectedTrainerIds,
    roles: unlockedRoles,
    primaryRole: nextPrimaryRole,
    role: nextRole,
  };
}

async function attachEnrollmentsByPhoneToUser(userId, phoneNumber) {
  const normalizedPhone = normalizePhoneLookupKey(phoneNumber);
  if (!normalizedPhone) {
    return 0;
  }

  const matchingRequestsSnapshot = await db
    .collection(collections.enrollmentRequests)
    .where("normalizedPhone", "==", normalizedPhone)
    .get();

  if (matchingRequestsSnapshot.empty) {
    return 0;
  }

  const uniqueSubmitterIds = Array.from(
    new Set(
      matchingRequestsSnapshot.docs
        .map((snapshot) => asString(snapshot.get("submitterUid")))
        .filter(Boolean),
    ),
  );
  const userDocs = await Promise.all(uniqueSubmitterIds.map((candidateUid) => findAppUser(candidateUid)));
  const userDocsById = new Map(
    userDocs.filter(Boolean).map((entry) => [entry.id, entry]),
  );

  const batch = db.batch();
  let linkedCount = 0;

  matchingRequestsSnapshot.docs.forEach((snapshot) => {
    const submitterUid = asString(snapshot.get("submitterUid"));
    if (submitterUid === userId) {
      return;
    }

    const existingUser = submitterUid ? userDocsById.get(submitterUid) : null;
    if (existingUser && existingUser.id !== userId) {
      return;
    }

    batch.set(
      snapshot.ref,
      {
        submitterUid: userId,
        normalizedPhone,
      },
      { merge: true },
    );
    linkedCount += 1;
  });

  if (linkedCount > 0) {
    await batch.commit();
  }

  return linkedCount;
}

function resolvePhoneUserDisplayName(userRecord, authUser) {
  const existingDisplayName = asString(userRecord?.displayName);
  if (existingDisplayName) {
    return existingDisplayName;
  }

  const authDisplayName = asString(authUser?.displayName);
  if (authDisplayName) {
    return authDisplayName;
  }

  const phone = asString(authUser?.phoneNumber);
  if (phone) {
    return `Uczestnik ${phone.slice(-4)}`;
  }

  return "Uczestnik Emandar";
}

async function ensurePhoneParticipantAppUser(uid, { seedTrainerId } = {}) {
  const authUser = await auth.getUser(uid);
  const verifiedPhone = requiredString(
    authUser.phoneNumber,
    "Numer telefonu musi zostać najpierw potwierdzony kodem SMS.",
  );
  const userRef = db.collection(collections.users).doc(uid);
  const createdAt = nowIso();
  let accountCreated = false;

  await auth.setCustomUserClaims(uid, {
    ...(authUser.customClaims ?? {}),
    admin: false,
  });

  await db.runTransaction(async (transaction) => {
    const existingSnapshot = await transaction.get(userRef);
    const existingUser = existingSnapshot.exists
      ? { id: existingSnapshot.id, ...existingSnapshot.data() }
      : null;
    const existingRoles = normalizeRoleList(existingUser?.roles);
    const nextRoles =
      existingRoles.length > 0
        ? Array.from(new Set(["participant", ...existingRoles]))
        : ["participant"];
    const existingSelectedTrainerIds = normalizeStringList(existingUser?.selectedTrainerIds);
    const nextSelectedTrainerIds =
      existingSelectedTrainerIds.length === 0 && asString(seedTrainerId)
        ? [asString(seedTrainerId)]
        : existingSelectedTrainerIds;
    const preferredPrimaryRole =
      existingUser?.primaryRole && nextRoles.includes(existingUser.primaryRole)
        ? existingUser.primaryRole
        : nextRoles[0];
    const preferredActiveRole =
      existingUser?.role && nextRoles.includes(existingUser.role)
        ? existingUser.role
        : preferredPrimaryRole;

    if (!existingSnapshot.exists) {
      accountCreated = true;
    }

    transaction.set(
      userRef,
      {
        displayName: resolvePhoneUserDisplayName(existingUser, authUser),
        notes: asString(existingUser?.notes),
        referralSource: asString(existingUser?.referralSource),
        email: authUser.email ?? existingUser?.email ?? null,
        phone: verifiedPhone,
        authProvider: "phone",
        phoneVerifiedAt: createdAt,
        status: existingUser?.status ?? "active",
        role: preferredActiveRole,
        roles: nextRoles,
        primaryRole: preferredPrimaryRole,
        pendingRoles: normalizePendingRoles(existingUser?.pendingRoles),
        accountApprovalStatus:
          existingUser?.accountApprovalStatus === "pending" ||
          existingUser?.accountApprovalStatus === "rejected" ||
          existingUser?.accountApprovalStatus === "approved"
            ? existingUser.accountApprovalStatus
            : "approved",
        selectedTrainerIds: nextSelectedTrainerIds,
        approvedTrainerIds: normalizeStringList(existingUser?.approvedTrainerIds),
        participantOnboardingCompletedAt:
          typeof existingUser?.participantOnboardingCompletedAt === "string"
            ? existingUser.participantOnboardingCompletedAt
            : null,
        communityEventAutoApprove:
          typeof existingUser?.communityEventAutoApprove === "boolean"
            ? existingUser.communityEventAutoApprove
            : false,
        trainerProfileId: existingUser?.trainerProfileId ?? null,
        organizerProfileId: existingUser?.organizerProfileId ?? null,
        avatarUrl: asString(existingUser?.avatarUrl),
        avatarPath: existingUser?.avatarPath ?? null,
        createdAt: existingUser?.createdAt ?? createdAt,
      },
      { merge: true },
    );
  });

  await attachEnrollmentsByPhoneToUser(uid, verifiedPhone);
  return { ok: true, userId: uid, accountCreated };
}

async function resolveEnrollmentContactsForEvent(event) {
  const trainer = event.trainerId ? await findTrainerProfile(event.trainerId) : null;
  const organizer = event.organizerId ? await findOrganizerProfile(event.organizerId) : null;
  const leadUserId = asString(trainer?.userId) || asString(event.creatorUserId) || null;
  const leadUser = leadUserId ? await requireAppUser(leadUserId) : null;
  const organizerUser = organizer?.userId ? await requireAppUser(organizer.userId) : null;

  if (!leadUser) {
    throw new HttpsError(
      "failed-precondition",
      "To wydarzenie nie ma poprawnie przypisanego właściciela do obsługi zgłoszeń.",
    );
  }

  return {
    trainer,
    organizer,
    leadUser,
    organizerUser,
    leadName:
      asString(trainer?.displayName) ||
      asString(event.creatorDisplayName) ||
      asString(leadUser.displayName) ||
      "Gospodarz wydarzenia",
  };
}

async function findAdminUsers() {
  const [rolesSnapshot, roleSnapshot] = await Promise.all([
    db.collection(collections.users).where("roles", "array-contains", "admin").get(),
    db.collection(collections.users).where("role", "==", "admin").get(),
  ]);

  return Array.from(
    new Map(
      [...rolesSnapshot.docs, ...roleSnapshot.docs].map((snapshot) => [
        snapshot.id,
        { id: snapshot.id, ...snapshot.data() },
      ]),
    ).values(),
  );
}

async function findCommunityEventByReviewTokenHash(tokenHash) {
  const snapshot = await db
    .collection(collections.trainingEvents)
    .where("publicationReviewTokenHash", "==", tokenHash)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const docSnapshot = snapshot.docs[0];
  return {
    id: docSnapshot.id,
    ...docSnapshot.data(),
  };
}

async function queueCommunityEventReviewSms(event) {
  const adminUsers = await findAdminUsers();
  const reviewToken = randomUUID();
  const reviewTokenHash = hashReviewToken(reviewToken);
  const reviewUrl = buildCommunityEventReviewUrl(reviewToken);

  await db.collection(collections.trainingEvents).doc(event.id).set(
    {
      publicationReviewTokenHash: reviewTokenHash,
    },
    { merge: true },
  );

  await Promise.all(
    adminUsers.map((adminUser) =>
      createSmsDispatchOnce(`community-review__${event.id}__${adminUser.id}`, {
        eventId: event.id,
        requestId: null,
        leadDays: null,
        templateKind: "community-review",
        recipientRole: "admin",
        recipientProfileId: null,
        recipientUserId: adminUser.id,
        recipientName: adminUser.displayName || "Admin",
        recipientPhone: asString(adminUser.phone),
        message: `Nowe wydarzenie społeczności czeka na zatwierdzenie: ${event.title}. ${reviewUrl}`,
      }),
    ),
  );
}

async function notifyCommunityEventReviewResult(event, decision, message, reviewerId) {
  await db.collection(collections.trainingEvents).doc(event.id).set(
    {
      isPublished: decision === "accepted",
      publicationApprovalStatus: decision,
      publicationReviewedAt: nowIso(),
      publicationReviewedByUserId: reviewerId,
      publicationReviewMessage: message || null,
      publicationReviewTokenHash: FieldValue.delete(),
    },
    { merge: true },
  );

  if (event.creatorUserId || event.creatorPhone) {
    await createSmsDispatchOnce(`community-review-result__${event.id}`, {
      eventId: event.id,
      requestId: null,
      leadDays: null,
      templateKind: "community-review-result",
      recipientRole: "participant",
      recipientProfileId: null,
      recipientUserId: event.creatorUserId ?? null,
      recipientName: asString(event.creatorDisplayName, "Autor wydarzenia"),
      recipientPhone: asString(event.creatorPhone),
      message:
        decision === "accepted"
          ? `Twoje wydarzenie "${event.title}" zostało zatwierdzone. ${message || "Sprawdź szczegóły w panelu."}`
          : `Twoje wydarzenie "${event.title}" zostało odrzucone. ${message || "Sprawdź szczegóły w panelu."}`,
    });
  }
}

async function getRelationByPair(trainerId, organizerId) {
  const snapshot = await db.collection(collections.relations).doc(buildRelationId(trainerId, organizerId)).get();
  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

async function requireApprovedRelation(trainer, organizer) {
  const relation = await getRelationByPair(trainer.id, organizer.id);

  if (
    !relation ||
    relation.status !== "approved" ||
    relation.trainerUserId !== trainer.userId ||
    relation.organizerUserId !== organizer.userId
  ) {
    throw new HttpsError("failed-precondition", "Najpierw potrzebujesz zatwierdzonej relacji między trenerem i organizatorem.");
  }

  return relation;
}

function ensureEventCanAcceptEnrollment(event) {
  if (isTrainingEventArchived(event)) {
    throw new HttpsError("failed-precondition", "To szkolenie zostało zarchiwizowane i nie przyjmuje już zgłoszeń.");
  }

  if (!isTrainingEventCollaborationAccepted(event)) {
    throw new HttpsError("failed-precondition", "To szkolenie czeka jeszcze na pełną akceptację współpracy.");
  }

  if (resolveTrainingEventStatus(event.status) === "cancelled") {
    throw new HttpsError("failed-precondition", "To wydarzenie jest anulowane i nie przyjmuje nowych zgłoszeń.");
  }

  if (event.isPublished !== true) {
    throw new HttpsError("failed-precondition", "To szkolenie nie przyjmuje teraz zgłoszeń.");
  }
}

async function isEnrollmentPhotoRequired(event, trainer, organizer) {
  if (event.enrollmentPhotoRequirement === "required") {
    return true;
  }

  if (event.enrollmentPhotoRequirement === "optional") {
    return false;
  }

  if (event.organizerId) {
    return organizer?.defaultEnrollmentPhotoRequired === true;
  }

  return trainer?.defaultEnrollmentPhotoRequired === true;
}

async function ensureCommunityTrainerCanPublish(user) {
  const isApprovedAccount =
    user.accountApprovalStatus === "approved" || user.accountApprovalStatus == null;

  if (!isApprovedAccount) {
    throw new HttpsError(
      "failed-precondition",
      "Konto wydarzeń społeczności musi zostać wcześniej zaakceptowane przez trenera.",
    );
  }
}

function canManageTrainingEvent(event, actor) {
  if (actor.role === "admin") {
    return true;
  }

  if (actor.role === "organizer" && isTrainingEventArchived(event)) {
    return false;
  }

  if (actor.role === "trainer" && actor.trainerProfileId === event.trainerId) {
    return (
      isSelfManagedTrainingEvent(event) ||
      resolveTrainerCollaborationStatus(event) === "accepted" ||
      event.createdByRole === "trainer"
    );
  }

  if (actor.role === "organizer" && actor.organizerProfileId === event.organizerId) {
    return (
      resolveOrganizerCollaborationStatus(event) === "accepted" ||
      event.createdByRole === "organizer"
    );
  }

  if (actor.role === "participant" && actor.id === event.creatorUserId) {
    return true;
  }

  return false;
}

async function createNotification(userId, title, body, entityType) {
  if (!userId) {
    return;
  }

  await db.collection(collections.notifications).add({
    userId,
    title,
    body,
    entityType,
    createdAt: nowIso(),
  });
}

async function createNotifications(userIds, title, body, entityType) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  await Promise.all(uniqueUserIds.map((userId) => createNotification(userId, title, body, entityType)));
}

async function createSmsDispatchOnce(dispatchId, payload) {
  const dispatchRef = db.collection(collections.smsDispatches).doc(dispatchId);
  const existing = await dispatchRef.get();

  if (existing.exists) {
    return { created: false, status: existing.get("status") ?? "existing" };
  }

  const recipientPhone = asString(payload.recipientPhone);
  const providerConfigured = asString(process.env.EMANDAR_SMS_PROVIDER, "");
  const status = !recipientPhone
    ? "skipped-no-phone"
    : providerConfigured
      ? "pending-provider"
      : "skipped-no-provider";

  await dispatchRef.set({
    ...payload,
    recipientPhone,
    provider: providerConfigured || null,
    status,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  return { created: true, status };
}

function countAcceptedEnrollmentRequests(requests) {
  return requests.filter(
    (request) =>
      request.finalStatus === "accepted" &&
      resolveParticipantEnrollmentStatus(request.participantStatus) === "active",
  ).length;
}

function resolveManagedEventStatus(currentStatus, acceptedCount, minimumParticipants) {
  if (resolveTrainingEventStatus(currentStatus) === "cancelled") {
    return "cancelled";
  }

  return acceptedCount >= minimumParticipants ? "confirmed" : "active";
}

async function getEnrollmentRequestsForEvent(eventId) {
  const snapshot = await db
    .collection(collections.enrollmentRequests)
    .where("eventId", "==", eventId)
    .get();

  return snapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...docSnapshot.data(),
  }));
}

async function findEnrollmentRequestByTokenHash(tokenHash) {
  const snapshot = await db
    .collection(collections.enrollmentRequests)
    .where("attendanceConfirmationTokenHash", "==", tokenHash)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const docSnapshot = snapshot.docs[0];
  return {
    id: docSnapshot.id,
    ...docSnapshot.data(),
  };
}

async function syncEventEnrollmentState(eventId) {
  const event = await findEvent(eventId);
  if (!event) {
    return;
  }
  const requests = await getEnrollmentRequestsForEvent(eventId);
  const acceptedCount = countAcceptedEnrollmentRequests(requests);
  const capacity = Math.max(1, asNumber(event.capacity, 1));
  const minimumParticipants = Math.max(1, Math.min(capacity, resolveMinimumParticipants(event)));
  const nextStatus = resolveManagedEventStatus(event.status, acceptedCount, minimumParticipants);

  await db.collection(collections.trainingEvents).doc(eventId).set(
    {
      enrolledCount: acceptedCount,
      status: nextStatus,
      minimumParticipants,
    },
    { merge: true },
  );
}

function normalizeFeedUrl(url) {
  const trimmedUrl = asString(url);

  if (trimmedUrl.startsWith("webcal://")) {
    return `https://${trimmedUrl.slice("webcal://".length)}`;
  }

  return trimmedUrl;
}

async function fetchCalendarResponse(url) {
  const normalizedUrl = normalizeFeedUrl(url);

  try {
    const response = await fetch(normalizedUrl, {
      method: "GET",
      cache: "no-store",
    });

    if (response.ok) {
      return response;
    }
  } catch {
    // Fallback below.
  }

  const proxiedResponse = await fetch(
    `${PROXY_BASE_URL}${encodeURIComponent(normalizedUrl)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!proxiedResponse.ok) {
    throw new Error("Nie udało się pobrać feedu iCal.");
  }

  return proxiedResponse;
}

function clampIntervalToRange(startsAt, endsAt, rangeStart, rangeEnd) {
  const boundedStart = Math.max(startsAt.getTime(), rangeStart.getTime());
  const boundedEnd = Math.min(endsAt.getTime(), rangeEnd.getTime());

  if (boundedEnd <= boundedStart) {
    return null;
  }

  return {
    startsAt: new Date(boundedStart).toISOString(),
    endsAt: new Date(boundedEnd).toISOString(),
  };
}

function toJsDate(value) {
  return value ? value.toJSDate() : null;
}

async function fetchIcalBusyIntervals({ provider, sourceLabel, url, rangeStart, rangeEnd }) {
  const response = await fetchCalendarResponse(url);
  const rawCalendar = await response.text();
  const jcalData = ICAL.parse(rawCalendar);
  const component = new ICAL.Component(jcalData);
  const vevents = component.getAllSubcomponents("vevent");
  const busyIntervals = [];

  vevents.forEach((vevent) => {
    const event = new ICAL.Event(vevent);

    if (!event.startDate) {
      return;
    }

    if (event.isRecurring()) {
      const iterator = event.iterator();
      let occurrence = iterator.next();
      let guard = 0;

      while (occurrence && guard < 5000) {
        guard += 1;
        const details = event.getOccurrenceDetails(occurrence);
        const occurrenceStart = toJsDate(details.startDate);
        const occurrenceEnd = toJsDate(details.endDate);

        if (!occurrenceStart || !occurrenceEnd) {
          occurrence = iterator.next();
          continue;
        }

        if (occurrenceStart > rangeEnd) {
          break;
        }

        const boundedInterval = clampIntervalToRange(
          occurrenceStart,
          occurrenceEnd,
          rangeStart,
          rangeEnd,
        );

        if (boundedInterval) {
          busyIntervals.push({
            ...boundedInterval,
            source: "ical",
            sourceLabel: `${provider}:${sourceLabel}`,
          });
        }

        occurrence = iterator.next();
      }

      return;
    }

    const startsAt = toJsDate(event.startDate);
    const endsAt = toJsDate(event.endDate);
    if (!startsAt || !endsAt) {
      return;
    }

    const boundedInterval = clampIntervalToRange(startsAt, endsAt, rangeStart, rangeEnd);
    if (!boundedInterval) {
      return;
    }

    busyIntervals.push({
      ...boundedInterval,
      source: "ical",
      sourceLabel: `${provider}:${sourceLabel}`,
    });
  });

  return busyIntervals;
}

function mergeBusyIntervals(intervals) {
  const sortedIntervals = [...intervals]
    .filter((interval) => new Date(interval.endsAt).getTime() > new Date(interval.startsAt).getTime())
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());

  return sortedIntervals.reduce((merged, interval) => {
    const previous = merged[merged.length - 1];

    if (!previous) {
      merged.push({ ...interval });
      return merged;
    }

    if (new Date(interval.startsAt).getTime() <= new Date(previous.endsAt).getTime()) {
      if (new Date(interval.endsAt).getTime() > new Date(previous.endsAt).getTime()) {
        previous.endsAt = interval.endsAt;
      }
      previous.sourceLabel = previous.sourceLabel ?? interval.sourceLabel;
      return merged;
    }

    merged.push({ ...interval });
    return merged;
  }, []);
}

function formatMonthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function splitIntervalsByMonth(intervals) {
  const grouped = new Map();

  intervals.forEach((interval) => {
    const key = formatMonthKey(new Date(interval.startsAt));
    const existing = grouped.get(key) ?? [];
    existing.push(interval);
    grouped.set(key, existing);
  });

  return grouped;
}

function getAvailabilitySyncRange() {
  const rangeStart = new Date();
  rangeStart.setUTCMinutes(0, 0, 0);

  const rangeEnd = new Date(rangeStart);
  rangeEnd.setUTCFullYear(rangeEnd.getUTCFullYear() + 3);

  return { rangeStart, rangeEnd };
}

function getTrainingEventScheduleDays(event) {
  const scheduleDays = Array.isArray(event.scheduleDays)
    ? event.scheduleDays
    : [{ startsAt: event.startsAt, endsAt: event.endsAt }];

  return [...scheduleDays].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
}

async function rebuildTrainerExternalBusyMonths(trainer) {
  const { rangeStart, rangeEnd } = getAvailabilitySyncRange();
  const feedsSnapshot = await db
    .collection(collections.trainerCalendarFeeds)
    .where("trainerId", "==", trainer.id)
    .get();
  const eventsSnapshot = await db
    .collection(collections.trainingEvents)
    .where("trainerId", "==", trainer.id)
    .get();

  const enabledFeeds = feedsSnapshot.docs
    .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
    .filter((feed) => feed.enabled);
  const trainerEvents = eventsSnapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...docSnapshot.data(),
  }));
  const emandarIntervals = trainerEvents
    .filter(
      (event) =>
        !isTrainingEventArchived(event) &&
        resolveTrainingEventStatus(event.status) !== "cancelled",
    )
    .flatMap((event) =>
      getTrainingEventScheduleDays(event).map((day) => ({
        startsAt: day.startsAt,
        endsAt: day.endsAt,
        source: "emandar",
        sourceLabel: event.title || event.location,
      })),
    );

  const successfulIntervals = [];
  let successfulFeedCount = 0;

  for (const feed of enabledFeeds) {
    try {
      const fetchedIntervals = await fetchIcalBusyIntervals({
        provider: feed.provider,
        sourceLabel: feed.id,
        url: feed.url,
        rangeStart,
        rangeEnd,
      });

      successfulIntervals.push(...fetchedIntervals);
      successfulFeedCount += 1;
      await db.collection(collections.trainerCalendarFeeds).doc(feed.id).set(
        {
          lastSyncedAt: nowIso(),
          lastSyncStatus: "success",
          lastSyncError: FieldValue.delete(),
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    } catch (error) {
      await db.collection(collections.trainerCalendarFeeds).doc(feed.id).set(
        {
          lastSyncedAt: nowIso(),
          lastSyncStatus: "error",
          lastSyncError: error instanceof Error ? error.message : "Nie udało się pobrać feedu iCal.",
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    }
  }

  if (enabledFeeds.length > 0 && successfulFeedCount === 0) {
    return;
  }

  const mergedIntervals = mergeBusyIntervals([...emandarIntervals, ...successfulIntervals]);
  const groupedIntervals = splitIntervalsByMonth(mergedIntervals);
  const existingMonthDocs = await db
    .collection(collections.trainerExternalBusyMonths)
    .where("trainerId", "==", trainer.id)
    .get();
  const batch = db.batch();

  existingMonthDocs.docs.forEach((docSnapshot) => {
    batch.delete(docSnapshot.ref);
  });

  groupedIntervals.forEach((intervals, monthKey) => {
    const monthDocId = `${trainer.id}__${monthKey}`;
    batch.set(db.collection(collections.trainerExternalBusyMonths).doc(monthDocId), {
      trainerId: trainer.id,
      monthKey,
      intervals,
      updatedAt: nowIso(),
    });
  });

  await batch.commit();
}

function callableOptions() {
  return {
    region: FUNCTION_REGION,
    enforceAppCheck: shouldEnforceAppCheck,
  };
}

export const finalizePhoneRegistration = onCall(callableOptions(), async (request) => {
  const { uid } = await requireCurrentUser(request, { allowAnonymous: true });
  const authUser = await auth.getUser(uid);
  const payload = request.data ?? {};
  const displayName = requiredString(payload.displayName, "Podaj imię i nazwisko.");
  const notes = asString(payload.notes);
  const trainerAuthorizationCode = requiredString(
    payload.trainerAuthorizationCode,
    "Podaj kod trenera.",
  );
  const avatarPath = asString(payload.avatarPath);
  const avatarUrl = asString(payload.avatarUrl);
  const verifiedPhone = requiredString(
    authUser.phoneNumber,
    "Numer telefonu musi zostać najpierw potwierdzony kodem SMS.",
  );
  const globalSettings = await getPublicSettings();

  if (globalSettings.signupPhotoRequired === true && !avatarPath) {
    throw new HttpsError(
      "invalid-argument",
      "Aktualnie zdjęcie jest wymagane przy zakładaniu konta.",
    );
  }

  const trainer = await findOfficialTrainerByAuthorizationCode(trainerAuthorizationCode);
  const ensureResult = await ensurePhoneParticipantAppUser(uid, {
    seedTrainerId: trainer.id,
  });
  const currentUser = await requireAppUser(uid);
  const accountRequestRef = db
    .collection(collections.accountRequests)
    .doc(buildPhoneAccountRequestId(uid));
  const userRef = db.collection(collections.users).doc(uid);
  const createdAt = nowIso();

  const registrationResult = await db.runTransaction(async (transaction) => {
    const existingUserSnapshot = await transaction.get(userRef);
    const existingUser = existingUserSnapshot.exists
      ? { id: existingUserSnapshot.id, ...existingUserSnapshot.data() }
      : currentUser;
    const existingRolesInTransaction = normalizeRoleList(existingUser.roles);
    const nextRoles =
      existingRolesInTransaction.length > 0
        ? Array.from(new Set(["participant", ...existingRolesInTransaction]))
        : ["participant"];
    const nextPrimaryRole =
      existingUser.primaryRole && nextRoles.includes(existingUser.primaryRole)
        ? existingUser.primaryRole
        : nextRoles[0];
    const nextRole =
      existingUser.role && nextRoles.includes(existingUser.role)
        ? existingUser.role
        : nextPrimaryRole;
    const nextSelectedTrainerIds = Array.from(
      new Set([trainer.id, ...normalizeStringList(existingUser.selectedTrainerIds)]),
    );
    const nextApprovedTrainerIds = Array.from(
      new Set([trainer.id, ...normalizeStringList(existingUser.approvedTrainerIds)]),
    );

    transaction.set(userRef, {
      displayName,
      notes,
      referralSource: asString(existingUser.referralSource),
      email: authUser.email ?? null,
      phone: verifiedPhone,
      avatarUrl: avatarUrl || "",
      avatarPath: avatarPath || null,
      authProvider: "phone",
      phoneVerifiedAt: createdAt,
      status: existingUser.status ?? "active",
      role: nextRole,
      roles: nextRoles,
      primaryRole: nextPrimaryRole,
      pendingRoles: [],
      accountApprovalStatus: "approved",
      selectedTrainerIds: nextSelectedTrainerIds,
      approvedTrainerIds: nextApprovedTrainerIds,
      trainerProfileId: existingUser.trainerProfileId ?? null,
      organizerProfileId: existingUser.organizerProfileId ?? null,
      participantOnboardingCompletedAt: createdAt,
      createdAt: existingUser.createdAt ?? createdAt,
      communityEventAutoApprove:
        typeof existingUser.communityEventAutoApprove === "boolean"
          ? existingUser.communityEventAutoApprove
          : false,
    });

    transaction.set(accountRequestRef, {
      displayName,
      email: authUser.email ?? null,
      phone: verifiedPhone,
      requestedRoles: ["participant"],
      notes,
      referralSource: asString(existingUser.referralSource),
      status: "approved",
      authProvider: "phone",
      selectedTrainerIds: nextSelectedTrainerIds,
      avatarPath: avatarPath || null,
      avatarUrl: avatarUrl || "",
      submitterUid: uid,
      createdAt,
      reviewedAt: createdAt,
      reviewedByUserId: "phone-self-service",
      createdUserId: uid,
      trainerProfileId: existingUser.trainerProfileId ?? null,
      organizerProfileId: existingUser.organizerProfileId ?? null,
    }, { merge: true });

    return { accountCreated: !existingUserSnapshot.exists };
  });

  return {
    ok: true,
    userId: uid,
    trainerId: trainer.id,
    accountCreated: ensureResult.accountCreated || registrationResult.accountCreated,
  };
});

export const ensurePhoneParticipantProfile = onCall(callableOptions(), async (request) => {
  const { uid, user } = await requireCurrentUser(request, { allowAnonymous: true });
  const seedTrainerId = asString(request.data?.seedTrainerId);
  const trainerAuthorizationCode = asString(request.data?.trainerAuthorizationCode);

  if (trainerAuthorizationCode) {
    if (!user) {
      throw new HttpsError("permission-denied", "Musisz być zalogowany.");
    }

    if (!hasRole(user, "participant") && !hasRole(user, "organizer")) {
      throw new HttpsError(
        "failed-precondition",
        "Najpierw potrzebujesz aktywnego konta uczestnika.",
      );
    }

    const trainer = await findOfficialTrainerByAuthorizationCode(trainerAuthorizationCode);
    const currentUser = await requireAppUser(uid);
    const userRef = db.collection(collections.users).doc(uid);
    const organizerProfileId = currentUser.organizerProfileId || createId("organizer");
    const organizerRef = db.collection(collections.organizers).doc(organizerProfileId);
    const relationRef = db
      .collection(collections.relations)
      .doc(buildRelationId(trainer.id, organizerProfileId));
    const createdAt = nowIso();
    let organizerProfileCreated = false;

    await db.runTransaction(async (transaction) => {
      const existingUserSnapshot = await transaction.get(userRef);
      const existingUser = existingUserSnapshot.exists
        ? { id: existingUserSnapshot.id, ...existingUserSnapshot.data() }
        : currentUser;
      const existingRoles = normalizeRoleList(existingUser.roles);
      const nextRoles = existingRoles.includes("organizer")
        ? existingRoles
        : Array.from(new Set([...existingRoles, "organizer"]));
      const nextPrimaryRole =
        existingUser.primaryRole && nextRoles.includes(existingUser.primaryRole)
          ? existingUser.primaryRole
          : "participant";
      const nextRole =
        existingUser.role && nextRoles.includes(existingUser.role)
          ? existingUser.role
          : nextPrimaryRole;
      const nextSelectedTrainerIds = Array.from(
        new Set([trainer.id, ...normalizeStringList(existingUser.selectedTrainerIds)]),
      );
      const nextApprovedTrainerIds = Array.from(
        new Set([trainer.id, ...normalizeStringList(existingUser.approvedTrainerIds)]),
      );

      transaction.set(
        userRef,
        {
          roles: nextRoles,
          role: nextRole,
          primaryRole: nextPrimaryRole,
          organizerProfileId,
          selectedTrainerIds: nextSelectedTrainerIds,
          approvedTrainerIds: nextApprovedTrainerIds,
          pendingRoles: normalizePendingRoles(existingUser.pendingRoles).filter(
            (role) => role !== "organizer",
          ),
          accountApprovalStatus: "approved",
        },
        { merge: true },
      );

      if (!existingUser.organizerProfileId) {
        organizerProfileCreated = true;
        transaction.set(organizerRef, {
          userId: uid,
          displayName: asString(existingUser.displayName),
          description: asString(existingUser.notes),
          isVisible: false,
          contactName:
            asString(existingUser.displayName).split(/\s+/)[0] ||
            asString(existingUser.displayName),
          location: "",
          defaultEnrollmentPhotoRequired: false,
          notificationSettings: getDefaultNotificationSettings(),
        });
      }

      transaction.set(
        relationRef,
        {
          trainerId: trainer.id,
          organizerId: organizerProfileId,
          trainerUserId: trainer.userId,
          organizerUserId: uid,
          status: "approved",
          requestedBy: "organizer",
          createdAt,
        },
        { merge: true },
      );
    });

    return { ok: true, trainerId: trainer.id, organizerProfileCreated };
  }

  return ensurePhoneParticipantAppUser(uid, {
    seedTrainerId,
  });
});

export const getCommunityEventReview = onCall(callableOptions(), async (request) => {
  const token = requiredString(request.data?.token, "Brak tokenu moderacji.");
  const event = await findCommunityEventByReviewTokenHash(hashReviewToken(token));

  if (!event) {
    throw new HttpsError("not-found", "Nie znaleziono wydarzenia do moderacji.");
  }

  return {
    ok: true,
    event,
    creatorName: asString(event.creatorDisplayName, "Autor wydarzenia"),
    creatorPhone: asString(event.creatorPhone),
  };
});

export const reviewCommunityEvent = onCall(callableOptions(), async (request) => {
  const token = requiredString(request.data?.token, "Brak tokenu moderacji.");
  const decision =
    request.data?.decision === "accepted" || request.data?.decision === "rejected"
      ? request.data.decision
      : null;
  const message = asString(request.data?.message);

  if (!decision) {
    throw new HttpsError("invalid-argument", "Podaj poprawną decyzję moderacji.");
  }

  const event = await findCommunityEventByReviewTokenHash(hashReviewToken(token));

  if (!event) {
    throw new HttpsError("not-found", "Nie znaleziono wydarzenia do moderacji.");
  }

  if (!isCommunityBrandStatus(event.brandStatus)) {
    throw new HttpsError("failed-precondition", "Ten link dotyczy tylko wydarzeń społeczności.");
  }

  if (event.publicationApprovalStatus === "accepted" || event.publicationApprovalStatus === "rejected") {
    throw new HttpsError("failed-precondition", "To wydarzenie zostało już wcześniej obsłużone.");
  }

  const adminUsers = await findAdminUsers();
  const reviewerId = adminUsers[0]?.id ?? "community-review-link";

  await notifyCommunityEventReviewResult(event, decision, message, reviewerId);

  return {
    ok: true,
    eventId: event.id,
  };
});

export const approveAccountRequest = onCall(callableOptions(), async (request) => {
  if (request.auth?.token?.admin !== true) {
    throw new HttpsError("permission-denied", "Tylko admin może obsługiwać rejestracje.");
  }

  const { uid } = await requireCurrentUser(request);
  const requestId = requiredString(request.data?.requestId, "Brak identyfikatora wniosku.");
  const requestRef = db.collection(collections.accountRequests).doc(requestId);
  const accountRequest = await requestRef.get();

  if (!accountRequest.exists) {
    throw new HttpsError("not-found", "Nie znaleziono wniosku o konto.");
  }

  const data = accountRequest.data();
  if (data.status !== "pending") {
    throw new HttpsError("failed-precondition", "Ten wniosek został już wcześniej obsłużony.");
  }

  const requestedRoles = normalizeRequestedRoles(data.requestedRoles);
  if (requestedRoles.length === 0) {
    throw new HttpsError("failed-precondition", "Wniosek nie zawiera żadnego poprawnego zakresu.");
  }

  let authUser;
  try {
    authUser = await auth.createUser({
      email: data.email,
      displayName: data.displayName,
    });
  } catch (error) {
    if (error?.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Konto z tym adresem email już istnieje.");
    }

    throw error;
  }

  const trainerProfileId = requestedRoles.includes("trainer") ? createId("trainer") : null;
  const organizerProfileId = requestedRoles.includes("organizer") ? createId("organizer") : null;
  const primaryRole = requestedRoles.includes("organizer") ? "organizer" : "trainer";
  const passwordResetLink = await auth.generatePasswordResetLink(data.email);

  await auth.setCustomUserClaims(authUser.uid, {
    admin: false,
  });

  const batch = db.batch();
  batch.set(db.collection(collections.users).doc(authUser.uid), {
    displayName: data.displayName,
    email: data.email,
    phone: data.phone,
    avatarUrl: "",
    status: "active",
    role: primaryRole,
    roles: requestedRoles,
    primaryRole,
    trainerProfileId,
    organizerProfileId,
    createdAt: nowIso(),
  });

  if (trainerProfileId) {
    batch.set(db.collection(collections.trainers).doc(trainerProfileId), {
      userId: authUser.uid,
      slug: slugifyDisplayName(data.displayName),
      displayName: data.displayName,
      sortOrder: 999,
      bio: asString(data.notes) || "Nowy profil oczekuje na uzupełnienie opisu.",
      specialties: [],
      locations: [],
      isVisible: false,
      heroNote: "Profil w trakcie konfiguracji.",
      avatarUrl: "",
      brandStatus: "supported",
      authorizationCodeConfigured: false,
      notificationSettings: getDefaultNotificationSettings(),
    });
  }

  if (organizerProfileId) {
    batch.set(db.collection(collections.organizers).doc(organizerProfileId), {
      userId: authUser.uid,
      displayName: data.displayName,
      description: asString(data.notes) || "Nowy organizator oczekuje na uzupełnienie profilu.",
      isVisible: false,
      contactName: asString(data.displayName).split(/\s+/)[0] ?? data.displayName,
      location: "",
      notificationSettings: getDefaultNotificationSettings(),
    });
  }

  batch.set(
    requestRef,
    {
      status: "approved",
      reviewedAt: nowIso(),
      reviewedByUserId: uid,
      createdUserId: authUser.uid,
      trainerProfileId,
      organizerProfileId,
      passwordResetLink,
    },
    { merge: true },
  );
  await batch.commit();

  return {
    ok: true,
    userId: authUser.uid,
  };
});

export const rejectAccountRequest = onCall(callableOptions(), async (request) => {
  if (request.auth?.token?.admin !== true) {
    throw new HttpsError("permission-denied", "Tylko admin może obsługiwać rejestracje.");
  }

  const { uid } = await requireCurrentUser(request);
  const requestId = requiredString(request.data?.requestId, "Brak identyfikatora wniosku.");
  const requestRef = db.collection(collections.accountRequests).doc(requestId);
  const accountRequest = await requestRef.get();

  if (!accountRequest.exists) {
    throw new HttpsError("not-found", "Nie znaleziono wniosku o konto.");
  }

  if (accountRequest.get("status") !== "pending") {
    throw new HttpsError("failed-precondition", "Ten wniosek został już wcześniej obsłużony.");
  }

  await requestRef.set(
    {
      status: "rejected",
      reviewedAt: nowIso(),
      reviewedByUserId: uid,
    },
    { merge: true },
  );

  return { ok: true };
});

export const decideTrainerAccountApproval = onCall(callableOptions(), async (request) => {
  const { user } = await requireCurrentUser(request);
  if (!user) {
    throw new HttpsError("permission-denied", "Musisz być zalogowany.");
  }

  const approvalId = requiredString(request.data?.approvalId, "Brak identyfikatora zgody.");
  const status =
    request.data?.status === "accepted" || request.data?.status === "rejected"
      ? request.data.status
      : null;

  if (!status) {
    throw new HttpsError("invalid-argument", "Podaj poprawny status zgody.");
  }

  const approvalRef = db.collection(collections.trainerAccountApprovals).doc(approvalId);
  const approvalSnapshot = await approvalRef.get();

  if (!approvalSnapshot.exists) {
    throw new HttpsError("not-found", "Nie znaleziono prośby o zatwierdzenie konta.");
  }

  const approval = {
    id: approvalSnapshot.id,
    ...approvalSnapshot.data(),
  };

  if (user.role !== "admin" && approval.targetTrainerUserId !== user.id) {
    throw new HttpsError("permission-denied", "Nie możesz podjąć decyzji dla tej zgody.");
  }

  await approvalRef.set(
    {
      status,
      decidedAt: nowIso(),
      decidedByUserId: user.id,
    },
    { merge: true },
  );
  const syncedUser = await syncUserAccountApprovalState(approval.requesterUserId);

  await createNotification(
    approval.requesterUserId,
    "Zmieniono status zatwierdzenia konta",
    status === "accepted"
      ? "Jeden z trenerów zaakceptował Twoje konto. Jeśli wybrano dodatkowe role, zostały właśnie odblokowane."
      : syncedUser?.accountApprovalStatus === "rejected"
        ? "Wszyscy wybrani trenerzy odrzucili Twoje konto. Nadal możesz śledzić własne zgłoszenia jako uczestnik."
        : "Jedna z próśb o zatwierdzenie konta została odrzucona. Konto nadal czeka na pozostałych trenerów.",
    "auth",
  );

  return { ok: true };
});

export const createUnifiedTrainingEvent = onCall(callableOptions(), async (request) => {
  const { user } = await requireCurrentUser(request);
  if (!user) {
    throw new HttpsError("permission-denied", "Musisz być zalogowany.");
  }

  const input = request.data ?? {};
  const requestedBrandStatus = resolveBrandStatus(input.brandStatus);
  const isParticipantCommunityCreate =
    user.role === "participant" && requestedBrandStatus === "supported";
  const isParticipantOfficialCreate =
    user.role === "participant" && requestedBrandStatus === "official";

  if (
    !isParticipantCommunityCreate &&
    !isParticipantOfficialCreate &&
    (
      (user.role !== "trainer" && user.role !== "organizer") ||
      (user.role === "trainer" && !user.trainerProfileId) ||
      (user.role === "organizer" && !user.organizerProfileId)
    )
  ) {
    throw new HttpsError(
      "permission-denied",
      "Tylko zalogowany uczestnik, Przekazujący Wiedzę albo organizator może tworzyć wydarzenia.",
    );
  }

  const actingOrganizer =
    user.role === "organizer" || isParticipantOfficialCreate
      ? await requireOrganizerProfile(
          requiredString(user.organizerProfileId, "Najpierw połącz się z trenerem."),
        )
      : null;
  const actingTrainer =
    user.role === "trainer" ? await requireTrainerProfile(user.trainerProfileId) : null;
  const trainer =
    user.role === "participant"
      ? isParticipantCommunityCreate
        ? null
        : input.trainerId
          ? await requireTrainerProfile(
              requiredString(
                input.trainerId,
                "Najpierw wybierz Przekazującego Wiedzę dla szkolenia.",
              ),
            )
          : null
      : user.role === "trainer"
      ? actingTrainer
      : input.trainerId
        ? await requireTrainerProfile(requiredString(input.trainerId, "Najpierw wybierz Przekazującego Wiedzę dla szkolenia."))
        : null;

  if (!isParticipantCommunityCreate && !trainer) {
    throw new HttpsError("invalid-argument", "Najpierw wybierz Przekazującego Wiedzę dla szkolenia.");
  }

  const brandStatus =
    isParticipantCommunityCreate
      ? "supported"
      : isParticipantOfficialCreate
        ? "official"
      : user.role === "trainer"
      ? resolveBrandStatus(input.brandStatus ?? trainer.brandStatus)
      : "official";
  const isCommunityTrainer = isCommunityBrandStatus(brandStatus);

  if (isParticipantCommunityCreate && !isCommunityTrainer) {
    throw new HttpsError(
      "failed-precondition",
      "Uczestnik może tworzyć tylko wydarzenia społeczności.",
    );
  }

  if (user.role === "organizer" && isCommunityTrainer) {
    throw new HttpsError("failed-precondition", "Organizator może tworzyć tylko oficjalne szkolenia.");
  }

  if (isParticipantOfficialCreate && trainer && isCommunityBrandStatus(trainer.brandStatus)) {
    throw new HttpsError("failed-precondition", "Ten kod działa tylko dla oficjalnych szkoleń Emandar.");
  }

  if (user.role === "organizer" && trainer && isCommunityBrandStatus(trainer.brandStatus)) {
    throw new HttpsError("failed-precondition", "Wydarzenia społeczności pozostają po stronie ich właściciela.");
  }

  const shouldAutoPublishCommunityEvent = false;

  const selfManagedByTrainer =
    user.role === "participant"
      ? isParticipantCommunityCreate
      : user.role === "trainer" && !isCommunityTrainer
      ? Boolean(input.selfManagedByTrainer || !input.organizerId)
      : false;
  const organizer =
    isCommunityTrainer || selfManagedByTrainer
      ? null
      : user.role === "organizer" || isParticipantOfficialCreate
        ? actingOrganizer
        : input.organizerId
          ? await requireOrganizerProfile(requiredString(input.organizerId, "Najpierw wybierz organizatora dla szkolenia."))
          : null;

  if (!isCommunityTrainer && !selfManagedByTrainer && !organizer) {
    throw new HttpsError("invalid-argument", "Najpierw wybierz organizatora dla szkolenia.");
  }

  if (!isCommunityTrainer && !selfManagedByTrainer && organizer) {
    await requireApprovedRelation(trainer, organizer);
  }

  const normalizedScheduleDays = normalizeScheduleDays(input.scheduleDays);
  const firstScheduleDay = normalizedScheduleDays[0];
  const lastScheduleDay = normalizedScheduleDays[normalizedScheduleDays.length - 1];
  const trimmedLocation = requiredString(input.location, "Podaj lokalizację wydarzenia.");
  const normalizedTags = normalizeEventTags(input.tags);
  const normalizedEventImages = isCommunityTrainer ? normalizeEventImages(input.eventImages) : [];
  const useEventImageAsCover =
    isCommunityTrainer &&
    input.useEventImageAsCover === true &&
    normalizedEventImages.length > 0;
  const capacity = Math.max(1, asNumber(input.capacity, 1));
  const minimumParticipants = Math.max(
    1,
    Math.min(capacity, asNumber(input.minimumParticipants, capacity)),
  );
  const eventTitle = isCommunityTrainer
    ? requiredString(input.title, "Podaj tytuł wydarzenia społeczności.")
    : trimmedLocation;

  const eventPayload = {
    trainerId: trainer?.id ?? null,
    organizerId: organizer?.id ?? null,
    trainerUserId: trainer?.userId ?? null,
    organizerUserId: organizer?.userId ?? null,
    creatorUserId: user.role === "participant" ? user.id : null,
    creatorDisplayName: user.role === "participant" ? user.displayName : null,
    creatorAvatarUrl: user.role === "participant" ? asString(user.avatarUrl) : null,
    creatorPhone: user.role === "participant" ? asString(user.phone) : null,
    eventImages: normalizedEventImages,
    useEventImageAsCover,
    title: eventTitle,
    summary: requiredString(input.summary, "Podaj krótki opis szkolenia."),
    description: requiredString(input.description, "Podaj pełny opis szkolenia."),
    type: requiredString(input.type, "Podaj typ szkolenia."),
    startsAt: firstScheduleDay.startsAt,
    endsAt: lastScheduleDay.endsAt,
    scheduleDays: normalizedScheduleDays,
    location: trimmedLocation,
    tags: normalizedTags,
    capacity,
    enrolledCount: 0,
    isPublished: isCommunityTrainer
      ? shouldAutoPublishCommunityEvent
      : Boolean(input.isPublished),
    imageHint: trimmedLocation.split(/\s+/)[0]?.toLowerCase() || "event",
    brandStatus,
    status: resolveTrainingEventStatus(input.status),
    minimumParticipants,
    requiresOrganizerApproval: !isCommunityTrainer && !selfManagedByTrainer,
    trainerCollaborationStatus:
      isCommunityTrainer || user.role === "trainer" || isParticipantOfficialCreate
        ? "accepted"
        : "pending",
    organizerCollaborationStatus:
      isCommunityTrainer || selfManagedByTrainer
        ? "not-required"
        : user.role === "organizer" || isParticipantOfficialCreate
          ? "accepted"
          : "pending",
    selfManagedByTrainer: isCommunityTrainer ? true : selfManagedByTrainer,
    createdByRole: user.role,
    publicationApprovalStatus: isCommunityTrainer
      ? shouldAutoPublishCommunityEvent
        ? "accepted"
        : "pending"
      : null,
    publicationApprovalRequestedAt:
      isCommunityTrainer && !shouldAutoPublishCommunityEvent ? nowIso() : null,
    publicationReviewedAt:
      isCommunityTrainer && shouldAutoPublishCommunityEvent ? nowIso() : null,
    publicationReviewedByUserId:
      isCommunityTrainer && shouldAutoPublishCommunityEvent ? user.id : null,
    publicationReviewMessage: null,
    publicationReviewTokenHash: null,
    enrollmentPhotoRequirement:
      input.enrollmentPhotoRequirement === "required" ||
      input.enrollmentPhotoRequirement === "optional"
        ? input.enrollmentPhotoRequirement
        : "default",
  };

  const docRef = await db.collection(collections.trainingEvents).add(eventPayload);

  if (isCommunityTrainer && !shouldAutoPublishCommunityEvent) {
    await queueCommunityEventReviewSms({
      id: docRef.id,
      ...eventPayload,
    });
  }

  return {
    ok: true,
    eventId: docRef.id,
  };
});

export const createEnrollmentDraft = onCall(callableOptions(), async (request) => {
  const { uid } = await requireCurrentUser(request, { allowAnonymous: true });
  const input = request.data ?? {};
  const eventId = requiredString(input.eventId, "Brak identyfikatora szkolenia.");
  const participantPhone = requiredString(input.telefon, "Podaj numer telefonu.");
  const event = await requireEvent(eventId);
  ensureEventCanAcceptEnrollment(event);

  const { trainer, organizer, leadUser, organizerUser, leadName } =
    await resolveEnrollmentContactsForEvent(event);
  const requiresOrganizerApproval =
    event.requiresOrganizerApproval ?? !isCommunityBrandStatus(event.brandStatus);
  const photoRequired = await isEnrollmentPhotoRequired(event, trainer, organizer);
  const requestRef = db.collection(collections.enrollmentRequests).doc();

  await requestRef.set({
    eventId: event.id,
    trainerId: event.trainerId ?? null,
    organizerId: event.organizerId ?? null,
    submitterUid: uid,
    trainerUserId: leadUser.id,
    organizerUserId: organizer?.userId ?? null,
    trainerContactName: leadName,
    trainerContactPhone: asString(leadUser.phone) || null,
    trainerContactEmail: asString(leadUser.email) || null,
    organizerContactPhone: asString(organizerUser?.phone) || null,
    organizerContactEmail: asString(organizerUser?.email) || null,
    organizerContactName: asString(organizer?.contactName || organizer?.displayName) || null,
    imieNazwisko: requiredString(input.imieNazwisko, "Podaj imię i nazwisko."),
    telefon: participantPhone,
    normalizedPhone: normalizePhoneLookupKey(participantPhone),
    polecenieOdKogo: asString(input.polecenieOdKogo),
    wiadomosc: asString(input.wiadomosc),
    photoStatus: "pending",
    trainerDecision: "pending",
    organizerDecision: "pending",
    finalStatus: "pending",
    attendanceConfirmationStatus: "not-required",
    requiresOrganizerApproval,
    photoRequired,
    createdAt: nowIso(),
  });

  return {
    ok: true,
    requestId: requestRef.id,
    photoPath: `enrollment-photos/${requestRef.id}/original`,
    photoRequired,
  };
});

export const finalizeEnrollmentDraft = onCall(callableOptions(), async (request) => {
  const { uid } = await requireCurrentUser(request, { allowAnonymous: true });
  const requestId = requiredString(request.data?.requestId, "Brak identyfikatora zgłoszenia.");
  const photoPath = asString(request.data?.photoPath);
  const avatarPath = asString(request.data?.avatarPath);
  const avatarUrl = asString(request.data?.avatarUrl);
  const requestRef = db.collection(collections.enrollmentRequests).doc(requestId);
  const enrollmentRequest = await requestRef.get();

  if (!enrollmentRequest.exists) {
    throw new HttpsError("not-found", "Nie znaleziono zgłoszenia.");
  }

  if (enrollmentRequest.get("submitterUid") !== uid) {
    throw new HttpsError("permission-denied", "To nie jest Twoje zgłoszenie.");
  }

  const photoRequired = enrollmentRequest.get("photoRequired") === true;

  if (!photoPath && photoRequired) {
    throw new HttpsError("invalid-argument", "To szkolenie wymaga zdjęcia twarzy.");
  }

  if (photoPath) {
    const [metadata] = await storage.bucket().file(photoPath).getMetadata();
    await requestRef.set(
      {
        photoStatus: "ready",
        photoPath,
        photoContentType: metadata.contentType ?? null,
        photoUploadedAt: nowIso(),
      },
      { merge: true },
    );
  } else {
    await requestRef.set(
      {
        photoStatus: "ready",
        photoPath: null,
        photoContentType: null,
      },
      { merge: true },
    );
  }

  const authUser = await auth.getUser(uid);
  const profileDisplayName = requiredString(
    enrollmentRequest.get("imieNazwisko"),
    "Brak imienia i nazwiska w zgłoszeniu.",
  );
  const profilePhone =
    asString(authUser.phoneNumber) ||
    requiredString(enrollmentRequest.get("telefon"), "Brak numeru telefonu w zgłoszeniu.");
  const profileReferralSource = asString(enrollmentRequest.get("polecenieOdKogo"));
  const profileNotes = asString(enrollmentRequest.get("wiadomosc"));
  const userRef = db.collection(collections.users).doc(uid);
  const accountRequestRef = db
    .collection(collections.accountRequests)
    .doc(buildPhoneAccountRequestId(uid));
  const userSnapshot = await userRef.get();
  const currentUser = userSnapshot.exists ? { id: userSnapshot.id, ...userSnapshot.data() } : null;

  await userRef.set(
    {
      displayName: profileDisplayName,
      phone: profilePhone,
      notes: profileNotes,
      referralSource: profileReferralSource,
      avatarPath: avatarPath || currentUser?.avatarPath || null,
      avatarUrl: avatarUrl || asString(currentUser?.avatarUrl),
      authProvider: "phone",
      phoneVerifiedAt: asString(currentUser?.phoneVerifiedAt) || nowIso(),
    },
    { merge: true },
  );

  await accountRequestRef.set(
    {
      displayName: profileDisplayName,
      email: authUser.email ?? null,
      phone: profilePhone,
      notes: profileNotes,
      referralSource: profileReferralSource,
      avatarPath: avatarPath || null,
      avatarUrl: avatarUrl || "",
      authProvider: "phone",
      requestedRoles: ["participant"],
      status: "approved",
      selectedTrainerIds: normalizeStringList(currentUser?.selectedTrainerIds),
      submitterUid: uid,
      createdUserId: uid,
      createdAt: asString(currentUser?.createdAt) || nowIso(),
      reviewedByUserId: "enrollment-self-service",
      reviewedAt: nowIso(),
    },
    { merge: true },
  );

  if (authUser.displayName !== profileDisplayName) {
    await auth.updateUser(uid, { displayName: profileDisplayName });
  }

  return {
    ok: true,
  };
});

export const decideEnrollment = onCall(callableOptions(), async (request) => {
  const { user } = await requireCurrentUser(request);
  if (!user) {
    throw new HttpsError("permission-denied", "Musisz być zalogowany.");
  }

  const requestId = requiredString(request.data?.requestId, "Brak identyfikatora zgłoszenia.");
  const decision =
    request.data?.decision === "accepted" || request.data?.decision === "rejected"
      ? request.data.decision
      : null;

  if (!decision) {
    throw new HttpsError("invalid-argument", "Podaj poprawną decyzję.");
  }

  const requestRef = db.collection(collections.enrollmentRequests).doc(requestId);
  const enrollmentRequest = await requestRef.get();
  if (!enrollmentRequest.exists) {
    throw new HttpsError("not-found", "Nie znaleziono zgłoszenia.");
  }

  const current = {
    id: enrollmentRequest.id,
    ...enrollmentRequest.data(),
  };
  const sourceEvent = await requireEvent(current.eventId);
  const organizer = current.organizerId ? await findOrganizerProfile(current.organizerId) : null;
  const updates = {};

  if (user.role === "admin") {
    updates.trainerDecision = decision;
    updates.organizerDecision = current.requiresOrganizerApproval ? decision : "pending";
  } else if (
    organizer &&
    user.role === "organizer" &&
    user.organizerProfileId === organizer.id
  ) {
    updates.organizerDecision = decision;
  } else if (canManageTrainingEvent(sourceEvent, user)) {
    updates.trainerDecision = decision;
  } else {
    throw new HttpsError("permission-denied", "Brak dostępu do tej decyzji.");
  }

  const finalStatus = deriveEnrollmentFinalStatus(
    updates.trainerDecision ?? current.trainerDecision,
    updates.organizerDecision ?? current.organizerDecision,
    current.requiresOrganizerApproval,
  );

  await requestRef.set(
    {
      ...updates,
      finalStatus,
      ...(finalStatus === "accepted" ? {} : buildAttendanceResetFields()),
    },
    { merge: true },
  );

  await syncEventEnrollmentState(current.eventId);

  return { ok: true };
});

export const manageEnrollmentRequest = onCall(callableOptions(), async (request) => {
  const { user } = await requireCurrentUser(request);
  if (!user) {
    throw new HttpsError("permission-denied", "Musisz być zalogowany.");
  }

  const input = request.data ?? {};
  const requestId = requiredString(input.requestId, "Brak identyfikatora zgłoszenia.");
  const decision =
    input.decision === "accepted" || input.decision === "rejected" || input.decision === "pending"
      ? input.decision
      : null;

  if (!decision) {
    throw new HttpsError("invalid-argument", "Podaj poprawną decyzję.");
  }

  const requestRef = db.collection(collections.enrollmentRequests).doc(requestId);
  const requestSnapshot = await requestRef.get();
  if (!requestSnapshot.exists) {
    throw new HttpsError("not-found", "Nie znaleziono zgłoszenia.");
  }

  const currentRequest = {
    id: requestSnapshot.id,
    ...requestSnapshot.data(),
  };
  const sourceEvent = await requireEvent(currentRequest.eventId);
  if (!canManageTrainingEvent(sourceEvent, user)) {
    throw new HttpsError("permission-denied", "Możesz zarządzać tylko zgłoszeniami do swoich wydarzeń.");
  }

  const targetEventId = asString(input.transferTargetEventId, "");
  const targetEvent = targetEventId ? await requireEvent(targetEventId) : sourceEvent;

  if (targetEventId && !canManageTrainingEvent(targetEvent, user)) {
    throw new HttpsError("permission-denied", "Możesz przenosić osoby tylko do swoich wydarzeń.");
  }

  const {
    trainer: targetTrainer,
    organizer: targetOrganizer,
    leadUser: targetLeadUser,
    organizerUser: targetOrganizerUser,
    leadName: targetLeadName,
  } = await resolveEnrollmentContactsForEvent(targetEvent);
  const targetRequiresOrganizerApproval =
    targetEvent.requiresOrganizerApproval ?? !isSelfManagedTrainingEvent(targetEvent);

  let nextTrainerDecision =
    !targetEventId || currentRequest.trainerId === targetEvent.trainerId
      ? currentRequest.trainerDecision
      : "pending";
  let nextOrganizerDecision =
    targetRequiresOrganizerApproval
      ? !targetEventId || currentRequest.organizerId === targetEvent.organizerId
        ? currentRequest.organizerDecision
        : "pending"
      : "pending";

  if (user.role === "trainer" && user.trainerProfileId === targetEvent.trainerId) {
    nextTrainerDecision = decision;
  } else if (
    user.role === "organizer" &&
    user.organizerProfileId === targetEvent.organizerId &&
    targetRequiresOrganizerApproval
  ) {
    nextOrganizerDecision = decision;
  } else if (user.role === "admin") {
    nextTrainerDecision = decision;
    nextOrganizerDecision = targetRequiresOrganizerApproval ? decision : "pending";
  }

  const nextFinalStatus = deriveEnrollmentFinalStatus(
    nextTrainerDecision,
    nextOrganizerDecision,
    targetRequiresOrganizerApproval,
  );

  await requestRef.set(
    {
      eventId: targetEvent.id,
      trainerId: targetEvent.trainerId ?? null,
      organizerId: targetEvent.organizerId ?? null,
      trainerUserId: targetLeadUser.id,
      organizerUserId: targetOrganizer?.userId ?? null,
      trainerContactName: targetLeadName,
      trainerContactPhone: asString(targetLeadUser.phone) || null,
      trainerContactEmail: asString(targetLeadUser.email) || null,
      organizerContactPhone: asString(targetOrganizerUser?.phone) || null,
      organizerContactEmail: asString(targetOrganizerUser?.email) || null,
      organizerContactName: asString(targetOrganizer?.contactName || targetOrganizer?.displayName) || null,
      trainerDecision: nextTrainerDecision,
      organizerDecision: nextOrganizerDecision,
      finalStatus: nextFinalStatus,
      ...(nextFinalStatus === "accepted" && targetEvent.id === currentRequest.eventId
        ? {}
        : buildAttendanceResetFields()),
      requiresOrganizerApproval: targetRequiresOrganizerApproval,
    },
    { merge: true },
  );

  await Promise.all([
    syncEventEnrollmentState(currentRequest.eventId),
    targetEvent.id === currentRequest.eventId ? Promise.resolve() : syncEventEnrollmentState(targetEvent.id),
  ]);

  if (targetEventId && targetEvent.id !== currentRequest.eventId) {
    await createNotifications(
      [targetLeadUser.id, targetOrganizer?.userId],
      "Przeniesiono zgłoszenie do szkolenia",
      `${currentRequest.imieNazwisko} zostało przeniesione do ${targetEvent.title}.`,
      "request",
    );
  }

  return { ok: true };
});

export const manageOwnEnrollment = onCall(callableOptions(), async (request) => {
  const { uid, user } = await requireCurrentUser(request);
  if (!user) {
    throw new HttpsError("permission-denied", "Musisz być zalogowany.");
  }

  const input = request.data ?? {};
  const requestId = requiredString(input.requestId, "Brak identyfikatora zgłoszenia.");
  const action = input.action === "cancel" || input.action === "transfer" ? input.action : null;

  if (!action) {
    throw new HttpsError("invalid-argument", "Podaj poprawną akcję uczestnika.");
  }

  const enrollmentRef = db.collection(collections.enrollmentRequests).doc(requestId);
  const enrollmentSnapshot = await enrollmentRef.get();
  if (!enrollmentSnapshot.exists) {
    throw new HttpsError("not-found", "Nie znaleziono zgłoszenia.");
  }

  const currentRequest = {
    id: enrollmentSnapshot.id,
    ...enrollmentSnapshot.data(),
  };

  if (currentRequest.submitterUid !== uid) {
    throw new HttpsError("permission-denied", "Możesz zarządzać tylko własnym zgłoszeniem.");
  }

  if (resolveParticipantEnrollmentStatus(currentRequest.participantStatus) === "cancelled") {
    throw new HttpsError("failed-precondition", "To zgłoszenie zostało już wcześniej anulowane.");
  }

  const sourceEvent = await requireEvent(currentRequest.eventId);
  const sourceEndsAt = new Date(sourceEvent.endsAt);
  if (
    isTrainingEventArchived(sourceEvent) ||
    (Number.isFinite(sourceEndsAt.getTime()) && sourceEndsAt.getTime() < Date.now())
  ) {
    throw new HttpsError("failed-precondition", "To szkolenie jest już w archiwum uczestnika.");
  }

  if (action === "cancel") {
    await enrollmentRef.set(
      {
        participantStatus: "cancelled",
        participantManagedAt: nowIso(),
        participantActionSource: "participant",
        ...buildAttendanceResetFields(),
      },
      { merge: true },
    );

    await syncEventEnrollmentState(sourceEvent.id);
    await createNotifications(
      [currentRequest.trainerUserId, currentRequest.organizerUserId],
      "Uczestnik zrezygnował ze szkolenia",
      `${currentRequest.imieNazwisko} zrezygnował(a) z udziału w ${sourceEvent.title}.`,
      "request",
    );

    return { ok: true };
  }

  const targetEventId = requiredString(
    input.transferTargetEventId,
    "Wybierz docelowe szkolenie do przeniesienia.",
  );
  if (targetEventId === sourceEvent.id) {
    throw new HttpsError("failed-precondition", "Wybierz inne szkolenie docelowe.");
  }

  const targetEvent = await requireEvent(targetEventId);
  ensureEventCanAcceptEnrollment(targetEvent);

  const targetEndsAt = new Date(targetEvent.endsAt);
  if (Number.isFinite(targetEndsAt.getTime()) && targetEndsAt.getTime() <= Date.now()) {
    throw new HttpsError("failed-precondition", "Nie możesz przenieść się na zakończone szkolenie.");
  }

  if (targetEvent.type !== sourceEvent.type) {
    throw new HttpsError("failed-precondition", "Możesz przenieść się tylko na szkolenie tego samego typu.");
  }

  const targetRequests = await getEnrollmentRequestsForEvent(targetEvent.id);
  if (countAcceptedEnrollmentRequests(targetRequests) >= Math.max(1, asNumber(targetEvent.capacity, 1))) {
    throw new HttpsError("failed-precondition", "To szkolenie nie ma już wolnych miejsc.");
  }

  const {
    trainer: targetTrainer,
    organizer: targetOrganizer,
    leadUser: targetLeadUser,
    organizerUser: targetOrganizerUser,
    leadName: targetLeadName,
  } = await resolveEnrollmentContactsForEvent(targetEvent);
  const targetRequiresOrganizerApproval =
    targetEvent.requiresOrganizerApproval ?? !isSelfManagedTrainingEvent(targetEvent);

  const nextTrainerDecision =
    currentRequest.trainerId === targetEvent.trainerId ? currentRequest.trainerDecision : "pending";
  const nextOrganizerDecision = targetRequiresOrganizerApproval
    ? currentRequest.organizerId === targetEvent.organizerId
      ? currentRequest.organizerDecision
      : "pending"
    : "pending";

  await enrollmentRef.set(
    {
      eventId: targetEvent.id,
      trainerId: targetEvent.trainerId ?? null,
      organizerId: targetEvent.organizerId ?? null,
      trainerUserId: targetLeadUser.id,
      organizerUserId: targetOrganizer?.userId ?? null,
      trainerContactName: targetLeadName,
      trainerContactPhone: asString(targetLeadUser.phone) || null,
      trainerContactEmail: asString(targetLeadUser.email) || null,
      organizerContactPhone: asString(targetOrganizerUser?.phone) || null,
      organizerContactEmail: asString(targetOrganizerUser?.email) || null,
      organizerContactName: asString(targetOrganizer?.contactName || targetOrganizer?.displayName) || null,
      trainerDecision: nextTrainerDecision,
      organizerDecision: nextOrganizerDecision,
      finalStatus: deriveEnrollmentFinalStatus(
        nextTrainerDecision,
        nextOrganizerDecision,
        targetRequiresOrganizerApproval,
      ),
      requiresOrganizerApproval: targetRequiresOrganizerApproval,
      participantStatus: "active",
      participantManagedAt: nowIso(),
      participantActionSource: "participant",
      ...buildAttendanceResetFields(),
    },
    { merge: true },
  );

  await Promise.all([
    syncEventEnrollmentState(sourceEvent.id),
    syncEventEnrollmentState(targetEvent.id),
  ]);

  await createNotifications(
    [
      currentRequest.trainerUserId,
      currentRequest.organizerUserId,
      targetLeadUser.id,
      targetOrganizer?.userId,
    ],
    "Uczestnik przeniósł zgłoszenie",
    `${currentRequest.imieNazwisko} przeniósł(a) się z ${sourceEvent.title} do ${targetEvent.title}.`,
    "request",
  );

  return { ok: true };
});

export const confirmEnrollmentAttendance = onCall(callableOptions(), async (request) => {
  await requireCurrentUser(request, { allowAnonymous: true });

  const token = requiredString(request.data?.token, "Brak tokenu potwierdzenia.");
  const decision =
    request.data?.decision === "confirm" || request.data?.decision === "decline"
      ? request.data.decision
      : null;

  if (!decision) {
    throw new HttpsError("invalid-argument", "Podaj poprawną decyzję potwierdzenia.");
  }

  const tokenHash = hashAttendanceToken(token);
  const enrollmentRequest = await findEnrollmentRequestByTokenHash(tokenHash);

  if (!enrollmentRequest) {
    throw new HttpsError("not-found", "Link potwierdzenia jest nieprawidłowy albo wygasł.");
  }

  if (enrollmentRequest.finalStatus !== "accepted") {
    throw new HttpsError("failed-precondition", "To zgłoszenie nie jest już aktywne.");
  }

  const expiresAt = enrollmentRequest.attendanceConfirmationExpiresAt
    ? new Date(enrollmentRequest.attendanceConfirmationExpiresAt)
    : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    throw new HttpsError("deadline-exceeded", "Link potwierdzenia już wygasł.");
  }

  const nextStatus = decision === "confirm" ? "confirmed" : "declined";
  const currentStatus = resolveAttendanceConfirmationStatus(
    enrollmentRequest.attendanceConfirmationStatus,
  );

  if (currentStatus === nextStatus) {
    return { ok: true, requestId: enrollmentRequest.id, status: nextStatus };
  }

  if (currentStatus === "confirmed" || currentStatus === "declined") {
    throw new HttpsError("failed-precondition", "To zgłoszenie zostało już wcześniej potwierdzone.");
  }

  await db.collection(collections.enrollmentRequests).doc(enrollmentRequest.id).set(
    {
      attendanceConfirmationStatus: nextStatus,
      attendanceConfirmationRespondedAt: nowIso(),
    },
    { merge: true },
  );

  return { ok: true, requestId: enrollmentRequest.id, status: nextStatus };
});

export const updateTrainingEventManagement = onCall(callableOptions(), async (request) => {
  const { user } = await requireCurrentUser(request);
  if (!user) {
    throw new HttpsError("permission-denied", "Musisz być zalogowany.");
  }

  const input = request.data ?? {};
  const eventId = requiredString(input.eventId, "Brak identyfikatora szkolenia.");
  const event = await requireEvent(eventId);

  if (!canManageTrainingEvent(event, user)) {
    throw new HttpsError("permission-denied", "Możesz zarządzać tylko swoimi wydarzeniami.");
  }

  if (isTrainingEventArchived(event)) {
    throw new HttpsError("failed-precondition", "To szkolenie jest już zarchiwizowane.");
  }

  const publicationDecision =
    input.publicationDecision === "accepted" || input.publicationDecision === "rejected"
      ? input.publicationDecision
      : null;
  const publicationReviewMessage = asString(input.publicationReviewMessage);

  if (publicationDecision) {
    if (user.role !== "admin") {
      throw new HttpsError("permission-denied", "Tylko admin może moderować wydarzenia społeczności.");
    }

    if (!isCommunityBrandStatus(event.brandStatus)) {
      throw new HttpsError("failed-precondition", "Moderacja publikacji dotyczy tylko wydarzeń społeczności.");
    }

    await notifyCommunityEventReviewResult(
      event,
      publicationDecision,
      publicationReviewMessage,
      user.id,
    );

    return { ok: true, eventId };
  }

  const normalizedCapacity = Math.max(1, asNumber(input.capacity, event.capacity));
  const normalizedMinimumParticipants = Math.max(
    1,
    Math.min(normalizedCapacity, asNumber(input.minimumParticipants, resolveMinimumParticipants(event))),
  );
  const normalizedTitle = isCommunityBrandStatus(event.brandStatus)
    ? requiredString(input.title ?? event.title, "Podaj tytuł wydarzenia społeczności.")
    : event.title;
  const normalizedLocation = requiredString(
    input.location ?? event.location,
    "Podaj lokalizację wydarzenia.",
  );
  const normalizedTags = normalizeEventTags(input.tags ?? event.tags);
  const normalizedEventImages = isCommunityBrandStatus(event.brandStatus)
    ? normalizeEventImages(input.eventImages ?? event.eventImages)
    : [];
  const useEventImageAsCover = isCommunityBrandStatus(event.brandStatus)
    ? input.useEventImageAsCover === true && normalizedEventImages.length > 0
    : false;
  const normalizedScheduleDays = normalizeScheduleDays(input.scheduleDays ?? getTrainingEventScheduleDays(event));
  const firstScheduleDay = normalizedScheduleDays[0];
  const lastScheduleDay = normalizedScheduleDays[normalizedScheduleDays.length - 1];
  const targetEventId = asString(input.transferTargetEventId, "");

  if (!targetEventId) {
    await db.collection(collections.trainingEvents).doc(eventId).set(
      {
        title: normalizedTitle,
        location: normalizedLocation,
        tags: normalizedTags,
        eventImages: normalizedEventImages,
        useEventImageAsCover,
        startsAt: firstScheduleDay.startsAt,
        endsAt: lastScheduleDay.endsAt,
        scheduleDays: normalizedScheduleDays,
        capacity: normalizedCapacity,
        minimumParticipants: normalizedMinimumParticipants,
        status: resolveTrainingEventStatus(input.status),
        enrollmentPhotoRequirement:
          input.enrollmentPhotoRequirement === "required" ||
          input.enrollmentPhotoRequirement === "optional"
            ? input.enrollmentPhotoRequirement
            : "default",
      },
      { merge: true },
    );

    return { ok: true };
  }

  if (targetEventId === event.id) {
    throw new HttpsError("failed-precondition", "Wybierz inne wydarzenie do przeniesienia zgłoszeń.");
  }

  const targetEvent = await requireEvent(targetEventId);
  if (!canManageTrainingEvent(targetEvent, user)) {
    throw new HttpsError("permission-denied", "Możesz przenosić zgłoszenia tylko do swoich wydarzeń.");
  }

  const [sourceRequests] = await Promise.all([
    getEnrollmentRequestsForEvent(event.id),
  ]);
  const {
    trainer: targetTrainer,
    organizer: targetOrganizer,
    leadUser: targetLeadUser,
    leadName: targetLeadName,
  } = await resolveEnrollmentContactsForEvent(targetEvent);
  const targetRequiresOrganizerApproval =
    targetEvent.requiresOrganizerApproval ?? !isSelfManagedTrainingEvent(targetEvent);
  const transferableRequests = sourceRequests.filter((entry) => entry.finalStatus !== "rejected");
  const batch = db.batch();

  transferableRequests.forEach((entry) => {
    const nextTrainerDecision =
      entry.trainerId === targetEvent.trainerId ? entry.trainerDecision : "pending";
    const nextOrganizerDecision =
      targetRequiresOrganizerApproval
        ? entry.organizerId === targetEvent.organizerId
          ? entry.organizerDecision
          : "pending"
        : "pending";

    batch.set(
      db.collection(collections.enrollmentRequests).doc(entry.id),
      {
        eventId: targetEvent.id,
        trainerId: targetEvent.trainerId ?? null,
        organizerId: targetEvent.organizerId ?? null,
        trainerUserId: targetLeadUser.id,
        organizerUserId: targetOrganizer?.userId ?? null,
        trainerContactName: targetLeadName,
        trainerDecision: nextTrainerDecision,
        organizerDecision: nextOrganizerDecision,
        finalStatus: deriveEnrollmentFinalStatus(
          nextTrainerDecision,
          nextOrganizerDecision,
          targetRequiresOrganizerApproval,
        ),
        requiresOrganizerApproval: targetRequiresOrganizerApproval,
      },
      { merge: true },
    );
  });

  batch.set(
    db.collection(collections.trainingEvents).doc(event.id),
    {
      tags: normalizedTags,
      startsAt: firstScheduleDay.startsAt,
      endsAt: lastScheduleDay.endsAt,
      scheduleDays: normalizedScheduleDays,
      capacity: normalizedCapacity,
      minimumParticipants: normalizedMinimumParticipants,
      status: resolveTrainingEventStatus(input.status),
      enrollmentPhotoRequirement:
        input.enrollmentPhotoRequirement === "required" ||
        input.enrollmentPhotoRequirement === "optional"
          ? input.enrollmentPhotoRequirement
          : "default",
    },
    { merge: true },
  );
  await batch.commit();

  await Promise.all([syncEventEnrollmentState(event.id), syncEventEnrollmentState(targetEvent.id)]);

  if (transferableRequests.length > 0) {
    await createNotifications(
      [targetLeadUser.id, targetOrganizer?.userId],
      "Przeniesiono zgłoszenia do szkolenia",
      `${transferableRequests.length} zgłoszeń przeniesiono do ${targetEvent.title}.`,
      "request",
    );
  }

  return { ok: true };
});

export const archiveTrainingEvent = onCall(callableOptions(), async (request) => {
  const { user } = await requireCurrentUser(request);
  if (!user) {
    throw new HttpsError("permission-denied", "Musisz być zalogowany.");
  }

  const eventId = requiredString(request.data?.eventId, "Brak identyfikatora szkolenia.");
  const event = await requireEvent(eventId);

  if (!canManageTrainingEvent(event, user)) {
    throw new HttpsError("permission-denied", "Możesz archiwizować tylko swoje wydarzenia.");
  }

  if (isTrainingEventArchived(event)) {
    throw new HttpsError("failed-precondition", "To szkolenie jest już zarchiwizowane.");
  }

  await db.collection(collections.trainingEvents).doc(event.id).set(
    {
      archivedAt: nowIso(),
      archivedByRole: user.role,
      archivedReason: "manual",
      archivedForOrganizerId: event.organizerId ?? null,
      isPublished: false,
    },
    { merge: true },
  );

  return { ok: true };
});

export const syncOwnTrainerCalendarFeeds = onCall(callableOptions(), async (request) => {
  const { user } = await requireCurrentUser(request);
  if (!user || user.role !== "trainer" || !user.trainerProfileId) {
    throw new HttpsError("permission-denied", "Tylko trener może synchronizować feedy iCal.");
  }

  const trainer = await requireTrainerProfile(user.trainerProfileId);
  if (isCommunityBrandStatus(trainer.brandStatus)) {
    throw new HttpsError("failed-precondition", "Panel wspólnych terminów jest dostępny tylko dla oficjalnych trenerów.");
  }

  await rebuildTrainerExternalBusyMonths(trainer);

  return { ok: true };
});

async function resolveNotificationContextForEvent(event) {
  const [trainer, organizer] = await Promise.all([
    event.trainerId ? findTrainerProfile(event.trainerId) : Promise.resolve(null),
    event.organizerId ? findOrganizerProfile(event.organizerId) : Promise.resolve(null),
  ]);

  const ownerRole = resolveNotificationSettingsOwnerRole(event);
  const settings =
    ownerRole === "organizer" && organizer
      ? normalizeNotificationSettings(organizer.notificationSettings)
      : trainer
        ? normalizeNotificationSettings(trainer.notificationSettings)
        : getDefaultNotificationSettings();

  return {
    trainer,
    organizer,
    ownerRole,
    settings,
  };
}

function shouldDispatchReminderForEvent(event, settings, now = new Date()) {
  const firstDay = getTrainingEventScheduleDays(event)[0];

  if (!firstDay) {
    return false;
  }

  const startsAt = new Date(firstDay.startsAt);
  const reminderAt = new Date(
    startsAt.getTime() - settings.reminderLeadDays * 24 * 60 * 60 * 1000,
  );

  return now.getTime() >= reminderAt.getTime() && now.getTime() < startsAt.getTime();
}

async function queueRoleReminderSms(event, settings, role, profile, user) {
  if (!profile || !user) {
    return;
  }

  const shouldSend =
    role === "trainer" ? settings.sendToTrainer : settings.sendToOrganizer;

  if (!shouldSend) {
    return;
  }

  const dispatchId = `${event.id}__${role}__lead-${settings.reminderLeadDays}`;
  const message = renderSmsTemplate(settings.reminderSmsTemplate, {
    eventTitle: event.title || event.location,
    eventDate: formatEventDateForSms(event),
    eventLocation: event.location || "",
    recipientName: profile.displayName || user.displayName || "",
    confirmUrl: "",
    declineUrl: "",
  });

  await createSmsDispatchOnce(dispatchId, {
    eventId: event.id,
    requestId: null,
    leadDays: settings.reminderLeadDays,
    templateKind: "reminder",
    recipientRole: role,
    recipientProfileId: profile.id,
    recipientUserId: user.id,
    recipientName: profile.displayName || user.displayName || "",
    recipientPhone: user.phone || "",
    message,
  });
}

async function queueParticipantReminderSms(event, settings, enrollmentRequest) {
  if (!settings.sendToParticipants || enrollmentRequest.finalStatus !== "accepted") {
    return;
  }

  const dispatchId = `${event.id}__${enrollmentRequest.id}__participant__lead-${settings.reminderLeadDays}`;
  const participantName = asString(enrollmentRequest.imieNazwisko, "Uczestnik");
  let confirmUrl = "";
  let declineUrl = "";
  let tokenHash = null;

  if (settings.requireParticipantSmsConfirmation) {
    const token = randomUUID();
    tokenHash = hashAttendanceToken(token);
    confirmUrl = buildAttendanceDecisionUrl(token, "confirm");
    declineUrl = buildAttendanceDecisionUrl(token, "decline");
  }

  const message = renderSmsTemplate(
    settings.requireParticipantSmsConfirmation
      ? settings.confirmationSmsTemplate
      : settings.reminderSmsTemplate,
    {
      eventTitle: event.title || event.location,
      eventDate: formatEventDateForSms(event),
      eventLocation: event.location || "",
      recipientName: participantName,
      confirmUrl,
      declineUrl,
    },
  );

  const dispatch = await createSmsDispatchOnce(dispatchId, {
    eventId: event.id,
    requestId: enrollmentRequest.id,
    leadDays: settings.reminderLeadDays,
    templateKind: settings.requireParticipantSmsConfirmation
      ? "confirmation"
      : "reminder",
    recipientRole: "participant",
    recipientProfileId: null,
    recipientUserId: enrollmentRequest.submitterUid ?? null,
    recipientName: participantName,
    recipientPhone: asString(enrollmentRequest.telefon),
    message,
  });

  if (
    settings.requireParticipantSmsConfirmation &&
    dispatch.created &&
    dispatch.status === "pending-provider"
  ) {
    await db.collection(collections.enrollmentRequests).doc(enrollmentRequest.id).set(
      {
        attendanceConfirmationStatus: "pending",
        attendanceConfirmationRequestedAt: nowIso(),
        attendanceConfirmationRespondedAt: FieldValue.delete(),
        attendanceConfirmationTokenHash: tokenHash,
        attendanceConfirmationExpiresAt:
          getTrainingEventScheduleDays(event)[0]?.startsAt ?? event.startsAt,
      },
      { merge: true },
    );
  }
}

async function processNotificationReminders() {
  const now = new Date();
  const eventsSnapshot = await db.collection(collections.trainingEvents).get();

  for (const docSnapshot of eventsSnapshot.docs) {
    const event = { id: docSnapshot.id, ...docSnapshot.data() };

    if (
      isTrainingEventArchived(event) ||
      event.isPublished !== true ||
      resolveTrainingEventStatus(event.status) === "cancelled" ||
      !isTrainingEventCollaborationAccepted(event)
    ) {
      continue;
    }

    const context = await resolveNotificationContextForEvent(event);

    if (!context || !shouldDispatchReminderForEvent(event, context.settings, now)) {
      continue;
    }

    const [trainerUser, organizerUser, requests] = await Promise.all([
      context.trainer?.userId
        ? findAppUser(context.trainer.userId)
        : event.creatorUserId
          ? findAppUser(event.creatorUserId)
          : Promise.resolve(null),
      context.organizer?.userId ? findAppUser(context.organizer.userId) : Promise.resolve(null),
      getEnrollmentRequestsForEvent(event.id),
    ]);

    await queueRoleReminderSms(event, context.settings, "trainer", context.trainer, trainerUser);
    await queueRoleReminderSms(
      event,
      context.settings,
      "organizer",
      context.organizer,
      organizerUser,
    );

    for (const enrollmentRequest of requests) {
      await queueParticipantReminderSms(event, context.settings, enrollmentRequest);
    }
  }
}

export const processScheduledNotificationReminders = onSchedule(
  {
    region: FUNCTION_REGION,
    schedule: "every 60 minutes",
    timeZone: "Europe/Warsaw",
    retryCount: 0,
  },
  async () => {
    await processNotificationReminders();
  },
);

export const onRelationWrite = onDocumentWritten(
  {
    region: FUNCTION_REGION,
    document: `${collections.relations}/{relationId}`,
    retry: false,
  },
  async (event) => {
    const before = event.data?.before.exists ? { id: event.data.before.id, ...event.data.before.data() } : null;
    const after = event.data?.after.exists ? { id: event.data.after.id, ...event.data.after.data() } : null;
    const relation = after ?? before;

    if (!relation) {
      return;
    }

    const slotsSnapshot = await db
      .collection(collections.availabilitySlots)
      .where("trainerId", "==", relation.trainerId)
      .get();

    if (after?.status === "approved" && before?.status !== "approved") {
      await Promise.all(
        slotsSnapshot.docs.map((slotDoc) =>
          slotDoc.ref.set(
            {
              visibleToOrganizerIds: FieldValue.arrayUnion(relation.organizerId),
            },
            { merge: true },
          ),
        ),
      );

      const trainer = await findTrainerProfile(relation.trainerId);
      const organizer = await findOrganizerProfile(relation.organizerId);
      if (!trainer || !organizer) {
        return;
      }
      await createNotification(
        organizer.userId,
        "Zmieniono status relacji",
        `${trainer.displayName}: zaakceptowano współpracę.`,
        "relation",
      );
      return;
    }

    if (after?.status === "rejected" && before?.status !== "rejected") {
      const trainer = await findTrainerProfile(relation.trainerId);
      const organizer = await findOrganizerProfile(relation.organizerId);
      if (!trainer || !organizer) {
        return;
      }
      await createNotification(
        organizer.userId,
        "Zmieniono status relacji",
        `${trainer.displayName}: odrzucono współpracę.`,
        "relation",
      );
      return;
    }

    if (after?.status === "pending" && !before) {
      const trainer = await findTrainerProfile(relation.trainerId);
      const organizer = await findOrganizerProfile(relation.organizerId);
      if (!trainer || !organizer) {
        return;
      }
      await createNotification(
        trainer.userId,
        "Nowa prośba o współpracę",
        `${organizer.displayName} chce uzyskać dostęp do Twoich terminów.`,
        "relation",
      );
      return;
    }

    if (after?.status === "detached" && before?.status !== "detached") {
      await Promise.all(
        slotsSnapshot.docs.map((slotDoc) =>
          slotDoc.ref.set(
            {
              visibleToOrganizerIds: FieldValue.arrayRemove(relation.organizerId),
            },
            { merge: true },
          ),
        ),
      );

      const trainer = await findTrainerProfile(relation.trainerId);
      const organizer = await findOrganizerProfile(relation.organizerId);
      if (!trainer || !organizer) {
        return;
      }
      let archivedEventsCount = 0;

      if (after.archivedLinkedEvents === true) {
        const eventSnapshots = await db
          .collection(collections.trainingEvents)
          .where("trainerId", "==", relation.trainerId)
          .where("organizerId", "==", relation.organizerId)
          .get();

        const batch = db.batch();
        eventSnapshots.docs.forEach((eventDoc) => {
          const eventData = eventDoc.data();
          if (eventData.archivedAt) {
            return;
          }

          archivedEventsCount += 1;
          batch.set(
            eventDoc.ref,
            {
              archivedAt: nowIso(),
              archivedByRole: after.detachedByRole ?? null,
              archivedReason: "relation-detached",
              archivedForOrganizerId: relation.organizerId,
              isPublished: false,
            },
            { merge: true },
          );
        });
        await batch.commit();
      }

      await createNotifications(
        [trainer.userId, organizer.userId],
        "Odpięto relację",
        after.archivedLinkedEvents === true
          ? `${trainer.displayName} zakończył współpracę z ${organizer.displayName} i zarchiwizował ${archivedEventsCount} szkoleń.`
          : `${trainer.displayName} i ${organizer.displayName} zakończyliście współpracę.`,
        "relation",
      );
    }
  },
);

export const onEnrollmentRequestWrite = onDocumentWritten(
  {
    region: FUNCTION_REGION,
    document: `${collections.enrollmentRequests}/{requestId}`,
    retry: false,
  },
  async (event) => {
    const before = event.data?.before.exists ? { id: event.data.before.id, ...event.data.before.data() } : null;
    const after = event.data?.after.exists ? { id: event.data.after.id, ...event.data.after.data() } : null;

    if (before?.eventId) {
      await syncEventEnrollmentState(before.eventId);
    }

    if (after?.eventId && after.eventId !== before?.eventId) {
      await syncEventEnrollmentState(after.eventId);
    }

    if (after && !before) {
      const eventDoc = await findEvent(after.eventId);
      const trainer = await findTrainerProfile(after.trainerId);
      const organizer = after.organizerId ? await findOrganizerProfile(after.organizerId) : null;
      if (!eventDoc || !trainer) {
        return;
      }
      await createNotifications(
        [trainer.userId, organizer?.userId ?? trainer.userId],
        "Nowe zgłoszenie uczestnika",
        `${after.imieNazwisko} chce dołączyć do szkolenia ${eventDoc.title}.`,
        "request",
      );
      return;
    }

    if (after && before && after.finalStatus !== before.finalStatus) {
      const trainer = await findTrainerProfile(after.trainerId);
      const organizer = after.organizerId ? await findOrganizerProfile(after.organizerId) : null;
      if (!trainer) {
        return;
      }
      await createNotifications(
        [trainer.userId, organizer?.userId ?? trainer.userId],
        "Zmieniono status zgłoszenia",
        `${after.imieNazwisko}: ${after.finalStatus}.`,
        "request",
      );
    }
  },
);

export const onTrainingEventWrite = onDocumentWritten(
  {
    region: FUNCTION_REGION,
    document: `${collections.trainingEvents}/{eventId}`,
    retry: false,
  },
  async (event) => {
    const before = event.data?.before.exists ? { id: event.data.before.id, ...event.data.before.data() } : null;
    const after = event.data?.after.exists ? { id: event.data.after.id, ...event.data.after.data() } : null;

    if (after && !before && !isSelfManagedTrainingEvent(after)) {
      const trainer = await findTrainerProfile(after.trainerId);
      const organizer = after.organizerId ? await findOrganizerProfile(after.organizerId) : null;
      if (!trainer) {
        return;
      }

      if (after.createdByRole === "trainer" && organizer) {
        await createNotification(
          organizer.userId,
          "Nowe szkolenie czeka na akceptację",
          `${trainer.displayName} dodał szkolenie ${after.location}.`,
          "event",
        );
      } else if (after.createdByRole === "organizer" && organizer) {
        await createNotification(
          trainer.userId,
          "Nowe szkolenie czeka na akceptację",
          `${organizer.displayName} dodał szkolenie ${after.location}.`,
          "event",
        );
      }

      return;
    }

    if (
      before &&
      after &&
      (
        before.trainerCollaborationStatus !== after.trainerCollaborationStatus ||
        before.organizerCollaborationStatus !== after.organizerCollaborationStatus
      )
    ) {
      const trainer = await findTrainerProfile(after.trainerId);
      const organizer = after.organizerId ? await findOrganizerProfile(after.organizerId) : null;
      if (!trainer) {
        return;
      }
      await createNotifications(
        [trainer.userId, organizer?.userId],
        "Zmieniono status współpracy przy szkoleniu",
        `${after.title}: trener ${resolveTrainerCollaborationStatus(after)}, organizator ${resolveOrganizerCollaborationStatus(after)}.`,
        "event",
      );
    }
  },
);
