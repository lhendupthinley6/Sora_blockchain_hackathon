export type SoraMode = "mock" | "ndi";

export type SupportedCredentialSchema = "studentId" | "academicCertificate";
export type SignInRole = "user" | "issuer" | "verifier";

export type VerificationScope =
  | SupportedCredentialSchema
  | "combined"
  | "holderDiscovery"
  | "signIn";

export type VerificationStatus =
  | "pending"
  | "completed"
  | "failed"
  | "issued"
  | "accepted";

export interface StudentIdCredential {
  schema: "studentId";
  studentId: string;
  studentName: string;
  collegeName: string;
  programmeName: string;
  enrollmentYear: string;
  programmeDuration: string;
}

export interface AcademicCertificateCredential {
  schema: "academicCertificate";
  issuerName: string;
  studentId: string;
  studentName: string;
  titleOfAward: string;
  collegeName: string;
}

export interface HolderIdentity {
  holderDid: string | null;
  relationshipDid?: string | null;
}

export interface NormalizedProofResult {
  verified: boolean;
  threadId: string;
  holder: HolderIdentity;
  scope: VerificationScope;
  transport: "mock" | "webhook" | "nats";
  verificationResult: string;
  rawRevealedAttributes: Record<string, string | null>;
  credentials: {
    studentId?: StudentIdCredential;
    academicCertificate?: AcademicCertificateCredential;
  };
}

export interface ManualGradeSubject {
  name: string;
  score: number;
  maxScore: number;
}

export type GradeScale = "gpa4" | "cgpa10";

export interface ManualGradeInput {
  gradingScale: GradeScale;
  gradeValue?: number;
  institutionName: string;
  country?: string;
}

export interface InstitutionContextRecord {
  institutionName: string;
  country: string;
  gdi: number;
  si: number;
  gds: number;
  arf: number;
  trueScore?: number;
}

export interface ContextualFactors {
  gdiFactor: number;
  siFactor: number;
  gdsFactor: number;
  arfFactor: number;
}

export interface ContextualConversionResult {
  normalizedScore: number;
  contextFactor: number;
  convertedScore: number;
  gradeBand: "distinction" | "merit" | "pass" | "review";
  explanation: string[];
  institution: InstitutionContextRecord;
  usedFallbackInstitution: boolean;
  factors: ContextualFactors;
}

export interface ScreeningReport {
  threadId: string;
  scope: VerificationScope;
  mode: SoraMode;
  verified: boolean;
  candidateName: string;
  holderDid: string | null;
  credentialSummary: string[];
  gradeInput: ManualGradeInput;
  conversion: ContextualConversionResult;
  decision: "eligible" | "manual_review" | "rejected";
  decisionReason: string;
  generatedAt: string;
}

export interface ProofAttribute {
  name: string;
  restrictions: Array<{
    schema_name: string;
  }>;
}

export interface ProofRequestPayload {
  proofName: string;
  proofAttributes: ProofAttribute[];
  purpose: "ekyc" | "login" | "ekyc_update";
  authenticationLevel: "Standard";
  isShortenUrl: true;
}

export interface VerificationStartResult {
  threadId: string;
  proofRequestURL: string;
  deepLinkURL: string;
  qrSvg: string;
  mode: SoraMode;
  transport: "mock" | "webhook" | "nats";
  scope: VerificationScope;
}

export interface IssueCredentialRequest {
  schema: SupportedCredentialSchema;
  holderDID: string;
  credentialData: Record<string, string | number>;
}

export interface IssueCredentialResult {
  issueCredThreadId: string;
  relationshipDid?: string | null;
  revocationId?: string | null;
  credInviteURL: string;
  deepLinkURL: string;
  qrSvg?: string;
  acceptanceStatus?: "issued" | "accepted";
  acceptancePayload?: unknown;
}

export interface SignInStartResult extends VerificationStartResult {
  scope: "signIn";
  role: SignInRole;
}

export interface SignInStatusResponse {
  threadId: string;
  role: SignInRole;
  status: VerificationStatus;
  transport: "mock" | "webhook" | "nats";
  start?: SignInStartResult;
  normalizedResult?: NormalizedProofResult;
  profile?: {
    fullName: string;
    holderDid: string | null;
    email?: string | null;
    phone?: string | null;
  };
  error?: string;
}
