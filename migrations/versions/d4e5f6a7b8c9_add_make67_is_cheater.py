"""add make67 is_cheater flag

Revision ID: d4e5f6a7b8c9
Revises: c1d2e3f4a5b6
Create Date: 2025-12-08 14:50:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == 'sqlite'

    if is_sqlite:
        with op.batch_alter_table('users') as batch:
            batch.add_column(sa.Column('make67_is_cheater', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    else:
        op.add_column('users', sa.Column('make67_is_cheater', sa.Boolean(), nullable=False, server_default=sa.text('false')))
        # Remove server default after backfill
        with op.batch_alter_table('users') as batch:
            batch.alter_column('make67_is_cheater', server_default=None)


def downgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_column('make67_is_cheater')
