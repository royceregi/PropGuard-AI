"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Icons } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { canAccessPath, homeForRole } from "@/lib/auth/roles";
import { isUserRole } from "@/lib/auth/types";

const REMEMBER_KEY = "propguard.rememberNic";
const NIC_PATTERN = /^(?:\d{9}[VX]|\d{12})$/;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const nicId = useId();
  const passwordId = useId();
  const rememberId = useId();

  const [nic, setNic] = useState(() => readRememberedNic());
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => hasRememberedNic());
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [nicTouched, setNicTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const nicError = getNicError(nic);
  const passwordError = getPasswordError(password);
  const showNicError = (submitted || nicTouched) && Boolean(nicError);
  const showPasswordError =
    (submitted || passwordTouched) && Boolean(passwordError);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setServerError(null);

    if (nicError || passwordError) {
      return;
    }

    setLoading(true);

    if (rememberMe) {
      window.localStorage.setItem(REMEMBER_KEY, nic);
    } else {
      window.localStorage.removeItem(REMEMBER_KEY);
    }

    try {
      const user = await login({ nic, password });
      const next = searchParams.get("next");
      const roleHome = isUserRole(user.role)
        ? homeForRole(user.role)
        : "/dashboard/my-properties";
      const destination =
        next &&
        next.startsWith("/") &&
        !next.startsWith("//") &&
        isUserRole(user.role) &&
        canAccessPath(next, user.role)
          ? next
          : roleHome;
      router.replace(destination);
      router.refresh();
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Invalid NIC or password",
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
          htmlFor={nicId}
          className="block text-sm font-medium text-text-primary"
        >
          National Identity Card
        </label>
        <div className="relative">
          <Icons.Badge className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-text-muted" />
          <input
            id={nicId}
            name="nic"
            type="text"
            autoComplete="username"
            inputMode="text"
            value={nic}
            aria-invalid={showNicError}
            aria-describedby={showNicError ? `${nicId}-error` : undefined}
            onBlur={() => setNicTouched(true)}
            onChange={(event) => {
              setNic(event.target.value.toUpperCase());
              setServerError(null);
            }}
            placeholder="900000001V"
            className={`h-11 w-full rounded-lg border bg-surface py-2 pr-3 pl-10 text-sm tracking-wide text-text-primary outline-none placeholder:text-text-muted focus:border-primary ${
              showNicError ? "border-danger" : "border-border"
            }`}
          />
        </div>
        {showNicError ? (
          <p id={`${nicId}-error`} role="alert" className="text-xs text-danger">
            {nicError}
          </p>
        ) : (
          <p className="text-xs text-text-muted">
            Use your NIC number to access the verification workspace.
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
          Remember NIC
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

function getNicError(nic: string): string | null {
  const value = nic.trim().toUpperCase();
  if (!value) {
    return "National Identity Card number is required.";
  }
  if (!NIC_PATTERN.test(value)) {
    return "Enter a valid NIC (9 digits + V/X, or 12 digits).";
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

function readRememberedNic(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(REMEMBER_KEY) ?? "";
}

function hasRememberedNic(): boolean {
  return readRememberedNic().length > 0;
}
