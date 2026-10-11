"""Phase B: shared query guard, AI assistant routing, and the assistant ↔ Evidence Retrieval link."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from app.api.v1.endpoints import retrieval as retrieval_endpoint
from app.services import query_guard, retrieval_service, user_assistant_service
from app.services.query_guard import QueryGuard
from app.services.retrieval_service import parse_query
from fastapi import HTTPException

PUBLIC = SimpleNamespace(user_id="U1", access_level="PUBLIC")
ADMIN = SimpleNamespace(user_id="A1", access_level="SYSTEM")
TX = "1-102-2021-10436"


def _hit(source: str, record_id: str, relevance: float, **extra) -> dict:
    return retrieval_service.make_hit(
        source,
        record_id,
        relevance=relevance,
        match="exact",
        title=f"{source} {record_id}",
        **extra,
    )


def _search_result(hits: list[dict]) -> dict:
    return {"interpreted": {}, "sources": [], "hits": hits, "counts": {}, "warnings": []}


# ─── query guard ────────────────────────────────────────────────────────────


def test_guard_public_user_without_properties_gets_empty_scope_not_unrestricted(monkeypatch):
    monkeypatch.setattr(
        query_guard.property_repository, "accessible_property_ids_for_user", lambda db, uid: set()
    )
    guard = query_guard.guard_query(MagicMock(), PUBLIC, "villa in Dubai Marina")
    assert guard.property_scope == set()
    assert guard.unauthorized == []


def test_guard_authority_is_unrestricted():
    guard = query_guard.guard_query(MagicMock(), ADMIN, f"risk of {TX} TD-DXB-0000623")
    assert guard.property_scope is None
    assert guard.unauthorized == []


def test_guard_flags_identifiers_outside_public_scope(monkeypatch):
    monkeypatch.setattr(
        query_guard.property_repository,
        "accessible_property_ids_for_user",
        lambda db, uid: {"100000000000000001"},
    )
    monkeypatch.setattr(
        query_guard.property_repository,
        "user_can_access_transaction",
        lambda db, uid, tid: tid == TX,
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [("TD-DXB-0000001",)]

    guard = query_guard.guard_query(
        db,
        PUBLIC,
        f"{TX} 9-9-2020-99 100000000000000001 100000000000000002 TD-DXB-0000001 TD-DXB-0000999",
    )
    assert guard.property_scope == {"100000000000000001"}
    assert sorted(guard.unauthorized) == sorted(
        ["100000000000000002", "TD-DXB-0000999", "9-9-2020-99"]
    )
    assert "TD-DXB-0000999" in guard.restricted_message


# ─── assistant routing ──────────────────────────────────────────────────────


def _patch_guard(monkeypatch, question: str, scope: set[str] | None, unauthorized=()):
    monkeypatch.setattr(
        user_assistant_service.query_guard,
        "guard_query",
        lambda db, user, q: QueryGuard(
            parsed=parse_query(question), property_scope=scope, unauthorized=list(unauthorized)
        ),
    )


def test_wants_investigation_needs_transaction_id_and_risk_wording():
    q1 = f"Is transaction {TX} risky?"
    assert user_assistant_service.wants_investigation(q1, parse_query(q1))
    q2 = "show high risk transactions"
    assert not user_assistant_service.wants_investigation(q2, parse_query(q2))
    q3 = f"when was {TX} registered"
    assert not user_assistant_service.wants_investigation(q3, parse_query(q3))


def test_public_user_without_properties_searches_empty_scope(monkeypatch):
    question = "villa in Dubai Marina"
    _patch_guard(monkeypatch, question, scope=set())
    captured: dict = {}

    def fake_search(db, q, **kwargs):
        captured.update(kwargs)
        return _search_result([])

    monkeypatch.setattr(user_assistant_service.retrieval_service, "search", fake_search)
    res = user_assistant_service.process_user_query(MagicMock(), PUBLIC, question)

    assert captured["property_scope"] == set()
    assert res.mode == "retrieval"
    assert res.confidence_score == 0.0


def test_restricted_question_is_refused_without_search(monkeypatch):
    question = "details of 100000000000000002"
    _patch_guard(monkeypatch, question, scope={"1"}, unauthorized=["100000000000000002"])
    monkeypatch.setattr(
        user_assistant_service.retrieval_service,
        "search",
        MagicMock(side_effect=AssertionError("must not search")),
    )
    monkeypatch.setattr(user_assistant_service, "get_accessible_property_records", lambda *a: [])

    res = user_assistant_service.process_user_query(MagicMock(), PUBLIC, question)
    assert res.mode == "restricted"
    assert res.detail_url is None
    assert res.answer.startswith(user_assistant_service.RESTRICTED_PREFIX)


def test_retrieval_answer_links_to_evidence_page_with_real_confidence(monkeypatch):
    question = "documents with hash mismatch"
    _patch_guard(monkeypatch, question, scope={"P1"})
    monkeypatch.setattr(user_assistant_service, "get_accessible_property_records", lambda *a: [])
    hits = [
        _hit("transaction", TX, 0.9, transaction_id=TX),
        _hit("document", "7", 0.8, document_id=7),
    ]
    monkeypatch.setattr(
        user_assistant_service.retrieval_service,
        "search",
        lambda db, q, **kw: _search_result(hits),
    )
    monkeypatch.setattr(user_assistant_service, "_synthesize_answer", lambda *a: "answer")

    db = MagicMock()
    res = user_assistant_service.process_user_query(db, PUBLIC, question)

    assert res.mode == "retrieval"
    assert res.confidence_score == 0.9
    assert res.detail_url == f"/property-search?tab=retrieval&qid={res.query_id}"
    assert [s.identifier for s in res.sources] == [TX, "7"]

    from app.models.retrieval import QueryLog, QueryRetrieval

    added = [c.args[0] for c in db.add.call_args_list]
    (log,) = [a for a in added if isinstance(a, QueryLog)]
    assert log.flagged_suspicious is True
    stored = [
        (r.transaction_id, r.document_id, float(r.relevance_score))
        for r in added
        if isinstance(r, QueryRetrieval)
    ]
    assert stored == [(TX, None, 0.9), (None, 7, 0.8)]


def test_risk_question_runs_four_agent_investigation(monkeypatch):
    question = f"Is transaction {TX} risky?"
    _patch_guard(monkeypatch, question, scope={"P1"})
    monkeypatch.setattr(user_assistant_service, "get_accessible_property_records", lambda *a: [])
    captured: dict = {}

    def fake_investigate(db, tid, user_id=None, query_id=None):
        captured.update(tid=tid, user_id=user_id, query_id=query_id)
        return {
            "report": {
                "property_id": "P1",
                "risk_summary": {"risk_level": "HIGH", "risk_score": 0.82},
                "executive_summary": "Several checks failed.",
                "recommendation": "Manual review.",
                "responsible_ai_notice": "Not a legal judgment.",
            },
            "agents": [{"confidence_score": 1.0}, {"confidence_score": 0.75, "warnings": []}],
        }

    monkeypatch.setattr(user_assistant_service.orchestrator, "investigate", fake_investigate)
    monkeypatch.setattr(
        user_assistant_service.retrieval_service,
        "search",
        MagicMock(side_effect=AssertionError("must not search")),
    )

    res = user_assistant_service.process_user_query(MagicMock(), PUBLIC, question)

    suffix = res.query_id.removeprefix("NLP-")
    assert captured == {"tid": TX, "user_id": "U1", "query_id": f"INV-{suffix}"}
    assert res.mode == "investigation"
    assert res.risk_level == "HIGH"
    assert res.investigation_id == f"INV-{suffix}"
    assert res.detail_url == f"/investigation-reports/INV-{suffix}"
    assert res.confidence_score == 0.75
    assert "HIGH risk" in res.answer and "Manual review." in res.answer
    assert "Not a legal judgment." in res.warnings


def test_investigation_falls_back_to_retrieval_when_no_ledger(monkeypatch):
    question = f"verify transaction {TX}"
    _patch_guard(monkeypatch, question, scope=None)
    monkeypatch.setattr(user_assistant_service, "get_accessible_property_records", lambda *a: [])
    monkeypatch.setattr(user_assistant_service.orchestrator, "investigate", lambda *a, **k: None)
    monkeypatch.setattr(
        user_assistant_service.retrieval_service, "search", lambda db, q, **kw: _search_result([])
    )

    res = user_assistant_service.process_user_query(MagicMock(), ADMIN, question)
    assert res.mode == "retrieval"
    assert any("No blockchain ledger record" in w for w in res.warnings)


def _record(pid: str, tx_id: str, *, owner: bool, district: str = "Dubai Marina") -> dict:
    return {
        "property": SimpleNamespace(
            property_id=pid,
            property_name=None,
            district=district,
            title_deed_number=f"TD-{pid}",
        ),
        "transactions": [SimpleNamespace(transaction_id=tx_id, transaction_datetime=None)],
        "documents": [],
        "is_owner": owner,
        "relationship": "current owner" if owner else "former owner",
    }


def _implicit(question, records, turns=(), scope=frozenset({"P1", "P2"})):
    return user_assistant_service._implicit_transaction(
        MagicMock(), PUBLIC, question, parse_query(question), records, set(scope), list(turns)
    )


def test_risk_question_without_id_uses_the_only_owned_property():
    records = [_record("P1", "1-1-2023-1", owner=True), _record("P2", "1-1-2023-2", owner=False)]
    assert _implicit("is my property safe?", records) == ("1-1-2023-1", None)


def test_risk_question_without_id_asks_which_property_when_ambiguous():
    records = [_record("P1", "1-1-2023-1", owner=False), _record("P2", "1-1-2023-2", owner=False)]
    tx, clarification = _implicit("is my property safe?", records)
    assert tx is None
    assert clarification and "1-1-2023-1" in clarification and "1-1-2023-2" in clarification


def test_risk_question_without_id_matches_named_district():
    records = [
        _record("P1", "1-1-2023-1", owner=False, district="Business Bay"),
        _record("P2", "1-1-2023-2", owner=False, district="Burj Khalifa"),
    ]
    assert _implicit("is my Burj Khalifa flat safe?", records) == ("1-1-2023-2", None)


def test_follow_up_risk_question_uses_previous_transaction(monkeypatch):
    monkeypatch.setattr(
        user_assistant_service.property_repository,
        "user_can_access_transaction",
        lambda db, uid, tid: tid == TX,
    )
    turns = [("show transaction history", f"The latest sale was {TX} in 2021.")]
    assert _implicit("is it risky?", [], turns) == (TX, None)


def test_listing_risk_question_does_not_pick_a_transaction():
    records = [_record("P1", "1-1-2023-1", owner=True)]
    assert _implicit("show all my high risk transactions", records) == (None, None)


def test_rule_based_answer_separates_current_and_former_ownership():
    records = [_record("P1", "1-1-2023-1", owner=False)]
    answer = user_assistant_service._rule_based_record_answer("what properties do I own?", records)
    assert answer and "not the current owner" in answer and "former owner" in answer


def test_history_marks_investigation_and_retrieval_modes():
    logs = [
        SimpleNamespace(
            query_id="NLP-AAAA1111",
            query_text="risk?",
            agent_response="HIGH",
            confidence_score=None,
            log_timestamp=None,
        ),
        SimpleNamespace(
            query_id="NLP-BBBB2222",
            query_text="deed?",
            agent_response="TD-1",
            confidence_score=None,
            log_timestamp=None,
        ),
        SimpleNamespace(
            query_id="NLP-CCCC3333",
            query_text="x",
            agent_response="Access Restricted: no",
            confidence_score=None,
            log_timestamp=None,
        ),
    ]
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = logs
    db.query.return_value.filter.return_value.distinct.return_value.all.return_value = [
        ("INV-AAAA1111",)
    ]
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

    items = user_assistant_service.get_user_history(db, "U1")
    assert [(i.mode, i.detail_url) for i in items] == [
        ("investigation", "/investigation-reports/INV-AAAA1111"),
        ("retrieval", "/property-search?tab=retrieval&qid=NLP-BBBB2222"),
        ("restricted", None),
    ]


# ─── Evidence Retrieval detail view ─────────────────────────────────────────


def _detail_db(owner: str, agent_used: str = "User-NLP-Assistant") -> MagicMock:
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(
        query_id="NLP-1",
        user_id=owner,
        query_text="villa Dubai Marina",
        agent_response="Your villa is in Dubai Marina.",
        agent_used=agent_used,
    )
    return db


def test_query_detail_hidden_from_other_public_users():
    with pytest.raises(HTTPException) as exc:
        retrieval_endpoint.query_detail("NLP-1", limit=20, db=_detail_db("U2"), current_user=PUBLIC)
    assert exc.value.status_code == 404


def test_query_detail_rejects_non_retrieval_logs():
    with pytest.raises(HTTPException):
        retrieval_endpoint.query_detail(
            "INV-1", limit=20, db=_detail_db("U1", "orchestrator"), current_user=ADMIN
        )


def test_query_detail_returns_same_answer_and_scoped_hits(monkeypatch):
    captured: dict = {}

    def fake_guarded(db, user, q, **kw):
        captured.update(user=user, q=q)
        return _search_result([_hit("property", "P1", 0.95, property_id="P1")]), None

    monkeypatch.setattr(retrieval_endpoint, "_guarded_search", fake_guarded)
    res = retrieval_endpoint.query_detail(
        "NLP-1", limit=20, db=_detail_db("U1"), current_user=PUBLIC
    )

    assert captured == {"user": PUBLIC, "q": "villa Dubai Marina"}
    assert res.ai_answer == "Your villa is in Dubai Marina."
    assert res.origin == "assistant"
    assert res.question == "villa Dubai Marina"
    assert [h.record_id for h in res.hits] == ["P1"]
