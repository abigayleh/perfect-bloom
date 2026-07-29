PASSWORD = "correct-horse-battery"


async def register(client, timezone="Europe/London"):
    response = await client.post(
        "/api/v1/auth/signup",
        json={"email": "ada@example.com", "password": PASSWORD, "timezone": timezone},
    )
    return {"Authorization": f"Bearer {response.json()['token']}"}


async def test_timezone_can_be_updated(client):
    headers = await register(client)

    response = await client.patch("/api/v1/me", headers=headers, json={"timezone": "Asia/Tokyo"})

    assert response.status_code == 200
    assert response.json()["timezone"] == "Asia/Tokyo"
    assert (await client.get("/api/v1/me", headers=headers)).json()["timezone"] == "Asia/Tokyo"


async def test_a_bogus_timezone_is_refused(client):
    headers = await register(client)

    response = await client.patch(
        "/api/v1/me", headers=headers, json={"timezone": "Mars/Olympus_Mons"}
    )

    assert response.status_code == 400
    assert (await client.get("/api/v1/me", headers=headers)).json()["timezone"] == "Europe/London"


async def test_updating_timezone_requires_authentication(client):
    assert (await client.patch("/api/v1/me", json={"timezone": "UTC"})).status_code == 401


async def test_moving_timezone_shifts_the_due_date(client):
    """The whole reason this endpoint exists: due dates are local calendar dates,
    so they must be recomputed against wherever the user now is."""
    headers = await register(client, timezone="Pacific/Kiritimati")  # UTC+14
    plant = (
        await client.post(
            "/api/v1/plants", headers=headers, json={"nickname": "Monty", "interval_days": 7}
        )
    ).json()
    before = plant["next_due_on"]

    await client.patch("/api/v1/me", headers=headers, json={"timezone": "Pacific/Niue"})  # UTC-11

    after = (await client.get(f"/api/v1/plants/{plant['id']}", headers=headers)).json()
    assert after["next_due_on"] != before
