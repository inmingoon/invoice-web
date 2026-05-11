"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.success("로그인 시도 (데모)", {
      description: `${email}${remember ? " · 로그인 상태 유지" : ""}`,
    });
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm select-none">
        <Checkbox
          id="remember"
          checked={remember}
          onCheckedChange={(v) => setRemember(v === true)}
        />
        로그인 상태 유지
      </label>
      <Button type="submit" className="w-full">
        로그인하기
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        아직 계정이 없으신가요?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground hover:underline"
        >
          회원가입
        </Link>
      </p>
    </form>
  );
}
