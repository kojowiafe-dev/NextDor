import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../app.js";
import type { FastifyInstance } from "fastify";

describe("E2E: Catalog Browsing & Logistics Geo-Pricing", { timeout: 30000 }, () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("retrieves product catalog with pagination metadata via GET /api/v1/products", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products?limit=10&page=1",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.products)).toBe(true);
    expect(body.data.pagination).toBeDefined();
    expect(body.data.pagination.page).toBe(1);
  });

  it("calculates real-time delivery quote for Greater Accra rooftop GPS", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/logistics/quote",
      payload: {
        region: "Greater Accra",
        city: "Accra",
        digitalAddress: "GA-183-9221",
        weightKg: 2.5,
        method: "STANDARD",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    // Verify quote options array contains standard pricing
    if (Array.isArray(body.data)) {
      expect(body.data.length).toBeGreaterThan(0);
      const standard = body.data[0];
      expect(standard.totalFee).toBeGreaterThan(0);
      expect(standard.minDays).toBeDefined();
      expect(standard.zoneCode).toBeDefined();
    }
  });

  it("calculates express vs standard tiered geo-pricing for Ashanti Kumasi", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/logistics/quote",
      payload: {
        region: "Ashanti",
        city: "Kumasi",
        digitalAddress: "AK-039-1122",
        weightKg: 5.0,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    if (Array.isArray(body.data) && body.data.length > 1) {
      const standard = body.data.find((q: any) => q.method === "STANDARD");
      const express = body.data.find((q: any) => q.method === "EXPRESS");
      if (standard && express) {
        expect(express.totalFee).toBeGreaterThanOrEqual(standard.totalFee);
      }
    }
  });
});
