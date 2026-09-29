"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { api } from "@/lib/api/client";
import type { HashVerifyResponse } from "@/lib/blockchain/verification";

type CheckRow = {
  label: string;
  ok: boolean | null;
  pass: string;
  fail: string;
};

function integrityChecks(data: HashVerifyResponse): CheckRow[] {
  const match = { pass: "Match", fail: "Mismatch" };
  return [
    { label: "Block hash", ok: data.tx_hash_match, ...match },
    {
      label: "Transaction data hash",
      ok: data.transaction_data_hash_match,
      ...match
    },
    { label: "Chain link", ok: data.previous_hash_match, ...match },
    { label: "Property anchor", ok: data.property_hash_match, ...match },
    { label: "Documents", ok: data.document_hash_match, ...match },
    {
      label: "Registry signature",
      ok: data.digital_signature_valid,
      pass: "Valid",
      fail: "Invalid"
    },
    {
      label: "Registry contract",
      ok: data.smart_contract_valid,
      pass: "Valid",
      fail: "Unknown"
    },
    {
      label: "Unique block hash",
      ok: !data.duplicate_tx_hash,
      pass: "Unique",
      fail: "Duplicate"
    }
  ];
}

export function LedgerIntegrityStatus({
  transactionId
}: {
  transactionId: string;
}) {
  const [data, setData] = useState<HashVerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<HashVerifyResponse>(
        `/api/v1/blockchain/verify/${encodeURIComponent(transactionId)}`
      )
      .then(({ data: result }) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(
            isAxiosError(err) && err.response?.status === 404
              ? "No blockchain record for this transaction."
              : "Unable to verify ledger hashes."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  if (error) {
    return <p className="text-xs font-medium text-text-muted">{error}</p>;
  }
  if (!data) {
    return (
      <p className="text-xs font-medium text-text-muted">
        Verifying ledger hashes…
      </p>
    );
  }

  const valid = data.integrity === "VALID";
  const changes = data.details.property_changes ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {valid ? (
          <Icons.GppGood className="h-5 w-5 text-success" />
        ) : (
          <Icons.GppBad className="h-5 w-5 text-danger" />
        )}
        <span
          className={`text-sm font-bold tracking-wide ${valid ? "text-success" : "text-danger"}`}
        >
          Blockchain Integrity: {data.integrity}
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {integrityChecks(data).map(({ label, ok, pass, fail }) => (
          <li key={label} className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">{label}</span>
            <span
              className={`font-semibold ${
                ok === null
                  ? "text-text-muted"
                  : ok
                    ? "text-success"
                    : "text-danger"
              }`}
            >
              {ok === null ? "Not checked" : ok ? pass : fail}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-text-muted">
        Consensus:{" "}
        <span
          className={`font-semibold ${data.consensus_verified ? "text-success" : "text-warning"}`}
        >
          {data.consensus_verified
            ? "Confirmed by validators"
            : data.details.transaction_status ||
              data.details.consensus_verification ||
              "Not confirmed"}
        </span>
      </p>
      {changes.length > 0 ? (
        <div className="rounded-lg border border-border-subtle p-2 text-[11px]">
          <p className="mb-1 font-semibold text-text-secondary">
            Registry changed since anchoring
            {data.details.is_chain_head ? "" : " (older block, still valid)"}
          </p>
          {changes.map((change) => (
            <p
              key={change.field}
              className="font-mono break-all text-text-muted"
            >
              {change.field}: {change.anchored ?? "—"} → {change.current ?? "—"}
            </p>
          ))}
        </div>
      ) : null}
      <p className="text-[11px] text-text-muted">
        {data.details.chain_position === "GENESIS"
          ? "First block of this property's chain."
          : "Linked to the previous block of this property."}
      </p>
    </div>
  );
}
