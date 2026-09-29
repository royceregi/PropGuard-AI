"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Icons } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { canAccessPath, homeForAccessLevel } from "@/lib/auth/roles";
import { isOperationalAccessLevel } from "@/lib/auth/types";

const REMEMBER_KEY = "propguard.rememberEmail";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const emailId = useId();
  const passwordId = useId();
  const rememberId = useId();

  const [email, setEmail] = useState(() => readRememberedEmail());
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => hasRememberedEmail());
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const emailError = getEmailError(email);
  const passwordError = getPasswordError(password);
  const showEmailError = (submitted || emailTouched) && Boolean(emailError);
  const showPasswordError =
    (submitted || passwordTouched) && Boolean(passwordError);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setServerError(null);

    if (emailError || passwordError) {
      return;
    }

    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    if (rememberMe) {
      window.localStorage.setItem(REMEMBER_KEY, normalizedEmail);
    } else {
      window.localStorage.removeItem(REMEMBER_KEY);
    }

    try {
      const user = await login({ email: normalizedEmail, password });
      const next = searchParams.get("next");
      const roleHome = isOperationalAccessLevel(user.access_level)
        ? homeForAccessLevel(user.access_level)
        : "/dashboard/my-properties";
      const destination =
        next &&
        next.startsWith("/") &&
        !next.startsWith("//") &&
        isOperationalAccessLevel(user.access_level) &&
        canAccessPath(next, user.access_level)
          ? next
          : roleHome;
      router.replace(destination);
      router.refresh();
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Invalid email or password"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {serverError ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-critical-container px-3 py-2 text-sm text-danger"
        >
          {serverError}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label
          htmlFor={emailId}
          className="block text-sm font-medium text-text-primary"
        >
          Email
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
            onBlur={() => setEmailTouched(true)}
            onChange={(event) => {
              setEmail(event.target.value);
              setServerError(null);
            }}
            placeholder="maria.s@example.com"
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
        ) : (
          <p className="text-xs text-text-muted">
            Sign in with your registered email address.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={passwordId}
          className="block text-sm font-medium text-text-primary"
        >
          Password
        </label>
        <div className="relative">
          <Icons.Lock className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-text-muted" />
          <input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            aria-invalid={showPasswordError}
            aria-describedby={
              showPasswordError ? `${passwordId}-error` : undefined
            }
            onBlur={() => setPasswordTouched(true)}
            onChange={(event) => {
              setPassword(event.target.value);
              setServerError(null);
            }}
            placeholder="Enter your password"
            className={`h-11 w-full rounded-lg border bg-surface py-2 pr-11 pl-10 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary ${
              showPasswordError ? "border-danger" : "border-border"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
          >
            {showPassword ? (
              <Icons.VisibilityOff className="h-5 w-5" />
            ) : (
              <Icons.Visibility className="h-5 w-5" />
            )}
          </button>
        </div>
        {showPasswordError ? (
          <p
            id={`${passwordId}-error`}
            role="alert"
            className="text-xs text-danger"
          >
            {passwordError}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={rememberId}
          className="inline-flex cursor-pointer items-center gap-2 text-sm text-text-secondary"
        >
          <input
            id={rememberId}
            name="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border-border text-primary accent-primary"
          />
          Remember email
        </label>
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-link hover:text-link-hover"
        >
          Forgot Password?
        </Link>
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
          <Icons.Login className="h-5 w-5" />
        )}
        {loading ? "Verifying identity..." : "Sign in"}
      </button>
    </form>
  );
}

function getEmailError(email: string): string | null {
  const value = email.trim();
  if (!value) {
    return "Email is required.";
  }
  if (!EMAIL_PATTERN.test(value)) {
    return "Enter a valid email address.";
  }
  return null;
}

function getPasswordError(password: string): string | null {
  if (!password) {
    return "Password is required.";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

function readRememberedEmail(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(REMEMBER_KEY) ?? "";
}

function hasRememberedEmail(): boolean {
  return readRememberedEmail().length > 0;
}
