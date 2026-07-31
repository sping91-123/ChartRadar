import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import type { ExchangeCredentialInput, ExchangeProvider } from "@/lib/exchangeJournal";

export interface EncryptedExchangeCredentials {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: 1;
}

const algorithm = "aes-256-gcm";

function decodeCanonicalBase64Key(value: string) {
  if (!value) return null;
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32 || decoded.toString("base64") !== value) return null;
  return decoded;
}

export function exchangeCredentialEncryptionConfigurationError() {
  const encoded = process.env.EXCHANGE_CREDENTIAL_ENCRYPTION_KEY_V1?.trim() ?? "";
  if (!encoded) return "credential_encryption_not_configured";
  const key = decodeCanonicalBase64Key(encoded);
  if (!key) return "credential_encryption_invalid";

  const appleEncoded = process.env.APPLE_TOKEN_ENCRYPTION_KEY?.trim() ?? "";
  const appleKey = decodeCanonicalBase64Key(appleEncoded);
  if (appleKey && timingSafeEqual(key, appleKey)) {
    return "credential_encryption_key_reused";
  }
  return null;
}

function encryptionKey() {
  const error = exchangeCredentialEncryptionConfigurationError();
  if (error) throw new ExchangeCredentialEncryptionError(error);
  return Buffer.from(process.env.EXCHANGE_CREDENTIAL_ENCRYPTION_KEY_V1!.trim(), "base64");
}

function credentialAad(connectionId: string, userId: string, provider: ExchangeProvider, keyVersion = 1) {
  return Buffer.from(`exchange-credential:${keyVersion}:${userId}:${connectionId}:${provider}`, "utf8");
}

function normalizedCredentialInput(input: ExchangeCredentialInput) {
  const apiKey = input.apiKey.trim();
  const secret = input.secret.trim();
  const passphrase = input.passphrase?.trim() ?? "";
  if (apiKey.length < 6 || apiKey.length > 256 || secret.length < 8 || secret.length > 512 || passphrase.length > 256) {
    throw new ExchangeCredentialEncryptionError("credential_shape_invalid");
  }
  return { apiKey, secret, ...(passphrase ? { passphrase } : {}) };
}

export function encryptExchangeCredentials(
  connectionId: string,
  userId: string,
  provider: ExchangeProvider,
  input: ExchangeCredentialInput
): EncryptedExchangeCredentials {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, encryptionKey(), iv);
  cipher.setAAD(credentialAad(connectionId, userId, provider));
  const plaintext = Buffer.from(JSON.stringify(normalizedCredentialInput(input)), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: 1
  };
}

export function decryptExchangeCredentials(
  connectionId: string,
  userId: string,
  provider: ExchangeProvider,
  encrypted: EncryptedExchangeCredentials
): ExchangeCredentialInput {
  if (encrypted.keyVersion !== 1) throw new ExchangeCredentialEncryptionError("encryption_key_version_unsupported");
  try {
    const decipher = createDecipheriv(algorithm, encryptionKey(), Buffer.from(encrypted.iv, "base64"));
    decipher.setAAD(credentialAad(connectionId, userId, provider, encrypted.keyVersion));
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
      decipher.final()
    ]).toString("utf8");
    return normalizedCredentialInput(JSON.parse(plaintext) as ExchangeCredentialInput);
  } catch (error) {
    if (error instanceof ExchangeCredentialEncryptionError) throw error;
    throw new ExchangeCredentialEncryptionError("credential_decryption_failed");
  }
}

export function maskedApiKey(apiKey: string) {
  const value = apiKey.trim();
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

export function hashExchangeAccountUid(provider: ExchangeProvider, accountUid: string) {
  const value = accountUid.trim();
  if (!value) throw new ExchangeCredentialEncryptionError("account_uid_missing");
  return createHmac("sha256", encryptionKey())
    .update(`exchange-account:${provider}:${value}`)
    .digest("hex");
}

export class ExchangeCredentialEncryptionError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ExchangeCredentialEncryptionError";
  }
}
