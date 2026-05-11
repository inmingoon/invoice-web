import Link from "next/link";
import {
  Component,
  Database,
  FileType2,
  Layers,
  Palette,
  Rocket,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Triangle,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Container } from "@/components/layouts/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type TechItem = { title: string; subtitle: string; icon: LucideIcon };
type FeatureItem = { title: string; description: string; icon: LucideIcon };

const techStack: TechItem[] = [
  { title: "Next.js 15", subtitle: "App Router", icon: Triangle },
  { title: "TypeScript", subtitle: "타입 안정성", icon: FileType2 },
  { title: "TailwindCSS", subtitle: "유틸리티 CSS", icon: Wind },
  { title: "ShadcnUI", subtitle: "컴포넌트 라이브러리", icon: Component },
];

const features: FeatureItem[] = [
  {
    title: "빠른 성능",
    description: "Turbopack과 React Server Components로 최적화된 성능",
    icon: Zap,
  },
  {
    title: "타입 안정성",
    description: "TypeScript strict 모드로 컴파일 타임에 오류를 차단",
    icon: ShieldCheck,
  },
  {
    title: "아름다운 디자인",
    description: "shadcn radix-nova 기반의 일관된 디자인 시스템",
    icon: Palette,
  },
  {
    title: "개발자 경험",
    description: "ESLint · Prettier · Husky로 표준화된 워크플로",
    icon: Wrench,
  },
  {
    title: "반응형 디자인",
    description: "모바일부터 데스크톱까지 어떤 화면에도 매끄럽게 대응",
    icon: Smartphone,
  },
  {
    title: "SEO 최적화",
    description: "Metadata API와 SSG로 검색엔진 친화적 페이지",
    icon: Search,
  },
  {
    title: "확장 가능",
    description: "모듈화된 컴포넌트로 기능을 빠르게 추가",
    icon: Layers,
  },
  {
    title: "프로덕션 준비",
    description: "Vercel 즉시 배포 가능한 프로덕션 그레이드 설정",
    icon: Rocket,
  },
  {
    title: "상태 관리",
    description: "필요할 때만 클라이언트 컴포넌트로 상태를 분리",
    icon: Database,
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-border">
        <Container className="py-20 text-center sm:py-28">
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="size-3.5" />
            Next.js 15 기반 스타터킷
          </Badge>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            모던 웹 개발을 위한 완벽한 스타터킷
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            Next.js 15, TypeScript, TailwindCSS, ShadcnUI로 구축된 프로덕션
            준비가 완료된 웹 애플리케이션 템플릿
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">무료로 시작하기</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/showcase">문서 보기</Link>
            </Button>
          </div>
        </Container>
      </section>

      {/* 기술 스택 */}
      <section>
        <Container className="grid gap-4 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {techStack.map(({ title, subtitle, icon: Icon }) => (
            <Card key={title}>
              <CardHeader className="items-center text-center">
                <Icon className="size-7 text-primary" />
                <CardTitle className="mt-3">{title}</CardTitle>
                <CardDescription>{subtitle}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </Container>
      </section>

      {/* 주요 기능 */}
      <section className="border-t border-border bg-muted/30">
        <Container className="py-16">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              주요 기능
            </h2>
            <p className="mt-3 text-muted-foreground">
              프로덕션에 바로 투입 가능한 핵심 기능들을 미리 갖췄습니다.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <Card key={title}>
                <CardHeader>
                  <Icon className="size-6 text-primary" />
                  <CardTitle className="mt-3">{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* 빠른 설치 */}
      <section className="border-t border-border">
        <Container className="py-16 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">빠른 설치</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            아래 명령어 한 줄로 즉시 시작할 수 있습니다.
          </p>
          <div className="mx-auto mt-8 max-w-2xl rounded-lg border border-border bg-muted/60 p-4 text-left">
            <code className="font-mono text-sm">
              git clone https://github.com/your-repo/nextjs-starter.git
            </code>
          </div>
        </Container>
      </section>
    </>
  );
}
