"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { regenerateTokenAction } from "@/app/admin/invoices/actions";
import { Button } from "@/components/ui/button";

const CONFIRM_MESSAGE =
  "토큰을 회수하면 기존 링크는 즉시 404가 됩니다. 계속할까요?";

/**
 * 토큰 회수 버튼. window.confirm으로 1차 확인 후 Server Action 호출.
 * revalidatePath가 list와 detail을 모두 재실행하므로 별도 router.refresh 불필요.
 */
export function RegenerateButton({ invoiceId }: { invoiceId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(CONFIRM_MESSAGE)) return;
    startTransition(async () => {
      const result = await regenerateTokenAction(invoiceId);
      if (result.ok) {
        toast.success(
          "새 토큰이 발급되었습니다. 기존 링크는 더 이상 작동하지 않습니다.",
        );
        return;
      }
      if (result.reason === "unauthorized") {
        toast.error("세션이 만료되었습니다. 다시 로그인해 주세요.");
      } else if (result.reason === "rate_limited") {
        toast.error("요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        toast.error("토큰 재발급에 실패했습니다.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={onClick}
      aria-label="토큰 회수"
    >
      <RefreshCw
        className={pending ? "mr-1 size-4 animate-spin" : "mr-1 size-4"}
        aria-hidden
      />
      <span>{pending ? "회수 중..." : "토큰 회수"}</span>
    </Button>
  );
}
