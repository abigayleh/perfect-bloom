async def test_registering_needs_no_credentials(client):
    response = await client.post("/api/v1/devices")

    assert response.status_code == 201
    assert response.json()["token"]


async def test_the_proxy_refuses_an_unregistered_device(client):
    assert (await client.get("/api/v1/care", params={"scientific_name": "x y"})).status_code == 401

    headers = {"Authorization": "Bearer made-up"}
    response = await client.get(
        "/api/v1/care", headers=headers, params={"scientific_name": "Monstera deliciosa"}
    )
    assert response.status_code == 401


async def test_a_registered_device_can_use_the_proxy(client):
    token = (await client.post("/api/v1/devices")).json()["token"]

    response = await client.get(
        "/api/v1/care",
        headers={"Authorization": f"Bearer {token}"},
        params={"scientific_name": "Monstera deliciosa"},
    )

    assert response.status_code == 200


async def test_exhausting_the_quota_returns_429(client, monkeypatch):
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "device_daily_call_limit", 2, raising=False)

    token = (await client.post("/api/v1/devices")).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    params = {"scientific_name": "Monstera deliciosa"}

    assert (await client.get("/api/v1/care", headers=headers, params=params)).status_code == 200
    assert (await client.get("/api/v1/care", headers=headers, params=params)).status_code == 200

    exhausted = await client.get("/api/v1/care", headers=headers, params=params)
    assert exhausted.status_code == 429
