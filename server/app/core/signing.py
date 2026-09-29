"""Ed25519 signing of ledger blocks by the (simulated) land-registry key.

The registry signs each block's tx_hash. tx_hash already covers the transaction payload,
the anchored property hash, the chain link, and the block timestamp, so anyone who edits a
row and recomputes every SHA-256 still cannot produce a valid signature without the key.
"""

from __future__ import annotations

from functools import lru_cache

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

from app.core.config import settings


def _raw_hex(value: str) -> bytes | None:
    cleaned = (value or "").strip().lower().removeprefix("0x")
    if not cleaned:
        return None
    raw = bytes.fromhex(cleaned)
    if len(raw) != 32:
        raise ValueError("Ed25519 keys must be 32 bytes (64 hex characters)")
    return raw


@lru_cache(maxsize=1)
def _private_key() -> Ed25519PrivateKey | None:
    raw = _raw_hex(settings.REGISTRY_SIGNING_KEY)
    return Ed25519PrivateKey.from_private_bytes(raw) if raw else None


@lru_cache(maxsize=1)
def _public_key() -> Ed25519PublicKey | None:
    raw = _raw_hex(settings.REGISTRY_PUBLIC_KEY)
    if raw:
        return Ed25519PublicKey.from_public_bytes(raw)
    private = _private_key()
    return private.public_key() if private else None


def signing_enabled() -> bool:
    return _private_key() is not None


def verification_enabled() -> bool:
    return _public_key() is not None


def public_key_hex() -> str | None:
    key = _public_key()
    if key is None:
        return None
    return key.public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw
    ).hex()


def sign(tx_hash: str) -> str:
    """Hex Ed25519 signature (128 chars) over the UTF-8 tx_hash."""
    key = _private_key()
    if key is None:
        raise RuntimeError("REGISTRY_SIGNING_KEY is not configured")
    return key.sign(tx_hash.encode("utf-8")).hex()


def verify(signature: str | None, tx_hash: str | None) -> bool | None:
    """True/False when a public key is configured; None when signatures can't be checked."""
    key = _public_key()
    if key is None:
        return None
    if not signature or not tx_hash:
        return False
    try:
        key.verify(bytes.fromhex(signature.strip()), tx_hash.encode("utf-8"))
        return True
    except (InvalidSignature, ValueError):
        return False


def contract_address_valid(address: str | None) -> bool:
    expected = (settings.REGISTRY_CONTRACT_ADDRESS or "").strip().lower()
    return bool(expected) and (address or "").strip().lower() == expected


def consensus_confirmed(transaction_status: str | None, consensus: str | None) -> bool:
    status_ok = (transaction_status or "").strip().upper() == "CONFIRMED"
    consensus_ok = (consensus or "").strip().upper().startswith("CONFIRMED")
    return status_ok and consensus_ok


def generate_keypair_hex() -> tuple[str, str]:
    """(private_hex, public_hex) for a fresh Ed25519 key pair."""
    private = Ed25519PrivateKey.generate()
    private_hex = private.private_bytes(
        serialization.Encoding.Raw,
        serialization.PrivateFormat.Raw,
        serialization.NoEncryption(),
    ).hex()
    public_hex = private.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw
    ).hex()
    return private_hex, public_hex
