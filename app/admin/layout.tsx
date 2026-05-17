import type { Metadata } from "next";

import { AdminHeader } from "@/components/admin/admin-header";

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
      <AdminHeader />
      <div className="flex-1">{children}</div>
    </div>
  );
}
