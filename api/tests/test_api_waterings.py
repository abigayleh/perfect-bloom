from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import WateringEvent
from app.models.base import utcnow

PASSWORD = "correct-horse-battery"


async def register(client, email="ada@example.com", timezone="America/Halifax"):
    response = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": PASSWORD, "timezone": timezone},
    )
    return {"Authorization": f"Bearer {response.json()['token']}"}


async def add_plant(client, headers, **body):
    payload = {"nickname": "Monty", "interval_days": 7, **body}
    response = await client.post("/api/v1/plants", headers=headers, json=payload)
    return response.json()


async def test_watering_re_anchors_the_schedule(client):
    headers = await register(client)
    plant = await add_plant(client, headers)
    assert plant["anchor"] == "created"

    response = await client.post(
        f"/api/v1/plants/{plant['id']}/waterings", headers=headers, json={}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["anchor"] == "watering"
    assert body["last_watered_at"] is not None
    assert body["days_until_due"] == 7
    assert body["is_due"] is False


async def test_a_backdated_watering_can_leave_the_plant_overdue(client):
    headers = await register(client)
    plant = await add_plant(client, headers)
    ten_days_ago = (utcnow() - timedelta(days=10)).isoformat()

    response = await client.post(
        f"/api/v1/plants/{plant['id']}/waterings",
        headers=headers,
        json={"watered_at": ten_days_ago},
    )

    body = response.json()
    assert body["is_due"] is True
    assert body["days_until_due"] == -3


async def test_a_future_watering_is_refused(client):
    headers = await register(client)
    plant = await add_plant(client, headers)
    tomorrow = (utcnow() + timedelta(days=1)).isoformat()

    response = await client.post(
        f"/api/v1/plants/{plant['id']}/waterings", headers=headers, json={"watered_at": tomorrow}
    )

    assert response.status_code == 400


async def test_an_absurdly_old_watering_is_refused(client):
    headers = await register(client)
    plant = await add_plant(client, headers)
    ancient = datetime(2000, 1, 1, tzinfo=UTC).isoformat()

    response = await client.post(
        f"/api/v1/plants/{plant['id']}/waterings", headers=headers, json={"watered_at": ancient}
    )

    assert response.status_code == 400


async def test_the_log_is_append_only(client, session):
    headers = await register(client)
    plant = await add_plant(client, headers)

    for _ in range(3):
        await client.post(f"/api/v1/plants/{plant['id']}/waterings", headers=headers, json={})

    rows = (
        (await session.execute(select(WateringEvent).where(WateringEvent.plant_id == plant["id"])))
        .scalars()
        .all()
    )
    assert len(rows) == 3, "each watering adds a row; none are overwritten"

    history = await client.get(f"/api/v1/plants/{plant['id']}/waterings", headers=headers)
    assert len(history.json()) == 3


async def test_history_survives_the_plant_being_removed(client, session):
    headers = await register(client)
    plant = await add_plant(client, headers)
    await client.post(f"/api/v1/plants/{plant['id']}/waterings", headers=headers, json={})

    await client.delete(f"/api/v1/plants/{plant['id']}", headers=headers)

    rows = (
        (await session.execute(select(WateringEvent).where(WateringEvent.plant_id == plant["id"])))
        .scalars()
        .all()
    )
    assert len(rows) == 1, "the log must outlive the plant for V2 diagnosis"


async def test_a_plant_with_no_interval_has_no_due_date(client):
    headers = await register(client)
    plant = await add_plant(client, headers, interval_days=None)

    assert plant["next_due_on"] is None
    assert plant["is_due"] is False

    watered = await client.post(f"/api/v1/plants/{plant['id']}/waterings", headers=headers, json={})
    assert watered.json()["next_due_on"] is None
    assert watered.json()["last_watered_at"] is not None


async def test_the_collection_carries_schedule_for_every_plant(client):
    headers = await register(client)
    first = await add_plant(client, headers, nickname="One")
    await add_plant(client, headers, nickname="Two", interval_days=3)
    await client.post(f"/api/v1/plants/{first['id']}/waterings", headers=headers, json={})

    listing = await client.get("/api/v1/plants", headers=headers)

    by_name = {plant["nickname"]: plant for plant in listing.json()}
    assert by_name["One"]["anchor"] == "watering"
    assert by_name["One"]["days_until_due"] == 7
    assert by_name["Two"]["anchor"] == "created"
    assert by_name["Two"]["days_until_due"] == 3


async def test_no_future_dates_are_ever_written(client, session):
    headers = await register(client)
    plant = await add_plant(client, headers)

    await client.post(f"/api/v1/plants/{plant['id']}/waterings", headers=headers, json={})

    rows = (await session.execute(select(WateringEvent))).scalars().all()
    for row in rows:
        assert row.watered_at <= utcnow(), "watering_events must only record the past"


async def test_watering_another_users_plant_is_a_404(client):
    ada = await register(client, "ada@example.com")
    grace = await register(client, "grace@example.com")
    plant = await add_plant(client, ada)

    response = await client.post(f"/api/v1/plants/{plant['id']}/waterings", headers=grace, json={})

    assert response.status_code == 404
    assert (
        await client.get(f"/api/v1/plants/{plant['id']}/waterings", headers=grace)
    ).status_code == 404


async def test_watering_routes_require_authentication(client):
    assert (await client.post("/api/v1/plants/1/waterings", json={})).status_code == 401
    assert (await client.get("/api/v1/plants/1/waterings")).status_code == 401
