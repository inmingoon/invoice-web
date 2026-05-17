import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getInvoiceStats } from "@/lib/notion";

export const metadata: Metadata = {
  title: "대시보드",
};

// getInvoiceStats가 Notion API를 호출하므로 정적 prerender 금지 — 매 요청마다 실시간 통계 반영.
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const stats = await getInvoiceStats();
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          관리자 대시보드
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          전체 견적서 현황을 한눈에 확인하고{" "}
          <Link
            href="/admin/invoices"
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            견적서 목록
          </Link>
          으로 이동하세요.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          title="전체 견적서"
          value={stats.total}
          description="현재 Notion DB에 등록된 모든 row"
        />
        <KpiCard
          title="만료 임박"
          value={stats.expiringSoon}
          description="오늘부터 7일 이내 만료"
          tone={stats.expiringSoon > 0 ? "warning" : "default"}
        />
        <KpiCard
          title="미열람"
          value={stats.unviewed}
          description="status가 viewed가 아닌 row"
        />
      </div>
    </main>
  );
}

function KpiCard({
  title,
  value,
  description,
  tone = "default",
}: {
  title: string;
  value: number;
  description: string;
  tone?: "default" | "warning";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium tracking-tight">
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p
          className={
            tone === "warning"
              ? "text-destructive text-3xl font-semibold"
              : "text-3xl font-semibold"
          }
        >
          {value.toLocaleString("ko-KR")}
        </p>
      </CardContent>
    </Card>
  );
}
