"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { homeForRole } from "@/lib/auth/roles";

export default function DashboardIndexPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    router.replace(user ? homeForRole(user.role) : "/login");
  }, [router, user]);

  return (
    <div className="p-6 text-sm text-text-secondary">
      Opening your verification workspace…
    </div>
  );
}
