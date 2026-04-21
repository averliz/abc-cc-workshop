"""signals hypertable with 30-day retention"""
from alembic import op

revision = "0002_signals_hypertable"
down_revision = "0001_init_users_sources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE signals (
            id TEXT NOT NULL,
            source_item_id TEXT NOT NULL,
            source_id TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_url TEXT NOT NULL,
            ts TIMESTAMPTZ NOT NULL,
            ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            author TEXT,
            title TEXT,
            content TEXT NOT NULL,
            tags TEXT[] NOT NULL DEFAULT '{}',
            confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            raw JSONB,
            PRIMARY KEY (id, ingested_at)
        )
    """)
    # Pitfall 1: hypertable PK MUST include partition column (ingested_at).
    op.execute("SELECT create_hypertable('signals', 'ingested_at', chunk_time_interval => INTERVAL '1 day')")
    op.execute("CREATE INDEX idx_signals_source_ts ON signals (source_id, ingested_at DESC)")
    op.execute("CREATE INDEX idx_signals_ingested ON signals (ingested_at DESC)")
    op.execute("SELECT add_retention_policy('signals', INTERVAL '30 days')")


def downgrade() -> None:
    op.execute("SELECT remove_retention_policy('signals', if_exists => TRUE)")
    op.execute("DROP TABLE IF EXISTS signals CASCADE")
