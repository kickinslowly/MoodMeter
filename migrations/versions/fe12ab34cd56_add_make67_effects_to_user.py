"""add DB-backed make67 effects timestamps on users

Revision ID: fe12ab34cd56
Revises: ea6b7c8d9e01
Create Date: 2025-12-13 20:20:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'fe12ab34cd56'
down_revision = 'ea6b7c8d9e01'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == 'sqlite'

    # Add columns (use batch mode for sqlite safety)
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('make67_invisible_until', sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column('make67_boost_until', sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column('make67_mud_until', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_column('make67_mud_until')
        batch.drop_column('make67_boost_until')
        batch.drop_column('make67_invisible_until')
