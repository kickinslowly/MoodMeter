"""create m67_user_items table for persistent Make67 inventory

Revision ID: ab12cd34ef56
Revises: fe12ab34cd56
Create Date: 2025-12-14 16:25:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'ab12cd34ef56'
down_revision = 'fe12ab34cd56'
branch_labels = None
depends_on = None


def upgrade():
    """Idempotent upgrade: create table/indexes only if missing.
    This avoids failures when the table was created manually/previously
    but Alembic revision wasn't recorded (common in SQLite/dev).
    """
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # Create table only if it doesn't exist
    if not insp.has_table('m67_user_items'):
        op.create_table(
            'm67_user_items',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('key', sa.String(length=50), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    # Create indexes only if they're not already present
    try:
        existing_ix = {ix['name'] for ix in (insp.get_indexes('m67_user_items') or [])}
    except Exception:
        existing_ix = set()
    if 'ix_m67_user_items_user_id' not in existing_ix:
        op.create_index('ix_m67_user_items_user_id', 'm67_user_items', ['user_id'])
    if 'ix_m67_user_items_created_at' not in existing_ix:
        op.create_index('ix_m67_user_items_created_at', 'm67_user_items', ['created_at'])


def downgrade():
    # Best-effort drops (safe if already absent)
    try:
        op.drop_index('ix_m67_user_items_created_at', table_name='m67_user_items')
    except Exception:
        pass
    try:
        op.drop_index('ix_m67_user_items_user_id', table_name='m67_user_items')
    except Exception:
        pass
    try:
        op.drop_table('m67_user_items')
    except Exception:
        pass
