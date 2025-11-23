"""add make67_chat_messages table (idempotent)

Revision ID: 938eb84c78c6
Revises: c1d2e3f4a5b6
Create Date: 2025-11-23 09:13:09.514387
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "938eb84c78c6"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade():
    """Create chat table and indexes if they don't already exist.
    This handles the case where the table was created earlier by runtime code.
    """
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    # Create table only if missing
    if "make67_chat_messages" not in tables:
        op.create_table(
            "make67_chat_messages",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=True),
            sa.Column("username", sa.String(length=255), nullable=False),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            # Name the FK explicitly to satisfy naming conventions and downgrades
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_m67_chat_user_id_users"),
        )

    # Ensure indexes exist (runtime path likely didn't add them)
    try:
        existing_indexes = {ix["name"] for ix in (inspector.get_indexes("make67_chat_messages") or [])}
    except Exception:
        existing_indexes = set()

    if "ix_make67_chat_messages_user_id" not in existing_indexes:
        op.create_index(
            "ix_make67_chat_messages_user_id",
            "make67_chat_messages",
            ["user_id"],
            unique=False,
        )
    if "ix_make67_chat_messages_created_at" not in existing_indexes:
        op.create_index(
            "ix_make67_chat_messages_created_at",
            "make67_chat_messages",
            ["created_at"],
            unique=False,
        )


def downgrade():
    """Drop indexes and table (if present)."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    try:
        tables = set(inspector.get_table_names())
    except Exception:
        tables = set()

    if "make67_chat_messages" in tables:
        try:
            existing_indexes = {ix["name"] for ix in (inspector.get_indexes("make67_chat_messages") or [])}
        except Exception:
            existing_indexes = set()

        if "ix_make67_chat_messages_created_at" in existing_indexes:
            op.drop_index("ix_make67_chat_messages_created_at", table_name="make67_chat_messages")
        if "ix_make67_chat_messages_user_id" in existing_indexes:
            op.drop_index("ix_make67_chat_messages_user_id", table_name="make67_chat_messages")

        op.drop_table("make67_chat_messages")