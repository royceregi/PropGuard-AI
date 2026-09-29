export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type IndicatorEvidence = {
  table: string | null;
  id: string | null;
  field?: string | null;
  expected?: unknown;
  actual?: unknown;
};

export type BlockchainRiskIndicator = {
  indicator_code: string;
  indicator_name: string | null;
  indicator_value: number | null;
  severity: RiskLevel | null;
  description: string | null;
  evidence: IndicatorEvidence[];
};

export type BlockchainRiskAssessment = {
  assessment_id: number | null;
  stored: boolean;
  transaction_id: string;
  property_id: string | null;
  integrity: string | null;
  /** 0–1; LOW < 0.40 ≤ MEDIUM < 0.70 ≤ HIGH */
  risk_score: number | null;
  risk_level: RiskLevel | null;
  model_name: string | null;
  model_version: string | null;
  explanation: string | null;
  review_status: string | null;
  created_at: string | null;
  indicators: BlockchainRiskIndicator[];
};

export type AgentOutput = {
  agent_name: string;
  status: string;
  confidence_score: number;
  findings: Record<string, unknown>;
  evidence_ids: string[];
  warnings: string[];
};

export type BlockchainInvestigationResponse = {
  assessment: BlockchainRiskAssessment | null;
  agents: AgentOutput[];
  notice: string;
};

export const AGENT_LABELS: Record<string, string> = {
  blockchain_retrieval_agent: "Blockchain Retrieval Agent",
  risk_detection_agent: "Risk Detection Agent"
};
