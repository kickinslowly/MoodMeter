"""add make67_divine_shield (shield until) column

Revision ID: 1a2b3c4d5e67
Revises: fe12ab34cd56
Create Date: 2025-12-16 10:15:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '1a2b3c4d5e67'
down_revision = 'fe12ab34cd56'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('make67_shield_until', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_column('make67_shield_until')
