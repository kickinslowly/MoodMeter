"""add tournament tables (tournaments, tournament_participants, tournament_trophies)

Revision ID: a1b2c3d4e5f6
Revises: f0123abc4567
Create Date: 2026-03-10 12:00:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f0123abc4567'
branch_labels = None
depends_on = None


def upgrade():
    """Idempotent upgrade: create tables/indexes only if missing."""
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # --- tournaments ---
    if not insp.has_table('tournaments'):
        op.create_table(
            'tournaments',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('game_type', sa.String(length=20), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
            sa.Column('duration_sec', sa.Integer(), nullable=False, server_default='300'),
            sa.Column('created_by', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('champion_id', sa.String(length=36), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    # --- tournament_participants ---
    if not insp.has_table('tournament_participants'):
        op.create_table(
            'tournament_participants',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('tournament_id', sa.String(length=36), sa.ForeignKey('tournaments.id'), nullable=False),
            sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('solves', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    # --- tournament_trophies ---
    if not insp.has_table('tournament_trophies'):
        op.create_table(
            'tournament_trophies',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('tournament_id', sa.String(length=36), sa.ForeignKey('tournaments.id'), nullable=False),
            sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('place', sa.Integer(), nullable=False),
            sa.Column('game_type', sa.String(length=20), nullable=False),
            sa.Column('solves', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('awarded_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    # --- indexes ---
    for table, col, ix_name in [
        ('tournament_participants', 'tournament_id', 'ix_tp_tournament_id'),
        ('tournament_participants', 'user_id', 'ix_tp_user_id'),
        ('tournament_trophies', 'tournament_id', 'ix_tt_tournament_id'),
        ('tournament_trophies', 'user_id', 'ix_tt_user_id'),
    ]:
        try:
            existing_ix = {ix['name'] for ix in (insp.get_indexes(table) or [])}
        except Exception:
            existing_ix = set()
        if ix_name not in existing_ix:
            op.create_index(ix_name, table, [col])


def downgrade():
    for ix, tbl in [
        ('ix_tt_user_id', 'tournament_trophies'),
        ('ix_tt_tournament_id', 'tournament_trophies'),
        ('ix_tp_user_id', 'tournament_participants'),
        ('ix_tp_tournament_id', 'tournament_participants'),
    ]:
        try:
            op.drop_index(ix, table_name=tbl)
        except Exception:
            pass
    for tbl in ['tournament_trophies', 'tournament_participants', 'tournaments']:
        try:
            op.drop_table(tbl)
        except Exception:
            pass
