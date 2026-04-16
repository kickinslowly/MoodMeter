"""add mr_a_rain_claimed (one-time Mr. A rain event flag)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-16 12:00:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c['name'] for c in insp.get_columns('users')}
    if 'mr_a_rain_claimed' not in cols:
        with op.batch_alter_table('users') as batch:
            batch.add_column(sa.Column(
                'mr_a_rain_claimed',
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ))


def downgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_column('mr_a_rain_claimed')
