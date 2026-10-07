"""Unit tests for the Phase 5 retrieval service (07-information-retrieval.md)."""

from __future__ import annotations

from app.services.retrieval_service import merge_hits, parse_query

# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------


def test_parse_transaction_id():
    p = parse_query("1-102-2021-10436")
    assert p.transaction_ids == ["1-102-2021-10436"]
    assert p.intents == []


def test_parse_title_deed():
    p = parse_query("TD-DXB-0000623")
    assert p.title_deeds == ["TD-DXB-0000623"]
    assert p.intents == []


def test_parse_property_id():
    p = parse_query("Show property 10003635071741442048")
    assert "10003635071741442048" in p.property_ids


def test_parse_year_range():
    p = parse_query("high value transactions in 2021")
    assert p.date_from is not None
    assert p.date_from.year == 2021
    assert p.date_to.year == 2021
    assert "high_value" in p.intents


def test_parse_year_range_span():
    p = parse_query("transactions between 2020 and 2022")
    assert p.date_from.year == 2020
    assert p.date_to.year == 2022


def test_parse_all_intents():
    for phrase, expected in [
        ("previous owners of property", "previous_owners"),
        ("find high-value transactions", "high_value"),
        ("document hash mismatch", "hash_mismatch"),
        ("rapid ownership changes", "rapid_ownership_change"),
        ("high risk flagged", "high_risk"),
    ]:
        p = parse_query(phrase)
        assert expected in p.intents, f"{expected!r} not found for {phrase!r}"


def test_parse_source_hints():
    p = parse_query("find the documents for this property")
    assert "document" in p.source_hints
    assert "property" in p.source_hints


def test_parse_removes_filler_from_terms():
    p = parse_query("show me all documents for villa")
    assert p.terms == "villa"


def test_parse_preserves_meaningful_terms():
    p = parse_query("villa mortgaged Wadi Al Safa")
    for word in ("villa", "mortgaged", "Wadi", "Safa"):
        assert word.lower() in p.terms.lower(), f"{word!r} missing from {p.terms!r}"


def test_parse_removes_identifier_from_terms():
    p = parse_query("rapid ownership change 1-102-2021-10436")
    assert "10436" not in p.terms
    assert "rapid_ownership_change" in p.intents


def test_parse_empty():
    p = parse_query("")
    assert p.transaction_ids == []
    assert p.intents == []
    assert p.terms == ""


def test_parse_to_dict_keys():
    p = parse_query("find high-value transactions 2022")
    d = p.to_dict()
    assert "intents" in d
    assert "date_from" in d
    # text field is excluded from dict
    assert "text" not in d


# ---------------------------------------------------------------------------
# merge_hits
# ---------------------------------------------------------------------------


def _hit(evidence_id: str, relevance: float, rank: int = 0) -> dict:
    return {
        "evidence_id": evidence_id,
        "source": "transaction",
        "record_id": "x",
        "rank": rank,
        "relevance_score": relevance,
        "match": "identifier",
        "intent": None,
        "title": "t",
        "subtitle": None,
        "snippet": None,
        "property_id": None,
        "transaction_id": None,
        "document_id": None,
        "occurred_at": None,
        "value": None,
    }


def test_merge_deduplicates_keeps_highest():
    a = _hit("properties:1", 0.70)
    b = _hit("properties:1", 0.90)
    merged = merge_hits([[a], [b]], limit=10)
    assert len(merged) == 1
    assert merged[0]["relevance_score"] == 0.90


def test_merge_assigns_ranks():
    hits = [_hit(f"properties:{i}", relevance=0.5 + i * 0.1) for i in range(5)]
    merged = merge_hits([hits], limit=10)
    for pos, h in enumerate(merged, 1):
        assert h["rank"] == pos


def test_merge_respects_limit():
    hits = [_hit(f"properties:{i}", relevance=0.5) for i in range(20)]
    merged = merge_hits([hits], limit=5)
    assert len(merged) == 5


def test_merge_sorts_by_relevance_descending():
    hits = [_hit(f"properties:{i}", relevance=1.0 / (i + 1)) for i in range(5)]
    merged = merge_hits([hits], limit=5)
    scores = [h["relevance_score"] for h in merged]
    assert scores == sorted(scores, reverse=True)
