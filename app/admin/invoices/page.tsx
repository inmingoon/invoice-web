import type { Metadata } from "next";

import { FilterPanel } from "@/components/admin/filter-panel";
import { InvoiceTable } from "@/components/admin/invoice-table";
import { Pagination } from "@/components/admin/pagination";
import { SearchBar } from "@/components/admin/search-bar";
import { listInvoices } from "@/lib/notion";
import type {
  ExpiredFilter,
  InvoiceStatus,
  SortDirection,
  SortKey,
} from "@/types/invoice";

export const metadata: Metadata = {
  title: "견적서 목록",
};

const SORT_KEYS: readonly SortKey[] = ["issuedAt", "expiresAt", "total"];
const SORT_DIRS: readonly SortDirection[] = ["asc", "desc"];
const STATUSES: readonly InvoiceStatus[] = ["draft", "sent", "viewed"];

function parseSort(raw: string | undefined): {
  by: SortKey;
  direction: SortDirection;
} {
  if (!raw) return { by: "issuedAt", direction: "desc" };
  const [keyRaw, dirRaw] = raw.split(":");
  const by = SORT_KEYS.includes(keyRaw as SortKey)
    ? (keyRaw as SortKey)
    : "issuedAt";
  const direction = SORT_DIRS.includes(dirRaw as SortDirection)
    ? (dirRaw as SortDirection)
    : "desc";
  return { by, direction };
}

function parseStatuses(raw: string | undefined): InvoiceStatus[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is InvoiceStatus => STATUSES.includes(s as InvoiceStatus));
}

function parseExpired(raw: string | undefined): ExpiredFilter {
  if (raw === "active" || raw === "expired") return raw;
  return "all";
}

function toUrlParams(
  searchParams: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      if (value[0]) out.set(key, value[0]);
    } else if (typeof value === "string" && value) {
      out.set(key, value);
    }
  }
  return out;
}

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q : undefined;
  const statuses = parseStatuses(
    typeof raw.status === "string" ? raw.status : undefined,
  );
  const expired = parseExpired(
    typeof raw.expired === "string" ? raw.expired : undefined,
  );
  const sort = parseSort(typeof raw.sort === "string" ? raw.sort : undefined);
  const cursor = typeof raw.cursor === "string" ? raw.cursor : undefined;

  const urlParams = toUrlParams(raw);

  const result = await listInvoices({ q, status: statuses, expired }, sort, {
    cursor,
    pageSize: 20,
  });

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">견적서 목록</h1>
        <p className="text-muted-foreground text-sm">
          페이지당 20건. 필터·정렬·검색은 모두 URL에 반영되어 공유 가능합니다.
        </p>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-sm">
          <SearchBar />
        </div>
        <FilterPanel searchParams={urlParams} />
      </div>

      <InvoiceTable
        items={result.items}
        sortBy={sort.by}
        sortDirection={sort.direction}
        searchParams={urlParams}
      />

      <Pagination
        searchParams={urlParams}
        hasMore={result.hasMore}
        nextCursor={result.nextCursor}
      />
    </main>
  );
}
