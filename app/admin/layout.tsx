import type { Metadata } from "next";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/admin-login/actions";

export const metadata: Metadata = {
  title: { default: "관리자", template: "%s | 관리자" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-border flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <h2 className="text-sm font-semibold tracking-tight">견적서 관리자</h2>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut className="mr-2 size-4" aria-hidden />
            로그아웃
          </Button>
        </form>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
