# PropGuard AI — Backend Makefile
.PHONY: env lint format format-check fix typecheck test check dev run clean help

VENV = .venv
PYTHON = $(VENV)/bin/python
RUFF = $(VENV)/bin/ruff
PYRIGHT = $(VENV)/bin/pyright
PYTEST = $(VENV)/bin/pytest
UVICORN = $(VENV)/bin/uvicorn

ENV_VARS = DATABASE_URL="postgresql://user:pass@localhost:5432/testdb" SECRET_KEY="testsecretkey"

help:
	@echo "PropGuard AI Backend Commands:"
	@echo "  make env           - Create .env from .env.example with a new SECRET_KEY (ARGS=--registry-key / --force)"
	@echo "  make lint          - Run Ruff linter"
	@echo "  make format        - Format code with Ruff"
	@echo "  make format-check  - Check code formatting"
	@echo "  make fix           - Auto-fix linting & formatting issues"
	@echo "  make typecheck     - Run Pyright type checking"
	@echo "  make test          - Run Pytest test suite"
	@echo "  make check         - Run full check suite (lint, format-check, typecheck, test)"
	@echo "  make dev           - Start local development server with auto-reload"

env:
	$(PYTHON) scripts/create_env.py $(ARGS)

lint:
	$(RUFF) check .

format:
	$(RUFF) format .

format-check:
	$(RUFF) format --check .

fix:
	$(RUFF) check . --fix
	$(RUFF) format .

typecheck:
	$(PYRIGHT)

test:
	$(ENV_VARS) $(PYTEST) tests/

check: lint format-check typecheck test

dev:
	$(UVICORN) app.main:app --reload --host 0.0.0.0 --port 8000

run: dev

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache .ruff_cache

