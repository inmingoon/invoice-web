import Link from "next/link";
import { Zap } from "lucide-react";

import { siteConfig } from "@/lib/site-config";
import { Container } from "@/components/layouts/container";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/layouts/mobile-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Container className="flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <Zap className="size-5 text-primary" />
            <span>{siteConfig.name}</span>
          </Link>
          <nav className="hidden gap-5 sm:flex">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <MobileNav />
        </div>
      </Container>
    </header>
  );
}
