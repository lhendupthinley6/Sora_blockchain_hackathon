import cors from "cors";
import express from "express";
import QRCode from "qrcode";
import {
  buildProofRequest,
  buildScreeningReport,
  buildStandaloneScreeningReport,
  createMockIssueResult,
  createMockProofResult,
  createMockVerificationStart,
  type GradeScale,
  normalizeProofPayload,
  RUB_SCHEMAS,
  type IssueCredentialRequest,
  type ManualGradeInput,
  type SoraMode,
  type SupportedCredentialSchema,
  type VerificationScope,
} from "sora-sdk";
import type { AppConfig } from "./config";
import { FlowStore } from "./store";
import { NdiClient, type NdiProofStart } from "./ndiClient";
import { NdiNatsTransport } from "./natsTransport";

const numericFields: Record<SupportedCredentialSchema, string[]> = {
  studentId: [],
  academicCertificate: ["Student ID"],
};

function assertScope(value: unknown): VerificationScope {
  if (
    value === "studentId" ||
    value === "academicCertificate" ||
    value === "combined" ||
    value === "holderDiscovery"
  ) {
    return value;
  }

  throw new Error("Invalid verification scope.");
}

function assertManualGrades(value: unknown): ManualGradeInput {
  if (!value || typeof value !== "object") {
    throw new Error("Manual grades are required.");
  }

  const input = value as ManualGradeInput;
  if (!input.institutionName) {
    throw new Error("institutionName is required.");
  }
  const allowedScales: GradeScale[] = ["gpa4", "cgpa10"];
  if (!allowedScales.includes(input.gradingScale)) {
    throw new Error("Unsupported gradingScale.");
  }
  if (typeof input.gradeValue !== "number") {
    throw new Error("gradeValue is required for numeric grading scales.");
  }
  const maxValue = input.gradingScale === "gpa4" ? 4 : 10;
  if (input.gradeValue < 0 || input.gradeValue > maxValue) {
    throw new Error(`gradeValue must be between 0 and ${maxValue} for ${input.gradingScale}.`);
  }
  return input;
}

function coerceIssueCredentialRequest(value: unknown): IssueCredentialRequest {
  if (!value || typeof value !== "object") {
    throw new Error("Issuance request body is required.");
  }

  const request = value as IssueCredentialRequest;
  if (request.schema !== "studentId" && request.schema !== "academicCertificate") {
    throw new Error("Unsupported credential schema.");
  }
  if (!request.holderDID) {
    throw new Error("holderDID is required.");
  }
  if (!request.credentialData || typeof request.credentialData !== "object") {
    throw new Error("credentialData is required.");
  }

  const normalizedCredentialData: Record<string, string | number> = {};
  for (const [key, rawValue] of Object.entries(request.credentialData)) {
    if (numericFields[request.schema].includes(key)) {
      const numericValue =
        typeof rawValue === "number" ? rawValue : Number.parseInt(String(rawValue), 10);
      if (Number.isNaN(numericValue)) {
        throw new Error(`Attribute ${key} must be numeric.`);
      }
      normalizedCredentialData[key] = numericValue;
    } else {
      normalizedCredentialData[key] = String(rawValue);
    }
  }

  return {
    ...request,
    credentialData: normalizedCredentialData,
  };
}

function createIssueTemplate(schema: SupportedCredentialSchema) {
  if (schema === "studentId") {
    return {
      "Student ID": 20240001,
      "Student Name": "Sonam Choden",
      "College Name": "Royal University of Bhutan",
      "Programme Name": "BSc Information Technology",
      "Enrollment Year": 2021,
      "Programme Duration": "4 years",
    };
  }

  return {
    "Issuer Name": "RUB Registrar",
    "Student ID": 20240001,
    "Student Name": "Sonam Choden",
    "Title of Award": "Bachelor of Science in Information Technology",
    "College Name": "Royal University of Bhutan",
  };
}

function resolveMode(config: AppConfig, headerMode: unknown): SoraMode {
  if (headerMode === "mock" || headerMode === "ndi") {
    return headerMode;
  }

  return config.mode;
}

async function withQrSvg(
  start: NdiProofStart,
  mode: SoraMode,
  scope: VerificationScope,
  transport: "webhook" | "nats",
) {
  return {
    threadId: start.proofRequestThreadId,
    proofRequestURL: start.proofRequestURL,
    deepLinkURL: start.deepLinkURL,
    qrSvg: await QRCode.toString(start.proofRequestURL, { type: "svg", margin: 0 }),
    mode,
    transport,
    scope,
  };
}

function applyTransportEvent(
  store: FlowStore,
  payload: unknown,
  transport: "webhook" | "nats",
) {
  const threadId =
    (payload as { pattern?: string; data?: { thid?: string } })?.pattern ??
    (payload as { data?: { thid?: string } })?.data?.thid;

  if (!threadId || !store.has(threadId)) {
    return { ok: false as const, error: "Unknown thread." };
  }

  const flow = store.get(threadId)!;
  const eventId = JSON.stringify(payload);
  if (flow.lastEventId === eventId) {
    return { ok: true as const, deduped: true };
  }

  flow.lastEventId = eventId;
  flow.lastTransportPayload = payload;

  if (flow.flowType === "issuance") {
    flow.status = "accepted";
    if (flow.issueResult) {
      flow.issueResult = {
        ...flow.issueResult,
        acceptanceStatus: "accepted",
        acceptancePayload: payload,
      };
    }
    flow.error = undefined;
    store.set(threadId, flow);
    return { ok: true as const, deduped: false };
  }

  const normalized = normalizeProofPayload(
    payload as Parameters<typeof normalizeProofPayload>[0],
    flow.scope,
    transport,
  );
  flow.normalizedResult = normalized;
  flow.status = normalized.verified ? "completed" : "failed";
  flow.error = normalized.verified ? undefined : "Credential proof was not validated.";
  store.set(threadId, flow);
  return { ok: true as const, deduped: false };
}

export function createApp(
  config: AppConfig,
  options?: {
    store?: FlowStore;
    ndiClient?: NdiClient;
    ndiNatsTransport?: NdiNatsTransport;
  },
) {
  const app = express();
  const store = options?.store ?? new FlowStore();
  const ndiClient = options?.ndiClient ?? new NdiClient(config);
  const ndiNatsTransport =
    options?.ndiNatsTransport ??
    new NdiNatsTransport(config, (payload, transport) => {
      applyTransportEvent(store, payload, transport);
    });

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, mode: config.mode, transport: config.ndiTransport });
  });

  app.post("/api/verification/start", async (req, res) => {
    try {
      const scope = assertScope(req.body?.scope);
      const mode = resolveMode(config, req.headers["x-sora-mode"]);

      if (mode === "mock") {
        const start = createMockVerificationStart(scope);
        const normalized = createMockProofResult(start.threadId, scope);
        store.set(start.threadId, {
          flowType: "proof",
          scope,
          status: "completed",
          transport: "mock",
          start,
          normalizedResult: normalized,
        });
        res.status(201).json(start);
        return;
      }

      if (config.ndiTransport === "nats") {
        await ndiNatsTransport.ensureConnected();
      } else {
        await ndiClient.ensureWebhookRegistered();
      }
      const response = await ndiClient.createProofRequest(buildProofRequest(scope));
      if (config.ndiTransport === "webhook") {
        await ndiClient.subscribeWebhook(response.proofRequestThreadId);
      }
      const start = await withQrSvg(response, mode, scope, config.ndiTransport);
      store.set(start.threadId, {
        flowType: "proof",
        scope,
        status: "pending",
        transport: config.ndiTransport,
        start,
      });
      res.status(201).json(start);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to start verification." });
    }
  });

  app.get("/api/verification/:threadId", (req, res) => {
    const flow = store.get(req.params.threadId);
    if (!flow) {
      res.status(404).json({ error: "Flow not found." });
      return;
    }

    res.json({
      threadId: req.params.threadId,
      scope: flow.scope,
      status: flow.status,
      transport: flow.transport,
      start: flow.start,
      normalizedResult: flow.normalizedResult,
      report: flow.report,
      issueResult: flow.issueResult,
      lastTransportPayload: flow.lastTransportPayload,
      error: flow.error,
    });
  });

  app.post("/api/screening/report", (req, res) => {
    try {
      const grades = assertManualGrades(req.body?.grades);
      const mode = resolveMode(config, req.headers["x-sora-mode"]);
      const threadId = String(req.body?.threadId ?? "");
      if (!threadId) {
        const report = buildStandaloneScreeningReport(mode, grades);
        res.status(201).json(report);
        return;
      }
      const flow = store.get(threadId);
      if (!flow || !flow.normalizedResult) {
        res.status(404).json({ error: "Verified flow not found." });
        return;
      }

      const report = buildScreeningReport(mode, flow.normalizedResult, grades);
      flow.report = report;
      store.set(threadId, flow);
      res.status(201).json(report);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to generate report." });
    }
  });

  app.post("/oauth/token", (req, res) => {
    const clientId = req.body?.client_id;
    const clientSecret = req.body?.client_secret;
    if (clientId !== config.webhookClientId || clientSecret !== config.webhookClientSecret) {
      res.status(401).json({ error: "invalid_client" });
      return;
    }
    res.json({
      access_token: config.webhookClientSecret,
      expires_in: 3600,
      token_type: "Bearer",
    });
  });

  app.post("/ndi-webhook", (req, res) => {
    if (req.headers.authorization !== `Bearer ${config.webhookClientSecret}`) {
      res.status(401).json({ error: "Unauthorized webhook request." });
      return;
    }

    const threadId = req.body?.pattern ?? req.body?.data?.thid;
    if (!threadId || !store.has(threadId)) {
      res.status(404).json({ error: "Unknown thread." });
      return;
    }

    const result = applyTransportEvent(store, req.body, "webhook");
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ ok: true, deduped: result.deduped });
  });

  app.post("/api/issuance/discover-holder", async (_req, res) => {
    try {
      const scope: VerificationScope = "holderDiscovery";
      const mode = resolveMode(config, _req.headers["x-sora-mode"]);
      if (mode === "mock") {
        const start = createMockVerificationStart(scope);
        const normalized = createMockProofResult(start.threadId, scope);
        store.set(start.threadId, {
          flowType: "proof",
          scope,
          status: "completed",
          transport: "mock",
          start,
          normalizedResult: normalized,
        });
        res.status(201).json(start);
        return;
      }

      if (config.ndiTransport === "nats") {
        await ndiNatsTransport.ensureConnected();
      } else {
        await ndiClient.ensureWebhookRegistered();
      }
      const response = await ndiClient.createProofRequest(buildProofRequest(scope));
      if (config.ndiTransport === "webhook") {
        await ndiClient.subscribeWebhook(response.proofRequestThreadId);
      }
      const start = await withQrSvg(response, mode, scope, config.ndiTransport);
      store.set(start.threadId, {
        flowType: "proof",
        scope,
        status: "pending",
        transport: config.ndiTransport,
        start,
      });
      res.status(201).json(start);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to discover holder." });
    }
  });

  app.post("/api/issuance/issue", async (req, res) => {
    try {
      const issueRequest = coerceIssueCredentialRequest(req.body);
      const mode = resolveMode(config, req.headers["x-sora-mode"]);

      if (mode === "mock") {
        const result = createMockIssueResult(issueRequest);
        store.set(result.issueCredThreadId, {
          flowType: "issuance",
          scope: issueRequest.schema,
          status: "accepted",
          transport: "mock",
          start: {
            threadId: result.issueCredThreadId,
            proofRequestURL: result.credInviteURL,
            deepLinkURL: result.deepLinkURL,
            qrSvg: result.qrSvg ?? `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#f6f1e8"/><text x="12" y="80" fill="#17324d" font-size="14">Issue ${issueRequest.schema}</text></svg>`,
            mode,
            transport: "mock",
            scope: issueRequest.schema,
          },
          issueResult: result,
        });
        res.status(201).json(result);
        return;
      }

      if (config.ndiTransport === "nats") {
        await ndiNatsTransport.ensureConnected();
      } else {
        await ndiClient.ensureWebhookRegistered();
      }
      const result = await ndiClient.issueCredential(issueRequest);
      if (config.ndiTransport === "webhook") {
        await ndiClient.subscribeWebhook(result.issueCredThreadId);
      }
      const qrSvg = await QRCode.toString(result.credInviteURL, { type: "svg", margin: 0 });
      store.set(result.issueCredThreadId, {
        flowType: "issuance",
        scope: issueRequest.schema,
        status: "issued",
        transport: config.ndiTransport,
        start: {
          threadId: result.issueCredThreadId,
          proofRequestURL: result.credInviteURL,
          deepLinkURL: result.deepLinkURL,
          qrSvg,
          mode,
          transport: config.ndiTransport,
          scope: issueRequest.schema,
        },
        issueResult: {
          ...result,
          qrSvg,
          acceptanceStatus: "issued",
        },
      });
      res.status(201).json({
        ...result,
        qrSvg,
        acceptanceStatus: "issued",
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to issue credential." });
    }
  });

  app.get("/api/issuance/template/:schema", (req, res) => {
    const schema = req.params.schema as SupportedCredentialSchema;
    if (!RUB_SCHEMAS[schema]) {
      res.status(404).json({ error: "Unknown schema." });
      return;
    }
    res.json({
      schema,
      schemaUrl: RUB_SCHEMAS[schema].schemaUrl,
      credentialData: createIssueTemplate(schema),
    });
  });

  return { app, store };
}
