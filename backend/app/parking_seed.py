"""Parking spot seed data: deterministic demo mix of available / occupied / reserved."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from bson import ObjectId

_GRID = re.compile(r'^([1-3])(\d{2})$')
_ALPHA = re.compile(r'^([A-Z])(\d{2})$')


def dummy_flags_for_spot(*, floor: int, spot_num: int) -> tuple[bool, bool]:
    """Return (is_occupied, reserved). Mutually exclusive for UI logic."""
    idx = (floor - 1) * 20 + spot_num
    if idx % 7 == 0:
        return True, False
    if idx % 7 == 1:
        return False, True
    return False, False


def demo_flags_for_spot_number(spot_number: str) -> tuple[bool, bool]:
    """Map any spot_number (e.g. 101, 320, A01, B12) to demo (is_occupied, reserved)."""
    sn = str(spot_number).strip().upper()
    m = _GRID.match(sn)
    if m:
        floor = int(m.group(1))
        spot_num = int(m.group(2))
        return dummy_flags_for_spot(floor=floor, spot_num=spot_num)
    m = _ALPHA.match(sn)
    if m:
        letter = m.group(1)
        spot_num = int(m.group(2))
        floor_map = {'A': 1, 'B': 2, 'C': 3}
        floor = floor_map.get(letter, 1)
        return dummy_flags_for_spot(floor=floor, spot_num=spot_num)
    h = sum(ord(c) for c in sn) % 7
    if h == 0:
        return True, False
    if h == 1:
        return False, True
    return False, False


def floor_from_spot_number(spot_number: str | None) -> int:
    """Derive display/grouping floor when DB document has no `floor` field."""
    if not spot_number:
        return 1
    sn = str(spot_number).strip().upper()
    m = _GRID.match(sn)
    if m:
        return int(m.group(1))
    m = _ALPHA.match(sn)
    if m:
        letter = m.group(1)
        return {'A': 1, 'B': 2, 'C': 3}.get(letter, 1)
    return 1


def effective_floor(spot: dict) -> int:
    """Prefer stored `floor`; otherwise infer from `spot_number` (e.g. legacy rows)."""
    f = spot.get('floor')
    if isinstance(f, int):
        return f
    return floor_from_spot_number(spot.get('spot_number'))


def apply_dummy_flags_to_spot_number(spot_number: str) -> tuple[bool, bool]:
    """Alias for :func:`demo_flags_for_spot_number` (backward compatible name)."""
    return demo_flags_for_spot_number(spot_number)


def parking_spots_seed_documents() -> list[dict]:
    now = datetime.now(timezone.utc)
    spots: list[dict] = []
    for floor in range(1, 4):
        for spot_num in range(1, 21):
            is_occ, res = dummy_flags_for_spot(floor=floor, spot_num=spot_num)
            spots.append({
                '_id': ObjectId(),
                'spot_number': f'{floor}{spot_num:02d}',
                'floor': floor,
                'is_occupied': is_occ,
                'reserved': res,
                'last_updated': now,
            })
    return spots
