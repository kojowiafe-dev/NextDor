/**
 * URL-friendly slug generator.
 *
 * DRY utility (Fix #21): Shared across products, vendors, and categories.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
