import { createRequire } from "node:module";
import type { AppConfig } from "./config";

const require = createRequire(import.meta.url);
const { connect, JSONCodec, nkeyAuthenticator } = require("nats") as {
  connect: (options: Record<string, unknown>) => Promise<NatsConnection>;
  JSONCodec: <T>() => { decode: (data: Uint8Array) => T };
  nkeyAuthenticator: (seed: Uint8Array) => unknown;
};

interface NatsConnection {
  isClosed(): boolean;
  subscribe(subject: string): Subscription;
}

interface Subscription extends AsyncIterable<{ data: Uint8Array }> {}

interface NdiWrappedMessage {
  pattern?: string;
  data?: {
    thid?: string;
  };
}

export class NdiNatsTransport {
  private connection?: NatsConnection;
  private subscription?: Subscription;
  private connecting?: Promise<void>;
  private readonly codec = JSONCodec<NdiWrappedMessage>();

  constructor(
    private readonly config: AppConfig,
    private readonly onMessage: (payload: unknown, transport: "nats") => void,
  ) {}

  async ensureConnected(): Promise<void> {
    if (this.connection && !this.connection.isClosed()) {
      return;
    }

    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = this.connectInternal();
    try {
      await this.connecting;
    } finally {
      this.connecting = undefined;
    }
  }

  private async connectInternal(): Promise<void> {
    if (!this.config.ndiNatsNkey) {
      throw new Error("NDI NATS transport requires NDI_NATS_NKEY.");
    }

    this.connection = await connect({
      servers: [this.config.ndiNatsServer],
      authenticator: nkeyAuthenticator(new TextEncoder().encode(this.config.ndiNatsNkey)),
    });

    this.subscription = this.connection.subscribe(">");

    void (async () => {
      for await (const message of this.subscription!) {
        try {
          const payload = this.codec.decode(message.data);
          const threadId = payload.pattern ?? payload.data?.thid;
          if (!threadId) {
            continue;
          }
          this.onMessage(payload, "nats");
        } catch {
          continue;
        }
      }
    })();
  }
}
