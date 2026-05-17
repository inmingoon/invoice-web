import { AdminNav } from "@/components/admin/admin-nav";
import { LogoutButton } from "@/components/admin/logout-button";

export function AdminHeader() {
  return (
    <header className="border-border flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6">
      <div className="flex items-center gap-6">
        <h2 className="text-sm font-semibold tracking-tight">견적서 관리자</h2>
        <AdminNav />
      </div>
      <LogoutButton />
    </header>
  );
}
