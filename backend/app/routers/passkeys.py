"""Passkeys: add, list, remove, and sign in with one (no password).

Mounted under ``/api/auth``. A sign-in by passkey ends in the same JWT as a
password login, so nothing downstream needs to know which door was used.
"""
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from .. import models, passkeys, ratelimit, schemas
from ..auth import create_access_token, get_current_user, verify_password
from ..database import get_db
from ..tokens import hash_token, now_utc

router = APIRouter(prefix="/auth", tags=["passkeys"])

PASSKEY_FAILED = "That passkey didn't work. Sign in with your password."
PASSKEY_NOT_ADDED = "That passkey couldn't be added. Try again."
PASSKEY_EXISTS = "That passkey is already added."
TOO_MANY_PASSKEYS = f"You can have up to {passkeys.MAX_PASSKEYS} passkeys. Remove one first."
TOO_MANY_TRIES = "Too many tries. Wait a few minutes and try again."

# Sign-ins that may be waiting for their answer at once: each is a row, and anyone can ask.
SIGN_INS_WAITING = 500


class PasskeyOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    last_used_at: datetime | None = None

    model_config = {"from_attributes": True}


class PasskeyStart(BaseModel):
    """Adding a passkey asks for the password again: a borrowed session must
    not leave a key behind."""
    current_password: str = Field(max_length=128)


class PasskeyOptions(BaseModel):
    token: str
    options: dict


class PasskeyAnswer(BaseModel):
    token: str = Field(max_length=128)
    credential: dict

    @field_validator("credential")
    @classmethod
    def _small(cls, value: dict) -> dict:
        if len(str(value)) > 20_000:
            raise ValueError("That passkey is too large.")
        return value


class PasskeyCreate(PasskeyAnswer):
    name: str = Field(default="", max_length=passkeys.NAME_MAX_LENGTH)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _new_challenge(db: Session, challenge: str, user_id: int | None) -> str:
    """Remember a ceremony's challenge; the token goes to the browser."""
    rows = db.query(models.PasskeyChallenge)
    rows.filter(models.PasskeyChallenge.expires_at <= now_utc()).delete(synchronize_session=False)
    token = secrets.token_urlsafe(32)
    db.add(models.PasskeyChallenge(
        token_hash=hash_token(token),
        user_id=user_id,
        challenge=challenge,
        expires_at=now_utc() + passkeys.CHALLENGE_TTL,
    ))
    db.commit()
    return token


def _take_challenge(db: Session, token: str, user_id: int | None) -> str | None:
    """The challenge behind a token, used up by the asking (each works once), or None."""
    row = db.get(models.PasskeyChallenge, hash_token(token)) if token else None
    if row is None or row.user_id != user_id:
        return None
    live = _aware(row.expires_at) > now_utc()
    challenge = row.challenge
    taken = (
        db.query(models.PasskeyChallenge)
        .filter(models.PasskeyChallenge.token_hash == row.token_hash)
        .delete(synchronize_session=False)
    )
    db.commit()
    return challenge if live and taken == 1 else None


def _user_passkeys(db: Session, user_id: int) -> list[models.Passkey]:
    return (
        db.query(models.Passkey)
        .filter(models.Passkey.user_id == user_id)
        .order_by(models.Passkey.id)
        .all()
    )


# ── Signing in ───────────────────────────────────────────────────────────────

@router.post("/passkey-login/options", response_model=PasskeyOptions)
def passkey_login_options(db: Session = Depends(get_db)):
    """Start a sign-in by passkey: no username, the browser offers the passkeys
    it holds for Gamgee."""
    waiting = db.query(models.PasskeyChallenge).filter(
        models.PasskeyChallenge.user_id.is_(None),
        models.PasskeyChallenge.expires_at > now_utc(),
    ).count()
    if waiting >= SIGN_INS_WAITING or ratelimit.passkey_failures.full("*"):
        raise HTTPException(status_code=429, detail=TOO_MANY_TRIES)
    options, challenge = passkeys.authentication_options()
    return PasskeyOptions(token=_new_challenge(db, challenge, None), options=options)


@router.post("/passkey-login", response_model=schemas.Token)
def passkey_login(body: PasskeyAnswer, db: Session = Depends(get_db)):
    if ratelimit.passkey_failures.full("*"):
        raise HTTPException(status_code=429, detail=TOO_MANY_TRIES)
    challenge = _take_challenge(db, body.token, None)
    credential_id = passkeys.credential_id(body.credential)
    passkey = (
        db.query(models.Passkey).filter(models.Passkey.credential_id == credential_id).first()
        if challenge and credential_id else None
    )
    user = db.get(models.User, passkey.user_id) if passkey is not None else None
    count = None
    if user is not None:
        try:
            count = passkeys.verify_authentication(
                body.credential, challenge, passkey.public_key, passkey.sign_count,
            )
        except passkeys.PasskeyRefused:
            count = None
    if count is None:
        ratelimit.passkey_failures.hit("*")
        raise HTTPException(status_code=401, detail=PASSKEY_FAILED)
    passkey.sign_count = count
    passkey.last_used_at = now_utc()
    db.commit()
    return {"access_token": create_access_token({"sub": user.username}), "token_type": "bearer"}


# ── Managing your own ────────────────────────────────────────────────────────

@router.get("/passkeys", response_model=list[PasskeyOut])
def list_passkeys(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _user_passkeys(db, current_user.id)


@router.post("/passkeys/options", response_model=PasskeyOptions)
def passkey_options(
    body: PasskeyStart,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if ratelimit.password_checks.full(current_user.id):
        raise HTTPException(status_code=429, detail=TOO_MANY_TRIES)
    if not verify_password(body.current_password, current_user.hashed_password):
        ratelimit.password_checks.hit(current_user.id)
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    existing = _user_passkeys(db, current_user.id)
    if len(existing) >= passkeys.MAX_PASSKEYS:
        raise HTTPException(status_code=409, detail=TOO_MANY_PASSKEYS)
    options, challenge = passkeys.registration_options(
        current_user.id,
        current_user.username,
        current_user.name or current_user.username,
        [p.credential_id for p in existing],
    )
    return PasskeyOptions(token=_new_challenge(db, challenge, current_user.id), options=options)


@router.post("/passkeys", response_model=PasskeyOut, status_code=201)
def add_passkey(
    body: PasskeyCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    challenge = _take_challenge(db, body.token, current_user.id)
    if challenge is None:
        raise HTTPException(status_code=400, detail=PASSKEY_NOT_ADDED)
    try:
        credential_id, public_key, sign_count = passkeys.verify_registration(body.credential, challenge)
    except passkeys.PasskeyRefused:
        raise HTTPException(status_code=400, detail=PASSKEY_NOT_ADDED)
    if db.query(models.Passkey).filter(models.Passkey.credential_id == credential_id).first():
        raise HTTPException(status_code=409, detail=PASSKEY_EXISTS)
    if len(_user_passkeys(db, current_user.id)) >= passkeys.MAX_PASSKEYS:
        raise HTTPException(status_code=409, detail=TOO_MANY_PASSKEYS)
    passkey = models.Passkey(
        user_id=current_user.id,
        credential_id=credential_id,
        public_key=public_key,
        sign_count=sign_count,
        name=body.name.strip() or "Passkey",
        created_at=now_utc(),
    )
    db.add(passkey)
    db.commit()
    db.refresh(passkey)
    return passkey


@router.delete("/passkeys/{passkey_id}", status_code=204)
def remove_passkey(
    passkey_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    passkey = db.get(models.Passkey, passkey_id)
    if passkey is None or passkey.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="We couldn't find that passkey.")
    db.delete(passkey)
    db.commit()
