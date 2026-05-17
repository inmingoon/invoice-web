import { LogOut } from "lucide-react";

import { logoutAction } from "@/app/admin-login/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut className="mr-2 size-4" aria-hidden />
        로그아웃
      </Button>
    </form>
  );
}
