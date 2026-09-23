"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { homeForAccessLevel } from "@/lib/auth/roles";
import { isOperationalAccessLevel } from "@/lib/auth/types";

export default function DashboardIndexPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user && isOperationalAccessLevel(user.access_level)) {
      router.replace(homeForAccessLevel(user.access_level));
      return;
    }
    router.replace("/login");
  }, [router, user]);

  return (
    <div className="p-6 text-sm text-text-secondary">
      Opening your verification workspace…
    </div>
  );
}
