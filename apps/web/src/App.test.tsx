import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  it("progresses through verification and report generation", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/issuance/template/academicCertificate")) {
        return {
          ok: true,
          json: async () => ({
            schema: "academicCertificate",
            credentialData: {
              "Issuer Name": "RUB Registrar",
              "Student ID": 20240001,
            },
          }),
        };
      }

      if (url.endsWith("/api/verification/start") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            threadId: "thread-123",
            proofRequestURL: "https://example.com/proof",
            deepLinkURL: "bhutanndidemo://proof",
            qrSvg: "<svg></svg>",
            mode: "mock",
            transport: "mock",
            scope: "combined",
          }),
        };
      }

      if (url.endsWith("/api/verification/thread-123")) {
        return {
          ok: true,
          json: async () => ({
            threadId: "thread-123",
            status: "completed",
            normalizedResult: {
              verified: true,
              threadId: "thread-123",
              holder: { holderDid: "did:key:test-holder" },
              scope: "combined",
              transport: "mock",
              verificationResult: "ProofValidated",
              rawRevealedAttributes: { "Student Name": "Sonam Choden" },
              credentials: {},
            },
          }),
        };
      }

      if (url.endsWith("/api/screening/report") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            threadId: "thread-123",
            scope: "combined",
            mode: "mock",
            verified: true,
            candidateName: "Sonam Choden",
            holderDid: "did:key:test-holder",
            credentialSummary: [],
            gradeInput: {
              gradingScale: "cgpa10",
              gradeValue: 8.5,
              institutionName: "University of Delhi",
              country: "India",
            },
            conversion: {
              normalizedScore: 85,
              contextFactor: 1.05,
              convertedScore: 78,
              gradeBand: "merit",
              explanation: ["Context applied"],
              institution: {
                institutionName: "University of Delhi",
                country: "India",
                gdi: 0.9,
                si: 0.92,
                gds: 0.35,
                arf: 0.9,
              },
              usedFallbackInstitution: false,
              factors: {
                gdiFactor: 0.99,
                siFactor: 1.01,
                gdsFactor: 1.02,
                arfFactor: 0.98,
              },
            },
            decision: "eligible",
            decisionReason: "Verified credentials passed.",
            generatedAt: new Date().toISOString(),
          }),
        };
      }

      throw new Error(`Unhandled fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Verify Both Credentials" }));

    await waitFor(() => {
      expect(screen.getByText(/Thread: thread-123/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate Contextual Report" }));

    await waitFor(() => {
      expect(screen.getByText("Converted Percentage")).toBeInTheDocument();
      expect(screen.getByText("78%")).toBeInTheDocument();
    });
  });
});
