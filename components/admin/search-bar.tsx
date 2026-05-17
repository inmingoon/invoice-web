"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEBOUNCE_MS = 300;

/** 검색어를 URL ?q=...에 디바운스로 동기화. cursor는 제거(검색이 바뀌면 첫 페이지부터). */
export function SearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      next.delete("cursor");
      const query = next.toString();
      router.replace(query ? `?${query}` : "?");
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="invoice-search" className="sr-only">
        클라이언트명 검색
      </Label>
      <div className="relative">
        <Search
          className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          id="invoice-search"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="클라이언트명 검색..."
          className="pl-9"
          autoComplete="off"
        />
      </div>
    </div>
  );
}
