"""Recompute the blockchain columns of core.transaction_features.

Usage (from server/):
  PYTHONPATH=. .venv/bin/python scripts/refresh_blockchain_features.py --limit 1000
  PYTHONPATH=. .venv/bin/python scripts/refresh_blockchain_features.py --property 10003635071741442048
  PYTHONPATH=. .venv/bin/python scripts/refresh_blockchain_features.py --all   # every ledger row (slow)
"""

from __future__ import annotations

import argparse
import time

from app.core.database import SessionLocal
from app.models.property import BlockchainTransaction
from app.services import blockchain_risk_service


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    scope = parser.add_mutually_exclusive_group(required=True)
    scope.add_argument("--limit", type=int, help="Refresh the N least recently checked transactions")
    scope.add_argument("--property", help="Refresh every transaction of one property")
    scope.add_argument("--all", action="store_true", help="Refresh every ledger transaction")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        query = db.query(BlockchainTransaction.transaction_id).filter(
            BlockchainTransaction.transaction_id.isnot(None)
        )
        if args.property:
            query = query.filter(BlockchainTransaction.property_id == args.property)
        query = query.order_by(BlockchainTransaction.blockchain_tx_id)
        if args.limit:
            query = query.limit(args.limit)
        transaction_ids = [row[0] for row in query.all()]

        started = time.perf_counter()
        result = blockchain_risk_service.refresh_features(db, transaction_ids)
        elapsed = time.perf_counter() - started
        print(f"{result['written']} written, {result['skipped']} skipped in {elapsed:.1f}s")
    finally:
        db.close()


if __name__ == "__main__":
    main()
