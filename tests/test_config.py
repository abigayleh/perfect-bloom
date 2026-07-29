import pytest

from app.config import DEV_SECRET_KEY, Settings


def test_empty_secret_falls_back_to_the_dev_key_in_dev():
    # `cp .env.example .env` leaves SECRET_KEY empty; sessions must not be signed with "".
    assert Settings(env="dev", secret_key="").secret_key == DEV_SECRET_KEY


@pytest.mark.parametrize("secret", ["", DEV_SECRET_KEY])
def test_production_refuses_an_absent_or_dev_secret(secret):
    with pytest.raises(ValueError):
        Settings(env="production", secret_key=secret)


def test_production_accepts_a_real_secret():
    assert Settings(env="production", secret_key="a-real-generated-key").secret_key
