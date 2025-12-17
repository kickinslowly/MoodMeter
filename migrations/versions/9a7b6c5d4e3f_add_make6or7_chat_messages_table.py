"""add make6or7_chat_messages table (idempotent)

Revision ID: 9a7b6c5d4e3f
Revises: ea6b7c8d9e01
Create Date: 2025-12-16 18:05:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "9a7b6c5d4e3f"
down_revision = "ea6b7c8d9e01"
branch_labels = None
depends_on = None


def upgrade():
    """Create Make 6 or 7 chat table and indexes if they don't already exist."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    try:
        tables = set(inspector.get_table_names())
    except Exception:
        tables = set()

    if "make6or7_chat_messages" not in tables:
        op.create_table(
            "make6or7_chat_messages",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=True),
            sa.Column("username", sa.String(length=255), nullable=False),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_m6or7_chat_user_id_users"),
        )

    # Ensure indexes exist
    try:
        existing_indexes = {ix["name"] for ix in (inspector.get_indexes("make6or7_chat_messages") or [])}
    except Exception:
        existing_indexes = set()

    if "ix_make6or7_chat_messages_user_id" not in existing_indexes:
        op.create_index(
            "ix_make6or7_chat_messages_user_id",
            "make6or7_chat_messages",
            ["user_id"],
            unique=False,
        )
    if "ix_make6or7_chat_messages_created_at" not in existing_indexes:
        op.create_index(
            "ix_make6or7_chat_messages_created_at",
            "make6or7_chat_messages",
            ["created_at"],
            unique=False,
        )


def downgrade():
    """Drop Make 6 or 7 chat table and its indexes if present."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    try:
        tables = set(inspector.get_table_names())
    except Exception:
        tables = set()

    if "make6or7_chat_messages" in tables:
        try:
            existing_indexes = {ix["name"] for ix in (inspector.get_indexes("make6or7_chat_messages") or [])}
        except Exception:
            existing_indexes = set()

        if "ix_make6or7_chat_messages_created_at" in existing_indexes:
            op.drop_index("ix_make6or7_chat_messages_created_at", table_name="make6or7_chat_messages")
        if "ix_make6or7_chat_messages_user_id" in existing_indexes:
            op.drop_index("ix_make6or7_chat_messages_user_id", table_name="make6or7_chat_messages")

        op.drop_table("make6or7_chat_messages")
