/**
 * Strict Cash-on-Delivery (COD) detection helper.
 *
 * Matches only the structured checkout marker (`Payment method: cod`) or an
 * exact `"cash on delivery"` string, avoiding false positives on free-text
 * customer notes containing words like `"code"`.
 */
export function isCodOrder(notes?: string | null): boolean {
  if (!notes) return false;
  const trimmed = notes.trim();
  if (/^payment method:\s*cod\b/i.test(trimmed)) return true;
  if (/\bpayment method:\s*cod\b/i.test(trimmed)) return true;
  return trimmed.toLowerCase() === "cash on delivery";
}

