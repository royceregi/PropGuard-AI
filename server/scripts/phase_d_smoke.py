"""Live smoke test for the assistant ↔ retrieval ↔ 4-agent integration.

Usage (server running on :8000, demo users seeded):
    python scripts/phase_d_smoke.py <own_tx_id> <other_property_id> [<other_tx_id>]
"""

from __future__ import annotations

import sys

import httpx

BASE = "http://localhost:8000"
PUBLIC = {"email": "user@prop.ai", "password": "pass!123"}
ADMIN = {"email": "admin@prop.ai", "password": "pass!123"}

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")


def login(client: httpx.Client, creds: dict) -> dict:
    r = client.post(f"{BASE}/api/auth/login", json=creds)
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def main(own_tx: str, other_prop: str, other_tx: str | None) -> int:
    with httpx.Client(timeout=180) as c:
        pub = login(c, PUBLIC)
        admin = login(c, ADMIN)

        # 1. Normal question -> short answer + link to the same query on the Evidence Retrieval page.
        r = c.post(
            f"{BASE}/api/v1/user-assistant/query",
            headers=pub,
            json={"question": "What is my title deed number?"},
        )
        a = r.json()
        check("assistant retrieval answer", r.status_code == 200 and a["mode"] == "retrieval")
        check(
            "retrieval detail_url uses same query_id",
            a.get("detail_url") == f"/property-search?tab=retrieval&qid={a['query_id']}",
            a.get("detail_url") or "",
        )
        d = c.get(f"{BASE}/api/v1/retrieval/query/{a['query_id']}", headers=pub)
        dj = d.json()
        check(
            "detail page shows same answer",
            d.status_code == 200 and dj["ai_answer"] == a["answer"] and dj["origin"] == "assistant",
            f"{len(dj.get('hits', []))} hit(s)",
        )
        d2 = c.get(f"{BASE}/api/v1/retrieval/query/{a['query_id']}", headers=admin)
        check("authority can open detail", d2.status_code == 200)

        # 2. Risk question with own transaction -> 4-agent investigation + report.
        r = c.post(
            f"{BASE}/api/v1/user-assistant/query",
            headers=pub,
            json={"question": f"Is transaction {own_tx} risky?"},
        )
        inv = r.json()
        check(
            "risk question runs investigation",
            r.status_code == 200 and inv["mode"] == "investigation",
            f"risk={inv.get('risk_level')} url={inv.get('detail_url')}",
        )
        if inv.get("investigation_id"):
            rep = c.get(
                f"{BASE}/api/v1/investigations/query/{inv['investigation_id']}", headers=pub
            ).json()
            names = [run["agent_name"] for run in rep.get("agent_runs", [])]
            check(
                "report has all 4 agent runs",
                names
                == [
                    "blockchain_retrieval_agent",
                    "transaction_analysis_agent",
                    "risk_detection_agent",
                    "report_agent",
                ],
                ",".join(names),
            )
            check("report stored", bool((rep.get("report") or {}).get("executive_summary")))

        # 3. Someone else's property / transaction -> refused, nothing searched.
        r = c.post(
            f"{BASE}/api/v1/user-assistant/query",
            headers=pub,
            json={"question": f"Show details of property {other_prop}"},
        )
        rj = r.json()
        check(
            "foreign property refused",
            rj["mode"] == "restricted" and rj["answer"].startswith("Access Restricted"),
        )
        s = c.get(f"{BASE}/api/v1/retrieval/search", headers=pub, params={"q": other_prop})
        check(
            "retrieval page refuses too",
            s.json()["hits"] == [] and s.json()["ai_answer"].startswith("Access Restricted"),
        )
        if other_tx:
            r = c.post(
                f"{BASE}/api/v1/user-assistant/query",
                headers=pub,
                json={"question": f"Is transaction {other_tx} risky?"},
            )
            check("foreign transaction refused", r.json()["mode"] == "restricted")

        # 4. Investigation list is scoped to the public user's own reports.
        me = c.get(f"{BASE}/api/auth/me", headers=pub).json()
        my_id = me.get("user_id") or (me.get("user") or {}).get("user_id")
        items = c.get(f"{BASE}/api/v1/investigations", headers=pub).json()["items"]
        check(
            "public investigation list scoped",
            all(i["user_id"] == my_id for i in items),
            f"{len(items)} item(s)",
        )
        all_items = c.get(f"{BASE}/api/v1/investigations", headers=admin).json()
        check("admin sees all investigations", all_items["total"] >= len(items))

        # 5. History keeps the links.
        hist = c.get(f"{BASE}/api/v1/user-assistant/history", headers=pub).json()
        modes = {h["mode"] for h in hist[:5]}
        check(
            "history carries modes/links",
            {"retrieval", "investigation", "restricted"} <= modes,
            str(modes),
        )

    failed = [n for n, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None))
