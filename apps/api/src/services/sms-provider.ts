import crypto from "node:crypto";
import type { ApiConfig } from "../config.js";

export type SmsSendResult = {
  provider: "smsapi" | "test";
  status: "sent" | "queued" | "failed";
  providerMessageId?: string;
  error?: string;
};

export function generateSmsCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export class SmsProvider {
  constructor(private config: ApiConfig) {}

  async sendLoginCode(phone: string, code: string): Promise<SmsSendResult> {
    if (this.config.smsapiTestMode || !this.config.smsapiToken) {
      return {
        provider: "test",
        status: "sent",
        providerMessageId: `test-${Date.now()}`,
      };
    }

    const body = new URLSearchParams({
      to: phone,
      message: `Kod logowania Emandar: ${code}`,
      format: "json",
    });
    if (this.config.smsapiFrom) {
      body.set("from", this.config.smsapiFrom);
    }

    const response = await fetch("https://api.smsapi.pl/sms.do", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.smsapiToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      return {
        provider: "smsapi",
        status: "failed",
        error: `smsapi-${response.status}`,
      };
    }

    const payload = (await response.json().catch(() => null)) as
      | { list?: Array<{ id?: string; status?: string }> }
      | null;
    const firstMessage = payload?.list?.[0];

    return {
      provider: "smsapi",
      status: firstMessage?.status === "QUEUE" ? "queued" : "sent",
      providerMessageId: firstMessage?.id,
    };
  }
}
