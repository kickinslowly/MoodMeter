"""sync after template fix

Revision ID: 24b6d856b4ef
Revises: 0001
Create Date: 2025-10-12 10:53:47.954689
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '24b6d856b4ef'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    # Make migration SQLite-safe by skipping unsupported ALTER COLUMN and using batch mode for users table
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == 'sqlite'

    # Skip DROP DEFAULT alterations on SQLite (unsupported)
    if not is_sqlite:
        op.alter_column(
            'mood_submissions', 'created_at',
            existing_type=sa.DateTime(),
            server_default=None,
            existing_nullable=False,
        )
        op.alter_column(
            'users', 'created_at',
            existing_type=sa.DateTime(),
            server_default=None,
            existing_nullable=False,
        )
        op.alter_column(
            'users', 'updated_at',
            existing_type=sa.DateTime(),
            server_default=None,
            existing_nullable=False,
        )

    # This index drop is fine on SQLite
    op.drop_index(op.f('ix_mood_submissions_chosen_at'), table_name='mood_submissions')

    # Use batch mode to update unique/index on users.email in a SQLite-compatible way
    with op.batch_alter_table('users', recreate='always') as batch:
        try:
            batch.drop_constraint(op.f('uq_users_email'), type_='unique')
        except Exception:
            # Some SQLite schemas may not have a separately named unique constraint
            pass
        batch.create_index(op.f('ix_users_email'), ['email'], unique=True)


def downgrade():
    # Minimal downgrade: restore unique/index state; skip server-default toggles on SQLite
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.create_unique_constraint(op.f('uq_users_email'), 'users', ['email'])
    op.create_index(op.f('ix_mood_submissions_chosen_at'), 'mood_submissions', ['chosen_at'], unique=False)
    # Note: We intentionally do not re-add server defaults to datetime columns for SQLite.
