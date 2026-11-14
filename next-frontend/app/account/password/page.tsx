"use client";

import { AccountLayout } from "@/components/account/AccountLayout";
import { ChangePasswordCard } from "@/components/auth/ChangePasswordCard";

export default function ChangePasswordPage() {
  return (
    <AccountLayout>
      <ChangePasswordCard />
    </AccountLayout>
  );
}
