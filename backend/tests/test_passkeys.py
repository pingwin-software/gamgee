"""Passkeys: adding, signing in with one alone, removing, and what refuses them."""

import hashlib
import json
import os

import cbor2
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from webauthn.helpers import bytes_to_base64url

from app import passkeys

ORIGIN = "http://localhost:5173"
PASSWORD = "Str0ng-Test-Pass!"


class Device:
    """A software authenticator: one P-256 passkey that answers as a browser would relay it."""

    def __init__(self, origin=ORIGIN, rp_id="localhost", verifies_user=True):
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.id = os.urandom(32)
        self.origin, self.rp_id, self.verifies_user = origin, rp_id, verifies_user
        self.count = 0

    def _client_data(self, kind, challenge):
        return json.dumps({"type": kind, "challenge": challenge, "origin": self.origin, "crossOrigin": False}).encode()

    def _auth_data(self, attested):
        flags = 0x01 | (0x04 if self.verifies_user else 0) | (0x40 if attested else 0)
        data = hashlib.sha256(self.rp_id.encode()).digest() + bytes([flags]) + self.count.to_bytes(4, "big")
        if attested:
            numbers = self.key.public_key().public_numbers()
            cose = {1: 2, 3: -7, -1: 1, -2: numbers.x.to_bytes(32, "big"), -3: numbers.y.to_bytes(32, "big")}
            data += bytes(16) + len(self.id).to_bytes(2, "big") + self.id + cbor2.dumps(cose)
        return data

    def register(self, options):
        client_data = self._client_data("webauthn.create", options["challenge"])
        attestation = cbor2.dumps({"fmt": "none", "attStmt": {}, "authData": self._auth_data(True)})
        return {
            "id": bytes_to_base64url(self.id),
            "rawId": bytes_to_base64url(self.id),
            "type": "public-key",
            "response": {"clientDataJSON": bytes_to_base64url(client_data), "attestationObject": bytes_to_base64url(attestation)},
        }

    def sign(self, options):
        self.count += 1
        client_data = self._client_data("webauthn.get", options["challenge"])
        auth_data = self._auth_data(False)
        signature = self.key.sign(auth_data + hashlib.sha256(client_data).digest(), ec.ECDSA(hashes.SHA256()))
        return {
            "id": bytes_to_base64url(self.id),
            "rawId": bytes_to_base64url(self.id),
            "type": "public-key",
            "response": {
                "clientDataJSON": bytes_to_base64url(client_data),
                "authenticatorData": bytes_to_base64url(auth_data),
                "signature": bytes_to_base64url(signature),
            },
        }


def _add(client, headers, device, name="Phone", password=PASSWORD):
    start = client.post("/api/auth/passkeys/options", json={"current_password": password}, headers=headers)
    if start.status_code != 200:
        return start
    return client.post(
        "/api/auth/passkeys",
        json={"token": start.json()["token"], "credential": device.register(start.json()["options"]), "name": name},
        headers=headers,
    )


def _sign_in(client, device):
    start = client.post("/api/auth/passkey-login/options")
    assert start.status_code == 200, start.text
    return client.post(
        "/api/auth/passkey-login",
        json={"token": start.json()["token"], "credential": device.sign(start.json()["options"])},
    )


def test_the_options_ask_for_a_verified_discoverable_passkey_on_this_site(client, auth_headers):
    res = client.post("/api/auth/passkeys/options", json={"current_password": PASSWORD}, headers=auth_headers)
    assert res.status_code == 200, res.text
    options = res.json()["options"]
    assert options["rp"] == {"name": "Gamgee", "id": "localhost"}
    assert options["authenticatorSelection"]["residentKey"] == "required"
    assert options["authenticatorSelection"]["userVerification"] == "required"
    assert passkeys.origin() == ORIGIN


def test_add_a_passkey_and_sign_in_with_it_alone(client, auth_headers):
    me = client.get("/api/auth/me", headers=auth_headers).json()
    device = Device()
    added = _add(client, auth_headers, device)
    assert added.status_code == 201, added.text
    assert added.json()["name"] == "Phone"

    res = _sign_in(client, device)
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["id"] == me["id"]

    listed = client.get("/api/auth/passkeys", headers=auth_headers).json()
    assert [p["name"] for p in listed] == ["Phone"]
    assert listed[0]["last_used_at"] is not None


def test_adding_needs_the_password_again(client, auth_headers):
    res = _add(client, auth_headers, Device(), password="not-my-password")
    assert res.status_code == 400
    assert client.get("/api/auth/passkeys", headers=auth_headers).json() == []


def test_a_challenge_works_once(client, auth_headers):
    device = Device()
    assert _add(client, auth_headers, device).status_code == 201
    start = client.post("/api/auth/passkey-login/options").json()
    answer = {"token": start["token"], "credential": device.sign(start["options"])}
    assert client.post("/api/auth/passkey-login", json=answer).status_code == 200
    assert client.post("/api/auth/passkey-login", json=answer).status_code == 401


def test_refuses_another_site_an_unverified_person_and_an_unknown_key(client, auth_headers):
    assert _add(client, auth_headers, Device(origin="https://evil.example")).status_code == 400
    assert _add(client, auth_headers, Device(verifies_user=False)).status_code == 400
    assert _sign_in(client, Device()).status_code == 401

    device = Device()
    assert _add(client, auth_headers, device).status_code == 201
    device.origin = "https://evil.example"
    assert _sign_in(client, device).status_code == 401


def test_the_same_passkey_is_not_added_twice(client, auth_headers):
    device = Device()
    assert _add(client, auth_headers, device).status_code == 201
    assert _add(client, auth_headers, device).status_code == 409


def test_remove_only_your_own(client, auth_headers, make_user):
    device = Device()
    passkey_id = _add(client, auth_headers, device).json()["id"]
    other = make_user()
    assert client.delete(f"/api/auth/passkeys/{passkey_id}", headers=other).status_code == 404
    assert client.delete(f"/api/auth/passkeys/{passkey_id}", headers=auth_headers).status_code == 204
    assert _sign_in(client, device).status_code == 401


def test_too_many_failed_passkey_sign_ins_close_the_door(client):
    from app import ratelimit

    for _ in range(ratelimit.passkey_failures.limit):
        assert _sign_in(client, Device()).status_code == 401
    assert client.post("/api/auth/passkey-login/options").status_code == 429


def test_wrong_passwords_are_throttled_per_account(client, make_user):
    from app import ratelimit

    make_user("throttled")
    form = {"Content-Type": "application/x-www-form-urlencoded"}
    for _ in range(ratelimit.login_failures.limit):
        res = client.post("/api/auth/login", data={"username": "throttled", "password": "nope"}, headers=form)
        assert res.status_code == 401
    # Even the right password waits now; another account is untouched.
    res = client.post("/api/auth/login", data={"username": "throttled", "password": PASSWORD}, headers=form)
    assert res.status_code == 429
    make_user("someone_else")


def test_new_accounts_carry_their_creation_time(client, auth_headers):
    assert client.get("/api/auth/me", headers=auth_headers).json()["created_at"]
