import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "대시보드",
};

export default function AdminDashboardPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          관리자 대시보드
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Phase A 완료 — 인증 인프라가 동작합니다. Phase B에서 견적서
          목록·검색·필터, Phase C에서 링크 생성·공유·토큰 회수가 추가됩니다.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phase B</CardTitle>
            <CardDescription>견적서 목록·검색·필터</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            아직 구현되지 않았습니다.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phase C</CardTitle>
            <CardDescription>링크 생성·공유·토큰 회수</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            아직 구현되지 않았습니다.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phase D</CardTitle>
            <CardDescription>캐시·rate limit·관찰성</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            아직 구현되지 않았습니다.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
