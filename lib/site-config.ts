export const siteConfig = {
  name: "NextJS Starter",
  description:
    "Next.js 15, TypeScript, TailwindCSS, ShadcnUI로 구축된 프로덕션 준비가 완료된 웹 애플리케이션 템플릿",
  url: "https://example.com",
  nav: [
    { title: "홈", href: "/" },
    { title: "로그인", href: "/login" },
  ],
  links: {
    github: "https://github.com",
  },
} as const;

export type SiteConfig = typeof siteConfig;
export type NavItem = SiteConfig["nav"][number];
