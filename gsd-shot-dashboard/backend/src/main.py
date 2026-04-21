from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI
from src.api.auth import router as auth_router
from src.api.signals import router as signals_router
from src.api.sources import router as sources_router
from src.api.stream import router as stream_router
from src.redis_client import close_redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: nothing to warm for now — Redis client is lazy.
    yield
    await close_redis()


def create_app() -> FastAPI:
    app = FastAPI(title="OSINT Shot Dashboard API", version="0.1.0", lifespan=lifespan)
    app.include_router(auth_router)
    app.include_router(signals_router)
    app.include_router(stream_router)
    app.include_router(sources_router)

    @app.get("/api/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
