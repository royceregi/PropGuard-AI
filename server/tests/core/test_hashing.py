import hashlib

from app.core.hashing import (
    compute_document_hash,
    compute_transaction_data_hash,
    compute_tx_hash,
)

TX = dict(
    transaction_id="TX1",
    property_id="P1",
    transaction_type="sale",
    transaction_datetime="2024-01-02T03:04:05",
    transaction_value="1500000",
    currency="lkr",
    from_wallet="0xSELLER",
    to_wallet="0xBUYER",
    property_hash="ab" * 32,
)


def test_document_hash_is_sha256_of_text():
    assert compute_document_hash("deed text") == hashlib.sha256(b"deed text").hexdigest()
    assert compute_document_hash("deed text") != compute_document_hash("deed text ")


def test_tx_hash_formula():
    data_hash = "cd" * 32
    expected = hashlib.sha256(("0" + data_hash + "2024-01-02 03:04:05").encode()).hexdigest()
    assert (
        compute_tx_hash(
            previous_hash="0",
            transaction_data_hash=data_hash.upper(),
            block_timestamp="2024-01-02 03:04:05",
        )
        == expected
    )


def test_transaction_data_hash_normalizes_case():
    variant = dict(
        TX,
        transaction_type="SALE",
        currency="LKR",
        from_wallet="0xseller",
        to_wallet="0xbuyer",
    )
    assert compute_transaction_data_hash(**TX) == compute_transaction_data_hash(**variant)


def test_transaction_data_hash_detects_each_field():
    base = compute_transaction_data_hash(**TX)
    for field, value in {
        "from_wallet": "0xattacker",
        "to_wallet": "0xattacker",
        "transaction_value": "1500001",
        "property_hash": "ef" * 32,
        "transaction_type": "gift",
    }.items():
        assert compute_transaction_data_hash(**dict(TX, **{field: value})) != base, field
