"""Print a fresh Ed25519 registry key pair as .env lines.

Usage (from server/):  PYTHONPATH=. .venv/bin/python scripts/generate_registry_key.py >> .env
Then rebuild ledger hashes (Settings → Rebuild) so every block is re-signed with the new key.
"""

from app.core.signing import generate_keypair_hex


def main() -> None:
    private_hex, public_hex = generate_keypair_hex()
    print("# Ed25519 registry signing key (keep private; never commit)")
    print(f"REGISTRY_SIGNING_KEY={private_hex}")
    print(f"REGISTRY_PUBLIC_KEY={public_hex}")


if __name__ == "__main__":
    main()
