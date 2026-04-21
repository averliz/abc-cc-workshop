from __future__ import annotations
import argparse
import asyncio
import sys
from sqlalchemy import select
from src.db import async_session
from src.models.user import User
from src.auth.passwords import hash_password


async def _create(email: str, password: str) -> int:
    async with async_session()() as s, s.begin():
        existing = await s.scalar(select(User).where(User.email == email))
        if existing is not None:
            print(f"user already exists: {email} (id={existing.id})", file=sys.stderr)
            return existing.id
        u = User(email=email, password_hash=hash_password(password))
        s.add(u)
        await s.flush()
        print(f"created user id={u.id} email={email}")
        return u.id


def main() -> int:
    p = argparse.ArgumentParser(prog="create_user", description="Seed the analyst user (run once).")
    p.add_argument("--email", required=True)
    p.add_argument("--password", required=True)
    args = p.parse_args()
    asyncio.run(_create(args.email, args.password))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
