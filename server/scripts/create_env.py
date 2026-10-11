"""Create server/.env from .env.example with a freshly generated SECRET_KEY.

Usage (from server/):
  make env                          # or: .venv/bin/python scripts/create_env.py
  make env ARGS=--registry-key      # also generate the Ed25519 ledger signing key pair
  make env ARGS=--force             # overwrite an existing .env

Only the standard library is needed for SECRET_KEY; --registry-key needs the project venv.
"""

import argparse
import re
import secrets
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
EXAMPLE = SERVER_DIR / ".env.example"
TARGET = SERVER_DIR / ".env"


def set_value(content: str, key: str, value: str) -> str:
    return re.sub(rf"^{key}=.*$", f"{key}={value}", content, count=1, flags=re.MULTILINE)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--force", action="store_true", help="overwrite an existing .env")
    parser.add_argument(
        "--registry-key",
        action="store_true",
        help="generate REGISTRY_SIGNING_KEY / REGISTRY_PUBLIC_KEY",
    )
    args = parser.parse_args()

    if TARGET.exists() and not args.force:
        sys.exit(f"{TARGET} already exists; nothing changed. Use --force to overwrite it.")

    content = EXAMPLE.read_text(encoding="utf-8")
    content = set_value(content, "SECRET_KEY", secrets.token_urlsafe(48))

    if args.registry_key:
        sys.path.insert(0, str(SERVER_DIR))
        from app.core.signing import generate_keypair_hex

        private_hex, public_hex = generate_keypair_hex()
        content = set_value(content, "REGISTRY_SIGNING_KEY", private_hex)
        content = set_value(content, "REGISTRY_PUBLIC_KEY", public_hex)

    TARGET.write_text(content, encoding="utf-8")
    TARGET.chmod(0o600)

    print(f"Created {TARGET} with a new SECRET_KEY.")
    if args.registry_key:
        print(
            "Generated a registry key pair; rebuild the ledger hashes (Settings page) to re-sign blocks."
        )
    print(
        "Next: edit .env and set DATABASE_URL (and AI_API_KEY if you enable AI), then run `make dev`."
    )


if __name__ == "__main__":
    main()
