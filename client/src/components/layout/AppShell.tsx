"use client";

import { useState } from "react";
import { SideNav } from "@/components/layout/SideNav";
import { TopNav } from "@/components/layout/TopNav";
import { UserNLPAssistantModal } from "@/components/assistant/UserNLPAssistantModal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <SideNav
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col bg-surface-canvas">
        <TopNav
          collapsed={sidebarCollapsed}
          onMenuClick={() => setSidebarOpen(true)}
          onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        />
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>

      <UserNLPAssistantModal />
    </div>
  );
}
