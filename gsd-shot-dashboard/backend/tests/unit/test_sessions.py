import time
from src.auth.sessions import issue_session_cookie, verify_session_cookie


def test_roundtrip():
    token = issue_session_cookie(42)
    assert verify_session_cookie(token) == 42


def test_tampered_rejected():
    token = issue_session_cookie(42)
    bad = token[:-2] + ("AA" if token[-2:] != "AA" else "BB")
    assert verify_session_cookie(bad) is None


def test_expired_rejected():
    token = issue_session_cookie(42)
    # itsdangerous stores timestamps at second granularity and checks age > max_age
    # strictly, so we must sleep long enough for the integer age to exceed max_age_s.
    time.sleep(2.1)
    assert verify_session_cookie(token, max_age_s=1) is None
