/**
 * Ledger Service — Immutable double-entry bookkeeping (Spec §6).
 *
 * DESIGN RULES (enforced here):
 *  1. Every entry is APPEND-ONLY. We never update or delete ledger rows.
 *  2. Total debits must equal total credits per entry (enforced in writeEntry).
 *  3. Every entry carries a source reference (orderId, paymentId, payoutId, or disputeId).
 *  4. All amounts are in INTEGER PESEWAS. Never floats.
 *  5. Account codes match the chart of accounts seeded via ledger.seed.ts.
 *
 * Ledger entries map to spec entries A–J:
 *  A  PAYMENT_RECEIVED     — payment verified
 *  C  ESCROW_START         — delivery verified, escrow window starts
 *  D  ESCROW_CLEARED       — 48h window or early customer confirm, funds available + revenue recognised
 *  E  GATEWAY_SETTLEMENT   — Paystack settles to bank (minus gateway fee)
 *  F  PAYOUT_INITIATED     — payout PROCESSING, funds move to in-transit
 *  G  PAYOUT_CONFIRMED     — gateway confirms payout PAID
 *  H  PAYOUT_FEE           — transfer fee charged
 *  I  PAYOUT_FAILED_REVERSAL — payout FAILED, funds back to AVAILABLE
 *  J  REFUND_FULL / REFUND_PARTIAL — refund entries
 *     DISPUTE_FREEZE / DISPUTE_RELEASE — dispute lifecycle
 */

import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import type { LedgerEntryType, Prisma } from "@prisma/client";

// ─── Account codes (must match seeded LedgerAccount rows) ──────────────────

export const ACCOUNTS = {
  GATEWAY_CLEARING:           "GATEWAY_CLEARING",
  BANK_MOMO_SETTLEMENT:       "BANK_MOMO_SETTLEMENT",
  PAYOUT_IN_TRANSIT:          "PAYOUT_IN_TRANSIT",
  VENDOR_PAYABLE_PENDING:     "VENDOR_PAYABLE_PENDING",
  VENDOR_PAYABLE_ESCROW:      "VENDOR_PAYABLE_ESCROW",
  VENDOR_PAYABLE_AVAILABLE:   "VENDOR_PAYABLE_AVAILABLE",
  VENDOR_PAYABLE_DISPUTED:    "VENDOR_PAYABLE_DISPUTED",
  COURIER_PAYABLE:            "COURIER_PAYABLE",
  DEFERRED_COMMISSION_REV:    "DEFERRED_COMMISSION_REV",
  DEFERRED_DELIVERY_REV:      "DEFERRED_DELIVERY_REV",
  COMMISSION_REVENUE:         "COMMISSION_REVENUE",
  DELIVERY_REVENUE:           "DELIVERY_REVENUE",
  GATEWAY_FEE_EXPENSE:        "GATEWAY_FEE_EXPENSE",
  PAYOUT_FEE_EXPENSE:         "PAYOUT_FEE_EXPENSE",
  REFUNDS_PAYABLE:            "REFUNDS_PAYABLE",
} as const;

type AccountCode = (typeof ACCOUNTS)[keyof typeof ACCOUNTS];

// ─── Line builder helpers ──────────────────────────────────────────────────

interface LineInput {
  accountCode: AccountCode;
  amountPesewas: number;
  isDebit: boolean;
  memo?: string;
  vendorId?: string;
}

function debit(accountCode: AccountCode, amountPesewas: number, memo?: string, vendorId?: string): LineInput {
  return { accountCode, amountPesewas, isDebit: true, memo, vendorId };
}

function credit(accountCode: AccountCode, amountPesewas: number, memo?: string, vendorId?: string): LineInput {
  return { accountCode, amountPesewas, isDebit: false, memo, vendorId };
}

// ─── Validation ───────────────────────────────────────────────────────────

/**
 * Spec §6: "Every transaction has equal total debits and credits, enforced in code."
 * Throws if the ledger is not balanced.
 */
function assertBalanced(lines: LineInput[]): void {
  const totalDebits  = lines.filter(l => l.isDebit).reduce((s, l) => s + l.amountPesewas, 0);
  const totalCredits = lines.filter(l => !l.isDebit).reduce((s, l) => s + l.amountPesewas, 0);
  if (totalDebits !== totalCredits) {
    throw new Error(
      `Ledger entry is not balanced: debits=${totalDebits} pesewas, credits=${totalCredits} pesewas`,
    );
  }
}

// ─── Core write method ────────────────────────────────────────────────────

interface EntryContext {
  orderId?:       string;
  vendorOrderId?: string;
  paymentId?:     string;
  payoutId?:      string;
  disputeId?:     string;
}

async function writeEntry(
  tx: Prisma.TransactionClient,
  entryType: LedgerEntryType,
  description: string,
  lines: LineInput[],
  ctx: EntryContext = {},
): Promise<void> {
  assertBalanced(lines);

  // Resolve account IDs from codes (cached per-process in production, fine for now)
  const codes = [...new Set(lines.map(l => l.accountCode))];
  const accounts = await tx.ledgerAccount.findMany({ where: { code: { in: codes } } });
  const accountMap = new Map(accounts.map(a => [a.code, a.id]));

  for (const code of codes) {
    if (!accountMap.has(code)) {
      throw new Error(`Ledger account code not found: ${code}. Run the ledger seed.`);
    }
  }

  await tx.ledgerEntry.create({
    data: {
      entryType,
      description,
      currency: "GHS",
      orderId:       ctx.orderId       ?? null,
      vendorOrderId: ctx.vendorOrderId ?? null,
      paymentId:     ctx.paymentId     ?? null,
      payoutId:      ctx.payoutId      ?? null,
      disputeId:     ctx.disputeId     ?? null,
      lines: {
        create: lines.map(l => ({
          accountId:    accountMap.get(l.accountCode)!,
          amountPesewas: l.amountPesewas,
          isDebit:      l.isDebit,
          memo:         l.memo ?? null,
          vendorId:     l.vendorId ?? null,
        })),
      },
    },
  });
}

// ─── Public entry writers (one per spec event) ───────────────────────────

export const LedgerService = {

  /**
   * Entry A — Payment received and verified.
   * Spec §6A:
   *   DR Gateway Clearing        totalPesewas
   *   CR Vendor Payable (Pending) vendorEarningsPesewas
   *   CR Deferred Commission Rev  commissionPesewas
   *   CR Deferred Delivery Rev    deliveryFeePesewas
   */
  async entryA_PaymentReceived(
    tx: Prisma.TransactionClient,
    params: {
      totalPesewas: number;
      vendorEarningsPesewas: number;
      commissionPesewas: number;
      deliveryFeePesewas: number;
      orderId: string;
      vendorOrderId: string;
      paymentId: string;
      vendorId: string;
    },
  ) {
    await writeEntry(
      tx,
      "PAYMENT_RECEIVED",
      "Payment verified — funds allocated to vendor payable, deferred revenue",
      [
        debit(ACCOUNTS.GATEWAY_CLEARING,        params.totalPesewas,            "Gross collection", ),
        credit(ACCOUNTS.VENDOR_PAYABLE_PENDING,  params.vendorEarningsPesewas,   "Vendor earnings pending fulfillment", params.vendorId),
        credit(ACCOUNTS.DEFERRED_COMMISSION_REV, params.commissionPesewas,       "Commission deferred until order completes"),
        credit(ACCOUNTS.DEFERRED_DELIVERY_REV,   params.deliveryFeePesewas,      "Delivery revenue deferred until order completes"),
      ],
      { orderId: params.orderId, vendorOrderId: params.vendorOrderId, paymentId: params.paymentId },
    );
  },

  /**
   * Entry C — Delivery verified, escrow starts.
   * Spec §6C:
   *   DR Vendor Payable (Pending) vendorEarningsPesewas
   *   CR Vendor Payable (Escrow)  vendorEarningsPesewas
   */
  async entryC_EscrowStart(
    tx: Prisma.TransactionClient,
    params: {
      vendorEarningsPesewas: number;
      orderId: string;
      vendorOrderId: string;
      vendorId: string;
    },
  ) {
    await writeEntry(
      tx,
      "ESCROW_START",
      "Delivery verified — vendor funds moved to escrow (48h inspection window)",
      [
        debit(ACCOUNTS.VENDOR_PAYABLE_PENDING, params.vendorEarningsPesewas, "Move from pending to escrow", params.vendorId),
        credit(ACCOUNTS.VENDOR_PAYABLE_ESCROW, params.vendorEarningsPesewas, "Escrow window started",       params.vendorId),
      ],
      { orderId: params.orderId, vendorOrderId: params.vendorOrderId },
    );
  },

  /**
   * Entry D — Escrow cleared (no dispute or early customer confirm).
   * Spec §6D:
   *   DR Vendor Payable (Escrow)    vendorEarningsPesewas
   *   CR Vendor Payable (Available) vendorEarningsPesewas
   *   DR Deferred Commission Rev    commissionPesewas
   *   CR Commission Revenue         commissionPesewas
   *   DR Deferred Delivery Rev      deliveryFeePesewas
   *   CR Delivery Revenue           deliveryFeePesewas
   *
   * "Escrow-to-available is a NEW balanced entry, not a relabel."
   */
  async entryD_EscrowCleared(
    tx: Prisma.TransactionClient,
    params: {
      vendorEarningsPesewas: number;
      commissionPesewas: number;
      deliveryFeePesewas: number;
      orderId: string;
      vendorOrderId: string;
      vendorId: string;
    },
  ) {
    await writeEntry(
      tx,
      "ESCROW_CLEARED",
      "Escrow cleared — funds available for payout, revenue recognised",
      [
        debit(ACCOUNTS.VENDOR_PAYABLE_ESCROW,    params.vendorEarningsPesewas, "Release from escrow",           params.vendorId),
        credit(ACCOUNTS.VENDOR_PAYABLE_AVAILABLE, params.vendorEarningsPesewas, "Funds now available for payout", params.vendorId),
        debit(ACCOUNTS.DEFERRED_COMMISSION_REV,   params.commissionPesewas,     "Recognise deferred commission"),
        credit(ACCOUNTS.COMMISSION_REVENUE,        params.commissionPesewas,     "Commission revenue recognised"),
        debit(ACCOUNTS.DEFERRED_DELIVERY_REV,     params.deliveryFeePesewas,    "Recognise deferred delivery revenue"),
        credit(ACCOUNTS.DELIVERY_REVENUE,          params.deliveryFeePesewas,    "Delivery revenue recognised"),
      ],
      { orderId: params.orderId, vendorOrderId: params.vendorOrderId },
    );
  },

  /**
   * Entry E — Gateway settles to bank/MoMo.
   * Spec §6E:
   *   DR Bank/MoMo Settlement   settlementPesewas
   *   DR Gateway Fee Expense    feePesewas
   *   CR Gateway Clearing       totalPesewas
   */
  async entryE_GatewaySettlement(
    tx: Prisma.TransactionClient,
    params: {
      settlementPesewas: number;
      feePesewas: number;
      orderId?: string;
      paymentId?: string;
    },
  ) {
    const totalPesewas = params.settlementPesewas + params.feePesewas;
    await writeEntry(
      tx,
      "GATEWAY_SETTLEMENT",
      "Gateway settlement received (net of gateway fee)",
      [
        debit(ACCOUNTS.BANK_MOMO_SETTLEMENT,  params.settlementPesewas, "Net settlement received"),
        debit(ACCOUNTS.GATEWAY_FEE_EXPENSE,   params.feePesewas,        "Gateway collection fee"),
        credit(ACCOUNTS.GATEWAY_CLEARING,     totalPesewas,             "Gateway clearing closed"),
      ],
      { orderId: params.orderId, paymentId: params.paymentId },
    );
  },

  /**
   * Entry F — Payout initiated (status PROCESSING).
   * Spec §6F:
   *   DR Vendor Payable (Available) amountPesewas
   *   CR Payout In Transit          amountPesewas
   */
  async entryF_PayoutInitiated(
    tx: Prisma.TransactionClient,
    params: {
      amountPesewas: number;
      payoutId: string;
      vendorId: string;
    },
  ) {
    await writeEntry(
      tx,
      "PAYOUT_INITIATED",
      "Payout initiated — funds locked in transit",
      [
        debit(ACCOUNTS.VENDOR_PAYABLE_AVAILABLE, params.amountPesewas, "Funds moved to payout in transit", params.vendorId),
        credit(ACCOUNTS.PAYOUT_IN_TRANSIT,       params.amountPesewas, "Payout in transit"),
      ],
      { payoutId: params.payoutId },
    );
  },

  /**
   * Entry G — Payout confirmed by gateway (status PAID).
   * Spec §6G:
   *   DR Payout In Transit       amountPesewas
   *   CR Bank/MoMo Settlement    amountPesewas
   */
  async entryG_PayoutConfirmed(
    tx: Prisma.TransactionClient,
    params: {
      amountPesewas: number;
      payoutId: string;
    },
  ) {
    await writeEntry(
      tx,
      "PAYOUT_CONFIRMED",
      "Payout confirmed by gateway — settled to vendor bank/MoMo",
      [
        debit(ACCOUNTS.PAYOUT_IN_TRANSIT,      params.amountPesewas, "Payout delivered"),
        credit(ACCOUNTS.BANK_MOMO_SETTLEMENT,  params.amountPesewas, "Bank/MoMo balance reduced by vendor payout"),
      ],
      { payoutId: params.payoutId },
    );
  },

  /**
   * Entry H — Payout transfer fee.
   * Spec §6H:
   *   DR Payout Fee Expense      feePesewas
   *   CR Bank/MoMo Settlement    feePesewas
   */
  async entryH_PayoutFee(
    tx: Prisma.TransactionClient,
    params: {
      feePesewas: number;
      payoutId: string;
    },
  ) {
    await writeEntry(
      tx,
      "PAYOUT_FEE",
      "Payout transfer fee charged",
      [
        debit(ACCOUNTS.PAYOUT_FEE_EXPENSE,     params.feePesewas, "Transfer fee"),
        credit(ACCOUNTS.BANK_MOMO_SETTLEMENT,  params.feePesewas, "Fee deducted from settlement account"),
      ],
      { payoutId: params.payoutId },
    );
  },

  /**
   * Entry I — Payout failed: reverse entry F.
   * Spec §6I:
   *   DR Payout In Transit          amountPesewas
   *   CR Vendor Payable (Available) amountPesewas
   */
  async entryI_PayoutFailedReversal(
    tx: Prisma.TransactionClient,
    params: {
      amountPesewas: number;
      payoutId: string;
      vendorId: string;
    },
  ) {
    await writeEntry(
      tx,
      "PAYOUT_FAILED_REVERSAL",
      "Payout failed — funds restored to vendor available balance",
      [
        debit(ACCOUNTS.PAYOUT_IN_TRANSIT,        params.amountPesewas, "Reversal of payout in transit"),
        credit(ACCOUNTS.VENDOR_PAYABLE_AVAILABLE, params.amountPesewas, "Funds returned to available balance", params.vendorId),
      ],
      { payoutId: params.payoutId },
    );
  },

  /**
   * Payout reversed (after success) — re-establish vendor liability.
   * Spec §3: status REVERSED; liability re-established.
   *   DR Bank/MoMo Settlement        amountPesewas
   *   CR Vendor Payable (Available)  amountPesewas
   */
  async entryPayoutReversed(
    tx: Prisma.TransactionClient,
    params: {
      amountPesewas: number;
      payoutId: string;
      vendorId: string;
    },
  ) {
    await writeEntry(
      tx,
      "PAYOUT_REVERSED",
      "Payout reversed by gateway — vendor liability re-established",
      [
        debit(ACCOUNTS.BANK_MOMO_SETTLEMENT,    params.amountPesewas, "Reversal recovered"),
        credit(ACCOUNTS.VENDOR_PAYABLE_AVAILABLE, params.amountPesewas, "Re-established vendor liability", params.vendorId),
      ],
      { payoutId: params.payoutId },
    );
  },

  /**
   * Entry J — Full refund (pre-fulfillment or post-dispute).
   * Spec §6J:
   *   DR Vendor Payable (Pending/Escrow/Available) vendorEarningsPesewas
   *   DR Deferred Commission Rev                   commissionPesewas
   *   DR Deferred Delivery Rev                     deliveryFeePesewas
   *   CR Refunds Payable (or Gateway Clearing)     totalPesewas
   *
   * @param fromAccount — which account currently holds the vendor's funds (Pending, Escrow, or Available)
   */
  async entryJ_FullRefund(
    tx: Prisma.TransactionClient,
    params: {
      totalPesewas: number;
      vendorEarningsPesewas: number;
      commissionPesewas: number;
      deliveryFeePesewas: number;
      fromAccount: "VENDOR_PAYABLE_PENDING" | "VENDOR_PAYABLE_ESCROW" | "VENDOR_PAYABLE_AVAILABLE" | "VENDOR_PAYABLE_DISPUTED";
      orderId: string;
      vendorOrderId: string;
      disputeId?: string;
      vendorId: string;
    },
  ) {
    await writeEntry(
      tx,
      "REFUND_FULL",
      "Full refund — vendor payable and deferred revenue reversed",
      [
        debit(ACCOUNTS[params.fromAccount],       params.vendorEarningsPesewas, "Vendor payable reversed",          params.vendorId),
        debit(ACCOUNTS.DEFERRED_COMMISSION_REV,   params.commissionPesewas,     "Deferred commission reversed"),
        debit(ACCOUNTS.DEFERRED_DELIVERY_REV,     params.deliveryFeePesewas,    "Deferred delivery revenue reversed"),
        credit(ACCOUNTS.REFUNDS_PAYABLE,           params.totalPesewas,          "Refund liability created"),
      ],
      { orderId: params.orderId, vendorOrderId: params.vendorOrderId, disputeId: params.disputeId },
    );
  },

  /**
   * Partial refund — proportionally reverse commission and vendor liability.
   * Spec §5: "reverse the proportional amounts from whichever accounts currently hold them."
   */
  async entryPartialRefund(
    tx: Prisma.TransactionClient,
    params: {
      refundTotalPesewas: number;
      vendorEarningsRefundPesewas: number;
      commissionRefundPesewas: number;
      deliveryFeeRefundPesewas: number;
      fromAccount: "VENDOR_PAYABLE_PENDING" | "VENDOR_PAYABLE_ESCROW" | "VENDOR_PAYABLE_AVAILABLE" | "VENDOR_PAYABLE_DISPUTED";
      orderId: string;
      vendorOrderId: string;
      disputeId?: string;
      vendorId: string;
    },
  ) {
    await writeEntry(
      tx,
      "REFUND_PARTIAL",
      "Partial refund — proportional reversal of vendor payable and deferred revenue",
      [
        debit(ACCOUNTS[params.fromAccount],       params.vendorEarningsRefundPesewas, "Partial vendor payable reversed", params.vendorId),
        debit(ACCOUNTS.DEFERRED_COMMISSION_REV,   params.commissionRefundPesewas,     "Partial commission reversed"),
        debit(ACCOUNTS.DEFERRED_DELIVERY_REV,     params.deliveryFeeRefundPesewas,    "Partial delivery rev reversed"),
        credit(ACCOUNTS.REFUNDS_PAYABLE,           params.refundTotalPesewas,          "Partial refund liability"),
      ],
      { orderId: params.orderId, vendorOrderId: params.vendorOrderId, disputeId: params.disputeId },
    );
  },

  /**
   * Dispute freeze — move funds to DISPUTED sub-account.
   * Spec §5: "only the affected vendor amount" is frozen.
   *   DR Vendor Payable (Escrow/Available) vendorEarningsPesewas
   *   CR Vendor Payable (Disputed)         vendorEarningsPesewas
   */
  async entryDisputeFreeze(
    tx: Prisma.TransactionClient,
    params: {
      vendorEarningsPesewas: number;
      fromAccount: "VENDOR_PAYABLE_ESCROW" | "VENDOR_PAYABLE_AVAILABLE";
      orderId: string;
      vendorOrderId: string;
      disputeId: string;
      vendorId: string;
    },
  ) {
    await writeEntry(
      tx,
      "DISPUTE_FREEZE",
      "Dispute opened — vendor funds frozen pending admin resolution",
      [
        debit(ACCOUNTS[params.fromAccount],      params.vendorEarningsPesewas, "Funds frozen for dispute", params.vendorId),
        credit(ACCOUNTS.VENDOR_PAYABLE_DISPUTED, params.vendorEarningsPesewas, "Disputed funds held",      params.vendorId),
      ],
      { orderId: params.orderId, vendorOrderId: params.vendorOrderId, disputeId: params.disputeId },
    );
  },

  /**
   * Dispute release — admin resolved in vendor's favour.
   *   DR Vendor Payable (Disputed) vendorEarningsPesewas
   *   CR Vendor Payable (Available) vendorEarningsPesewas
   */
  async entryDisputeRelease(
    tx: Prisma.TransactionClient,
    params: {
      vendorEarningsPesewas: number;
      orderId: string;
      vendorOrderId: string;
      disputeId: string;
      vendorId: string;
    },
  ) {
    await writeEntry(
      tx,
      "DISPUTE_RELEASE",
      "Dispute resolved — vendor funds released to available balance",
      [
        debit(ACCOUNTS.VENDOR_PAYABLE_DISPUTED,  params.vendorEarningsPesewas, "Disputed funds released", params.vendorId),
        credit(ACCOUNTS.VENDOR_PAYABLE_AVAILABLE, params.vendorEarningsPesewas, "Released to available",   params.vendorId),
      ],
      { orderId: params.orderId, vendorOrderId: params.vendorOrderId, disputeId: params.disputeId },
    );
  },

} as const;

// ─── Ledger balance queries (for admin reconciliation, Spec §9) ──────────────

export const LedgerQuery = {
  /**
   * Sum all debit and credit amounts for an account code.
   * Balance = totalDebits - totalCredits for Asset/Expense accounts.
   * Balance = totalCredits - totalDebits for Liability/Revenue accounts.
   */
  async accountBalance(accountCode: AccountCode): Promise<number> {
    const account = await prisma.ledgerAccount.findUnique({ where: { code: accountCode } });
    if (!account) throw new Error(`Ledger account not found: ${accountCode}`);

    const agg = await prisma.ledgerLine.aggregate({
      where: { accountId: account.id },
      _sum: { amountPesewas: true },
    });

    // Separate debit and credit sums
    const [debits, credits] = await Promise.all([
      prisma.ledgerLine.aggregate({
        where: { accountId: account.id, isDebit: true },
        _sum: { amountPesewas: true },
      }),
      prisma.ledgerLine.aggregate({
        where: { accountId: account.id, isDebit: false },
        _sum: { amountPesewas: true },
      }),
    ]);

    const totalDebits  = debits._sum.amountPesewas  ?? 0;
    const totalCredits = credits._sum.amountPesewas ?? 0;

    // Asset/Expense: debit-normal (balance = debits - credits)
    // Liability/Revenue: credit-normal (balance = credits - debits)
    const debitNormal = account.accountType === "ASSET" || account.accountType === "EXPENSE";
    return debitNormal ? totalDebits - totalCredits : totalCredits - totalDebits;
  },

  /**
   * Total vendor payable by status (for spec §9 admin dashboard).
   */
  async vendorPayableByStatus() {
    const [pending, escrow, available, disputed] = await Promise.all([
      LedgerQuery.accountBalance("VENDOR_PAYABLE_PENDING"),
      LedgerQuery.accountBalance("VENDOR_PAYABLE_ESCROW"),
      LedgerQuery.accountBalance("VENDOR_PAYABLE_AVAILABLE"),
      LedgerQuery.accountBalance("VENDOR_PAYABLE_DISPUTED"),
    ]);
    return { pending, escrow, available, disputed, total: pending + escrow + available + disputed };
  },

  /**
   * Platform financials summary (Spec §9 core figures).
   */
  async platformSummary() {
    const [
      gatewayClearing,
      bankMomo,
      payoutInTransit,
      commissionRevenue,
      deliveryRevenue,
      gatewayFeeExpense,
      payoutFeeExpense,
      refundsPayable,
      deferredCommission,
      deferredDelivery,
    ] = await Promise.all([
      LedgerQuery.accountBalance("GATEWAY_CLEARING"),
      LedgerQuery.accountBalance("BANK_MOMO_SETTLEMENT"),
      LedgerQuery.accountBalance("PAYOUT_IN_TRANSIT"),
      LedgerQuery.accountBalance("COMMISSION_REVENUE"),
      LedgerQuery.accountBalance("DELIVERY_REVENUE"),
      LedgerQuery.accountBalance("GATEWAY_FEE_EXPENSE"),
      LedgerQuery.accountBalance("PAYOUT_FEE_EXPENSE"),
      LedgerQuery.accountBalance("REFUNDS_PAYABLE"),
      LedgerQuery.accountBalance("DEFERRED_COMMISSION_REV"),
      LedgerQuery.accountBalance("DEFERRED_DELIVERY_REV"),
    ]);

    const platformGrossRevenue = commissionRevenue + deliveryRevenue;
    const totalGatewayFees     = gatewayFeeExpense + payoutFeeExpense;
    const netPlatformRevenue   = platformGrossRevenue - totalGatewayFees;

    return {
      gatewayClearing,
      bankMomo,
      payoutInTransit,
      commissionRevenue,
      deliveryRevenue,
      platformGrossRevenue,
      gatewayFeeExpense,
      payoutFeeExpense,
      totalGatewayFees,
      netPlatformRevenue,
      refundsPayable,
      deferredCommission,
      deferredDelivery,
    };
  },
};
