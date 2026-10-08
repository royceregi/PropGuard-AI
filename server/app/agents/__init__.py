"""Rule-based agents that exchange structured JSON (see Documents/05-ai-agents.md).

Agents:
- blockchain_retrieval_agent: Retrieves blockchain ledger data and verification
- transaction_analysis_agent: Analyzes registry consistency and hash integrity
- risk_detection_agent: Scores transactions using blockchain rule set
- report_agent: Generates investigation reports (supports LLM enhancement)

AI Model Support:
The system supports independent model selection for each agent. Retrieval and transaction
analysis are deterministic today; their settings are reserved for optional LLM-assisted
capabilities without allowing a model to change evidence or the authoritative score.
- Provider: gemini, openai, ollama, openrouter
- Models: gemini-2.0-flash, gpt-4o-mini, nvidia/nemotron-3-ultra-550b-a55b:free, etc.
- Configuration: Set AI_PROVIDER, AI_MODEL, and any AI_*_MODEL overrides in .env
"""
