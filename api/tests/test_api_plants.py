from sqlalchemy import select

from app.models import Plant, User
from app.services.images.storage import LocalDiskStorage
from app.services.plants import create_plant, delete_plant

PASSWORD = "correct-horse-battery"


async def register(client, email: str) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": PASSWORD, "timezone": "Europe/London"},
    )
    return {"Authorization": f"Bearer {response.json()['token']}"}


async def add_plant(client, headers, **body):
    payload = {"scientific_name": "Monstera deliciosa", "nickname": "Big Monty", **body}
    return await client.post("/api/v1/plants", headers=headers, json=payload)


async def test_create_and_list(client):
    headers = await register(client, "ada@example.com")

    created = await add_plant(client, headers, interval_days=7)

    assert created.status_code == 201
    body = created.json()
    assert body["nickname"] == "Big Monty"
    assert body["interval_days"] == 7

    listing = await client.get("/api/v1/plants", headers=headers)
    assert listing.status_code == 200
    assert [plant["id"] for plant in listing.json()] == [body["id"]]


async def test_manual_plant_needs_no_species_or_interval(client):
    headers = await register(client, "ada@example.com")

    response = await client.post(
        "/api/v1/plants", headers=headers, json={"nickname": "Windowsill mystery"}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["interval_days"] is None
    assert body["scientific_name"] == ""
    assert body["image_url"] is None


async def test_a_plant_needs_at_least_one_name(client):
    headers = await register(client, "ada@example.com")

    response = await client.post("/api/v1/plants", headers=headers, json={})

    assert response.status_code == 400


async def test_rejects_an_absurd_interval(client):
    headers = await register(client, "ada@example.com")

    assert (await add_plant(client, headers, interval_days=0)).status_code == 400
    assert (await add_plant(client, headers, interval_days=400)).status_code == 400


async def test_rejects_a_path_traversal_image_key(client):
    headers = await register(client, "ada@example.com")

    response = await add_plant(client, headers, image_key="../../etc/passwd")

    assert response.status_code == 400


async def test_update_nickname_and_interval(client):
    headers = await register(client, "ada@example.com")
    plant_id = (await add_plant(client, headers, interval_days=7)).json()["id"]

    response = await client.patch(
        f"/api/v1/plants/{plant_id}",
        headers=headers,
        json={"nickname": "Monty II", "interval_days": 10},
    )

    assert response.status_code == 200
    assert response.json()["nickname"] == "Monty II"
    assert response.json()["interval_days"] == 10


async def test_interval_can_be_cleared(client):
    headers = await register(client, "ada@example.com")
    plant_id = (await add_plant(client, headers, interval_days=7)).json()["id"]

    response = await client.patch(
        f"/api/v1/plants/{plant_id}", headers=headers, json={"clear_interval": True}
    )

    assert response.json()["interval_days"] is None


async def test_delete_is_soft_so_history_can_outlive_the_plant(client, session):
    headers = await register(client, "ada@example.com")
    plant_id = (await add_plant(client, headers)).json()["id"]

    assert (await client.delete(f"/api/v1/plants/{plant_id}", headers=headers)).status_code == 204
    assert (await client.get(f"/api/v1/plants/{plant_id}", headers=headers)).status_code == 404
    assert (await client.get("/api/v1/plants", headers=headers)).json() == []

    row = (await session.execute(select(Plant).where(Plant.id == plant_id))).scalar_one()
    assert row.deleted_at is not None, "the row must survive for watering_events to reference"


async def test_deleting_a_plant_removes_its_photo(session, tmp_path):
    # Service-level: the photo lives on disk, so the test needs its own storage
    # root rather than the configured one.
    storage = LocalDiskStorage(tmp_path)
    user = User(email="ada@example.com", password_hash="x", timezone="Europe/London")
    session.add(user)
    await session.commit()
    key = await storage.save(b"pretend-jpeg")
    plant = await create_plant(session, user, nickname="Big Monty", image_key=key)

    assert await delete_plant(session, user, plant.id, storage) is True

    assert not (tmp_path / key).exists(), "a photo of someone's home must not outlive the plant"
    assert plant.image_key is None, "no key should point at a file that is gone"


async def test_deleting_a_plant_without_a_photo_is_fine(session, tmp_path):
    storage = LocalDiskStorage(tmp_path)
    user = User(email="grace@example.com", password_hash="x", timezone="Europe/London")
    session.add(user)
    await session.commit()
    plant = await create_plant(session, user, nickname="Unphotographed")

    assert await delete_plant(session, user, plant.id, storage) is True


async def test_deleting_twice_is_a_404_not_a_crash(client):
    headers = await register(client, "ada@example.com")
    plant_id = (await add_plant(client, headers)).json()["id"]

    await client.delete(f"/api/v1/plants/{plant_id}", headers=headers)

    assert (await client.delete(f"/api/v1/plants/{plant_id}", headers=headers)).status_code == 404


async def test_one_user_cannot_see_or_touch_anothers_plants(client):
    ada = await register(client, "ada@example.com")
    grace = await register(client, "grace@example.com")
    plant_id = (await add_plant(client, ada)).json()["id"]

    assert (await client.get("/api/v1/plants", headers=grace)).json() == []
    assert (await client.get(f"/api/v1/plants/{plant_id}", headers=grace)).status_code == 404
    assert (
        await client.patch(
            f"/api/v1/plants/{plant_id}", headers=grace, json={"nickname": "mine now"}
        )
    ).status_code == 404
    assert (await client.delete(f"/api/v1/plants/{plant_id}", headers=grace)).status_code == 404

    # And Ada's plant is untouched.
    still_there = await client.get(f"/api/v1/plants/{plant_id}", headers=ada)
    assert still_there.json()["nickname"] == "Big Monty"


async def test_every_plant_route_requires_authentication(client):
    assert (await client.get("/api/v1/plants")).status_code == 401
    assert (await client.post("/api/v1/plants", json={"nickname": "x"})).status_code == 401
    assert (await client.get("/api/v1/plants/1")).status_code == 401
    assert (await client.patch("/api/v1/plants/1", json={})).status_code == 401
    assert (await client.delete("/api/v1/plants/1")).status_code == 401


async def test_saving_after_a_care_lookup_links_the_cached_species(client, session):
    headers = await register(client, "ada@example.com")
    await client.get(
        "/api/v1/care", headers=headers, params={"scientific_name": "Monstera deliciosa"}
    )

    plant_id = (await add_plant(client, headers)).json()["id"]

    row = (await session.execute(select(Plant).where(Plant.id == plant_id))).scalar_one()
    assert row.species_cache_id is not None


async def test_saving_without_a_cached_species_still_works(client, session):
    headers = await register(client, "ada@example.com")

    plant_id = (await add_plant(client, headers)).json()["id"]

    row = (await session.execute(select(Plant).where(Plant.id == plant_id))).scalar_one()
    assert row.species_cache_id is None
