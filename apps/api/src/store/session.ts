import crypto from "node:crypto";

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
};

export class InMemoryAuthStore {
  private smsChallenges = new Map<string, SmsChallenge>();
  private sessions = new Map<string, AuthSession>();

  createSmsChallenge(phone: string, code: string, ttlSeconds = 300) {
    const requestedAt = new Date();
    const expiresAt = new Date(requestedAt.getTime() + ttlSeconds * 1000);
    const challenge = {
      code,
      expiresAt: expiresAt.toISOString(),
      phone,
      requestedAt: requestedAt.toISOString(),
    };
    this.smsChallenges.set(phone, challenge);
    return challenge;
  }

  consumeSmsChallenge(phone: string) {
    const challenge = this.smsChallenges.get(phone) ?? null;
    this.smsChallenges.delete(phone);
    if (!challenge || Date.parse(challenge.expiresAt) < Date.now()) {
      return null;
    }
    return challenge;
  }

  createSession(userId: string) {
    const session: AuthSession = {
      id: crypto.randomBytes(32).toString("hex"),
      userId,
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string | undefined) {
    if (!sessionId) {
      return null;
    }

    return this.sessions.get(sessionId) ?? null;
  }

  deleteSession(sessionId: string | undefined) {
    if (sessionId) {
      this.sessions.delete(sessionId);
    }
  }
}
