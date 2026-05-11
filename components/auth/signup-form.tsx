"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("비밀번호가 일치하지 않습니다");
      return;
    }
    toast.success("회원가입 시도 (데모)", { description: email });
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">비밀번호 확인</Label>
        <Input
          id="confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full">
        회원가입
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground hover:underline"
        >
          로그인
        </Link>
      </p>
    </form>
  );
}
