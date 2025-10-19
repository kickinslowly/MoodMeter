"""add sessions and session_id on submissions

Revision ID: b7f1d4e2c3a0
Revises: a8c2f0d6c9b1
Create Date: 2025-10-19 14:45:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b7f1d4e2c3a0'
down_revision = 'a8c2f0d6c9b1'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == 'sqlite'

    # Create sessions table
    op.create_table(
        'sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('pin', sa.String(length=10), nullable=False),
        sa.Column('owner_id', sa.String(length=36), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.sql.expression.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('pin', name='uq_sessions_pin'),
    )
    op.create_index('ix_sessions_pin', 'sessions', ['pin'])
    op.create_index('ix_sessions_owner_id', 'sessions', ['owner_id'])
    op.create_index('ix_sessions_created_at', 'sessions', ['created_at'])

    # Add session_id to mood_submissions
    with op.batch_alter_table('mood_submissions') as batch:
        batch.add_column(sa.Column('session_id', sa.Integer(), nullable=True))
        batch.create_foreign_key('fk_mood_submissions_session_id', 'sessions', ['session_id'], ['id'])
        batch.create_index('ix_mood_submissions_session_id', ['session_id'])

    # Clean up server_default for active (not supported to alter on SQLite)
    if not is_sqlite:
        with op.batch_alter_table('sessions') as batch:
            batch.alter_column('active', server_default=None)


def downgrade():
    with op.batch_alter_table('mood_submissions') as batch:
        batch.drop_index('ix_mood_submissions_session_id')
        batch.drop_constraint('fk_mood_submissions_session_id', type_='foreignkey')
        batch.drop_column('session_id')
    op.drop_index('ix_sessions_created_at', table_name='sessions')
    op.drop_index('ix_sessions_owner_id', table_name='sessions')
    op.drop_index('ix_sessions_pin', table_name='sessions')
    op.drop_table('sessions')
