import type {
  IssueCredentialResult,
  NormalizedProofResult,
  ScreeningReport,
  VerificationScope,
  VerificationStartResult,
  VerificationStatus,
} from "sora-sdk";

export interface VerificationFlowRecord {
  flowType: "proof" | "issuance";
  scope: VerificationScope;
  status: VerificationStatus;
  transport: "mock" | "webhook" | "nats";
  start: VerificationStartResult;
  normalizedResult?: NormalizedProofResult;
  report?: ScreeningReport;
  issueResult?: IssueCredentialResult;
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
}
