export type VerificationForm = {
  propertyId: string;
  titleDeedNumber: string;
  address: string;
  district: string;
  city: string;
  landArea: string;
  areaUnit: string;
  landType: string;
  surveyPlanNumber: string;
  currentUsageType: string;
  currentSubtype: string;
  transactionId: string;
  transactionType: string;
  transactionDatetime: string;
  transactionValue: string;
  currency: string;
  fromWallet: string;
  toWallet: string;
};

export type VerificationFieldKey = keyof VerificationForm;

export const EMPTY_VERIFICATION_FORM: VerificationForm = {
  propertyId: "",
  titleDeedNumber: "",
  address: "",
  district: "",
  city: "",
  landArea: "",
  areaUnit: "",
  landType: "",
  surveyPlanNumber: "",
  currentUsageType: "",
  currentSubtype: "",
  transactionId: "",
  transactionType: "",
  transactionDatetime: "",
  transactionValue: "",
  currency: "",
  fromWallet: "",
  toWallet: ""
};

export type VerificationFormOptions = {
  area_units: string[];
  transaction_types: string[];
  currencies: string[];
  districts: string[];
  cities: string[];
  land_types: string[];
  usage_types: string[];
  usage_subtypes: string[];
};

export const DEFAULT_FORM_OPTIONS: VerificationFormOptions = {
  area_units: ["PERCH", "SQM", "SQFT", "ACRE", "HECTARE"],
  transaction_types: ["SALE", "TRANSFER", "LEASE", "MORTGAGE", "GIFT"],
  currencies: ["LKR", "USD", "AED"],
  districts: [],
  cities: [],
  land_types: [],
  usage_types: [],
  usage_subtypes: []
};

export type MismatchSection = "property" | "transaction" | "blockchain";

export type FieldMismatch = {
  section: MismatchSection;
  field: string;
  label: string;
  submitted: string | null;
  recorded: string | null;
  source: string;
  note?: string | null;
};

export type VerifyResponse = {
  status: "MATCH" | "MISMATCH" | "NOT_FOUND";
  matched: boolean;
  property_id: string;
  transaction_id: string;
  checked_fields: number;
  mismatches: FieldMismatch[];
  detail: string;
};

export const SECTION_LABELS: Record<MismatchSection, string> = {
  property: "Property details",
  transaction: "Transaction details",
  blockchain: "Blockchain record"
};

/** Maps backend field names to form keys so mismatched inputs can be highlighted. */
export const API_FIELD_TO_FORM_KEY: Record<string, VerificationFieldKey> = {
  property_id: "propertyId",
  title_deed_number: "titleDeedNumber",
  address: "address",
  district: "district",
  city: "city",
  land_area: "landArea",
  area_unit: "areaUnit",
  land_type: "landType",
  survey_plan_number: "surveyPlanNumber",
  current_usage_type: "currentUsageType",
  current_subtype: "currentSubtype",
  transaction_id: "transactionId",
  transaction_type: "transactionType",
  transaction_datetime: "transactionDatetime",
  transaction_value: "transactionValue",
  currency: "currency",
  from_wallet: "fromWallet",
  to_wallet: "toWallet"
};

const REQUIRED_FIELDS: [VerificationFieldKey, string][] = [
  ["propertyId", "Property ID"],
  ["titleDeedNumber", "Title deed number"],
  ["address", "Address"],
  ["district", "District"],
  ["city", "City"],
  ["landArea", "Land area"],
  ["areaUnit", "Area unit"],
  ["landType", "Land type"],
  ["transactionId", "Transaction ID"],
  ["transactionType", "Transaction type"],
  ["transactionDatetime", "Transaction date & time"],
  ["transactionValue", "Transaction value"],
  ["currency", "Currency"],
  ["fromWallet", "Seller wallet"],
  ["toWallet", "Buyer wallet"]
];

export type VerificationFormErrors = Partial<
  Record<VerificationFieldKey, string>
>;

export function validateVerificationForm(
  form: VerificationForm
): VerificationFormErrors {
  const errors: VerificationFormErrors = {};
  for (const [key, label] of REQUIRED_FIELDS) {
    if (!form[key].trim()) {
      errors[key] = `${label} is required`;
    }
  }
  for (const [key, label] of [
    ["landArea", "Land area"],
    ["transactionValue", "Transaction value"]
  ] as const) {
    const raw = form[key].trim();
    if (raw && (!Number.isFinite(Number(raw)) || Number(raw) <= 0)) {
      errors[key] = `${label} must be a positive number`;
    }
  }
  const wallets = [form.fromWallet.trim(), form.toWallet.trim()];
  if (wallets[0] && wallets[0].toLowerCase() === wallets[1].toLowerCase()) {
    errors.toWallet = "Buyer wallet must differ from seller wallet";
  }
  return errors;
}

export function buildVerifyPayload(form: VerificationForm) {
  const optional = (value: string) => value.trim() || null;
  return {
    property_id: form.propertyId.trim(),
    title_deed_number: form.titleDeedNumber.trim(),
    address: form.address.trim(),
    district: form.district.trim(),
    city: form.city.trim(),
    land_area: form.landArea.trim(),
    area_unit: form.areaUnit.trim(),
    land_type: form.landType.trim(),
    survey_plan_number: optional(form.surveyPlanNumber),
    current_usage_type: optional(form.currentUsageType),
    current_subtype: optional(form.currentSubtype),
    transaction_id: form.transactionId.trim(),
    transaction_type: form.transactionType.trim(),
    transaction_datetime: form.transactionDatetime.trim(),
    transaction_value: form.transactionValue.trim(),
    currency: form.currency.trim(),
    from_wallet: form.fromWallet.trim(),
    to_wallet: form.toWallet.trim()
  };
}

export type CheckStatus = "PASS" | "WARN" | "FAIL" | "NA";

export type RegistryCheck = {
  code: string;
  name: string;
  category: "ledger" | "parties" | "ownership" | "registration";
  status: CheckStatus;
  expected: string | null;
  actual: string | null;
  reason: string;
  evidence: { table: string; id: string | null }[];
};

export type RegistryChecksResponse = {
  transaction_id: string;
  property_id: string | null;
  overall: Exclude<CheckStatus, "NA">;
  counts: Record<CheckStatus, number>;
  checks: RegistryCheck[];
};

export type HashVerifyResponse = {
  tx_hash_match: boolean;
  transaction_data_hash_match: boolean;
  previous_hash_match: boolean;
  property_hash_match: boolean;
  property_snapshot_match: boolean;
  property_current_match: boolean;
  document_hash_match: boolean;
  /** null when the server has no registry public key configured */
  digital_signature_valid: boolean | null;
  smart_contract_valid: boolean;
  /** informational only; does not affect integrity */
  consensus_verified: boolean;
  duplicate_tx_hash: boolean;
  integrity: "VALID" | "INVALID";
  details: {
    tx_hash: string | null;
    transaction_status: string | null;
    consensus_verification: string | null;
    previous_hash: string | null;
    chain_position: string | null;
    is_chain_head: boolean | null;
    property_changes: {
      field: string;
      anchored: string | null;
      current: string | null;
    }[];
    documents: {
      document_id: number;
      document_type: string | null;
      match: boolean | null;
    }[];
  };
};

export type HashDetailRow = {
  blockchain_tx_id: number;
  transaction_id: string | null;
  property_id: string | null;
  tx_hash: string | null;
  previous_hash: string | null;
  block_number: number | null;
  block_timestamp: string | null;
  transaction_status: string | null;
  chain_position: string | null;
  integrity: "VALID" | "INVALID" | null;
  tx_hash_match: boolean | null;
  transaction_data_hash_match: boolean | null;
  previous_hash_match: boolean | null;
  property_hash_match: boolean | null;
  document_hash_match: boolean | null;
  digital_signature_valid: boolean | null;
  smart_contract_valid: boolean | null;
  duplicate_tx_hash: boolean | null;
};

export type PaginatedHashDetails = {
  items: HashDetailRow[];
  total: number;
  skip: number;
  limit: number;
};

/** Labels of the integrity checks that failed for one ledger row. */
export function failedHashChecks(row: HashDetailRow): string[] {
  const failed: string[] = [];
  if (row.tx_hash_match === false) failed.push("Block hash");
  if (row.transaction_data_hash_match === false)
    failed.push("Transaction data");
  if (row.previous_hash_match === false) failed.push("Chain link");
  if (row.property_hash_match === false) failed.push("Property anchor");
  if (row.document_hash_match === false) failed.push("Documents");
  if (row.digital_signature_valid === false) failed.push("Signature");
  if (row.smart_contract_valid === false) failed.push("Contract");
  if (row.duplicate_tx_hash) failed.push("Duplicate hash");
  return failed;
}

export const CHECK_CATEGORY_LABELS: Record<RegistryCheck["category"], string> =
  {
    ledger: "Ledger consistency",
    parties: "Parties & wallets",
    ownership: "Ownership",
    registration: "Registration & encumbrance"
  };

export function isHashLike(value: string | null | undefined): boolean {
  return Boolean(value && /^(0x)?[0-9a-f]{32,}$/i.test(value.trim()));
}

export function shortenHash(value: string, head = 10, tail = 8): string {
  const trimmed = value.trim();
  if (trimmed.length <= head + tail + 1) {
    return trimmed;
  }
  return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`;
}
