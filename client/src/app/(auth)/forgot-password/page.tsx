import {
  AuthBrandHeader,
  AuthSecurityBadge,
  AuthShell
} from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata = {
  title: "Forgot password · PROPERTYCHAIN AI"
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <article className="rounded-xl border border-border bg-surface p-6 shadow-[0_2px_4px_rgba(0,0,0,0.04)] sm:p-8">
        <AuthBrandHeader />
        <h2 className="mb-1 text-base font-semibold text-text-primary">
          Reset master password
        </h2>
        <p className="mb-6 text-sm text-text-secondary">
          Enter your work email and we will send reset instructions.
        </p>
        <ForgotPasswordForm />
        <AuthSecurityBadge />
      </article>
    </AuthShell>
  );
}
