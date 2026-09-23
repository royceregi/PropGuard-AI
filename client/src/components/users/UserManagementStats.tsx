"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import { StatsCard } from "@/components/stats/StatsCard";
import { api } from "@/lib/api/client";

export interface UserStats {
  total_users: number;
  approved_users: number;
  pending_approval: number;
  public_users: number;
}

const EMPTY_STATS: UserStats = {
  total_users: 0,
  approved_users: 0,
  pending_approval: 0,
  public_users: 0,
};

export function UserManagementStats({
  refreshKey = 0,
}: {
  refreshKey?: number;
}) {
  const [stats, setStats] = useState<UserStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<UserStats>("/api/v1/users/stats");
        if (!cancelled) {
          setStats(data);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load user statistics.");
          setStats(EMPTY_STATS);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <section aria-label="User management statistics" className="space-y-3">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-critical-container px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Total Users"
          value={loading ? "—" : stats.total_users}
          icon={Icons.Group}
          trend={{ value: "", label: "In directory" }}
          variant="info"
        />
        <StatsCard
          title="Approved Users"
          value={loading ? "—" : stats.approved_users}
          icon={Icons.HowToReg}
          trend={{
            value: "",
            label: "Active accounts",
            positive: true,
          }}
        />
        <StatsCard
          title="Pending Approval"
          value={loading ? "—" : stats.pending_approval}
          icon={Icons.HourglassEmpty}
          variant="error"
          trend={{
            value: "Review",
            label: "Awaiting activation",
            isError: true,
          }}
        />
        <StatsCard
          title="General Public"
          value={loading ? "—" : stats.public_users}
          icon={Icons.VerifiedUser}
          variant="info"
          trend={{ value: "", label: "Public accounts" }}
        />
      </div>
    </section>
  );
}
