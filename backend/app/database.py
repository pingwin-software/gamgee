import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://gamgee:gamgee@localhost:5432/gamgee",
)


def _with_driver(url: str) -> str:
    """Pin the PostgreSQL driver to psycopg 3 (the one in requirements.txt).

    A bare postgresql:// URL means "SQLAlchemy's default driver", and that default
    changed from psycopg2 to psycopg between SQLAlchemy releases. Naming the driver
    keeps a fresh image build from picking one that is not installed.
    """
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = _with_driver(DATABASE_URL)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
