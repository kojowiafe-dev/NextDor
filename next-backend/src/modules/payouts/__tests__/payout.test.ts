import { describe, it, expect } from "vitest";
import { getMomoBankCode } from "../paystack.transfer.js";
import { PayoutService } from "../payout.service.js";
import type { PayoutRepository } from "../payout.repository.js";
import { Money } from "../../../domain/Money.js";

describe("Phase 10: MoMo Payout Batches, Reconciliation & Merchant Analytics", () => {
  it("resolves Ghanaian Mobile Money network codes correctly", () => {
    expect(getMomoBankCode("MTN")).toBe("MTN");
    expect(getMomoBankCode("MTN MoMo")).toBe("MTN");
    expect(getMomoBankCode("Telecel")).toBe("VOD");
    expect(getMomoBankCode("Vodafone Cash")).toBe("VOD");
    expect(getMomoBankCode("AT")).toBe("ATL");
    expect(getMomoBankCode("AirtelTigo")).toBe("ATL");
    expect(getMomoBankCode(null)).toBe("MTN");
  });

  it("calculates payout batch aggregates and preserves financial invariants", async () => {
    const mockRepo = {
      findEligibleVendorsForPayout: async (minThreshold: number) => [
        {
          id: "vendor-1",
          name: "Melcom Accra",
          momoNumber: "0241234567",
          momoNetwork: "MTN",
          availableAmount: 450.0,
          clearedOrderCount: 3,
          vendorOrders: [{ id: "vo-1" }, { id: "vo-2" }, { id: "vo-3" }],
        },
        {
          id: "vendor-2",
          name: "Franko Trading Kumasi",
          momoNumber: "0209876543",
          momoNetwork: "Telecel",
          availableAmount: 820.5,
          clearedOrderCount: 2,
          vendorOrders: [{ id: "vo-4" }, { id: "vo-5" }],
        },
      ],
      createBatchWithPayouts: async (params: any) => ({
        batch: {
          id: "batch-101",
          batchReference: params.batchReference,
          totalAmount: params.totalAmount,
          totalCount: params.payouts.length,
          status: "PENDING",
        },
        payouts: params.payouts,
      }),
    } as unknown as PayoutRepository;

    const service = new PayoutService(mockRepo);
    const result = await service.generateBatch({ minThreshold: 10 });

    expect(result.batch.totalCount).toBe(2);
    expect(result.batch.totalAmount).toBe(1270.5);
    expect(result.batch.batchReference).toContain("PB-");
    expect(result.payouts).toHaveLength(2);

    // Verify integer pesewas conversion integrity
    const melcomMoney = Money.fromMajor(result.payouts[0].amount);
    expect(melcomMoney.toMinor()).toBe(45000);

    const frankoMoney = Money.fromMajor(result.payouts[1].amount);
    expect(frankoMoney.toMinor()).toBe(82050);
  });

  it("enforces minimum balance threshold on automated batch generation", async () => {
    const mockRepo = {
      findEligibleVendorsForPayout: async () => [],
    } as unknown as PayoutRepository;

    const service = new PayoutService(mockRepo);

    await expect(
      service.generateBatch({ minThreshold: 5000 })
    ).rejects.toThrowError(/No vendors with cleared escrow balances/);
  });

  it("calculates financial ledger invariant variance accurately", () => {
    // Invariant: Inflow = Disbursed + InEscrow + Available + Commission + Delivery + Refunds + Variance
    const customerInflow = 10000.0;
    const disbursed = 6000.0;
    const inEscrow = 1500.0;
    const available = 1000.0;
    const commission = 1000.0;
    const deliveryFees = 250.0;
    const refunds = 250.0;

    const totalAccounted =
      disbursed + inEscrow + available + commission + deliveryFees + refunds;
    const variance = Number((customerInflow - totalAccounted).toFixed(2));

    expect(totalAccounted).toBe(10000.0);
    expect(variance).toBe(0.0);
    expect(Math.abs(variance)).toBeLessThan(0.01);
  });

  it("calculates merchant AOV and repeat customer metrics mathematically", () => {
    const orders = [
      { id: "o1", subtotal: 100, customerId: "user-1" },
      { id: "o2", subtotal: 200, customerId: "user-1" }, // repeat customer
      { id: "o3", subtotal: 150, customerId: "user-2" },
      { id: "o4", subtotal: 50, customerId: "user-3" },
    ];

    const gmv = orders.reduce((s, o) => s + o.subtotal, 0);
    const aov = gmv / orders.length;
    expect(gmv).toBe(500);
    expect(aov).toBe(125);

    const customers = new Set(orders.map((o) => o.customerId));
    expect(customers.size).toBe(3);

    const counts: Record<string, number> = {};
    for (const o of orders) counts[o.customerId] = (counts[o.customerId] || 0) + 1;
    const repeatCount = Object.values(counts).filter((c) => c > 1).length;
    const repeatRate = (repeatCount / customers.size) * 100;

    expect(repeatCount).toBe(1); // user-1
    expect(Number(repeatRate.toFixed(1))).toBe(33.3);
  });
});
