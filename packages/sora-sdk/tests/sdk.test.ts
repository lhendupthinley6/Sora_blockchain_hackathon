import { describe, expect, it } from "vitest";
import {
  buildProofRequest,
  buildScreeningReport,
  findInstitutionRecord,
  normalizeProofPayload,
  runContextualConversion,
} from "../src";

describe("proof request builder", () => {
  it("builds the student ID proof request with exact RUB attributes", () => {
    const proof = buildProofRequest("studentId");
    expect(proof.proofAttributes.map((attribute) => attribute.name)).toEqual([
      "Student ID",
      "Student Name",
      "College Name",
      "Programme Name",
      "Enrollment Year",
      "Programme Duration",
    ]);
    expect(proof.proofAttributes[0]?.restrictions[0]?.schema_name).toContain("295abb90");
  });

  it("builds combined proof requests across both RUB schemas", () => {
    const proof = buildProofRequest("combined");
    expect(proof.proofAttributes).toHaveLength(11);
    expect(proof.proofAttributes.at(-1)?.name).toBe("College Name");
  });

  it("builds holder discovery against Foundational ID full name", () => {
    const proof = buildProofRequest("holderDiscovery");
    expect(proof.proofAttributes).toEqual([
      {
        name: "Full Name",
        restrictions: [
          {
            schema_name: "https://dev-schema.ngotag.com/schemas/c7952a0a-e9b5-4a4b-a714-1e5d0a1ae076",
          },
        ],
      },
    ]);
  });

  it("builds sign-in proof requests using login purpose", () => {
    const proof = buildProofRequest("signIn");
    expect(proof.proofName).toBe("Sign in with Bhutan NDI");
    expect(proof.purpose).toBe("login");
    expect(proof.proofAttributes[0]?.name).toBe("Full Name");
  });
});

describe("proof normalization", () => {
  it("normalizes array and object revealed attributes", () => {
    const payload = {
      pattern: "thread-1",
      data: {
        verification_result: "ProofValidated",
        thid: "thread-1",
        holder_did: "did:key:test",
        requested_presentation: {
          revealed_attrs: {
            "Student ID": [{ value: "1234" }],
            "Student Name": { value: "Pema" },
            "College Name": { value: "RUB" },
            "Programme Name": { value: "BSc" },
            "Enrollment Year": { value: "2020" },
            "Programme Duration": { value: "4 years" },
          },
        },
      },
    };

    const result = normalizeProofPayload(payload, "studentId", "webhook");
    expect(result.verified).toBe(true);
    expect(result.credentials.studentId?.studentName).toBe("Pema");
  });

  it("marks invalid verification even if revealed attributes exist", () => {
    const payload = {
      pattern: "thread-2",
      data: {
        verification_result: "PresentationRejected",
        thid: "thread-2",
        requested_presentation: {
          revealed_attrs: {
            "Student ID": [{ value: "9999" }],
          },
        },
      },
    };

    const result = normalizeProofPayload(payload, "studentId", "webhook");
    expect(result.verified).toBe(false);
  });
});

describe("conversion and report generation", () => {
  it("looks up universities from the contextual dataset", () => {
    const record = findInstitutionRecord("University of Oxford");
    expect(record?.country).toBe("UK");
  });

  it("computes a contextual conversion from CGPA and institution data", () => {
    const result = runContextualConversion({
      gradingScale: "cgpa10",
      gradeValue: 8.5,
      institutionName: "Jawaharlal Nehru University",
      country: "India",
    });
    expect(result.normalizedScore).toBe(85);
    expect(result.contextFactor).toBeGreaterThan(0.9);
    expect(result.convertedScore).toBeGreaterThan(80);
  });

  it("builds the final screening report", () => {
    const proof = normalizeProofPayload(
      {
        pattern: "thread-3",
        data: {
          verification_result: "ProofValidated",
          thid: "thread-3",
          holder_did: "did:key:test-report",
          requested_presentation: {
            revealed_attrs: {
              "Student ID": [{ value: "1234" }],
              "Student Name": [{ value: "Dechen" }],
              "College Name": [{ value: "RUB" }],
              "Programme Name": [{ value: "BSc" }],
              "Enrollment Year": [{ value: "2022" }],
              "Programme Duration": [{ value: "4 years" }],
            },
          },
        },
      },
      "studentId",
      "mock",
    );

    const report = buildScreeningReport("mock", proof, {
      gradingScale: "gpa4",
      gradeValue: 3.2,
      institutionName: "University of Delhi",
      country: "India",
    });

    expect(report.candidateName).toBe("Dechen");
    expect(report.conversion.normalizedScore).toBe(80);
    expect(report.decision).toBe("eligible");
  });
});
