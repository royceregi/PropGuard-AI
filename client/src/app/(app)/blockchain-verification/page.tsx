import type { Metadata } from "next";
import { Suspense } from "react";
import { BlockchainVerificationUI } from "@/components/blockchain/BlockchainVerificationUI";

export const metadata: Metadata = {
  title: "Blockchain Verification · PropGuard AI"
};

export default function BlockchainVerificationPage() {
  return (
    <div className="bg-background p-3 sm:p-4 lg:p-6 xl:p-8">
      <Suspense
        fallback={
          <p className="text-sm text-text-muted">
            Loading verification console…
          </p>
        }
      >
        <BlockchainVerificationUI />
      </Suspense>
    </div>
  );
}
