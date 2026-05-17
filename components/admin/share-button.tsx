"use client";

import { Mail, Send, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** 견적서 링크를 이메일/텔레그램으로 공유. mailto와 t.me/share/url은 별도 권한 없이 모든 브라우저에서 동작. */
export function ShareButton({
  url,
  invoiceNo,
  clientName,
}: {
  url: string;
  invoiceNo: string;
  clientName: string;
}) {
  const subject = `견적서 ${invoiceNo} — ${clientName}`;
  const body = `${clientName}님께 견적서를 보내드립니다.\n\n링크: ${url}`;

  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const telegram = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(subject)}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" aria-label="공유">
          <Share2 className="mr-1 size-4" aria-hidden />
          <span>공유</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{invoiceNo}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={mailto}>
            <Mail className="mr-2 size-4" aria-hidden />
            이메일
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={telegram} target="_blank" rel="noopener noreferrer">
            <Send className="mr-2 size-4" aria-hidden />
            텔레그램
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
