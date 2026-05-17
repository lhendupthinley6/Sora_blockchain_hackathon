import { runContextualConversion } from "./conversion.js";
import type {
  ManualGradeInput,
  NormalizedProofResult,
  ScreeningReport,
  SoraMode,
} from "./types.js";

export function buildStandaloneScreeningReport(
  mode: SoraMode,
  grades: ManualGradeInput,
): ScreeningReport {
  const conversion = runContextualConversion(grades);
  const decision =
    conversion.convertedScore >= 65
      ? "eligible"
      : conversion.convertedScore >= 50
        ? "manual_review"
        : "rejected";
  const decisionReason =
    decision === "eligible"
      ? "The contextualized score meets the demo eligibility threshold."
      : decision === "manual_review"
        ? "The contextualized score requires manual review."
        : "The contextualized score is below the demo threshold.";

  return {
    threadId: "converter-only",
    scope: "combined",
    mode,
    verified: false,
    candidateName: "Unverified student",
    holderDid: null,
    credentialSummary: ["No NDI verification was used for this report."],
    gradeInput: grades,
    conversion,
    decision,
    decisionReason,
    generatedAt: new Date().toISOString(),
  };
}

export function buildScreeningReport(
  mode: SoraMode,
  proof: NormalizedProofResult,
  grades: ManualGradeInput,
): ScreeningReport {
  const conversion = runContextualConversion(grades);
  const candidateName =
    proof.credentials.academicCertificate?.studentName ??
    proof.credentials.studentId?.studentName ??
    "Unknown candidate";
  const credentialSummary = [
    proof.credentials.studentId
      ? `Student ID verified for ${proof.credentials.studentId.collegeName}`
      : null,
    proof.credentials.academicCertificate
      ? `Academic award verified: ${proof.credentials.academicCertificate.titleOfAward}`
      : null,
  ].filter((value): value is string => Boolean(value));
  const decision =
    !proof.verified
      ? "rejected"
      : conversion.convertedScore >= 65
        ? "eligible"
        : conversion.convertedScore >= 50
          ? "manual_review"
          : "rejected";
  const decisionReason =
    !proof.verified
      ? "Credential proof was not validated by the selected transport."
      : decision === "eligible"
        ? "Verified credentials and contextualized score meet the demo eligibility threshold."
        : decision === "manual_review"
          ? "Verified credentials passed, but the contextual score requires manual review."
          : "Verified credentials passed, but the contextual score is below the demo threshold.";

  return {
    threadId: proof.threadId,
    scope: proof.scope,
    mode,
    verified: proof.verified,
    candidateName,
    holderDid: proof.holder.holderDid,
    credentialSummary,
    gradeInput: grades,
    conversion,
    decision,
    decisionReason,
    generatedAt: new Date().toISOString(),
  };
}
