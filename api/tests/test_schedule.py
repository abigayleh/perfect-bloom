from datetime import UTC, date, datetime, timedelta

import pytest

from app.services.schedule import compute_schedule

HALIFAX = "America/Halifax"  # UTC-3 / UTC-4
TOKYO = "Asia/Tokyo"  # UTC+9


def moment(year, month, day, hour=12, minute=0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=UTC)


def schedule(**overrides):
    defaults = {
        "interval_days": 7,
        "last_watered_at": moment(2026, 7, 1),
        "created_at": moment(2026, 6, 1),
        "timezone": "UTC",
        "now": moment(2026, 7, 1),
    }
    return compute_schedule(**{**defaults, **overrides})


def test_next_due_is_last_watered_plus_interval():
    result = schedule(last_watered_at=moment(2026, 7, 1), interval_days=7)

    assert result.next_due_on == date(2026, 7, 8)
    assert result.days_until_due == 7
    assert result.is_due is False
    assert result.anchor == "watering"


def test_due_on_the_day_itself():
    result = schedule(last_watered_at=moment(2026, 7, 1), now=moment(2026, 7, 8))

    assert result.days_until_due == 0
    assert result.is_due is True


def test_overdue_counts_up():
    result = schedule(last_watered_at=moment(2026, 7, 1), now=moment(2026, 7, 11))

    assert result.days_until_due == -3
    assert result.is_due is True
    assert result.days_overdue == 3


def test_watering_late_shifts_every_later_date():
    """The core rule: the schedule re-anchors to reality, it does not catch up."""
    on_time = schedule(last_watered_at=moment(2026, 7, 1))
    assert on_time.next_due_on == date(2026, 7, 8)

    # Watered two days late, on the 10th rather than the 8th.
    after_late = schedule(last_watered_at=moment(2026, 7, 10), now=moment(2026, 7, 10))

    assert after_late.next_due_on == date(2026, 7, 17)  # not the 15th
    assert after_late.is_due is False


def test_no_interval_means_no_schedule():
    result = schedule(interval_days=None)

    assert result.next_due_on is None
    assert result.days_until_due is None
    assert result.is_due is False
    assert result.has_schedule is False


def test_never_watered_anchors_on_when_the_plant_was_added():
    result = schedule(last_watered_at=None, created_at=moment(2026, 7, 2), now=moment(2026, 7, 2))

    assert result.anchor == "created"
    assert result.next_due_on == date(2026, 7, 9)
    assert result.last_watered_at is None


def test_late_evening_watering_belongs_to_the_local_day():
    """23:00 UTC is 20:00 in Halifax — still the 1st locally, so due the 8th."""
    result = schedule(last_watered_at=moment(2026, 7, 1, hour=23), timezone=HALIFAX)

    assert result.next_due_on == date(2026, 7, 8)


def test_after_midnight_utc_is_still_the_previous_day_in_halifax():
    """02:00 UTC on the 2nd is 23:00 on the 1st in Halifax — due the 8th, not the 9th."""
    result = schedule(last_watered_at=moment(2026, 7, 2, hour=2), timezone=HALIFAX)

    assert result.next_due_on == date(2026, 7, 8)


def test_the_same_instant_gives_different_dates_either_side_of_the_dateline():
    watered = moment(2026, 7, 1, hour=22)  # 19:00 Halifax on the 1st, 07:00 Tokyo on the 2nd

    halifax = schedule(last_watered_at=watered, timezone=HALIFAX)
    tokyo = schedule(last_watered_at=watered, timezone=TOKYO)

    assert halifax.next_due_on == date(2026, 7, 8)
    assert tokyo.next_due_on == date(2026, 7, 9)


def test_moving_timezone_recomputes_against_the_new_zone():
    watered = moment(2026, 7, 1, hour=22)
    now = moment(2026, 7, 8, hour=1)  # 22:00 on the 7th Halifax, 10:00 on the 8th Tokyo

    assert schedule(last_watered_at=watered, timezone=HALIFAX, now=now).is_due is False
    assert schedule(last_watered_at=watered, timezone=TOKYO, now=now).is_due is False

    later = moment(2026, 7, 8, hour=15)  # 12:00 Halifax on the 8th
    assert schedule(last_watered_at=watered, timezone=HALIFAX, now=later).is_due is True


def test_interval_spanning_a_dst_transition_stays_on_the_calendar():
    """Halifax leaves DST on 2026-11-01. A 14-day interval is 14 calendar days,
    not 14x24 hours, so the date must not slip."""
    result = schedule(
        last_watered_at=moment(2026, 10, 25, hour=16),
        interval_days=14,
        timezone=HALIFAX,
        now=moment(2026, 10, 25, hour=16),
    )

    assert result.next_due_on == date(2026, 11, 8)


def test_an_unknown_timezone_falls_back_to_utc_rather_than_exploding():
    result = schedule(timezone="Mars/Olympus_Mons")

    assert result.next_due_on == date(2026, 7, 8)


@pytest.mark.parametrize("interval", [1, 3, 30, 365])
def test_a_range_of_intervals(interval):
    result = schedule(last_watered_at=moment(2026, 1, 1), interval_days=interval)

    assert result.next_due_on == date(2026, 1, 1) + timedelta(days=interval)


def test_naive_timestamps_are_treated_as_utc():
    result = schedule(last_watered_at=datetime(2026, 7, 1, 12, 0))

    assert result.next_due_on == date(2026, 7, 8)
