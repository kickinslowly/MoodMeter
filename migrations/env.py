from __future__ import with_statement
from alembic import context
from logging.config import fileConfig
from flask import current_app

# this is the Alembic Config object, which provides access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    try:
        fileConfig(config.config_file_name)
    except Exception:
        # Some environments may not provide a full logging config; skip configuring logging.
        pass

# set target_metadata for 'autogenerate' support
# from the Flask app via Flask-Migrate extension
try:
    target_metadata = current_app.extensions['migrate'].db.metadata
except Exception:  # pragma: no cover
    target_metadata = None


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL and not an Engine, though an Engine is acceptable
    here as well. By skipping the Engine creation we don't even need a DBAPI to be available.
    """
    url = str(current_app.extensions['migrate'].db.engine.url)
    from sqlalchemy.engine import make_url
    is_sqlite = make_url(url).get_backend_name() == 'sqlite'

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
        render_as_batch=is_sqlite,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = current_app.extensions['migrate'].db.engine

    with connectable.connect() as connection:
        is_sqlite = connection.dialect.name == 'sqlite'
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            render_as_batch=is_sqlite,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
