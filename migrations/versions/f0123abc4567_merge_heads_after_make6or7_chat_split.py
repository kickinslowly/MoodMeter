"""merge heads after make6or7 chat split

Revision ID: f0123abc4567
Revises: 9a7b6c5d4e3f, be12ad34cf78
Create Date: 2025-12-16 21:03:00.000000
"""

from alembic import op
import sqlalchemy as sa  # noqa: F401  (kept for consistency; not used in this merge)

# revision identifiers, used by Alembic.
revision = "f0123abc4567"
down_revision = ("9a7b6c5d4e3f", "be12ad34cf78")
branch_labels = None
depends_on = None


def upgrade():
    """No-op merge migration to unify multiple heads into a single lineage."""
    pass


def downgrade():
    """No-op downgrade for merge; cannot un-merge branches automatically."""
    pass
