import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";

describe("API integration", () => {
  it("starts and resolves a mock sign-in flow", async () => {
    const { app } = createApp(loadConfig({ SORA_MODE: "mock" }));

    const startResponse = await request(app)
      .post("/api/auth/sign-in/start")
      .send({ role: "verifier" })
      .expect(201);

    expect(startResponse.body.scope).toBe("signIn");
    expect(startResponse.body.role).toBe("verifier");

    const statusResponse = await request(app)
      .get(`/api/auth/sign-in/${startResponse.body.threadId}`)
      .expect(200);

    expect(statusResponse.body.status).toBe("completed");
    expect(statusResponse.body.profile.fullName).toBe("Sonam Choden");
    expect(statusResponse.body.role).toBe("verifier");
  });

  it("runs the mock verification and screening flow", async () => {
    const { app } = createApp(loadConfig({ SORA_MODE: "mock" }));

    const startResponse = await request(app)
      .post("/api/verification/start")
      .send({ scope: "combined" })
      .expect(201);

    const threadId = startResponse.body.threadId as string;
    const verificationResponse = await request(app).get(`/api/verification/${threadId}`).expect(200);
    expect(verificationResponse.body.status).toBe("completed");
    expect(verificationResponse.body.normalizedResult.credentials.studentId.studentName).toBe(
      "Sonam Choden",
    );

    const reportResponse = await request(app)
      .post("/api/screening/report")
      .send({
        threadId,
        grades: {
          gradingScale: "cgpa10",
          gradeValue: 8.2,
          institutionName: "University of Delhi",
          country: "India",
        },
      })
      .expect(201);

    expect(reportResponse.body.decision).toBe("eligible");
  });

  it("generates a standalone contextual report without verification", async () => {
    const { app } = createApp(loadConfig({ SORA_MODE: "mock" }));

    const reportResponse = await request(app)
      .post("/api/screening/report")
      .send({
        grades: {
          gradingScale: "gpa4",
          gradeValue: 3.6,
          institutionName: "University of Delhi",
          country: "India",
        },
      })
      .expect(201);

    expect(reportResponse.body.threadId).toBe("converter-only");
    expect(reportResponse.body.verified).toBe(false);
    expect(reportResponse.body.conversion.normalizedScore).toBe(90);
  });

  it("deduplicates webhook deliveries", async () => {
    const { app } = createApp(loadConfig({ SORA_MODE: "mock" }));
    const startResponse = await request(app)
      .post("/api/verification/start")
      .send({ scope: "studentId" })
      .expect(201);
    const threadId = startResponse.body.threadId as string;

    const ndiApp = createApp(
      loadConfig({
        SORA_MODE: "ndi",
        PUBLIC_BASE_URL: "http://localhost:3030",
        NDI_CLIENT_ID: "client",
        NDI_CLIENT_SECRET: "secret",
      }),
    );

    ndiApp.store.set(threadId, {
      flowType: "proof",
      scope: "studentId",
      status: "pending",
      transport: "webhook",
      start: startResponse.body,
    });

    const body = {
      pattern: threadId,
      data: {
        verification_result: "ProofValidated",
        thid: threadId,
        holder_did: "did:key:test-webhook",
        requested_presentation: {
          revealed_attrs: {
            "Student ID": [{ value: "1234" }],
            "Student Name": [{ value: "Pema" }],
            "College Name": [{ value: "RUB" }],
            "Programme Name": [{ value: "BSc" }],
            "Enrollment Year": [{ value: "2020" }],
            "Programme Duration": [{ value: "4 years" }],
          },
        },
      },
    };

    await request(ndiApp.app)
      .post("/ndi-webhook")
      .set("Authorization", "Bearer sora-demo-webhook-secret")
      .send(body)
      .expect(200);

    const secondResponse = await request(ndiApp.app)
      .post("/ndi-webhook")
      .set("Authorization", "Bearer sora-demo-webhook-secret")
      .send(body)
      .expect(200);

    expect(secondResponse.body.deduped).toBe(true);
  });

  it("uses nats transport without webhook registration for live proof starts", async () => {
    const calls: string[] = [];
    const ndiClient = {
      async createProofRequest() {
        calls.push("createProofRequest");
        return {
          proofRequestThreadId: "thread-nats-1",
          proofRequestURL: "https://example.com/proof",
          deepLinkURL: "bhutanndidemo://proof",
        };
      },
      async ensureWebhookRegistered() {
        calls.push("ensureWebhookRegistered");
      },
      async subscribeWebhook() {
        calls.push("subscribeWebhook");
      },
    };
    const natsTransport = {
      async ensureConnected() {
        calls.push("ensureConnected");
      },
    };

    const { app } = createApp(
      loadConfig({
        SORA_MODE: "ndi",
        NDI_TRANSPORT: "nats",
        NDI_CLIENT_ID: "client",
        NDI_CLIENT_SECRET: "secret",
      }),
      {
        ndiClient: ndiClient as never,
        ndiNatsTransport: natsTransport as never,
      },
    );

    const response = await request(app)
      .post("/api/verification/start")
      .send({ scope: "studentId" })
      .expect(201);

    expect(response.body.transport).toBe("nats");
    expect(calls).toEqual(["ensureConnected", "createProofRequest"]);
  });

  it("coerces numeric issuance fields and rejects invalid values", async () => {
    const { app } = createApp(loadConfig({ SORA_MODE: "mock" }));

    const issueResponse = await request(app)
      .post("/api/issuance/issue")
      .send({
        schema: "academicCertificate",
        holderDID: "did:key:test-holder",
        credentialData: {
          "Issuer Name": "RUB",
          "Student ID": "1234",
          "Student Name": "Pema",
          "Title of Award": "BSc",
          "College Name": "RUB",
        },
      })
      .expect(201);

    expect(issueResponse.body.normalizedCredential["Student ID"]).toBe(1234);
    expect(issueResponse.body.acceptanceStatus).toBe("accepted");

    await request(app)
      .post("/api/issuance/issue")
      .send({
        schema: "academicCertificate",
        holderDID: "did:key:test-holder",
        credentialData: {
          "Issuer Name": "RUB",
          "Student ID": "abc",
          "Student Name": "Pema",
          "Title of Award": "BSc",
          "College Name": "RUB",
        },
      })
      .expect(400);
  });

  it("marks issuance threads as accepted when a transport event arrives", async () => {
    const issueThreadId = "issue-thread-123";
    const ndiClient = {
      async ensureWebhookRegistered() {},
      async createProofRequest() {
        return {
          proofRequestThreadId: "unused",
          proofRequestURL: "https://example.com/proof",
          deepLinkURL: "bhutanndidemo://proof",
        };
      },
      async subscribeWebhook() {},
      async issueCredential() {
        return {
          issueCredThreadId: issueThreadId,
          credInviteURL: "https://example.com/cred-invite",
          deepLinkURL: "bhutanndidemo://issue",
          relationshipDid: "relationship-123",
        };
      },
    };
    const natsTransport = {
      async ensureConnected() {},
    };
    const { app } = createApp(
      loadConfig({ SORA_MODE: "ndi", NDI_TRANSPORT: "nats", NDI_CLIENT_ID: "id", NDI_CLIENT_SECRET: "secret" }),
      {
        ndiClient: ndiClient as never,
        ndiNatsTransport: natsTransport as never,
      },
    );

    const issueResponse = await request(app)
      .post("/api/issuance/issue")
      .send({
        schema: "studentId",
        holderDID: "did:key:test-holder",
        credentialData: {
          "Student ID": "20240001",
          "Student Name": "Pema",
          "College Name": "RUB",
          "Programme Name": "BSc",
          "Enrollment Year": "2021",
          "Programme Duration": "4 years",
        },
      })
      .expect(201);

    expect(issueResponse.body.acceptanceStatus).toBe("issued");

    await request(app)
      .post("/ndi-webhook")
      .set("Authorization", "Bearer sora-demo-webhook-secret")
      .send({
        pattern: issueThreadId,
        data: {
          thid: issueThreadId,
          relationshipDid: "relationship-123",
          state: "credential-accepted",
        },
      })
      .expect(200);

    const statusResponse = await request(app).get(`/api/verification/${issueThreadId}`).expect(200);
    expect(statusResponse.body.status).toBe("accepted");
    expect(statusResponse.body.issueResult.acceptanceStatus).toBe("accepted");
  });

  it("returns issuance history for issued credentials", async () => {
    const { app } = createApp(loadConfig({ SORA_MODE: "mock" }));

    const issueResponse = await request(app)
      .post("/api/issuance/issue")
      .send({
        schema: "studentId",
        holderDID: "did:key:test-holder",
        credentialData: {
          "Student ID": "20240001",
          "Student Name": "Pema",
          "College Name": "RUB",
          "Programme Name": "BSc",
          "Enrollment Year": "2021",
          "Programme Duration": "4 years",
        },
      })
      .expect(201);

    const historyResponse = await request(app).get("/api/issuance/history").expect(200);
    expect(historyResponse.body.items).toHaveLength(1);
    expect(historyResponse.body.items[0].threadId).toBe(issueResponse.body.issueCredThreadId);
    expect(historyResponse.body.items[0].acceptanceStatus).toBe("accepted");
  });
});
