from app.adapters.base import BrokerAdapter
from app.adapters.zerodha import ZerodhaAdapter
from app.adapters.upstox import UpstoxAdapter
from app.adapters.angelone import AngelOneAdapter
from app.models.broker import BrokerCredential, BrokerName
from app.core.encryption import decrypt


def get_adapter(credential: BrokerCredential) -> BrokerAdapter:
    api_key = decrypt(credential.api_key_encrypted) if credential.api_key_encrypted else ""
    api_secret = decrypt(credential.api_secret_encrypted) if credential.api_secret_encrypted else ""
    access_token = decrypt(credential.access_token_encrypted) if credential.access_token_encrypted else ""

    kwargs = dict(
        api_key=api_key,
        api_secret=api_secret,
        access_token=access_token,
        is_sandbox=credential.is_sandbox,
    )

    if credential.broker == BrokerName.ZERODHA:
        return ZerodhaAdapter(**kwargs)
    elif credential.broker == BrokerName.UPSTOX:
        return UpstoxAdapter(**kwargs)
    elif credential.broker == BrokerName.ANGELONE:
        return AngelOneAdapter(**kwargs)
    else:
        raise ValueError(f"Unsupported broker: {credential.broker}")
