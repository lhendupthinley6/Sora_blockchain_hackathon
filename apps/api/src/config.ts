import type { SoraMode } from "sora-sdk";

const DEFAULT_NDI_DEMO_NATS_NKEY =
  "SUAPXY7TJFUFE3IX3OEMSLE3JFZJ3FZZRSRSOGSG2ANDIFN77O2MIBHWUM";

export interface AppConfig {
  mode: SoraMode;
  port: number;
  ndiClientId?: string;
  ndiClientSecret?: string;
  ndiTransport: "webhook" | "nats";
  publicBaseUrl: string;
  webhookId: string;
  webhookClientId: string;
  webhookClientSecret: string;
  ndiNatsServer: string;
  ndiNatsNkey?: string;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.replace(/\/+$/, "") : value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    mode: (env.SORA_MODE as SoraMode | undefined) ?? "mock",
    port: Number(env.PORT ?? "3030"),
    ndiClientId: env.NDI_CLIENT_ID,
    ndiClientSecret: env.NDI_CLIENT_SECRET,
    ndiTransport: env.NDI_TRANSPORT === "nats" ? "nats" : "webhook",
    publicBaseUrl: trimTrailingSlash(env.PUBLIC_BASE_URL ?? "http://localhost:3030"),
    webhookId: env.NDI_WEBHOOK_ID ?? "sora-academic-demo",
    webhookClientId: env.WEBHOOK_CLIENT_ID ?? "sora-demo-webhook",
    webhookClientSecret: env.WEBHOOK_CLIENT_SECRET ?? "sora-demo-webhook-secret",
    ndiNatsServer: env.NDI_NATS_SERVER ?? "wss://natsdemoclient.bhutanndi.com",
    ndiNatsNkey: env.NDI_NATS_NKEY ?? DEFAULT_NDI_DEMO_NATS_NKEY,
  };
}
