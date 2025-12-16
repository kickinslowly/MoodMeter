"""merge heads after adding items and shield columns

Revision ID: be12ad34cf78
Revises: 1a2b3c4d5e67, ab12cd34ef56
Create Date: 2025-12-16 19:00:00
"""

# This merge migration reconciles two parallel heads created when both
# `add_make67_divine_shield_to_user` and `add_m67_user_items` were added
# on top of the same parent revision. No schema changes are needed.

from alembic import op  # noqa: F401  (kept for consistency; no ops required)

# revision identifiers, used by Alembic.
revision = "be12ad34cf78"
down_revision = ("1a2b3c4d5e67", "ab12cd34ef56")
branch_labels = None
depends_on = None


def upgrade():
    # No-op; this just merges the heads so Alembic has a single tip.
    pass


def downgrade():
    # No-op; avoid re-splitting the history on downgrade.
    pass
