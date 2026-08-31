import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  /** Base path e.g. "/shop" or "/category/electronics" */
  basePath: string;
  /** Extra query params to preserve (sort, category, etc.) */
  searchParams?: Record<string, string | undefined>;
};

/**
 * Returns the page numbers to display, inserting `null` as an ellipsis marker.
 * Always shows: first, last, current, and up to 2 neighbours of current.
 */
function buildPageRange(
  current: number,
  total: number,
): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | null)[] = [];
  const addPage = (n: number) => {
    if (!pages.includes(n)) pages.push(n);
  };
  const addEllipsis = () => {
    if (pages[pages.length - 1] !== null) pages.push(null);
  };

  addPage(1);

  if (current > 3) addEllipsis();

  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    addPage(i);
  }

  if (current < total - 2) addEllipsis();

  addPage(total);

  return pages;
}

function buildHref(
  basePath: string,
  page: number,
  searchParams?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "page") params.set(key, value);
    }
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
  searchParams,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPageRange(currentPage, totalPages);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const btnBase =
    "flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors";
  const btnActive = "bg-[#232f3e] text-white shadow-sm";
  const btnInactive = "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50";
  const btnDisabled = "bg-white text-zinc-300 ring-1 ring-zinc-200 cursor-not-allowed";

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex flex-wrap items-center justify-center gap-1.5"
    >
      {/* Previous */}
      {hasPrev ? (
        <Link
          href={buildHref(basePath, currentPage - 1, searchParams)}
          aria-label="Previous page"
          className={`${btnBase} ${btnInactive} gap-1`}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </Link>
      ) : (
        <span className={`${btnBase} ${btnDisabled} gap-1`} aria-disabled="true">
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </span>
      )}

      {/* Page numbers */}
      {pages.map((page, i) =>
        page === null ? (
          <span key={`ellipsis-${i}`} className="flex h-9 w-6 items-center justify-center text-zinc-400">
            …
          </span>
        ) : (
          <Link
            key={page}
            href={buildHref(basePath, page, searchParams)}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
            className={`${btnBase} ${page === currentPage ? btnActive : btnInactive}`}
          >
            {page}
          </Link>
        ),
      )}

      {/* Next */}
      {hasNext ? (
        <Link
          href={buildHref(basePath, currentPage + 1, searchParams)}
          aria-label="Next page"
          className={`${btnBase} ${btnInactive} gap-1`}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={`${btnBase} ${btnDisabled} gap-1`} aria-disabled="true">
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
