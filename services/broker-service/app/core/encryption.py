import base64
import hashlib
from cryptography.fernet import Fernet
from app.config import get_settings


def _get_fernet() -> Fernet:
    settings = get_settings()
    # Derive a 32-byte key from SECRET_KEY using SHA-256
    key_bytes = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt(plain_text: str) -> str:
    if not plain_text:
        return ""
    f = _get_fernet()
    return f.encrypt(plain_text.encode()).decode()


def decrypt(cipher_text: str) -> str:
    if not cipher_text:
        return ""
    f = _get_fernet()
    return f.decrypt(cipher_text.encode()).decode()
