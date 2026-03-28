"""
In-memory fraud pre-gate.
Replaces Redis for hackathon purposes — restarts clear state.
"""
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional

_pinfl_log: dict[str, list[datetime]] = defaultdict(list)
_passport_log: dict[str, list[datetime]] = defaultdict(list)
_merchant_log: dict[str, list[datetime]] = defaultdict(list)


def check_fraud_gate(
    pinfl: Optional[str],
    passport_number: str,
    merchant_id: str,
) -> tuple[str, list[str]]:
    """
    Returns (gate, signals) where gate is 'PASS' | 'FLAG' | 'BLOCK'.
    Records the current attempt into the in-memory log.
    """
    now = datetime.now(timezone.utc)
    cutoff_24h = now - timedelta(hours=24)
    cutoff_1h = now - timedelta(hours=1)

    signals: list[str] = []
    gate = "PASS"

    # 1. PINFL duplicate within 24 h
    if pinfl:
        _pinfl_log[pinfl] = [t for t in _pinfl_log[pinfl] if t > cutoff_24h]
        if len(_pinfl_log[pinfl]) >= 1:
            gate = "BLOCK"
            signals.append("DUPLICATE_PINFL")

    # 2. Passport duplicate within 24 h
    _passport_log[passport_number] = [
        t for t in _passport_log[passport_number] if t > cutoff_24h
    ]
    if len(_passport_log[passport_number]) >= 1:
        if gate != "BLOCK":
            gate = "BLOCK"
        signals.append("DUPLICATE_PASSPORT")

    # 3. Merchant velocity > 10 per hour
    _merchant_log[merchant_id] = [
        t for t in _merchant_log[merchant_id] if t > cutoff_1h
    ]
    if len(_merchant_log[merchant_id]) > 10:
        if gate != "BLOCK":
            gate = "FLAG"
        signals.append("HIGH_MERCHANT_VELOCITY")

    # Record this attempt
    if pinfl:
        _pinfl_log[pinfl].append(now)
    _passport_log[passport_number].append(now)
    _merchant_log[merchant_id].append(now)

    return gate, signals
