import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "관리자 로그인",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const jar = await cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  if (await verifySession(existing)) {
    redirect("/admin");
  }
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>관리자 로그인</CardTitle>
          <CardDescription>
            견적서 관리 화면 접근에는 비밀번호가 필요합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
