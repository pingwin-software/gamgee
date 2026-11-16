"""Content seed vs. exercise catalogue consistency.

`exercise_info.exercise_id` is a foreign key to `exercises.id`. PostgreSQL
enforces it, so a single id in `content_seed.EXERCISE_INFO` that the exercise
catalogue in `seed.py` does not define aborts the content seed on startup (and
with it every content table seeded after `exercise_info`). The default SQLite
test database does not enforce foreign keys, so these tests check the data
directly and also run the seeder with enforcement switched on.
"""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import content_seed, database, models
from app.seed import EXERCISES


CATALOGUE_IDS = {ex["id"] for ex in EXERCISES}

CONTENT_MODELS = [
    models.Exercise, models.Quote, models.Tip, models.Focus, models.Muscle,
    models.Stretch, models.ExerciseInfo, models.MetricDef, models.WeekDay,
    models.BodyMapShape, models.ExerciseMotion,
]


@pytest.fixture()
def fk_session():
    """Session on a fresh SQLite database that enforces foreign keys, the way
    PostgreSQL does in production."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _enforce_foreign_keys(dbapi_connection, _record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    database.Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _counts(db) -> dict[str, int]:
    return {m.__tablename__: db.query(m).count() for m in CONTENT_MODELS}


def test_exercise_catalogue_ids_are_unique():
    ids = [ex["id"] for ex in EXERCISES]
    assert len(ids) == len(set(ids))


def test_exercise_info_only_references_seeded_exercises():
    missing = sorted(set(content_seed.EXERCISE_INFO) - CATALOGUE_IDS)
    assert not missing, (
        "content_seed.EXERCISE_INFO references exercise ids that seed.EXERCISES "
        f"does not define: {missing}. Add the exercise to seed.py or drop the "
        "stale entry, otherwise the content seed fails its foreign key on startup."
    )


def test_seeded_exercises_use_known_muscles():
    muscle_ids = {mid for mid, _name, _group in content_seed.MUSCLES}
    unknown = {
        ex["id"]: sorted(set(ex["primary_muscles"] + ex["secondary_muscles"]) - muscle_ids)
        for ex in EXERCISES
        if set(ex["primary_muscles"] + ex["secondary_muscles"]) - muscle_ids
    }
    assert not unknown, f"Exercises reference muscle ids missing from content_seed.MUSCLES: {unknown}"


def test_seed_populates_every_content_table_on_empty_database(fk_session):
    content_seed.seed_if_empty(fk_session)

    counts = _counts(fk_session)
    assert counts["exercises"] == len(EXERCISES)
    assert counts["exercise_info"] == len(content_seed.EXERCISE_INFO)
    empty = sorted(table for table, n in counts.items() if n == 0)
    assert not empty, f"Content seed left tables empty: {empty}"


def test_seed_is_idempotent(fk_session):
    content_seed.seed_if_empty(fk_session)
    first = _counts(fk_session)

    content_seed.seed_if_empty(fk_session)

    assert _counts(fk_session) == first


def test_seed_adds_missing_exercises_before_exercise_info(fk_session):
    """An existing database whose catalogue pre-dates some exercises must get
    them before `exercise_info` rows that reference them are inserted."""
    referenced = set(content_seed.EXERCISE_INFO)
    fk_session.add_all([
        models.Exercise(**{"is_assisted": False, **ex})
        for ex in EXERCISES
        if ex["id"] not in referenced
    ])
    fk_session.commit()

    content_seed.seed_if_empty(fk_session)

    assert fk_session.query(models.Exercise).count() == len(EXERCISES)
    assert fk_session.query(models.ExerciseInfo).count() == len(content_seed.EXERCISE_INFO)
