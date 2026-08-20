import { Suspense } from "react";
import {
  AuthBrandHeader,
  AuthSecurityBadge,
  AuthShell,
} from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign in · PropGuard AI",
};

export default function LoginPage() {
  return (
    <AuthShell>
      <article className="rounded-xl border border-border bg-surface p-6 shadow-[0_2px_4px_rgba(0,0,0,0.04)] sm:p-8">
        <AuthBrandHeader />
        <Suspense>
          <LoginForm />
        </Suspense>
        <AuthSecurityBadge />
      </article>
    </AuthShell>
  );
}
