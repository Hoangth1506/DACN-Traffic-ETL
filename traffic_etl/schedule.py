from __future__ import annotations

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from .config import EtlConfig


def parse_window(value: str) -> tuple[time, time]:
    start, end = value.split("-", 1)
    return _parse_time(start), _parse_time(end)


def is_inside_collection_window(now: datetime, etl: EtlConfig) -> bool:
    local = now.astimezone(ZoneInfo(etl.timezone))
    current = local.time()
    for value in etl.windows:
        start, end = parse_window(value)
        if start <= current <= end:
            return True
    return False


def initial_collection_slots(etl: EtlConfig, now: datetime | None = None) -> list[datetime]:
    tz = ZoneInfo(etl.timezone)
    local_now = (now or datetime.now(tz)).astimezone(tz)
    slots: list[datetime] = []
    for days_back in range(etl.initial_history_days):
        day = (local_now.date() - timedelta(days=days_back))
        for value in etl.windows:
            start, end = parse_window(value)
            cursor = datetime.combine(day, start, tzinfo=tz)
            stop = datetime.combine(day, end, tzinfo=tz)
            while cursor <= stop:
                slots.append(cursor)
                cursor += timedelta(minutes=etl.interval_minutes)
    return sorted(slots)


def _parse_time(value: str) -> time:
    hour, minute = value.strip().split(":", 1)
    return time(hour=int(hour), minute=int(minute))
