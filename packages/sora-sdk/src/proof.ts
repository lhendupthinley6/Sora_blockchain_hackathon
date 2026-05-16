import { FOUNDATIONAL_ID_SCHEMA, RUB_SCHEMAS } from "./schemas";
import type {
  ProofRequestPayload,
  SupportedCredentialSchema,
  VerificationScope,
} from "./types";

function buildAttributes(schema: SupportedCredentialSchema) {
  return RUB_SCHEMAS[schema].attributes.map((name) => ({
    name,
    restrictions: [{ schema_name: RUB_SCHEMAS[schema].schemaUrl }],
  }));
}

export function buildProofRequest(scope: VerificationScope): ProofRequestPayload {
  const proofName =
    scope === "studentId"
      ? "Verify Student ID"
      : scope === "academicCertificate"
        ? "Verify Academic Certificate"
        : scope === "holderDiscovery"
          ? "Discover wallet holder"
          : "Verify Academic Credentials";

  const proofAttributes =
    scope === "studentId"
      ? buildAttributes("studentId")
      : scope === "academicCertificate"
        ? buildAttributes("academicCertificate")
        : scope === "holderDiscovery"
          ? [
              {
                name: "Full Name",
                restrictions: [{ schema_name: FOUNDATIONAL_ID_SCHEMA.schemaUrl }],
              },
            ]
          : [...buildAttributes("studentId"), ...buildAttributes("academicCertificate")];

  return {
    proofName,
    proofAttributes,
    purpose: "ekyc",
    authenticationLevel: "Standard",
    isShortenUrl: true,
  };
}
