import Link from "next/link";
import { Icons } from "@/components/icons";
import {
  StatusBadge,
  type StatusBadgeVariant
} from "@/components/ui/StatusBadge";
import {
  formatMoneyWithCurrency,
  formatTransactionDate,
  partyDisplayName,
  shortenId,
  statusVariant,
  type PropertyTransaction
} from "@/lib/transactions/types";

export interface TransactionCardProps {
  transaction: PropertyTransaction;
  layout?: "grid" | "list";
}

export function TransactionCard({
  transaction,
  layout = "grid"
}: TransactionCardProps) {
  const statusLabel = (transaction.status ?? "Unknown").trim() || "Unknown";
  const verificationVariant = statusVariant(transaction.status);
  const title =
    transaction.project_name?.trim() ||
    transaction.master_project?.trim() ||
    transaction.procedure_name?.trim() ||
    transaction.property_id ||
    transaction.transaction_id;
  const area = transaction.area_name?.trim() || "—";
  const typeLabel =
    transaction.registration_type?.trim() ||
    transaction.transaction_group?.trim() ||
    "—";

  const isList = layout === "list";

  return (
    <div
      className={`flex rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md ${
        isList ? "flex-col gap-4 sm:flex-row sm:items-stretch" : "flex-col"
      }`}
    >
      <div className={isList ? "min-w-0 flex-1" : ""}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label="Risk N/A"
              variant="neutral"
              icon={<Icons.GppMaybe />}
              size="sm"
            />
            <StatusBadge
              label={statusLabel}
              variant={mapStatusBadge(verificationVariant)}
              icon={
                verificationVariant === "success" ? (
                  <Icons.AllInclusive />
                ) : (
                  <Icons.HourglassEmpty />
                )
              }
              size="sm"
            />
          </div>
          <span className="shrink-0 font-mono text-xs text-text-muted">
            {formatTransactionDate(transaction.transaction_datetime)}
          </span>
        </div>

        <div className={isList ? "mb-0" : "mb-5 flex-1"}>
          <h3 className="mb-1 text-lg leading-tight font-bold text-text-primary">
            {title}
          </h3>
          <div className="flex items-center gap-1 text-sm text-text-secondary">
            <Icons.LocationOn className="h-4 w-4 shrink-0" />
            <span className="truncate">{area}</span>
          </div>
        </div>
      </div>

      <div
        className={
          isList
            ? "flex shrink-0 flex-col justify-between gap-4 sm:w-56 sm:border-l sm:border-border-subtle sm:pl-5"
            : ""
        }
      >
        <div className={`grid grid-cols-2 gap-4 ${isList ? "" : "mb-6"}`}>
          <div>
            <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
              Value
            </span>
            <span className="text-xl font-bold text-text-primary">
              {formatMoneyWithCurrency(
                transaction.transaction_value,
                transaction.currency
              )}
            </span>
          </div>
          <div>
            <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
              Type
            </span>
            <span className="text-sm font-medium text-text-secondary">
              {typeLabel}
            </span>
          </div>
          <div>
            <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
              Seller
            </span>
            <span className="truncate text-sm font-medium text-text-secondary">
              {partyDisplayName(transaction.seller)}
            </span>
          </div>
          <div>
            <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
              Buyer
            </span>
            <span className="truncate text-sm font-medium text-text-secondary">
              {partyDisplayName(transaction.buyer)}
            </span>
          </div>
        </div>

        <div
          className={`mt-auto border-t border-border-subtle pt-4 ${isList ? "border-t-0 pt-0 sm:border-t sm:pt-4" : ""}`}
        >
          <div className="flex items-end justify-between">
            <div className="min-w-0">
              <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                TX ID
              </span>
              <Link
                href={`/transactions/${encodeURIComponent(transaction.transaction_id)}`}
                className="truncate font-mono text-sm text-primary transition-colors hover:text-primary-hover hover:underline"
                title={transaction.transaction_id}
              >
                {shortenId(transaction.transaction_id)}
              </Link>
            </div>
            <Link
              href={`/transactions/${encodeURIComponent(transaction.transaction_id)}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary-subtle"
              aria-label="View transaction details"
            >
              <Icons.ArrowForward className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function mapStatusBadge(
  variant: ReturnType<typeof statusVariant>
): StatusBadgeVariant {
  if (variant === "success") {
    return "info";
  }
  if (variant === "warning") {
    return "warning";
  }
  if (variant === "error") {
    return "error";
  }
  return "neutral";
}
