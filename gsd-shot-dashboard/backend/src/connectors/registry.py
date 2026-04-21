from __future__ import annotations
from src.connectors.base import SourceConnector

_registry: dict[str, SourceConnector] = {}


def register(connector: SourceConnector) -> None:
    if connector.source_id in _registry:
        raise ValueError(f"duplicate source_id: {connector.source_id}")
    _registry[connector.source_id] = connector


def all_connectors() -> list[SourceConnector]:
    return list(_registry.values())


def get(source_id: str) -> SourceConnector:
    return _registry[source_id]


def clear() -> None:
    _registry.clear()
