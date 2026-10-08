export interface AgentRunResult {
  agent_name: string;
  status: string;
  confidence_score: number;
  findings?: Record<string, unknown>;
  evidence_ids?: string[];
  warnings?: string[];
}

export interface InvestigationFinding {
  code: string;
  severity: string;
  description: string;
  weight: number;
  evidence_ids: string[];
}

export interface VerificationSummary {
  ledger_record_exists: boolean;
  ledger_integrity: string;
  document_hash_status: string;
  registry_checks_overall: string;
}

export interface InvestigationReportData {
  report_id: string;
  transaction_id: string;
  property_id: string | null;
  executive_summary: string;
  recommendation: string;
  risk_summary: {
    risk_level: string;
    risk_score: number;
    indicator_count: number;
  };
  verification_summary: VerificationSummary;
  findings: InvestigationFinding[];
  supporting_data: {
    transaction_id: string;
    property_id: string | null;
    chain_position?: number;
    is_chain_head?: boolean;
    documents?: Array<{
      document_id: number;
      document_type: string;
      file_name: string;
    }>;
    evidence_ids: string[];
  };
  responsible_ai_notice?: string;
}

export interface RiskIndicatorEvidence {
  table: string | null;
  id: string | null;
  field?: string | null;
  expected?: unknown;
  actual?: unknown;
}

export interface RiskIndicator {
  indicator_code: string;
  severity: string;
  description: string;
  indicator_value?: number;
  evidence?: RiskIndicatorEvidence[];
}

export interface RiskAssessmentData {
  risk_score: number | null;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | null;
  indicators: RiskIndicator[];
}

export interface InvestigationPipelineResponse {
  query_id: string;
  transaction_id: string;
  assessment: RiskAssessmentData | null;
  report: InvestigationReportData | null;
  agents: AgentRunResult[];
  notice: string;
}

export interface AgentMeta {
  key: string;
  name: string;
  label: string;
  description: string;
  stepNumber: number;
}

export const PIPELINE_AGENTS: AgentMeta[] = [
  {
    key: "retrieval_agent",
    name: "retrieval_agent",
    label: "Blockchain Retrieval Agent",
    description:
      "Retrieves immutable ledger blocks, ownership deeds, and document cryptographic hashes as evidentiary ground truth.",
    stepNumber: 1
  },
  {
    key: "transaction_analysis_agent",
    name: "transaction_analysis_agent",
    label: "Transaction Analysis Agent",
    description:
      "Cross-examines parties, current owner continuity, required registry fields, and cryptographic chain links.",
    stepNumber: 2
  },
  {
    key: "risk_agent",
    name: "risk_agent",
    label: "Risk & Fraud Detection Agent",
    description:
      "Evaluates transparent risk rules, calculates severity weights, and scores anomalous transaction patterns.",
    stepNumber: 3
  },
  {
    key: "report_agent",
    name: "report_agent",
    label: "Report Synthesis Agent",
    description:
      "Synthesizes explainable executive findings, actionable registry recommendations, and Responsible AI guardrails.",
    stepNumber: 4
  }
];
