"""Train the optional Isolation Forest anomaly model on core.transaction_features.

Usage (from server/):
  PYTHONPATH=. .venv/bin/python scripts/train_anomaly_model.py
  PYTHONPATH=. .venv/bin/python scripts/train_anomaly_model.py --contamination 0.02 --limit 50000

Saves to ANOMALY_MODEL_PATH (default server/models/anomaly_isolation_forest.joblib).
Then set ANOMALY_MODEL_ENABLED=true in .env and restart the API.
"""

from __future__ import annotations

import argparse
import time

from app.core.database import SessionLocal
from app.services import anomaly_model_service


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--contamination", type=float, help="Expected anomaly share (default ANOMALY_CONTAMINATION)"
    )
    parser.add_argument("--limit", type=int, help="Train on the first N feature rows only")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        started = time.perf_counter()
        result = anomaly_model_service.train(db, contamination=args.contamination, limit=args.limit)
        elapsed = time.perf_counter() - started
        print(
            f"{result['model_name']} {result['model_version']} trained on {result['training_rows']} rows "
            f"(contamination {result['contamination']}) in {elapsed:.1f}s → {result['path']}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
