import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "회원가입",
  description: "새 계정을 만들어 서비스를 시작하세요",
};

export default function SignupPage() {
  return (
    <AuthCard
      title="회원가입"
      description="새 계정을 만들어 서비스를 시작하세요"
    >
      <SignupForm />
    </AuthCard>
  );
}
