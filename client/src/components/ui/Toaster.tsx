"use client";

import type { CSSProperties } from "react";
import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="system"
      position="top-right"
      richColors
      closeButton
      duration={4000}
      gap={12}
      visibleToasts={4}
      offset={16}
      mobileOffset={16}
      toastOptions={{
        className: "font-sans",
        classNames: {
          toast: "border shadow-[0_8px_16px_rgba(0,0,0,0.08)] font-sans",
          title: "text-sm font-medium",
          description: "text-xs",
          actionButton: "bg-primary text-text-inverse",
          cancelButton: "bg-surface-subtle text-text-secondary"
        }
      }}
      style={
        {
          fontFamily: "var(--font-poppins), sans-serif",
          "--normal-bg": "var(--color-surface)",
          "--normal-border": "var(--color-border-subtle)",
          "--normal-text": "var(--color-text-primary)",
          "--success-bg": "var(--color-success-container)",
          "--success-border": "var(--color-success)",
          "--success-text": "var(--color-success-hover)",
          "--info-bg": "var(--color-primary-subtle)",
          "--info-border": "var(--color-primary-subtle-alt)",
          "--info-text": "var(--color-primary)",
          "--warning-bg": "var(--color-accent-container)",
          "--warning-border": "var(--color-accent-container-alt)",
          "--warning-text": "var(--color-accent)",
          "--error-bg": "var(--color-critical-container)",
          "--error-border": "var(--color-danger)",
          "--error-text": "var(--color-critical)"
        } as CSSProperties
      }
    />
  );
}
