"""init users, sources, feed_state"""
from alembic import op
import sqlalchemy as sa

revision = "0001_init_users_sources"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb")

    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("email", sa.Text, nullable=False, unique=True),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    op.create_table(
        "sources",
        sa.Column("source_id", sa.Text, primary_key=True),     # e.g. "rss:bbc-world"
        sa.Column("source_type", sa.Text, nullable=False),     # "rss"
        sa.Column("config", sa.dialects.postgresql.JSONB, nullable=False),  # {"feed_url": "..."}
        sa.Column("enabled", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # Per-source fetch bookkeeping (Pitfall 5: conditional GET state must survive restart → Postgres, not Redis)
    op.create_table(
        "feed_state",
        sa.Column("source_id", sa.Text, primary_key=True),
        sa.Column("etag", sa.Text, nullable=True),
        sa.Column("last_modified", sa.Text, nullable=True),
        sa.Column("last_fetch_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_success_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column("error_count_1h", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("throughput_per_min", sa.Float, nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(["source_id"], ["sources.source_id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("feed_state")
    op.drop_table("sources")
    op.drop_table("users")
    # Do NOT drop extension — may be shared.
