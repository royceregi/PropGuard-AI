import { Icons } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CopyableHashBox } from "@/components/ui/CopyableHashBox";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function TransactionPreviewCard() {
  return (
    <article className="rounded-xl border border-border-subtle bg-surface p-4 shadow-[0_2px_4px_rgba(0,0,0,0.04)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Breadcrumbs
          items={[
            { label: "Transactions", href: "/transactions" },
            { label: "TX-2023-10425" }
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label="Verified"
            variant="success"
            icon={<Icons.Verified />}
          />
          <StatusBadge
            label="Low Risk"
            variant="info"
            icon={<Icons.Shield />}
          />
        </div>
      </div>

      <CopyableHashBox
        className="mt-4"
        label="Transaction Hash"
        value="0x8fB3c91a04dE77e2b1c4a19dE2f8c0a1b9e4d6c3"
        displayValue="0x8fB3c...a19dE2"
      />
    </article>
  );
}
