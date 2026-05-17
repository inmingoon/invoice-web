import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  InvoiceListItem,
  InvoiceStatus,
  SortDirection,
  SortKey,
} from "@/types/invoice";

const krw = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
});

const statusBadge: Record<
  InvoiceStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  draft: { label: "초안", variant: "secondary" },
  sent: { label: "발송됨", variant: "default" },
  viewed: { label: "열람됨", variant: "outline" },
};

function isExpired(expiresAt: string): boolean {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return exp < today;
}

function sortHref(
  base: URLSearchParams,
  key: SortKey,
  currentBy: SortKey,
  currentDir: SortDirection,
): string {
  const next = new URLSearchParams(base.toString());
  const nextDir: SortDirection =
    currentBy === key && currentDir === "desc" ? "asc" : "desc";
  next.set("sort", `${key}:${nextDir}`);
  next.delete("cursor");
  const q = next.toString();
  return q ? `?${q}` : "?";
}

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active)
    return (
      <ArrowUpDown className="text-muted-foreground size-3.5" aria-hidden />
    );
  return direction === "asc" ? (
    <ArrowUp className="size-3.5" aria-hidden />
  ) : (
    <ArrowDown className="size-3.5" aria-hidden />
  );
}

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  currentBy: SortKey;
  currentDir: SortDirection;
  base: URLSearchParams;
  align?: "left" | "right";
}

function SortableHeader({
  label,
  sortKey,
  currentBy,
  currentDir,
  base,
  align = "left",
}: SortableHeaderProps) {
  const active = currentBy === sortKey;
  const href = sortHref(base, sortKey, currentBy, currentDir);
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "hover:text-foreground inline-flex items-center gap-1.5 transition-colors",
        active ? "text-foreground" : "text-muted-foreground",
        align === "right" && "justify-end",
      )}
    >
      <span>{label}</span>
      <SortIcon active={active} direction={currentDir} />
    </Link>
  );
}

export function InvoiceTable({
  items,
  sortBy,
  sortDirection,
  searchParams,
}: {
  items: InvoiceListItem[];
  sortBy: SortKey;
  sortDirection: SortDirection;
  searchParams: URLSearchParams;
}) {
  if (items.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
        조건에 맞는 견적서가 없습니다.
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>견적서 번호</TableHead>
          <TableHead>클라이언트</TableHead>
          <TableHead>
            <SortableHeader
              label="발행일"
              sortKey="issuedAt"
              currentBy={sortBy}
              currentDir={sortDirection}
              base={searchParams}
            />
          </TableHead>
          <TableHead>
            <SortableHeader
              label="만료일"
              sortKey="expiresAt"
              currentBy={sortBy}
              currentDir={sortDirection}
              base={searchParams}
            />
          </TableHead>
          <TableHead className="text-right">
            <SortableHeader
              label="총액"
              sortKey="total"
              currentBy={sortBy}
              currentDir={sortDirection}
              base={searchParams}
              align="right"
            />
          </TableHead>
          <TableHead className="text-right">상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((row) => {
          const status = statusBadge[row.status];
          const expired = isExpired(row.expiresAt);
          return (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.invoiceNo}</TableCell>
              <TableCell>{row.clientName}</TableCell>
              <TableCell className="text-muted-foreground">
                {row.issuedAt}
              </TableCell>
              <TableCell
                className={cn(
                  "text-muted-foreground",
                  expired && "text-destructive",
                )}
              >
                {row.expiresAt}
                {expired ? <span className="ml-1 text-xs">(만료)</span> : null}
              </TableCell>
              <TableCell className="text-right">
                {krw.format(row.total)}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant={status.variant}>{status.label}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
