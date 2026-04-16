"""add mr_a_rain_displayed (client-ACK flag for Mr. A rain overlay)

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-16 15:00:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c['name'] for c in insp.get_columns('users')}
    if 'mr_a_rain_displayed' not in cols:
        with op.batch_alter_table('users') as batch:
            batch.add_column(sa.Column(
                'mr_a_rain_displayed',
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ))
    # Leave all rows at default False so any user whose claim was granted
    # during a deploy race (old JS, no handler) gets a re-fire of the
    # overlay on next state poll. Grant logic is idempotent — inventory
    # won't double-fill and boost won't stack.


def downgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_column('mr_a_rain_displayed')
