from io import BytesIO

from PIL import Image

PASSWORD = "correct-horse-battery"
SIGNUP = {"email": "ada@example.com", "password": PASSWORD, "timezone": "Europe/London"}


def photo() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (400, 300), (30, 120, 70)).save(buffer, format="JPEG")
    return buffer.getvalue()


async def signup(client, **overrides):
    return await client.post("/api/v1/auth/signup", json={**SIGNUP, **overrides})


async def test_signup_returns_a_usable_token(client):
    response = await signup(client)

    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "ada@example.com"
    assert body["user"]["timezone"] == "Europe/London"
    assert "password" not in str(body)

    me = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "ada@example.com"


async def test_signup_rejects_a_bad_timezone(client):
    response = await signup(client, timezone="Mars/Olympus_Mons")

    assert response.status_code == 400


async def test_signup_rejects_a_duplicate_email(client):
    await signup(client)

    assert (await signup(client)).status_code == 400


async def test_login_returns_a_token_and_wrong_password_does_not(client):
    await signup(client)

    ok = await client.post(
        "/api/v1/auth/login", json={"email": "ada@example.com", "password": PASSWORD}
    )
    assert ok.status_code == 200
    assert ok.json()["token"]

    bad = await client.post(
        "/api/v1/auth/login", json={"email": "ada@example.com", "password": "wrong-password"}
    )
    assert bad.status_code == 401


async def test_logout_invalidates_the_token(client):
    token = (await signup(client)).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert (await client.post("/api/v1/auth/logout", headers=headers)).status_code == 204
    assert (await client.get("/api/v1/me", headers=headers)).status_code == 401


async def test_protected_routes_refuse_missing_and_malformed_tokens(client):
    for headers in (
        {},
        {"Authorization": "Bearer nonsense"},
        {"Authorization": "Basic abc123"},
        {"Authorization": "Bearer "},
    ):
        assert (await client.get("/api/v1/me", headers=headers)).status_code == 401


async def test_identify_requires_authentication(client):
    response = await client.post(
        "/api/v1/identify", files={"images": ("p.jpg", photo(), "image/jpeg")}
    )

    assert response.status_code == 401


async def test_identify_returns_candidates_for_a_signed_in_user(client):
    token = (await signup(client)).json()["token"]

    response = await client.post(
        "/api/v1/identify",
        headers={"Authorization": f"Bearer {token}"},
        files={"images": ("p.jpg", photo(), "image/jpeg")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["image_url"].startswith("/media/")
    assert isinstance(body["candidates"], list)
    # The fake provider calls nobody, so it must not credit anyone.
    assert body["attribution"] is None


async def test_identify_rejects_a_non_image(client):
    token = (await signup(client)).json()["token"]

    response = await client.post(
        "/api/v1/identify",
        headers={"Authorization": f"Bearer {token}"},
        files={"images": ("doc.pdf", b"%PDF-1.7 not an image", "application/pdf")},
    )

    assert response.status_code == 400
