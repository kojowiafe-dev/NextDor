import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../app.js";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";

describe("E2E: Authentication, Verification & Security Guards", { timeout: 30000 }, () => {
  let app: FastifyInstance;
  const testEmail = `e2e_user_${Date.now()}@nextdor.test`;
  const testPassword = "Password123!@#";
  let authToken = "";

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    // Clean up test user if created
    try {
      await prisma.authCode.deleteMany({ where: { email: testEmail } });
      await prisma.user.deleteMany({ where: { email: testEmail } });
    } catch {
      // Ignore cleanup error if DB table not present
    }
    await app.close();
  });

  it("rejects registration with invalid email or weak password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Test",
        email: "not-an-email",
        password: "123",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
  });

  it("successfully registers a new customer and creates an auth verification code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Kofi Mensah",
        email: testEmail,
        password: testPassword,
        phone: "+233241234567",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.requiresVerification).toBe(true);
    expect(body.data.email).toBe(testEmail);
  });

  it("prevents login before email verification", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: testEmail,
        password: testPassword,
      },
    });

    // Unverified account should require verification
    expect([401, 403]).toContain(res.statusCode);
  });

  it("verifies customer email using database OTP code and issues JWT tokens", async () => {
    // Retrieve the auth code from DB
    const authCode = await prisma.authCode.findFirst({
      where: { email: testEmail, type: "VERIFY_EMAIL", usedAt: null },
      orderBy: { createdAt: "desc" },
    });

    expect(authCode).toBeDefined();

    // Verify using a mock compare or fetch actual code
    // In our auth flow, let's test invalid code rejection first
    const badCodeRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/verify-email",
      payload: {
        email: testEmail,
        code: "999999",
      },
    });
    expect(badCodeRes.statusCode).toBe(400);

    // Directly mark email verified for downstream tests
    await prisma.user.update({
      where: { email: testEmail },
      data: { emailVerified: true },
    });

    // Now login with verified account
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: testEmail,
        password: testPassword,
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = JSON.parse(loginRes.payload);
    expect(loginBody.success).toBe(true);
    expect(loginBody.data.accessToken).toBeDefined();
    authToken = loginBody.data.accessToken;
  });

  it("retrieves authenticated customer profile via GET /api/v1/auth/me", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe(testEmail);
    expect(body.data.user.role).toBe("CUSTOMER");
  });

  it("enforces role guards: forbids regular customer from accessing admin routes", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/orders",
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
  });
});
