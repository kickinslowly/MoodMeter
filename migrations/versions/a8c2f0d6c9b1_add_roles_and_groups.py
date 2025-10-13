"""add roles and groups

Revision ID: a8c2f0d6c9b1
Revises: 24b6d856b4ef
Create Date: 2025-10-12 14:15:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a8c2f0d6c9b1'
down_revision = '24b6d856b4ef'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == 'sqlite'

    # Add role column to users
    op.add_column('users', sa.Column('role', sa.String(length=20), nullable=False, server_default='student'))

    # Create groups table
    op.create_table(
        'groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('teacher_id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['teacher_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_groups_teacher_id', 'groups', ['teacher_id'])

    # Create group_members table
    op.create_table(
        'group_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_group_members_group_id', 'group_members', ['group_id'])
    op.create_index('ix_group_members_student_id', 'group_members', ['student_id'])

    # Remove server_default for role after data backfilled (not supported on SQLite via ALTER)
    if not is_sqlite:
        op.alter_column('users', 'role', server_default=None)


def downgrade():
    op.drop_index('ix_group_members_student_id', table_name='group_members')
    op.drop_index('ix_group_members_group_id', table_name='group_members')
    op.drop_table('group_members')
    op.drop_index('ix_groups_teacher_id', table_name='groups')
    op.drop_table('groups')
    # Drop role column
    with op.batch_alter_table('users') as batch:
        batch.drop_column('role')
