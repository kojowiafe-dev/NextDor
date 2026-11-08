/**
 * Ledger account seed — Chart of Accounts (Spec §6).
 *
 * Run via: npx ts-node src/scripts/seed.ledger.ts
 * Or include in the main prisma/seed.ts.
 *
 * These rows MUST exist before any ledger entry is written.
 * The codes here must exactly match the ACCOUNTS constants in ledger.service.ts.
 */

import { prisma } from "../lib/prisma.js";

const ACCOUNTS = [
  // ── Assets ──────────────────────────────────────────────────────────────
  {
    code: "GATEWAY_CLEARING",
    name: "Gateway Clearing",
    accountType: "ASSET" as const,
    description: "Money Paystack holds on behalf of NextDor, not yet settled to bank",
  },
  {
    code: "BANK_MOMO_SETTLEMENT",
    name: "Bank / MoMo Settlement",
    accountType: "ASSET" as const,
    description: "Funds settled from Paystack into the NextDor bank or MoMo account",
  },
  {
    code: "PAYOUT_IN_TRANSIT",
    name: "Payout In Transit",
    accountType: "ASSET" as const,
    description: "Vendor payout initiated but not yet confirmed by the gateway",
  },

  // ── Liabilities ──────────────────────────────────────────────────────────
  {
    code: "VENDOR_PAYABLE_PENDING",
    name: "Vendor Payable — Pending Fulfilment",
    accountType: "LIABILITY" as const,
    description: "Vendor earnings owed, waiting for fulfilment to start",
  },
  {
    code: "VENDOR_PAYABLE_ESCROW",
    name: "Vendor Payable — Escrow",
    accountType: "LIABILITY" as const,
    description: "Vendor earnings in the 48-hour inspection escrow window",
  },
  {
    code: "VENDOR_PAYABLE_AVAILABLE",
    name: "Vendor Payable — Available",
    accountType: "LIABILITY" as const,
    description: "Vendor earnings cleared and eligible for payout",
  },
  {
    code: "VENDOR_PAYABLE_DISPUTED",
    name: "Vendor Payable — Disputed",
    accountType: "LIABILITY" as const,
    description: "Vendor earnings frozen pending admin dispute resolution",
  },
  {
    code: "COURIER_PAYABLE",
    name: "Courier Payable",
    accountType: "LIABILITY" as const,
    description: "Amount owed to outsourced courier partners from delivery fees",
  },
  {
    code: "DEFERRED_COMMISSION_REV",
    name: "Deferred Commission Revenue",
    accountType: "LIABILITY" as const,
    description: "Commission collected but not yet recognised (recognise at order completion)",
  },
  {
    code: "DEFERRED_DELIVERY_REV",
    name: "Deferred Delivery Revenue",
    accountType: "LIABILITY" as const,
    description: "Delivery fees collected but not yet recognised",
  },
  {
    code: "REFUNDS_PAYABLE",
    name: "Refunds Payable",
    accountType: "LIABILITY" as const,
    description: "Amount owed back to customers (awaiting Paystack refund processing)",
  },

  // ── Revenue ──────────────────────────────────────────────────────────────
  {
    code: "COMMISSION_REVENUE",
    name: "Commission Revenue",
    accountType: "REVENUE" as const,
    description: "Platform commission recognised when order completes (escrow cleared)",
  },
  {
    code: "DELIVERY_REVENUE",
    name: "Delivery Revenue",
    accountType: "REVENUE" as const,
    description: "Delivery fee revenue recognised when order completes",
  },

  // ── Expenses ─────────────────────────────────────────────────────────────
  {
    code: "GATEWAY_FEE_EXPENSE",
    name: "Gateway Fee Expense",
    accountType: "EXPENSE" as const,
    description: "Paystack collection fees (platform expense, not deducted from vendor)",
  },
  {
    code: "PAYOUT_FEE_EXPENSE",
    name: "Payout Fee Expense",
    accountType: "EXPENSE" as const,
    description: "Paystack transfer fees charged when disbursing vendor payouts",
  },
];

export async function seedLedgerAccounts() {
  console.log("Seeding ledger chart of accounts…");

  for (const account of ACCOUNTS) {
    await prisma.ledgerAccount.upsert({
      where: { code: account.code },
      update: { name: account.name, description: account.description, isActive: true },
      create: account,
    });
    console.log(`  ✓ ${account.code}`);
  }

  console.log(`Ledger seed complete — ${ACCOUNTS.length} accounts.`);
}

// Allow running directly
if (process.argv[1] && process.argv[1].includes("seed.ledger")) {
  seedLedgerAccounts()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
