import type { Metadata } from "next";
import { CheckCircle2, Info } from "lucide-react";

import { Container } from "@/components/layouts/container";
import { PageHeader } from "@/components/layouts/page-header";
import { ToastDemo } from "@/components/demo/toast-demo";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "쇼케이스",
  description: "스타터킷에 포함된 모든 shadcn 컴포넌트 시연 페이지",
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        {children}
      </div>
    </section>
  );
}

export default function ShowcasePage() {
  return (
    <Container className="space-y-10 py-10">
      <PageHeader
        title="컴포넌트 쇼케이스"
        description="설치된 shadcn radix-nova 컴포넌트를 한눈에 확인하세요."
      />

      <Section title="Button" description="6가지 variant × 다양한 size">
        <div className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
        <Separator className="my-4" />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs">XS</Button>
          <Button size="sm">SM</Button>
          <Button>Default</Button>
          <Button size="lg">LG</Button>
          <Button size="icon" aria-label="info">
            <Info />
          </Button>
        </div>
      </Section>

      <Section title="Form 입력" description="Input · Label · Textarea">
        <form className="grid max-w-lg gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="message">메시지</Label>
            <Textarea
              id="message"
              placeholder="문의 내용을 입력해 주세요."
              rows={4}
            />
          </div>
          <Button type="button" className="justify-self-start">
            전송
          </Button>
        </form>
      </Section>

      <Section title="Card · Badge · Avatar">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>프로젝트 알파</CardTitle>
              <CardDescription>
                새로 시작한 디자인 시스템 프로젝트입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt="avatar" />
                <AvatarFallback>NS</AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <div className="font-medium">Next Starter</div>
                <div className="text-muted-foreground">2 days ago</div>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Badge>active</Badge>
              <Badge variant="secondary">beta</Badge>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>로딩 스켈레톤</CardTitle>
              <CardDescription>
                데이터 페칭 중 자리표시용 UI입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Overlay" description="Dialog · Tooltip">
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Dialog 열기</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>변경 사항을 저장하시겠습니까?</DialogTitle>
                <DialogDescription>
                  저장하지 않으면 작성한 내용이 사라집니다.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost">취소</Button>
                <Button>
                  <CheckCircle2 />
                  저장
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost">툴팁 호버</Button>
            </TooltipTrigger>
            <TooltipContent>키보드 단축키: ⌘K</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      <Section title="Sonner Toast" description="lib: sonner (shadcn 권장)">
        <ToastDemo />
      </Section>
    </Container>
  );
}
