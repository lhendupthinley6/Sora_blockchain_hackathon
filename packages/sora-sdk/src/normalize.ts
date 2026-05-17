import { RUB_SCHEMAS } from "./schemas.js";
import type {
  AcademicCertificateCredential,
  NormalizedProofResult,
  StudentIdCredential,
  VerificationScope,
} from "./types.js";

interface NdiInnerPayload {
  type?: string;
  verification_result?: string;
  requested_presentation?: {
    revealed_attrs?: Record<string, { value?: string } | Array<{ value?: string }>>;
  };
  relationship_did?: string;
  relationshipDid?: string;
  thid?: string;
  holder_did?: string;
}

interface NdiEnvelope {
  pattern?: string;
  data?: NdiInnerPayload;
}

function pickValue(
  value: { value?: string } | Array<{ value?: string }> | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0]?.value ?? null;
  }

  return value.value ?? null;
}

function normalizeStudentId(attrs: Record<string, string | null>): StudentIdCredential | undefined {
  const required = RUB_SCHEMAS.studentId.attributes.every((name) => attrs[name]);
  if (!required) {
    return undefined;
  }

  return {
    schema: "studentId",
    studentId: attrs["Student ID"]!,
    studentName: attrs["Student Name"]!,
    collegeName: attrs["College Name"]!,
    programmeName: attrs["Programme Name"]!,
    enrollmentYear: attrs["Enrollment Year"]!,
    programmeDuration: attrs["Programme Duration"]!,
  };
}

function normalizeAcademicCertificate(
  attrs: Record<string, string | null>,
): AcademicCertificateCredential | undefined {
  const required = RUB_SCHEMAS.academicCertificate.attributes.every((name) => attrs[name]);
  if (!required) {
    return undefined;
  }

  return {
    schema: "academicCertificate",
    issuerName: attrs["Issuer Name"]!,
    studentId: attrs["Student ID"]!,
    studentName: attrs["Student Name"]!,
    titleOfAward: attrs["Title of Award"]!,
    collegeName: attrs["College Name"]!,
  };
}

export function normalizeProofPayload(
  payload: NdiEnvelope | NdiInnerPayload,
  scope: VerificationScope,
  transport: "mock" | "webhook" | "nats",
): NormalizedProofResult {
  const inner =
    ("data" in payload && payload.data ? payload.data : payload) as NdiInnerPayload;
  const revealed = inner.requested_presentation?.revealed_attrs ?? {};
  const attrs = Object.fromEntries(
    Object.entries(revealed).map(([name, value]) => [
      name,
      pickValue(value as { value?: string } | Array<{ value?: string }> | undefined),
    ]),
  );
  const threadId =
    ("pattern" in payload ? payload.pattern : undefined) ?? inner.thid ?? "unknown-thread";
  const verified = inner.verification_result === "ProofValidated";

  return {
    verified,
    threadId,
    holder: {
      holderDid: inner.holder_did ?? null,
      relationshipDid: inner.relationship_did ?? inner.relationshipDid ?? null,
    },
    scope,
    transport,
    verificationResult: inner.verification_result ?? "Unknown",
    rawRevealedAttributes: attrs,
    credentials: {
      studentId: normalizeStudentId(attrs),
      academicCertificate: normalizeAcademicCertificate(attrs),
    },
  };
}
