import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ExpiredFilter, InvoiceStatus } from "@/types/invoice";

const STATUSES: Array<{ value: InvoiceStatus; label: string }> = [
  { value: "draft", label: "초안" },
  { value: "sent", label: "발송됨" },
  { value: "viewed", label: "열람됨" },
];

const EXPIRED_OPTIONS: Array<{ value: ExpiredFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "active", label: "유효" },
  { value: "expired", label: "만료" },
];

function toggleStatus(
  current: InvoiceStatus[],
  next: InvoiceStatus,
): InvoiceStatus[] {
  return current.includes(next)
    ? current.filter((s) => s !== next)
    : [...current, next];
}

function hrefWith(
  base: URLSearchParams,
  mutate: (params: URLSearchParams) => void,
): string {
  const next = new URLSearchParams(base.toString());
  mutate(next);
  next.delete("cursor");
  const q = next.toString();
  return q ? `?${q}` : "?";
}

/**
 * URL params를 그대로 받아 링크로 토글하는 server-friendly 필터.
 * 상태는 multi-select(or), 만료는 single(all/active/expired).
 */
export function FilterPanel({
  searchParams,
}: {
  searchParams: URLSearchParams;
}) {
  const currentStatuses = (searchParams.get("status") ?? "")
    .split(",")
    .filter((s): s is InvoiceStatus => ["draft", "sent", "viewed"].includes(s));
  const currentExpired = (searchParams.get("expired") ??
    "all") as ExpiredFilter;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterGroup label="상태">
        {STATUSES.map(({ value, label }) => {
          const active = currentStatuses.includes(value);
          const href = hrefWith(searchParams, (p) => {
            const nextList = toggleStatus(currentStatuses, value);
            if (nextList.length > 0) p.set("status", nextList.join(","));
            else p.delete("status");
          });
          return (
            <Link key={value} href={href} prefetch={false}>
              <Badge
                variant={active ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition",
                  active ? "" : "hover:bg-muted",
                )}
              >
                {label}
              </Badge>
            </Link>
          );
        })}
      </FilterGroup>

      <FilterGroup label="만료">
        {EXPIRED_OPTIONS.map(({ value, label }) => {
          const active = currentExpired === value;
          const href = hrefWith(searchParams, (p) => {
            if (value === "all") p.delete("expired");
            else p.set("expired", value);
          });
          return (
            <Link key={value} href={href} prefetch={false}>
              <Badge
                variant={active ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition",
                  active ? "" : "hover:bg-muted",
                )}
              >
                {label}
              </Badge>
            </Link>
          );
        })}
      </FilterGroup>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
