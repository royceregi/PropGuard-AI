"use client";

import Link from "next/link";
import { Icons } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { homeForRole } from "@/lib/auth/roles";

export function HeroActions() {
  const { user, isAuthenticated } = useAuth();
  const workspaceHref =
    isAuthenticated && user ? homeForRole(user.role) : "/login";

  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      <Link
        href={workspaceHref}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
      >
        Launch Verification Workspace
        <Icons.ArrowForward className="h-4 w-4" />
      </Link>
      <a
        href="#architecture"
        className="inline-flex h-12 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
      >
        Explore System Architecture
      </a>
    </div>
  );
}
