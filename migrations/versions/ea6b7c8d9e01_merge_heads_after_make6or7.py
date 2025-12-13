"""merge heads after adding make6or7 counter

Revision ID: ea6b7c8d9e01
Revises: e1f2a3b4c5d6, f6a7b8c9d0e1
Create Date: 2025-12-13 13:20:00
"""

# This merge migration reconciles two parallel heads created when
# `f6a7b8c9d0e1_add_make6or7_all_time_solves.py` branched from an
# older revision. No schema changes are needed here.

from alembic import op  # noqa: F401  (kept for consistency; no ops required)

# revision identifiers, used by Alembic.
revision = "ea6b7c8d9e01"
down_revision = ("e1f2a3b4c5d6", "f6a7b8c9d0e1")
branch_labels = None
depends_on = None


def upgrade():
    # No-op; this just merges the heads so Alembic has a single tip.
    pass


def downgrade():
    # No-op; avoid re-splitting the history on downgrade.
    pass
