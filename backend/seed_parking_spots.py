"""Seed parking_spots with demo availability. Run from the backend folder:

  .venv\\Scripts\\python seed_parking_spots.py
  .venv\\Scripts\\python seed_parking_spots.py --apply-demo-state

--apply-demo-state  Recomputes is_occupied / reserved for every existing spot
                    (use after you already have rows but all \"available\").
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

# Repo root (parent of backend/)
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT / 'backend') not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT / 'backend'))

load_dotenv(_REPO_ROOT / '.env')

from app.parking_seed import (  # noqa: E402
    demo_flags_for_spot_number,
    parking_spots_seed_documents,
)


def get_db():
    uri = os.getenv('MONGODB_URI')
    if not uri:
        raise SystemExit('MONGODB_URI missing in .env')
    client = MongoClient(uri, serverSelectionTimeoutMS=20_000)
    db = client.get_default_database()
    if db is None:
        raise SystemExit('Mongo URI must include a default database name in the path.')
    return db


def main() -> None:
    parser = argparse.ArgumentParser(description='Seed parking_spots demo data')
    parser.add_argument(
        '--apply-demo-state',
        action='store_true',
        help='Update all parking spots to the demo occupied/reserved pattern',
    )
    args = parser.parse_args()

    db = get_db()
    coll = db.parking_spots
    coll.create_index('spot_number', unique=True)

    count = coll.count_documents({})
    if args.apply_demo_state:
        now = datetime.now(timezone.utc)
        updated = 0
        for doc in coll.find({}):
            sn = doc.get('spot_number')
            if not sn:
                continue
            occ, res = demo_flags_for_spot_number(str(sn))
            coll.update_one(
                {'_id': doc['_id']},
                {'$set': {'is_occupied': occ, 'reserved': res, 'last_updated': now}},
            )
            updated += 1
        print(f'Updated {updated} parking spot(s) with demo availability.')
        return

    if count > 0:
        print(
            f'parking_spots already has {count} document(s). '
            'Use --apply-demo-state to set demo flags, or clear the collection first.',
        )
        return

    docs = parking_spots_seed_documents()
    coll.insert_many(docs)
    print(f'Inserted {len(docs)} parking spots (mixed available / occupied / reserved).')


if __name__ == '__main__':
    main()
