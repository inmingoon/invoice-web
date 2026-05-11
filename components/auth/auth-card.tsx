import type { ReactNode } from "react";

import { Container } from "@/components/layouts/container";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuthCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <Container className="grid place-items-center py-16 sm:py-24">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </Container>
  );
}
