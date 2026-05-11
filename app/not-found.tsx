import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-medium tracking-widest text-muted-foreground">
        404
      </p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        요청하신 페이지가 존재하지 않거나, 이동되었거나, 일시적으로 사용할 수
        없습니다.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">홈으로 돌아가기</Link>
      </Button>
    </Container>
  );
}
