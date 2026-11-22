"""Passkeys (WebAuthn).

A passkey signs a user in on its own: the device checks the person (a fingerprint, a
face, its PIN: user verification is required) and proves it holds the key, which only
answers on Gamgee's own address (``APP_BASE_URL``: its host is the RP ID, its origin the
only one accepted). The password stays as the other way in.

The cryptography is `webauthn` (py_webauthn). This module holds what is Gamgee's: which
site the passkeys belong to, and the options asked of the browser.
"""

import json
from datetime import timedelta
from urllib.parse import urlsplit

from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from .email_service import app_base_url

CHALLENGE_TTL = timedelta(minutes=5)
MAX_PASSKEYS = 10
NAME_MAX_LENGTH = 40
RP_NAME = "Gamgee"


class PasskeyRefused(Exception):
    """The browser's answer did not check out."""


def origin() -> str:
    """The app's own address: the only page a passkey answers on."""
    parts = urlsplit(app_base_url())
    return f"{parts.scheme}://{parts.netloc}"


def rp_id() -> str:
    return urlsplit(app_base_url()).hostname or "localhost"


def registration_options(user_id: int, username: str, display_name: str, existing: list[str]) -> tuple[dict, str]:
    """What to ask the browser for a new passkey, and the challenge to remember (base64url)."""
    options = generate_registration_options(
        rp_id=rp_id(),
        rp_name=RP_NAME,
        user_id=f"gamgee-user-{user_id}".encode(),
        user_name=username,
        user_display_name=display_name or username,
        # One passkey per device: the browser refuses a device that already holds one.
        exclude_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(c)) for c in existing],
        authenticator_selection=AuthenticatorSelectionCriteria(
            # Discoverable, so signing in needs no username; verified, so it is two factors.
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
    )
    return json.loads(options_to_json(options)), bytes_to_base64url(options.challenge)


def verify_registration(credential: dict, challenge: str) -> tuple[str, bytes, int]:
    """The new passkey's id (base64url), public key and counter, or PasskeyRefused."""
    try:
        checked = verify_registration_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(challenge),
            expected_rp_id=rp_id(),
            expected_origin=origin(),
            require_user_verification=True,
        )
    except Exception as error:  # The library raises several kinds; none of them is the user's to read.
        raise PasskeyRefused(str(error)) from error
    return bytes_to_base64url(checked.credential_id), checked.credential_public_key, checked.sign_count


def authentication_options() -> tuple[dict, str]:
    """What to ask the browser at sign-in (any passkey it holds for this site), and the challenge."""
    options = generate_authentication_options(rp_id=rp_id(), user_verification=UserVerificationRequirement.REQUIRED)
    return json.loads(options_to_json(options)), bytes_to_base64url(options.challenge)


def credential_id(credential: dict) -> str:
    """The id a browser's answer names, normalised to base64url without padding ('' when it has none)."""
    value = credential.get("id") if isinstance(credential, dict) else None
    if not isinstance(value, str) or not value or len(value) > 1400:
        return ""
    try:
        return bytes_to_base64url(base64url_to_bytes(value))
    except Exception:
        return ""


def verify_authentication(credential: dict, challenge: str, public_key: bytes, sign_count: int) -> int:
    """The passkey's new counter, or PasskeyRefused."""
    try:
        checked = verify_authentication_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(challenge),
            expected_rp_id=rp_id(),
            expected_origin=origin(),
            credential_public_key=public_key,
            credential_current_sign_count=sign_count,
            require_user_verification=True,
        )
    except Exception as error:
        raise PasskeyRefused(str(error)) from error
    return checked.new_sign_count
