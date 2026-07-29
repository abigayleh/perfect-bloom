PASSWORD = "correct-horse-battery"
SIGNUP = {"email": "ada@example.com", "password": PASSWORD, "timezone": "Europe/London"}


async def auth_headers(client) -> dict[str, str]:
    response = await client.post("/api/v1/auth/signup", json=SIGNUP)
    return {"Authorization": f"Bearer {response.json()['token']}"}


async def test_care_requires_authentication(client):
    response = await client.get("/api/v1/care", params={"scientific_name": "Monstera deliciosa"})

    assert response.status_code == 401


async def test_returns_care_for_a_known_species(client):
    headers = await auth_headers(client)

    response = await client.get(
        "/api/v1/care", headers=headers, params={"scientific_name": "Monstera deliciosa Liebm."}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["match_kind"] == "exact"
    assert body["normalized_name"] == "Monstera deliciosa"
    assert body["common_name"] == "Swiss cheese plant"
    assert body["poisonous_to_pets"] is True
    assert body["toxicity_known"] is True


async def test_unknown_toxicity_is_null_and_flagged_not_safe(client):
    headers = await auth_headers(client)

    response = await client.get(
        "/api/v1/care", headers=headers, params={"scientific_name": "Sansevieria trifasciata"}
    )

    body = response.json()
    assert body["match_kind"] == "exact"
    assert body["poisonous_to_pets"] is None
    assert body["poisonous_to_humans"] is None
    assert body["toxicity_known"] is False


async def test_genus_fallback_is_reported_so_the_ui_can_say_so(client):
    headers = await auth_headers(client)

    response = await client.get(
        "/api/v1/care", headers=headers, params={"scientific_name": "Philodendron hederaceum"}
    )

    body = response.json()
    assert body["match_kind"] == "genus"
    assert body["matched_name"] == "Philodendron"


async def test_no_care_data_is_a_200_not_an_error(client):
    headers = await auth_headers(client)

    response = await client.get(
        "/api/v1/care", headers=headers, params={"scientific_name": "Nothing realis"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["match_kind"] == "none"
    assert body["watering"] is None
    assert body["poisonous_to_pets"] is None


async def test_second_request_is_served_from_cache(client):
    headers = await auth_headers(client)
    params = {"scientific_name": "Epipremnum aureum"}

    first = await client.get("/api/v1/care", headers=headers, params=params)
    second = await client.get("/api/v1/care", headers=headers, params=params)

    assert first.json()["from_cache"] is False
    assert second.json()["from_cache"] is True


async def test_unparseable_name_is_rejected(client):
    headers = await auth_headers(client)

    response = await client.get("/api/v1/care", headers=headers, params={"scientific_name": "123"})

    assert response.status_code == 400
