"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "대시보드", match: (p: string) => p === "/admin" },
  {
    href: "/admin/invoices",
    label: "견적서",
    match: (p: string) => p.startsWith("/admin/invoices"),
  },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="관리자 메뉴" className="flex items-center gap-1">
      {links.map(({ href, label, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
