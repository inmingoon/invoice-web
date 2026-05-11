"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { Button } from "@/components/ui/button";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        문제가 발생했습니다
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        {error.message || "예기치 못한 오류로 페이지를 표시할 수 없습니다."}
      </p>
      <div className="mt-8 flex gap-2">
        <Button onClick={() => reset()}>다시 시도</Button>
        <Button variant="outline" asChild>
          <Link href="/">홈으로 이동</Link>
        </Button>
      </div>
    </Container>
  );
}
