import crypto from "node:crypto";

export type SmsChallenge = {
  phone: string;
  requestedAt: string;
};

export type AuthSession = {
  id: string;
  userId: string;
  createdAt: string;
};

export class InMemoryAuthStore {
  private smsChallenges = new Map<string, SmsChallenge>();
  private sessions = new Map<string, AuthSession>();

  createSmsChallenge(phone: string) {
    const challenge = {
      phone,
      requestedAt: new Date().toISOString(),
    };
    this.smsChallenges.set(phone, challenge);
    return challenge;
  }

  consumeSmsChallenge(phone: string) {
    const challenge = this.smsChallenges.get(phone) ?? null;
    this.smsChallenges.delete(phone);
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
