import pytest
from datetime import timedelta
from jose import jwt

from app.core.security import (
    hash_password, verify_password, create_access_token,
    decode_access_token, create_refresh_token, hash_token
)
from app.config import get_settings

settings = get_settings()


def test_password_hashing():
    password = "SecurePass@123"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("WrongPassword", hashed)


def test_access_token_creation():
    data = {"sub": "test-user-id", "role": "admin", "email": "test@example.com"}
    token = create_access_token(data)
    assert token is not None
    payload = decode_access_token(token)
    assert payload["sub"] == "test-user-id"
    assert payload["role"] == "admin"
    assert payload["type"] == "access"


def test_token_expiry():
    data = {"sub": "test-user-id", "role": "admin", "email": "test@example.com"}
    token = create_access_token(data, expires_delta=timedelta(seconds=-1))
    with pytest.raises(Exception):
        decode_access_token(token)


def test_refresh_token_uniqueness():
    t1 = create_refresh_token()
    t2 = create_refresh_token()
    assert t1 != t2


def test_token_hash_deterministic():
    token = create_refresh_token()
    assert hash_token(token) == hash_token(token)


def test_different_tokens_different_hashes():
    assert hash_token(create_refresh_token()) != hash_token(create_refresh_token())
