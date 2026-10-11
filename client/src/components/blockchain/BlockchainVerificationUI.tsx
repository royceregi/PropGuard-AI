"use client";

import { api } from "@/lib/api/client";
import {
  API_FIELD_TO_FORM_KEY,
  buildVerifyPayload,
  DEFAULT_FORM_OPTIONS,
  EMPTY_VERIFICATION_FORM,
  isHashLike,
  SECTION_LABELS,
  shortenHash,
  validateVerificationForm,
  type FieldMismatch,
  type MismatchSection,
  type VerificationFieldKey,
  type VerificationForm,
  type VerificationFormErrors,
  type VerificationFormOptions,
  type VerifyResponse
} from "@/lib/blockchain/verification";
import { isAxiosError } from "axios";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  CheckCircle2,
  Home,
  Loader2,
  RefreshCw,
  Scale,
  ShieldX
} from "lucide-react";
import { JetBrains_Mono } from "next/font/google";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from "react";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-jetbrains-mono"
});

const INPUT_CLASS =
  "h-10 w-full rounded-lg border bg-surface-canvas px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20";

const MONO_CLASS = "font-[family-name:var(--font-jetbrains-mono)] text-xs";

type CompareState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "result"; data: VerifyResponse }
  | { kind: "error"; message: string };

function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail) && typeof detail[0]?.msg === "string") {
      return detail[0].msg.replace(/^Value error, /, "");
    }
  }
  return fallback;
}

export function BlockchainVerificationUI() {
  const searchParams = useSearchParams();

  const [form, setForm] = useState<VerificationForm>(() => ({
    ...EMPTY_VERIFICATION_FORM,
    propertyId: searchParams.get("property_id")?.trim() || "",
    transactionId: searchParams.get("transaction_id")?.trim() || ""
  }));
  const [options, setOptions] =
    useState<VerificationFormOptions>(DEFAULT_FORM_OPTIONS);
  const [errors, setErrors] = useState<VerificationFormErrors>({});
  const [compare, setCompare] = useState<CompareState>({ kind: "idle" });
  const [flagged, setFlagged] = useState<Set<VerificationFieldKey>>(new Set());
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<VerificationFormOptions>(
        "/api/v1/blockchain-transactions/form-options"
      )
      .then(({ data }) => {
        if (!cancelled) {
          setOptions({ ...DEFAULT_FORM_OPTIONS, ...data });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(key: VerificationFieldKey, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFlagged((current) => {
      if (!current.has(key)) {
        return current;
      }
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function resetForm() {
    setForm(EMPTY_VERIFICATION_FORM);
    setErrors({});
    setFlagged(new Set());
    setCompare({ kind: "idle" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateVerificationForm(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      setCompare({ kind: "idle" });
      return;
    }

    setCompare({ kind: "submitting" });
    setFlagged(new Set());
    try {
      const { data } = await api.post<VerifyResponse>(
        "/api/v1/blockchain-transactions/verify",
        buildVerifyPayload(form)
      );
      setCompare({ kind: "result", data });
      setFlagged(
        new Set(
          data.mismatches
            .map((item) => API_FIELD_TO_FORM_KEY[item.field])
            .filter((key): key is VerificationFieldKey => Boolean(key))
        )
      );
    } catch (err) {
      setCompare({
        kind: "error",
        message: apiErrorMessage(
          err,
          "Unable to compare the details right now."
        )
      });
    }
    window.requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      })
    );
  }

  const fieldProps = (key: VerificationFieldKey) => ({
    value: form[key],
    onChange: (value: string) => updateField(key, value),
    error: errors[key],
    flagged: flagged.has(key)
  });

  const errorCount = Object.keys(errors).length;

  return (
    <div
      className={`${jetbrainsMono.variable} mx-auto flex w-full max-w-7xl flex-col gap-6`}
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-6 xl:col-span-8"
        >
          <FormSection
            icon={<Home className="h-4 w-4 text-primary" />}
            title="Property details"
          >
            <TextField
              label="Property ID"
              placeholder="P001"
              mono
              required
              {...fieldProps("propertyId")}
            />
            <TextField
              label="Title Deed Number"
              placeholder="TD-12345"
              required
              {...fieldProps("titleDeedNumber")}
            />
            <TextField
              label="Address"
              placeholder="No. 12, Galle Road"
              required
              className="sm:col-span-2"
              {...fieldProps("address")}
            />
            <SuggestField
              label="District"
              placeholder="Colombo"
              required
              suggestions={options.districts}
              {...fieldProps("district")}
            />
            <SuggestField
              label="City"
              placeholder="Colombo 03"
              required
              suggestions={options.cities}
              {...fieldProps("city")}
            />

            <NumberField
              label="Land Area"
              placeholder="20.5"
              step="any"
              required
              {...fieldProps("landArea")}
            />
            <SelectField
              label="Area Unit"
              placeholder="Select unit"
              required
              choices={options.area_units}
              {...fieldProps("areaUnit")}
            />
            <SuggestField
              label="Land Type"
              placeholder="Residential"
              required
              suggestions={options.land_types}
              {...fieldProps("landType")}
            />
            <TextField
              label="Survey Plan Number"
              placeholder="Optional"
              mono
              {...fieldProps("surveyPlanNumber")}
            />
            <SuggestField
              label="Usage Type"
              placeholder="Optional"
              suggestions={options.usage_types}
              {...fieldProps("currentUsageType")}
            />
            <SuggestField
              label="Usage Subtype"
              placeholder="Optional"
              suggestions={options.usage_subtypes}
              {...fieldProps("currentSubtype")}
            />
          </FormSection>

          <FormSection
            icon={<ArrowLeftRight className="h-4 w-4 text-primary" />}
            title="Transaction details"
          >
            <TextField
              label="Transaction ID"
              placeholder="TX10025"
              mono
              required
              {...fieldProps("transactionId")}
            />
            <SelectField
              label="Transaction Type"
              placeholder="Select type"
              required
              choices={options.transaction_types}
              {...fieldProps("transactionType")}
            />
            <DateTimeField
              label="Transaction Date & Time"
              required
              {...fieldProps("transactionDatetime")}
            />
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <NumberField
                label="Transaction Value"
                placeholder="5000000"
                step="0.01"
                required
                {...fieldProps("transactionValue")}
              />
              <SelectField
                label="Currency"
                placeholder="—"
                required
                choices={options.currencies}
                {...fieldProps("currency")}
              />
            </div>
            <TextField
              label="Seller Wallet"
              placeholder="0x…"
              mono
              required
              className="sm:col-span-2"
              {...fieldProps("fromWallet")}
            />
            <TextField
              label="Buyer Wallet"
              placeholder="0x…"
              mono
              required
              className="sm:col-span-2"
              {...fieldProps("toWallet")}
            />
          </FormSection>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-text-muted">
              {errorCount > 0
                ? `${errorCount} field${errorCount === 1 ? "" : "s"} need${errorCount === 1 ? "s" : ""} attention before comparing.`
                : "Fields marked * are required. Optional fields are only compared when filled in."}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface-canvas px-4 text-sm font-medium text-text-primary hover:bg-surface-subtle"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </button>
              <button
                type="submit"
                disabled={compare.kind === "submitting"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-text-inverse transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                {compare.kind === "submitting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Scale className="h-4 w-4" />
                )}
                {compare.kind === "submitting" ? "Comparing…" : "Compare"}
              </button>
            </div>
          </div>
        </form>

        <aside ref={resultRef} className="xl:col-span-4">
          <div className="xl:sticky xl:top-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={
                  compare.kind === "result" ? compare.data.status : compare.kind
                }
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <ResultPanel state={compare} />
              </motion.div>
            </AnimatePresence>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FormSection({
  icon,
  title,
  children
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="border-b border-border-subtle bg-surface-subtle px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          {icon}
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:p-5">
        {children}
      </div>
    </section>
  );
}

type BaseFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  flagged?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
};

function borderClass(error?: string, flagged?: boolean) {
  return error || flagged ? "border-danger" : "border-border";
}

function FieldShell({
  label,
  required,
  error,
  flagged,
  className = "",
  children
}: {
  label: string;
  required?: boolean;
  error?: string;
  flagged?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
      {error ? (
        <span className="block text-xs text-danger">{error}</span>
      ) : flagged ? (
        <span className="block text-xs text-danger">
          Does not match the record
        </span>
      ) : null}
    </label>
  );
}

function TextField({
  mono = false,
  ...props
}: BaseFieldProps & { mono?: boolean }) {
  return (
    <FieldShell {...props}>
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        aria-invalid={Boolean(props.error || props.flagged)}
        className={`${INPUT_CLASS} ${borderClass(props.error, props.flagged)} ${mono ? MONO_CLASS : ""}`}
      />
    </FieldShell>
  );
}

function NumberField({ step, ...props }: BaseFieldProps & { step: string }) {
  return (
    <FieldShell {...props}>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        aria-invalid={Boolean(props.error || props.flagged)}
        className={`${INPUT_CLASS} ${borderClass(props.error, props.flagged)}`}
      />
    </FieldShell>
  );
}

function DateTimeField(props: BaseFieldProps) {
  return (
    <FieldShell {...props}>
      <input
        type="datetime-local"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        aria-invalid={Boolean(props.error || props.flagged)}
        className={`${INPUT_CLASS} ${borderClass(props.error, props.flagged)}`}
      />
    </FieldShell>
  );
}

function SelectField({
  choices,
  ...props
}: BaseFieldProps & { choices: string[] }) {
  const values = useMemo(() => {
    const current = props.value.trim();
    return current && !choices.includes(current)
      ? [current, ...choices]
      : choices;
  }, [choices, props.value]);

  return (
    <FieldShell {...props}>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        aria-invalid={Boolean(props.error || props.flagged)}
        className={`${INPUT_CLASS} ${borderClass(props.error, props.flagged)}`}
      >
        <option value="">{props.placeholder ?? "Select"}</option>
        {values.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function SuggestField({
  suggestions,
  ...props
}: BaseFieldProps & { suggestions: string[] }) {
  const listId = `suggest-${props.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <FieldShell {...props}>
      <input
        list={suggestions.length > 0 ? listId : undefined}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        autoComplete="off"
        aria-invalid={Boolean(props.error || props.flagged)}
        className={`${INPUT_CLASS} ${borderClass(props.error, props.flagged)}`}
      />
      {suggestions.length > 0 ? (
        <datalist id={listId}>
          {suggestions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      ) : null}
    </FieldShell>
  );
}

function ResultPanel({ state }: { state: CompareState }) {
  if (state.kind === "idle") {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface-subtle px-4 py-5 text-sm text-text-muted">
        Fill in the property and transaction details, then click Compare. The
        result appears here.
      </div>
    );
  }

  if (state.kind === "submitting") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-5 text-sm text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Comparing with registry and blockchain records…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-4 text-sm text-danger"
      >
        {state.message}
      </div>
    );
  }

  const { data } = state;
  if (data.matched) {
    return (
      <div className="rounded-2xl border border-success/40 bg-success/10 px-4 py-4 md:px-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" />
          <div>
            <p className="text-sm font-bold tracking-wide text-success uppercase">
              Verification successful
            </p>
            <p className="mt-1 text-sm text-text-secondary">{data.detail}</p>
            <p className="mt-2 text-xs text-text-muted">
              {data.checked_fields} details checked · blockchain hash chain
              intact
            </p>
          </div>
        </div>
      </div>
    );
  }

  const grouped = data.mismatches.reduce<
    Record<MismatchSection, FieldMismatch[]>
  >(
    (acc, item) => {
      acc[item.section].push(item);
      return acc;
    },
    { property: [], transaction: [], blockchain: [] }
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-danger/40 bg-surface">
      <div className="flex items-start gap-3 bg-danger/10 px-4 py-4 md:px-5">
        <ShieldX className="mt-0.5 h-6 w-6 shrink-0 text-danger" />
        <div>
          <p className="text-sm font-bold tracking-wide text-danger uppercase">
            {data.status === "NOT_FOUND"
              ? "Record not found"
              : "Verification failed"}
          </p>
          <p className="mt-1 text-sm text-text-secondary">{data.detail}</p>
        </div>
      </div>

      {data.mismatches.length > 0 ? (
        <div className="space-y-4 p-4">
          {(Object.keys(grouped) as MismatchSection[])
            .filter((section) => grouped[section].length > 0)
            .map((section) => (
              <div key={section} className="space-y-2">
                <p className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                  {SECTION_LABELS[section]}
                </p>
                {grouped[section].map((item) => (
                  <MismatchRow
                    key={`${item.section}-${item.field}`}
                    item={item}
                  />
                ))}
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function MismatchValue({
  label,
  value
}: {
  label: string;
  value: string | null;
}) {
  const hash = isHashLike(value);
  return (
    <div className="min-w-0 rounded-lg bg-surface-canvas px-3 py-2">
      <p className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">
        {label}
      </p>
      <p
        title={value ?? undefined}
        className={`mt-0.5 break-all text-sm text-text-primary ${hash ? MONO_CLASS : ""}`}
      >
        {value ? (hash ? shortenHash(value) : value) : "—"}
      </p>
    </div>
  );
}

function MismatchRow({ item }: { item: FieldMismatch }) {
  const computed = item.section === "blockchain";
  return (
    <div className="rounded-xl border border-border-subtle p-3">
      <p className="text-sm font-semibold text-text-primary">{item.label}</p>
      {item.note ? (
        <p className="mt-0.5 text-xs text-text-secondary">{item.note}</p>
      ) : null}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <MismatchValue
          label={computed ? "Expected" : "You entered"}
          value={item.submitted}
        />
        <MismatchValue
          label={`Recorded (${item.source})`}
          value={item.recorded}
        />
      </div>
    </div>
  );
}
