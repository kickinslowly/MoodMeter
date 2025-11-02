"""add make67 all-time solves counter

Revision ID: c1d2e3f4a5b6
Revises: b7f1d4e2c3a0
Create Date: 2025-11-02 07:45:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c1d2e3f4a5b6'
down_revision = 'b7f1d4e2c3a0'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == 'sqlite'

    # Add column to users
    if is_sqlite:
        # batch_alter_table for SQLite safety on older versions
        with op.batch_alter_table('users') as batch:
            batch.add_column(sa.Column('make67_all_time_solves', sa.Integer(), nullable=False, server_default='0'))
    else:
        op.add_column('users', sa.Column('make67_all_time_solves', sa.Integer(), nullable=False, server_default='0'))
        # Drop server_default after backfilling defaults
        with op.batch_alter_table('users') as batch:
            batch.alter_column('make67_all_time_solves', server_default=None)


def downgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_column('make67_all_time_solves')
