"use client";

import { useAuth } from "@/hooks/useAuth";
import { BlockchainHashDetailsTable } from "@/components/settings/BlockchainHashDetailsTable";
import { BlockchainHashManagement } from "@/components/settings/BlockchainHashManagement";

export function SettingsUI() {
  const { user } = useAuth();
  const isAdmin = user?.access_level === "SYSTEM";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-3 sm:p-4 lg:p-6 xl:p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          Settings
        </h1>
      </header>

      {isAdmin ? (
        <>
          <BlockchainHashManagement />
          <BlockchainHashDetailsTable />
        </>
      ) : (
        <p className="rounded-xl border border-border-subtle bg-surface px-4 py-6 text-sm text-text-muted">
          No settings are available for your role.
        </p>
      )}
    </div>
  );
}
