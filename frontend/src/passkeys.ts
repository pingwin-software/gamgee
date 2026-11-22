/**
 * The browser"s side of a passkey (WebAuthn): the server sends its options as JSON with the
 * binary parts in base64url, and wants the browser"s answer back the same way.
 */

type Json = Record<string, unknown>

export function fromBase64Url(text: string): ArrayBuffer {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=")
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export function toBase64Url(buffer: ArrayBuffer): string {
  let binary = ""
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const descriptors = (list: unknown) =>
  (Array.isArray(list) ? list : []).map((item: Json) => ({ ...item, id: fromBase64Url(String(item.id)) })) as PublicKeyCredentialDescriptor[]

/** The server"s options for a new passkey, as the browser wants them. */
export function creationOptions(json: Json): PublicKeyCredentialCreationOptions {
  const user = json.user as Json
  return {
    ...(json as unknown as PublicKeyCredentialCreationOptions),
    challenge: fromBase64Url(String(json.challenge)),
    user: { ...(user as unknown as PublicKeyCredentialUserEntity), id: fromBase64Url(String(user.id)) },
    excludeCredentials: descriptors(json.excludeCredentials),
  }
}

/** The server"s options for signing in, as the browser wants them. */
export function requestOptions(json: Json): PublicKeyCredentialRequestOptions {
  return {
    ...(json as unknown as PublicKeyCredentialRequestOptions),
    challenge: fromBase64Url(String(json.challenge)),
    allowCredentials: descriptors(json.allowCredentials),
  }
}

/** The browser"s answer as JSON for the server. */
export function credentialJson(credential: PublicKeyCredential): Json {
  const response = credential.response as AuthenticatorAttestationResponse & AuthenticatorAssertionResponse
  const out: Json = { clientDataJSON: toBase64Url(response.clientDataJSON) }
  if (response.attestationObject) out.attestationObject = toBase64Url(response.attestationObject)
  if (response.authenticatorData) out.authenticatorData = toBase64Url(response.authenticatorData)
  if (response.signature) out.signature = toBase64Url(response.signature)
  if (response.userHandle) out.userHandle = toBase64Url(response.userHandle)
  return { id: credential.id, rawId: toBase64Url(credential.rawId), type: credential.type, response: out }
}

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function" && !!navigator.credentials
}

/** Thrown when the person closed the browser"s passkey prompt: nothing to report. */
export class PasskeyCancelled extends Error {}

function rethrow(error: unknown): never {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) throw new PasskeyCancelled()
  if (error instanceof DOMException && error.name === "InvalidStateError") throw new Error("This device already has a passkey for your account.")
  throw new Error("Your browser couldn't use a passkey here.")
}

export async function createPasskey(options: Json): Promise<Json> {
  try {
    const credential = await navigator.credentials.create({ publicKey: creationOptions(options) })
    if (!credential) throw new DOMException("", "NotAllowedError")
    return credentialJson(credential as PublicKeyCredential)
  } catch (error) {
    rethrow(error)
  }
}

export async function usePasskey(options: Json): Promise<Json> {
  try {
    const credential = await navigator.credentials.get({ publicKey: requestOptions(options) })
    if (!credential) throw new DOMException("", "NotAllowedError")
    return credentialJson(credential as PublicKeyCredential)
  } catch (error) {
    rethrow(error)
  }
}

/** A first name for a new passkey, from the device it is made on. */
export function suggestedName(userAgent: string): string {
  if (/iPhone/.test(userAgent)) return "iPhone"
  if (/iPad/.test(userAgent)) return "iPad"
  if (/Android/.test(userAgent)) return "Android phone"
  if (/Macintosh|Mac OS X/.test(userAgent)) return "Mac"
  if (/Windows/.test(userAgent)) return "Windows PC"
  if (/Linux/.test(userAgent)) return "Linux PC"
  return "Passkey"
}
