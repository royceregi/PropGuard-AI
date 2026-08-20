import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyableHashBox } from "@/components/ui/CopyableHashBox";

export function TransactionDetailsUI() {
  return (
    <div className="flex flex-col gap-6">
      {/* 1. Page Header & Actions */}
      <div>
        <Breadcrumbs
          items={[
            { label: "Transactions", href: "/transactions" },
            { label: "TX-2023-10425" },
          ]}
          className="mb-4"
        />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-3 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
              Transaction TX-2023-10425
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label="Verified"
                variant="info"
                icon={<Icons.AllInclusive />}
                size="md"
              />
              <StatusBadge
                label="Low Risk"
                variant="success"
                icon={<Icons.GppGood />}
                size="md"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
            <button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 font-medium text-text-secondary transition-colors hover:bg-surface-canvas hover:text-text-primary">
              <Icons.ReceiptLong className="h-[18px] w-[18px]" />
              Verify Blockchain
            </button>
            <button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-medium text-white transition-colors hover:bg-primary-hover">
              <Icons.AutoAwesome className="h-[18px] w-[18px]" />
              Run AI Investigation
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2/3) */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Property Information Card */}
          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.LocationCity className="h-[22px] w-[22px] text-text-muted" />
              Property Information
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                  Property Type
                </span>
                <span className="text-sm font-medium text-text-primary">
                  Commercial Office
                </span>
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                  Primary Usage
                </span>
                <span className="text-sm font-medium text-text-primary">
                  Retail / Tech Hub
                </span>
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                  Total Area
                </span>
                <span className="text-sm font-medium text-text-primary">
                  12,450 sqft
                </span>
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                  Associated Project
                </span>
                <span className="text-sm font-medium text-text-primary">
                  Downtown Nexus Development
                </span>
              </div>
            </div>
          </section>

          {/* Transaction Details Card */}
          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.Receipt className="h-[22px] w-[22px] text-text-muted" />
              Transaction Details
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                  Execution Date
                </span>
                <span className="font-mono text-sm text-text-primary">
                  2023-10-24 14:32 UTC
                </span>
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                  Sale Price
                </span>
                <span className="text-lg font-bold text-primary">
                  $4,250,000.00
                </span>
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                  Registration Type
                </span>
                <span className="text-sm font-medium text-text-primary">
                  Freehold Transfer
                </span>
              </div>
            </div>
          </section>

          {/* Participants Card */}
          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.Group className="h-[22px] w-[22px] text-text-muted" />
              Participants
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-4 rounded-lg border border-border bg-surface-canvas p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-text-secondary">
                  <Icons.PersonAdd className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-medium text-text-secondary">
                    Buyer Entity (Role 1)
                  </span>
                  <span className="block text-sm font-bold text-text-primary">
                    1 Verified Party
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-lg border border-border bg-surface-canvas p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-text-secondary">
                  <Icons.PersonRemove className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-medium text-text-secondary">
                    Seller Entity (Role 2)
                  </span>
                  <span className="block text-sm font-bold text-text-primary">
                    1 Verified Party
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column (1/3) */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* AI Risk Assessment Card */}
          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.SmartToy className="h-[22px] w-[22px] text-primary" />
              AI Risk Assessment
            </h2>

            <div className="mb-4 flex items-end justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-primary">
                  18
                </span>
                <span className="text-sm font-medium text-text-muted">
                  / 100
                </span>
              </div>
              <StatusBadge label="Low Risk" variant="success" size="sm" />
            </div>

            <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
              <div className="h-full w-[18%] bg-primary" />
            </div>

            <div className="mb-6">
              <span className="mb-2 block text-xs font-semibold text-text-muted">
                Reasoning
              </span>
              <p className="text-sm leading-relaxed text-text-secondary">
                Transaction patterns align with historical data for this asset
                class. Parties involved have established institutional histories
                with no flagged AML markers. Title transfer sequence is logical.
              </p>
            </div>

            <div>
              <span className="mb-2 block text-xs font-semibold text-text-muted">
                Recommendation
              </span>
              <div className="flex items-start gap-2">
                <Icons.CheckCircle className="h-[18px] w-[18px] text-success" />
                <p className="text-sm font-medium text-success">
                  Proceed with standard clearing protocol.
                </p>
              </div>
            </div>
          </section>

          {/* Ledger Verification Card */}
          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.ViewInAr className="h-[22px] w-[22px] text-text-muted" />
              Ledger Verification
            </h2>

            <div className="mb-6 flex flex-col gap-4">
              <CopyableHashBox
                label="Transaction Hash"
                value="0x8fB3c5b8e92a4D9c7F1b0E3d2A4c8e7f1B9dE2a"
                displayValue="0x8fB3c...a19dE2"
              />

              <div>
                <span className="mb-1.5 block text-xs font-medium tracking-wide text-text-secondary uppercase">
                  Block Number
                </span>
                <div className="rounded-lg border border-border bg-surface-subtle px-3 py-2">
                  <code className="font-mono text-[13px] text-text-primary">
                    #18459201
                  </code>
                </div>
              </div>
            </div>

            <div className="mt-auto border-t border-border-subtle pt-4">
              <div className="flex items-center gap-2">
                <Icons.Verified className="h-[18px] w-[18px] text-success" />
                <span className="text-xs font-medium text-success">
                  On-Chain Finality Reached (64 Confirmations)
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
