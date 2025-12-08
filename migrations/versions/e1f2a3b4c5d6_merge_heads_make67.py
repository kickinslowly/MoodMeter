"""merge heads for Make67 changes

Revision ID: e1f2a3b4c5d6
Revises: 938eb84c78c6, d4e5f6a7b8c9
Create Date: 2025-12-08 15:25:00
"""

from alembic import op  # noqa: F401  (kept for consistency; no ops required)

# revision identifiers, used by Alembic.
revision = "e1f2a3b4c5d6"
down_revision = ("938eb84c78c6", "d4e5f6a7b8c9")
branch_labels = None
depends_on = None


def upgrade():
    # This is a merge migration to unify parallel heads.
    # No schema changes are required; this simply reconciles history.
    pass


def downgrade():
    # No-op: leaving empty to avoid re-splitting branches on downgrade.
    pass
