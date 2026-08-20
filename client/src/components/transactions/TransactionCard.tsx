import Link from "next/link";
import { Icons } from "@/components/icons";
import { StatusBadge, StatusBadgeVariant } from "@/components/ui/StatusBadge";

export interface TransactionCardProps {
  id: string;
  address: string;
  area: string;
  date: string;
  value: string;
  propertyType: string;
  txId: string;
  riskLevel: "Low Risk" | "Med Risk" | "High Risk";
  verificationStatus: "Verified" | "Pending";
}

export function TransactionCard({
  id,
  address,
  area,
  date,
  value,
  propertyType,
  txId,
  riskLevel,
  verificationStatus,
}: TransactionCardProps) {
  const getRiskVariant = (risk: string): StatusBadgeVariant => {
    switch (risk) {
      case "Low Risk":
        return "success";
      case "Med Risk":
        return "warning";
      case "High Risk":
        return "error";
      default:
        return "neutral";
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case "Low Risk":
        return <Icons.GppGood />;
      case "Med Risk":
        return <Icons.WarningAmber />;
      case "High Risk":
        return <Icons.GppBad />;
      default:
        return <Icons.GppMaybe />;
    }
  };

  const getVerificationVariant = (status: string): StatusBadgeVariant => {
    return status === "Verified" ? "info" : "neutral";
  };

  const getVerificationIcon = (status: string) => {
    return status === "Verified" ? (
      <Icons.AllInclusive />
    ) : (
      <Icons.HourglassEmpty />
    );
  };

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge
            label={riskLevel}
            variant={getRiskVariant(riskLevel)}
            icon={getRiskIcon(riskLevel)}
            size="sm"
          />
          <StatusBadge
            label={verificationStatus}
            variant={getVerificationVariant(verificationStatus)}
            icon={getVerificationIcon(verificationStatus)}
            size="sm"
          />
        </div>
        <span className="font-mono text-xs text-text-muted">{date}</span>
      </div>

      <div className="mb-5 flex-1">
        <h3 className="mb-1 text-lg font-bold leading-tight text-text-primary">
          {address}
        </h3>
        <div className="flex items-center gap-1 text-sm text-text-secondary">
          <Icons.LocationOn className="h-4 w-4" />
          <span>{area}</span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
            Value
          </span>
          <span className="text-xl font-bold text-text-primary">{value}</span>
        </div>
        <div>
          <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
            Type
          </span>
          <span className="text-sm font-medium text-text-secondary">
            {propertyType}
          </span>
        </div>
      </div>

      <div className="mt-auto border-t border-border-subtle pt-4">
        <div className="flex items-end justify-between">
          <div>
            <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
              TX ID
            </span>
            <Link
              href={`/transactions/${id}`}
              className="font-mono text-sm text-primary transition-colors hover:text-primary-hover hover:underline"
            >
              {txId}
            </Link>
          </div>
          <Link
            href={`/transactions/${id}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary-subtle"
            aria-label="View transaction details"
          >
            <Icons.ArrowForward className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
