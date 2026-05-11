import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "로그인",
  description: "계정에 로그인하여 서비스를 이용하세요",
};

export default function LoginPage() {
  return (
    <AuthCard
      title="로그인"
      description="계정에 로그인하여 서비스를 이용하세요"
    >
      <LoginForm />
    </AuthCard>
  );
}
