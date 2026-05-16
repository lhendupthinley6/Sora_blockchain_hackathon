import { useEffect, useMemo, useState } from "react";
import type {
  IssueCredentialResult,
  ManualGradeInput,
  NormalizedProofResult,
  ScreeningReport,
  SoraMode,
  SupportedCredentialSchema,
  VerificationScope,
  VerificationStartResult,
} from "sora-sdk";
import { listCountries, listInstitutionsByCountry } from "sora-sdk";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3030";

interface VerificationStatusResponse {
  threadId: string;
  status: "pending" | "completed" | "failed" | "issued" | "accepted";
  start?: VerificationStartResult;
  normalizedResult?: NormalizedProofResult;
  report?: ScreeningReport;
  issueResult?: IssueCredentialResult;
  lastTransportPayload?: unknown;
  error?: string;
}

const verificationActions: Array<{ label: string; scope: VerificationScope }> = [
  { label: "Verify Student ID", scope: "studentId" },
  { label: "Verify Academic Certificate", scope: "academicCertificate" },
  { label: "Verify Both Credentials", scope: "combined" },
];

const issueSchemas: SupportedCredentialSchema[] = ["studentId", "academicCertificate"];

const initialGrades: ManualGradeInput = {
  gradingScale: "cgpa10",
  institutionName: "University of Delhi",
  country: "India",
};

const countryOptions = listCountries();

function App() {
  const [selectedMode, setSelectedMode] = useState<SoraMode>("mock");
  const [activeStart, setActiveStart] = useState<VerificationStartResult | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatusResponse | null>(null);
  const [holderStatus, setHolderStatus] = useState<VerificationStatusResponse | null>(null);
  const [grades, setGrades] = useState<ManualGradeInput>(initialGrades);
  const [report, setReport] = useState<ScreeningReport | null>(null);
  const [issueSchema, setIssueSchema] = useState<SupportedCredentialSchema>("academicCertificate");
  const [issueDraft, setIssueDraft] = useState<Record<string, string | number>>({});
  const [issueResult, setIssueResult] = useState<IssueCredentialResult | null>(null);
  const [issueStatus, setIssueStatus] = useState<VerificationStatusResponse | null>(null);
  const [holderDiscovery, setHolderDiscovery] = useState<VerificationStartResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const verifiedResult = verificationStatus?.normalizedResult;
  const discoveredHolder = holderStatus?.normalizedResult?.holder.holderDid ?? null;
  const institutionOptions = listInstitutionsByCountry(grades.country);
  const gradeValueLimit = grades.gradingScale === "gpa4" ? 4 : 10;
  const holderDid = useMemo(
    () => verifiedResult?.holder.holderDid ?? discoveredHolder ?? "",
    [discoveredHolder, verifiedResult],
  );

  async function callApi<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-sora-mode": selectedMode,
        ...(init?.headers ?? {}),
      },
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error ?? "Request failed");
    }
    return json as T;
  }

  async function startVerification(scope: VerificationScope) {
    setBusy(scope);
    setError(null);
    setReport(null);
    setIssueResult(null);
    try {
      const start = await callApi<VerificationStartResult>("/api/verification/start", {
        method: "POST",
        body: JSON.stringify({ scope }),
      });
      setActiveStart(start);
      setVerificationStatus(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to start verification.");
    } finally {
      setBusy(null);
    }
  }

  async function refreshVerification(threadId: string) {
    try {
      const status = await callApi<VerificationStatusResponse>(`/api/verification/${threadId}`);
      setVerificationStatus(status);
      if (status.report) {
        setReport(status.report);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load verification status.");
    }
  }

  async function refreshHolder(threadId: string) {
    try {
      const status = await callApi<VerificationStatusResponse>(`/api/verification/${threadId}`);
      setHolderStatus(status);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load holder status.");
    }
  }

  async function refreshIssue(threadId: string) {
    try {
      const status = await callApi<VerificationStatusResponse>(`/api/verification/${threadId}`);
      setIssueStatus(status);
      if (status.issueResult) {
        setIssueResult(status.issueResult);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load issuance status.");
    }
  }

  async function submitReport() {
    setBusy("report");
    setError(null);
    try {
      const nextReport = await callApi<ScreeningReport>("/api/screening/report", {
        method: "POST",
        body: JSON.stringify({
          threadId: activeStart?.threadId,
          grades,
        }),
      });
      setReport(nextReport);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to generate screening report.");
    } finally {
      setBusy(null);
    }
  }

  async function discoverHolder() {
    setBusy("holderDiscovery");
    setError(null);
    try {
      const start = await callApi<VerificationStartResult>("/api/issuance/discover-holder", {
        method: "POST",
      });
      setHolderDiscovery(start);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to start holder discovery.");
    } finally {
      setBusy(null);
    }
  }

  async function loadIssueTemplate(schema: SupportedCredentialSchema) {
    try {
      const template = await callApi<{ credentialData: Record<string, string | number> }>(
        `/api/issuance/template/${schema}`,
      );
      setIssueDraft(template.credentialData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load issuance template.");
    }
  }

  async function submitIssuance() {
    setBusy("issuance");
    setError(null);
    if (!holderDid) {
      setBusy(null);
      setError("Discover the holder DID first, then issue the credential.");
      return;
    }
    try {
      const result = await callApi<IssueCredentialResult>("/api/issuance/issue", {
        method: "POST",
        body: JSON.stringify({
          schema: issueSchema,
          holderDID: holderDid,
          credentialData: issueDraft,
        }),
      });
      setIssueResult(result);
      setIssueStatus(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to issue credential.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void loadIssueTemplate(issueSchema);
  }, [issueSchema]);

  useEffect(() => {
    if (!activeStart?.threadId) {
      return;
    }

    void refreshVerification(activeStart.threadId);
    const interval = window.setInterval(() => {
      void refreshVerification(activeStart.threadId);
    }, 2500);

    return () => window.clearInterval(interval);
  }, [activeStart?.threadId]);

  useEffect(() => {
    if (!holderDiscovery?.threadId) {
      return;
    }

    void refreshHolder(holderDiscovery.threadId);
    const interval = window.setInterval(() => {
      void refreshHolder(holderDiscovery.threadId);
    }, 2500);

    return () => window.clearInterval(interval);
  }, [holderDiscovery?.threadId]);

  useEffect(() => {
    if (!issueResult?.issueCredThreadId) {
      return;
    }

    void refreshIssue(issueResult.issueCredThreadId);
    const interval = window.setInterval(() => {
      void refreshIssue(issueResult.issueCredThreadId);
    }, 2500);

    return () => window.clearInterval(interval);
  }, [issueResult?.issueCredThreadId]);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Sora Academic Screening Demo</p>
        <h1>Bhutan NDI verification, manual grades, and a mock screening decision in one operator flow.</h1>
        <div className="mode-switch" role="group" aria-label="mode switch">
          {(["mock", "ndi"] as const).map((mode) => (
            <button
              key={mode}
              className={mode === selectedMode ? "selected" : ""}
              onClick={() => setSelectedMode(mode)}
              type="button"
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="panel">
        <header>
          <p className="section-tag">1. Verification</p>
          <h2>Start a credential proof request</h2>
        </header>
        <div className="button-grid">
          {verificationActions.map((action) => (
            <button
              key={action.scope}
              onClick={() => void startVerification(action.scope)}
              disabled={busy !== null}
              type="button"
            >
              {busy === action.scope ? "Starting..." : action.label}
            </button>
          ))}
        </div>
        {activeStart ? (
          <div className="result-grid">
            <article className="card">
              <h3>Current proof</h3>
              <p>Mode: {selectedMode}</p>
              <p>Thread: {activeStart.threadId}</p>
              <p>Transport: {activeStart.transport}</p>
              <a href={activeStart.deepLinkURL}>Open wallet deep link</a>
            </article>
            <article className="card">
              <h3>QR payload</h3>
              <div dangerouslySetInnerHTML={{ __html: activeStart.qrSvg }} />
            </article>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <header>
          <p className="section-tag">2. Verified data</p>
          <h2>Normalized credentials</h2>
        </header>
        {verificationStatus ? (
          <div className="card-stack">
            <article className="card">
              <p>Status: {verificationStatus.status}</p>
              <p>Holder DID: {verifiedResult?.holder.holderDid ?? "Pending"}</p>
              <p>Verification result: {verifiedResult?.verificationResult ?? "Waiting for callback"}</p>
            </article>
            <article className="card">
              <h3>Revealed attributes</h3>
              <pre>{JSON.stringify(verifiedResult?.rawRevealedAttributes ?? {}, null, 2)}</pre>
            </article>
          </div>
        ) : (
          <p className="muted">No verification result yet.</p>
        )}
      </section>

      <section className="panel">
        <header>
          <p className="section-tag">3. Grades</p>
          <h2>Contextual grade conversion input</h2>
        </header>
        <div className="card-stack">
          <article className="card">
            <label>
              Grading scale
              <select
                value={grades.gradingScale}
                onChange={(event) =>
                  setGrades((current) => ({
                    ...current,
                    gradingScale: event.target.value as ManualGradeInput["gradingScale"],
                  }))
                }
              >
                <option value="gpa4">4.0 GPA</option>
                <option value="cgpa10">10.0 CGPA</option>
              </select>
            </label>
            <label>
              Country
              <select
                value={grades.country ?? ""}
                onChange={(event) =>
                  setGrades((current) => ({
                    ...current,
                    country: event.target.value || undefined,
                    institutionName: listInstitutionsByCountry(event.target.value)[0] ?? current.institutionName,
                  }))
                }
              >
                {countryOptions.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Institution
              <select
                value={grades.institutionName}
                onChange={(event) =>
                  setGrades((current) => ({
                    ...current,
                    institutionName: event.target.value,
                  }))
                }
              >
                {institutionOptions.map((institution) => (
                  <option key={institution} value={institution}>
                    {institution}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Grade value
              <input
                aria-label="grade-value"
                type="number"
                step="0.01"
                min="0"
                max={gradeValueLimit}
                value={grades.gradeValue ?? ""}
                onChange={(event) =>
                  setGrades((current) => ({
                    ...current,
                    gradeValue: event.target.value ? Number(event.target.value) : undefined,
                  }))
                }
              />
            </label>
          </article>
        </div>
        <button className="primary-action" onClick={() => void submitReport()} type="button">
          {busy === "report" ? "Generating..." : "Generate Contextual Report"}
        </button>
      </section>

      <section className="panel">
        <header>
          <p className="section-tag">4. Issuance</p>
          <h2>Discover holder DID and issue a credential</h2>
        </header>
        <div className="button-grid">
          <button onClick={() => void discoverHolder()} type="button">
            {busy === "holderDiscovery" ? "Starting..." : "Discover Holder DID"}
          </button>
          <select value={issueSchema} onChange={(event) => setIssueSchema(event.target.value as SupportedCredentialSchema)}>
            {issueSchemas.map((schema) => (
              <option key={schema} value={schema}>
                {schema}
              </option>
            ))}
          </select>
          <button onClick={() => void submitIssuance()} type="button">
            {busy === "issuance" ? "Issuing..." : "Issue Credential"}
          </button>
        </div>
        <article className="card">
          <p>Issuance holder DID: {holderDid || "Awaiting discovery or verified proof"}</p>
          {holderDiscovery ? <p>Discovery thread: {holderDiscovery.threadId}</p> : null}
          <pre>{JSON.stringify(issueDraft, null, 2)}</pre>
        </article>
        {holderDiscovery ? (
          <div className="result-grid">
            <article className="card">
              <h3>Holder discovery proof</h3>
              <p>Status: {holderStatus?.status ?? "pending"}</p>
              <a href={holderDiscovery.deepLinkURL}>Open holder discovery deep link</a>
            </article>
            <article className="card">
              <h3>Discovery QR</h3>
              <div dangerouslySetInnerHTML={{ __html: holderDiscovery.qrSvg }} />
            </article>
          </div>
        ) : null}
        {issueResult ? (
          <div className="result-grid">
            <article className="card">
              <h3>Issuance result</h3>
              <p>Issue thread: {issueResult.issueCredThreadId}</p>
              <p>Status: {issueStatus?.status ?? issueResult.acceptanceStatus ?? "issued"}</p>
              <a href={issueResult.deepLinkURL}>Open issuance deep link</a>
              <p className="muted">
                The holder must scan or open the invite and accept it in the Bhutan NDI wallet.
              </p>
            </article>
            <article className="card">
              <h3>Credential invite QR</h3>
              <div
                dangerouslySetInnerHTML={{
                  __html: issueStatus?.start?.qrSvg ?? issueResult.qrSvg ?? "<p>QR pending</p>",
                }}
              />
            </article>
            <article className="card">
              <h3>Acceptance payload</h3>
              <pre>{JSON.stringify(issueStatus?.issueResult?.acceptancePayload ?? issueStatus?.lastTransportPayload ?? {}, null, 2)}</pre>
            </article>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <header>
          <p className="section-tag">5. Final report</p>
          <h2>Screening output</h2>
        </header>
        {report ? (
          <article className="report-card">
            <h3>Converted Percentage</h3>
            <p>{report.conversion.convertedScore}%</p>
          </article>
        ) : (
          <p className="muted">Generate a report from grade and university input, with or without verification.</p>
        )}
      </section>
    </main>
  );
}

export default App;
