"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SUCCESS_RESET_MS = 1500;

export function CopyButton({
  value,
  label = "링크 복사",
  variant = "ghost",
  size = "sm",
}: {
  value: string;
  label?: string;
  variant?: "ghost" | "outline" | "default";
  size?: "sm" | "default";
}) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("링크가 클립보드에 복사되었습니다.");
      setTimeout(() => setCopied(false), SUCCESS_RESET_MS);
    } catch {
      toast.error(
        "클립보드 복사에 실패했습니다. 링크를 직접 선택해서 복사해 주세요.",
      );
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      aria-label={label}
    >
      {copied ? (
        <Check
          className={cn("size-4", size === "sm" ? "mr-1" : "mr-2")}
          aria-hidden
        />
      ) : (
        <Copy
          className={cn("size-4", size === "sm" ? "mr-1" : "mr-2")}
          aria-hidden
        />
      )}
      <span>{copied ? "복사됨" : label}</span>
    </Button>
  );
}
