// Biometric authentication via WebAuthn (Face ID / Touch ID / Android fingerprint).
// Stores a platform credential locally per user and gates access with userVerification.

const CRED_PREFIX = "biometric.cred.";
const ENABLED_PREFIX = "biometric.enabled.";
const SESSION_OK = "biometric.session.ok";

function b64urlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str: string): ArrayBuffer {
  const pad = str.length % 4 ? 4 - (str.length % 4) : 0;
  const s = (str + "=".repeat(pad)).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
function randomChallenge(n: number): ArrayBuffer {
  const buf = new ArrayBuffer(n);
  crypto.getRandomValues(new Uint8Array(buf));
  return buf;
}
function textBytes(s: string): ArrayBuffer {
  const enc = new TextEncoder().encode(s);
  const buf = new ArrayBuffer(enc.byteLength);
  new Uint8Array(buf).set(enc);
  return buf;
}

export function isBiometricSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.PublicKeyCredential !== "undefined"
    && typeof navigator.credentials?.create === "function"
    && typeof navigator.credentials?.get === "function";
}


export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isBiometricEnabled(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ENABLED_PREFIX + userId) === "1"
    && !!localStorage.getItem(CRED_PREFIX + userId);
}

export function markSessionVerified() {
  try { sessionStorage.setItem(SESSION_OK, "1"); } catch { /* noop */ }
}
export function isSessionVerified(): boolean {
  try { return sessionStorage.getItem(SESSION_OK) === "1"; } catch { return false; }
}
export function clearSessionVerified() {
  try { sessionStorage.removeItem(SESSION_OK); } catch { /* noop */ }
}

export async function enableBiometric(userId: string, email: string): Promise<void> {
  if (!isBiometricSupported()) throw new Error("Biometria não suportada neste dispositivo.");
  const available = await isPlatformAuthenticatorAvailable();
  if (!available) throw new Error("Nenhum autenticador biométrico disponível.");

  const challenge = randomChallenge(32);
  const userIdBytes = textBytes(userId);

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Controle de Diárias", id: window.location.hostname },
      user: {
        id: userIdBytes,
        name: email || userId,
        displayName: email || "Usuário",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Falha ao registrar biometria.");
  localStorage.setItem(CRED_PREFIX + userId, b64urlEncode(cred.rawId));
  localStorage.setItem(ENABLED_PREFIX + userId, "1");
  markSessionVerified();
}

export function disableBiometric(userId: string) {
  localStorage.removeItem(CRED_PREFIX + userId);
  localStorage.removeItem(ENABLED_PREFIX + userId);
  clearSessionVerified();
}

export async function verifyBiometric(userId: string): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  const credId = localStorage.getItem(CRED_PREFIX + userId);
  if (!credId) return false;
  const challenge = randomChallenge(32);
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [{ id: b64urlDecode(credId), type: "public-key" }],
        userVerification: "required",
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (assertion) {
      markSessionVerified();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
