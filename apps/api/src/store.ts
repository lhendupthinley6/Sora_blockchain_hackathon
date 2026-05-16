import type {
  IssueCredentialResult,
  NormalizedProofResult,
  ScreeningReport,
  SignInRole,
  VerificationScope,
  VerificationStartResult,
  VerificationStatus,
} from "sora-sdk";

export interface VerificationFlowRecord {
  flowType: "proof" | "issuance" | "signIn";
  scope: VerificationScope;
  status: VerificationStatus;
  transport: "mock" | "webhook" | "nats";
  start: VerificationStartResult;
  normalizedResult?: NormalizedProofResult;
  report?: ScreeningReport;
  issueResult?: IssueCredentialResult;
  issuedCredentialData?: Record<string, string | number>;
  revoked?: boolean;
  revokedAt?: string;
  role?: SignInRole;
  lastEventId?: string;
  lastTransportPayload?: unknown;
  error?: string;
}

export class FlowStore {
  private readonly flows = new Map<string, VerificationFlowRecord>();

  set(threadId: string, flow: VerificationFlowRecord): void {
    this.flows.set(threadId, flow);
  }

  get(threadId: string): VerificationFlowRecord | undefined {
    return this.flows.get(threadId);
  }

  has(threadId: string): boolean {
    return this.flows.has(threadId);
  }

  list(): VerificationFlowRecord[] {
    return [...this.flows.values()];
  }
}
