import type { AppConfig } from "./config";
import type {
  IssueCredentialRequest,
  IssueCredentialResult,
  ProofRequestPayload,
} from "sora-sdk";

interface AuthState {
  token: string;
  expiresAt: number;
}

export interface NdiProofStart {
  proofRequestThreadId: string;
  proofRequestURL: string;
  deepLinkURL: string;
}

export class NdiClient {
  private authState?: AuthState;
  private webhookRegistered = false;

  constructor(private readonly config: AppConfig) {}

  private async token(): Promise<string> {
    if (this.authState && Date.now() < this.authState.expiresAt) {
      return this.authState.token;
    }

    if (!this.config.ndiClientId || !this.config.ndiClientSecret) {
      throw new Error("NDI client credentials are not configured.");
    }

    const body = new URLSearchParams({
      client_id: this.config.ndiClientId,
      client_secret: this.config.ndiClientSecret,
      grant_type: "client_credentials",
    });

    const response = await fetch("https://staging.bhutanndi.com/authentication/v1/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      throw new Error(`NDI auth failed: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as { access_token: string; expires_in: number };
    this.authState = {
      token: json.access_token,
      expiresAt: Date.now() + ((json.expires_in - 300) * 1000),
    };
    return json.access_token;
  }

  async ensureWebhookRegistered(): Promise<void> {
    if (this.webhookRegistered) {
      return;
    }

    const token = await this.token();
    const response = await fetch("https://demo-client.bhutanndi.com/webhook/v1/register", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhookId: this.config.webhookId,
        webhookURL: `${this.config.publicBaseUrl}/ndi-webhook`,
        authentication: {
          type: "OAuth2",
          version: "v1",
          data: {
            url: `${this.config.publicBaseUrl}/oauth/token`,
            grant_type: "client_credentials",
            client_id: this.config.webhookClientId,
            client_secret: this.config.webhookClientSecret,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`NDI webhook registration failed: ${response.status} ${await response.text()}`);
    }

    this.webhookRegistered = true;
  }

  async createProofRequest(payload: ProofRequestPayload): Promise<NdiProofStart> {
    const token = await this.token();
    const response = await fetch("https://demo-client.bhutanndi.com/verifier/v1/proof-request", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`NDI proof request failed: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as {
      data: {
        proofRequestThreadId: string;
        proofRequestURL: string;
        deepLinkURL: string;
      };
    };

    return json.data;
  }

  async subscribeWebhook(threadId: string): Promise<void> {
    const token = await this.token();
    const response = await fetch("https://demo-client.bhutanndi.com/webhook/v1/subscribe", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhookId: this.config.webhookId,
        threadId,
      }),
    });

    if (!response.ok) {
      throw new Error(`NDI webhook subscription failed: ${response.status} ${await response.text()}`);
    }
  }

  async issueCredential(request: IssueCredentialRequest): Promise<IssueCredentialResult> {
    const token = await this.token();
    const response = await fetch("https://demo-client.bhutanndi.com/issuer/v1/issue-credential", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        credentialData: request.credentialData,
        schemaId: request.schema === "studentId"
          ? "https://dev-schema.ngotag.com/schemas/295abb90-559d-401b-a100-8cb7a8ce5d2e"
          : "https://dev-schema.ngotag.com/schemas/ff021513-94b1-407d-a0ee-bb829531df42",
        holderDID: request.holderDID,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      if (response.status === 404 && message.includes("Schema details not found")) {
        throw new Error("NDI tenant is not configured for the selected issuance schema.");
      }
      throw new Error(`NDI issuance failed: ${response.status} ${message}`);
    }

    const json = (await response.json()) as { data: IssueCredentialResult };
    return json.data;
  }
}
