from __future__ import annotations
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from src.config import get_settings


_SALT = "osint.session.v1"


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().session_secret, salt=_SALT)


def issue_session_cookie(user_id: int) -> str:
    return _serializer().dumps({"uid": user_id})


def verify_session_cookie(token: str, max_age_s: int | None = None) -> int | None:
    """Return user_id if valid, else None."""
    if max_age_s is None:
        max_age_s = get_settings().session_max_age_s
    try:
        payload = _serializer().loads(token, max_age=max_age_s)
    except (BadSignature, SignatureExpired):
        return None
    if not isinstance(payload, dict) or not isinstance(payload.get("uid"), int):
        return None
    return payload["uid"]
