"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { Icons } from "@/components/icons";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordForm() {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sent, setSent] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailError = getEmailError(email);
  const showEmailError = (submitted || touched) && Boolean(emailError);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (emailError) {
      return;
    }

    setLoading(true);
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-container text-success">
          <Icons.MarkEmailRead className="h-[26px] w-[26px]" />
        </div>
        <p className="text-sm text-text-secondary">
          If an account exists for{" "}
          <span className="font-medium text-text-primary">{email}</span>, reset
          instructions have been sent.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm font-medium text-link hover:text-link-hover"
        >
          <Icons.ArrowBack className="h-[18px] w-[18px]" />
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <label
          htmlFor={emailId}
          className="block text-sm font-medium text-text-primary"
        >
          Work Email
        </label>
        <div className="relative">
          <Icons.Mail className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-text-muted" />
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            aria-invalid={showEmailError}
            aria-describedby={showEmailError ? `${emailId}-error` : undefined}
            onBlur={() => setTouched(true)}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nina.v@example.com"
            className={`h-11 w-full rounded-lg border bg-surface py-2 pr-3 pl-10 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary ${
              showEmailError ? "border-danger" : "border-border"
            }`}
          />
        </div>
        {showEmailError ? (
          <p
            id={`${emailId}-error`}
            role="alert"
            className="text-xs text-danger"
          >
            {emailError}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-text-inverse transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-80"
      >
        {loading ? (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
            aria-hidden
          />
        ) : (
          <Icons.Send className="h-5 w-5" />
        )}
        {loading ? "Sending..." : "Send reset link"}
      </button>

      <p className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm font-medium text-link hover:text-link-hover"
        >
          <Icons.ArrowBack className="h-[18px] w-[18px]" />
          Back to login
        </Link>
      </p>
    </form>
  );
}

function getEmailError(email: string): string | null {
  if (!email.trim()) {
    return "Work email is required.";
  }
  if (!EMAIL_PATTERN.test(email.trim())) {
    return "Enter a valid work email address.";
  }
  return null;
}
