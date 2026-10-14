import { describe, it, expect } from "vitest";
import { LogisticsService, DEFAULT_RATES } from "../logistics.service.js";
import { Money } from "../../../domain/Money.js";
import type { LogisticsRepository } from "../logistics.repository.js";

describe("Phase 9: Dynamic Delivery Zones, Geo-Pricing & Logistics Invariants", () => {
  it("provides standard fallback rates when no custom zone is found", async () => {
    const mockRepo = {
      findMatchingZone: async () => null,
    } as unknown as LogisticsRepository;

    const service = new LogisticsService(mockRepo);
    const quotes = await service.calculateQuote({
      region: "Volta",
      district: "Ho",
    });

    expect(quotes).toHaveLength(3);
    const standard = quotes.find((q) => q.method === "STANDARD")!;
    const express = quotes.find((q) => q.method === "EXPRESS")!;
    const pickup = quotes.find((q) => q.method === "PICKUP")!;

    expect(standard.totalFee).toBe(25.0);
    expect(express.totalFee).toBe(50.0);
    expect(pickup.totalFee).toBe(0.0);
  });

  it("calculates tiered pricing with additional per-kg weight fees accurately", async () => {
    const mockRepo = {
      findMatchingZone: async () => ({
        id: "zone-1",
        name: "Greater Accra Metropolitan",
        code: "ACCRA_METRO",
        region: "Greater Accra",
        districts: ["Accra", "Tema"],
        postCodePrefixes: ["GA", "GT"],
        isActive: true,
        rates: [
          {
            id: "rate-1",
            zoneId: "zone-1",
            deliveryMethod: "STANDARD",
            baseFee: 30.0,
            perKgFee: 8.0,
            minDays: 1,
            maxDays: 2,
            isActive: true,
          },
          {
            id: "rate-2",
            zoneId: "zone-1",
            deliveryMethod: "EXPRESS",
            baseFee: 65.0,
            perKgFee: 12.0,
            minDays: 1,
            maxDays: 1,
            isActive: true,
          },
        ],
      }),
    } as unknown as LogisticsRepository;

    const service = new LogisticsService(mockRepo);

    // 1kg base package (no extra weight fee)
    const baseQuotes = await service.calculateQuote({
      region: "Greater Accra",
      district: "Accra",
      weightKg: 1.0,
    });
    const standardBase = baseQuotes.find((q) => q.method === "STANDARD")!;
    expect(standardBase.baseFee).toBe(30.0);
    expect(standardBase.weightFee).toBe(0.0);
    expect(standardBase.totalFee).toBe(30.0);

    // 4.5kg package (ceil(4.5 - 1) = 4 extra kg * 8 = 32.0 extra weight fee -> total 62.0)
    const heavyQuotes = await service.calculateQuote({
      region: "Greater Accra",
      district: "Accra",
      weightKg: 4.5,
    });
    const standardHeavy = heavyQuotes.find((q) => q.method === "STANDARD")!;
    expect(standardHeavy.baseFee).toBe(30.0);
    expect(standardHeavy.weightFee).toBe(32.0);
    expect(standardHeavy.totalFee).toBe(62.0);

    const expressHeavy = heavyQuotes.find((q) => q.method === "EXPRESS")!;
    expect(expressHeavy.baseFee).toBe(65.0);
    expect(expressHeavy.weightFee).toBe(48.0); // 4 * 12
    expect(expressHeavy.totalFee).toBe(113.0);
  });

  it("extracts GhanaPost GPS prefix from digital addresses accurately", () => {
    const parsePrefix = (address: string) => address.trim().toUpperCase().split(/[- ]/)[0];

    expect(parsePrefix("GA-183-9281")).toBe("GA");
    expect(parsePrefix("AK-039-4491")).toBe("AK");
    expect(parsePrefix("gt 029 1102")).toBe("GT");
    expect(parsePrefix("WR-102-3301")).toBe("WR");
  });

  it("resolves checkout delivery fee as a Money object without rounding drift", async () => {
    const mockRepo = {
      findMatchingZone: async () => ({
        id: "zone-ashanti",
        name: "Kumasi Urban",
        code: "KUMASI_URBAN",
        region: "Ashanti",
        districts: ["Kumasi"],
        postCodePrefixes: ["AK"],
        isActive: true,
        rates: [
          {
            id: "rate-ashanti-std",
            zoneId: "zone-ashanti",
            deliveryMethod: "STANDARD",
            baseFee: 35.5,
            perKgFee: 5.25,
            minDays: 2,
            maxDays: 3,
            isActive: true,
          },
        ],
      }),
    } as unknown as LogisticsRepository;

    const service = new LogisticsService(mockRepo);
    const feeMoney = await service.resolveCheckoutDeliveryFee({
      region: "Ashanti",
      district: "Kumasi",
      method: "STANDARD",
      weightKg: 3.0, // extra 2kg * 5.25 = 10.50 -> total 46.00
    });

    expect(feeMoney.toMajor()).toBe(46.0);
    expect(feeMoney.toMinor()).toBe(4600);
  });
});
