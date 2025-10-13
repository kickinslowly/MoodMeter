"""initial schema

Revision ID: 0001
Revises: 
Create Date: 2025-10-12 10:05:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('avatar_url', sa.String(length=512), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email', name='uq_users_email'),
    )

    # mood submissions table
    op.create_table(
        'mood_submissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=True),
        sa.Column('x', sa.Integer(), nullable=False),
        sa.Column('y', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(length=255), nullable=True),
        sa.Column('chosen_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ip', sa.String(length=45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_index('ix_mood_submissions_user_id', 'mood_submissions', ['user_id'])
    op.create_index('ix_mood_submissions_chosen_at', 'mood_submissions', ['chosen_at'])


def downgrade() -> None:
    op.drop_index('ix_mood_submissions_chosen_at', table_name='mood_submissions')
    op.drop_index('ix_mood_submissions_user_id', table_name='mood_submissions')
    op.drop_table('mood_submissions')
    op.drop_table('users')
