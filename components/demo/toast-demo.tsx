"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        onClick={() =>
          toast.success("저장되었습니다", {
            description: "변경 사항이 정상 반영되었습니다.",
          })
        }
      >
        성공 토스트
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          toast.info("새 알림", { description: "새 공지가 도착했습니다." })
        }
      >
        정보 토스트
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() =>
          toast.error("오류가 발생했습니다", {
            description: "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
          })
        }
      >
        에러 토스트
      </Button>
    </div>
  );
}
