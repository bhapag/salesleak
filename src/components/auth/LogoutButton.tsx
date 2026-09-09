"use client";

import { useTransition } from "react";
import { logout } from "@/server/actions/auth";
import { SecondaryButton } from "@/components/ui";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <SecondaryButton onClick={() => startTransition(async () => logout())} loading={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </SecondaryButton>
  );
}
