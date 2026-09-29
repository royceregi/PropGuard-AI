import pytest

from app.core import signing
from app.core.config import settings


@pytest.fixture
def registry_key(monkeypatch):
    private_hex, public_hex = signing.generate_keypair_hex()
    monkeypatch.setattr(settings, "REGISTRY_SIGNING_KEY", private_hex)
    monkeypatch.setattr(settings, "REGISTRY_PUBLIC_KEY", public_hex)
    signing._private_key.cache_clear()
    signing._public_key.cache_clear()
    yield public_hex
    signing._private_key.cache_clear()
    signing._public_key.cache_clear()


def test_sign_and_verify(registry_key):
    tx_hash = "ab" * 32
    signature = signing.sign(tx_hash)
    assert len(signature) == 128
    assert signing.verify(signature, tx_hash) is True
    assert signing.public_key_hex() == registry_key


def test_tampered_signature_or_hash_fails(registry_key):
    tx_hash = "ab" * 32
    signature = signing.sign(tx_hash)
    forged = ("cd" if signature[:2] == "ab" else "ab") + signature[2:]
    assert signing.verify(forged, tx_hash) is False
    assert signing.verify(signature, "cd" * 32) is False
    assert signing.verify("not-hex", tx_hash) is False
    assert signing.verify(None, tx_hash) is False


def test_verify_is_none_without_key(monkeypatch):
    monkeypatch.setattr(settings, "REGISTRY_SIGNING_KEY", "")
    monkeypatch.setattr(settings, "REGISTRY_PUBLIC_KEY", "")
    signing._private_key.cache_clear()
    signing._public_key.cache_clear()
    try:
        assert signing.verify("ab" * 64, "ab" * 32) is None
        assert signing.signing_enabled() is False
    finally:
        signing._private_key.cache_clear()
        signing._public_key.cache_clear()


def test_contract_and_consensus_rules(monkeypatch):
    monkeypatch.setattr(settings, "REGISTRY_CONTRACT_ADDRESS", "0xABC")
    assert signing.contract_address_valid("0xabc")
    assert not signing.contract_address_valid("0xdef")
    assert signing.consensus_confirmed("Confirmed", "Confirmed by Validators")
    assert not signing.consensus_confirmed("Pending", "Not Yet Verified")
