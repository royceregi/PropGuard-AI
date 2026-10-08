export interface AgentRunAuditItem {
  agent_run_id: number;
  query_id: string;
  agent_name: string;
  status: string;
  confidence_score: number;
  input_data?: Record<string, unknown> | null;
  output_data?: Record<string, unknown> | null;
  error_message?: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export const AGENT_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All Intelligent Agents" },
  { value: "retrieval_agent", label: "Retrieval Agent (retrieval_agent)" },
  { value: "transaction_analysis_agent", label: "Transaction Analysis Agent" },
  { value: "risk_agent", label: "Risk Detection Agent (risk_agent)" },
  { value: "report_agent", label: "Report Synthesis Agent (report_agent)" },
  { value: "blockchain_retrieval_agent", label: "Blockchain Retrieval Agent" },
  { value: "risk_detection_agent", label: "Risk Detection Agent (legacy)" }
];

export const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All Statuses" },
  { value: "SUCCESS", label: "Success / Completed" },
  { value: "FAILED", label: "Failed / Error" },
  { value: "RUNNING", label: "Running / Pending" }
];

export function getAgentDisplayName(agentName: string): string {
  const norm = agentName.toLowerCase();
  if (norm.includes("retrieval")) return "Blockchain Retrieval Agent";
  if (norm.includes("analysis")) return "Transaction Analysis Agent";
  if (norm.includes("risk")) return "Risk & Fraud Detection Agent";
  if (norm.includes("report")) return "Report Synthesis Agent";
  if (norm.includes("orchestrator")) return "Pipeline Orchestrator";
  return agentName;
}
