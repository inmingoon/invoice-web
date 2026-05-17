import Link from "next/link";

import { Button } from "@/components/ui/button";

function hrefWithoutCursor(base: URLSearchParams): string {
  const next = new URLSearchParams(base.toString());
  next.delete("cursor");
  const q = next.toString();
  return q ? `?${q}` : "?";
}

function hrefWithCursor(base: URLSearchParams, cursor: string): string {
  const next = new URLSearchParams(base.toString());
  next.set("cursor", cursor);
  const q = next.toString();
  return q ? `?${q}` : "?";
}

/**
 * Cursor 기반 페이지네이션. Notion API는 next_cursor만 제공 — "이전" 정확 추적 불가.
 * "맨 처음으로"(cursor 제거)와 "다음 페이지"만 제공해 UX 단순화.
 */
export function Pagination({
  searchParams,
  hasMore,
  nextCursor,
}: {
  searchParams: URLSearchParams;
  hasMore: boolean;
  nextCursor: string | null;
}) {
  const currentCursor = searchParams.get("cursor");
  const showFirst = Boolean(currentCursor);
  if (!showFirst && !hasMore) return null;
  return (
    <div className="flex items-center justify-end gap-2">
      {showFirst ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={hrefWithoutCursor(searchParams)} prefetch={false}>
            맨 처음으로
          </Link>
        </Button>
      ) : null}
      {hasMore && nextCursor ? (
        <Button asChild variant="outline" size="sm">
          <Link
            href={hrefWithCursor(searchParams, nextCursor)}
            prefetch={false}
          >
            다음 페이지
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
