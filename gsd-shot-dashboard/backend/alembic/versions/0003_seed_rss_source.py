"""seed one canonical RSS source (BBC World)

So `docker compose up` produces visible signal flow on first boot. Downstream
plans (Plan 04 SSE) depend on *some* source being registered; this migration
makes that guarantee infrastructural rather than operator-managed.
"""
from alembic import op

revision = "0003_seed_rss_source"
down_revision = "0002_signals_hypertable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO sources (source_id, source_type, config, enabled)
        VALUES (
            'rss:bbc-world',
            'rss',
            '{"feed_url": "http://feeds.bbci.co.uk/news/world/rss.xml", "poll_interval_s": 60}'::jsonb,
            true
        )
        ON CONFLICT (source_id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM sources WHERE source_id = 'rss:bbc-world'")
