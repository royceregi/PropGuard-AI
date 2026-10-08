from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    APP_NAME: str = "Blockchain Property Verification API"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    AUTH_COOKIE_NAME: str = "propguard_access_token"

    # Simulated registry smart contract + Ed25519 ledger signing key (hex, 32 raw bytes each).
    # Without REGISTRY_SIGNING_KEY / REGISTRY_PUBLIC_KEY, signatures are not written or checked.
    REGISTRY_CONTRACT_ADDRESS: str = "0x70726f7067756172642d72656769737472790001"
    REGISTRY_SIGNING_KEY: str = ""
    REGISTRY_PUBLIC_KEY: str = ""

    # AI / LLM. AI_MODEL remains the shared fallback for omitted agent-specific settings.
    AI_ENABLED: bool = False
    AI_PROVIDER: str = "gemini"  # gemini | openai | ollama | openrouter
    AI_API_KEY: str = ""
    AI_MODEL: str = "gemini-2.0-flash"
    AI_RETRIEVAL_MODEL: str = ""
    AI_TRANSACTION_ANALYSIS_MODEL: str = ""
    AI_RISK_MODEL: str = ""
    AI_REPORT_MODEL: str = ""
    AI_BASE_URL: str = ""  # optional; e.g. OpenAI-compatible or Ollama URL
    AI_TEMPERATURE: float = 0.2
    AI_MAX_TOKENS: int = 2048
    AI_TIMEOUT_SECONDS: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
