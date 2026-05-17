import { buildProofRequest } from "./proof.js";
import { normalizeProofPayload } from "./normalize.js";
import type {
  IssueCredentialRequest,
  IssueCredentialResult,
  NormalizedProofResult,
  VerificationScope,
  VerificationStartResult,
} from "./types.js";

function createThreadId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createMockVerificationStart(scope: VerificationScope): VerificationStartResult {
  const threadId = createThreadId(scope);
  return {
    threadId,
    proofRequestURL: `https://mock.sora.local/proof/${threadId}`,
    deepLinkURL: `bhutanndidemo://mock/${threadId}`,
    qrSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#f6f1e8"/><text x="12" y="80" fill="#17324d" font-size="14">Mock QR ${threadId}</text></svg>`,
    mode: "mock",
    transport: "mock",
    scope,
  };
}

export function createMockProofResult(
  threadId: string,
  scope: VerificationScope,
): NormalizedProofResult {
  buildProofRequest(scope);

  const payload = {
    pattern: threadId,
    data: {
      type: "present-proof/presentation-result",
      verification_result: "ProofValidated",
      relationship_did: "relationship-mock-001",
      thid: threadId,
      holder_did: "did:key:z6Mkf6mockholder123456789",
      requested_presentation: {
        revealed_attrs: {
          "Full Name": [{ value: "Sonam Choden" }],
          "Student ID": [{ value: "20240001" }],
          "Student Name": [{ value: "Sonam Choden" }],
          "College Name": [{ value: "Royal University of Bhutan" }],
          "Programme Name": [{ value: "BSc Information Technology" }],
          "Enrollment Year": [{ value: "2021" }],
          "Programme Duration": [{ value: "4 years" }],
          "Issuer Name": [{ value: "RUB Registrar" }],
          "Title of Award": [{ value: "Bachelor of Science in Information Technology" }],
        },
      },
    },
  };

  return normalizeProofPayload(payload, scope, "mock");
}

export function createMockIssueResult(
  request: IssueCredentialRequest,
): IssueCredentialResult & { normalizedCredential: Record<string, string | number> } {
  return {
    issueCredThreadId: createThreadId(`issue-${request.schema}`),
    relationshipDid: "relationship-mock-001",
    revocationId: `${request.schema}-revocation-001`,
    credInviteURL: `https://mock.sora.local/issue/${request.schema}`,
    deepLinkURL: `bhutanndidemo://issue/${request.schema}`,
    qrSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#f6f1e8"/><text x="12" y="80" fill="#17324d" font-size="14">Issue ${request.schema}</text></svg>`,
    acceptanceStatus: "accepted",
    acceptancePayload: {
      type: "issue-credential/accepted",
      thid: `issue-${request.schema}`,
      relationshipDid: "relationship-mock-001",
    },
    normalizedCredential: request.credentialData,
  };
}
