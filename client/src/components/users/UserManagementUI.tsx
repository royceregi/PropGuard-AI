"use client";

import { useState } from "react";
import { UserManagementStats } from "@/components/users/UserManagementStats";
import { UsersTable } from "@/components/users/UsersTable";

export function UserManagementUI() {
  const [refreshKey, setRefreshKey] = useState(0);

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <div className="space-y-6 p-3 sm:p-4 lg:p-6 xl:p-8">
      <header>
        <h1 className="text-xl font-semibold text-text-primary">
          User Management
        </h1>
      </header>

      <UserManagementStats refreshKey={refreshKey} />
      <UsersTable refreshKey={refreshKey} onChanged={refresh} />
    </div>
  );
}
