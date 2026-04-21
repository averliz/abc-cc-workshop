from src.auth.passwords import hash_password, verify_password


def test_hash_is_bcrypt():
    h = hash_password("hunter2")
    assert h.startswith("$2b$") or h.startswith("$2a$")


def test_verify_correct():
    h = hash_password("hunter2")
    assert verify_password("hunter2", h) is True


def test_verify_wrong():
    h = hash_password("hunter2")
    assert verify_password("nope", h) is False


def test_hash_is_salted():
    assert hash_password("same") != hash_password("same")
