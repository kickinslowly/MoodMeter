"""add make6or7 all-time solves counter

Revision ID: f6a7b8c9d0e1
Revises: c1d2e3f4a5b6
Create Date: 2025-12-13 13:10:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f6a7b8c9d0e1'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == 'sqlite'

    # Add column to users (idempotent style not required here; rely on Alembic ordering)
    if is_sqlite:
        with op.batch_alter_table('users') as batch:
            batch.add_column(sa.Column('make6or7_all_time_solves', sa.Integer(), nullable=False, server_default='0'))
    else:
        op.add_column('users', sa.Column('make6or7_all_time_solves', sa.Integer(), nullable=False, server_default='0'))
        with op.batch_alter_table('users') as batch:
            batch.alter_column('make6or7_all_time_solves', server_default=None)


def downgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_column('make6or7_all_time_solves')
