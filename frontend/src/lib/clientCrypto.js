const PRIVATE_KEY_STORAGE_KEY = 'bugchain_owner_private_key';
const CLIENT_ENCRYPTION_SCHEME = 'CLIENT_RSA_AES_GCM';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBuffer(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function derivePassphraseKey(passphrase, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 210000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function generateOwnerEncryptionKeyPair(passphrase) {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Use a passphrase with at least 8 characters to protect the private key.');
  }

  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );

  const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await derivePassphraseKey(passphrase, salt);
  const encryptedPrivateKey = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    privateKey,
  );

  localStorage.setItem(
    PRIVATE_KEY_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      algorithm: 'RSA-OAEP-4096/AES-GCM',
      encryptedPrivateKey: bufferToBase64(encryptedPrivateKey),
      iv: bufferToBase64(iv),
      salt: bufferToBase64(salt),
    }),
  );

  return {
    publicKey: bufferToBase64(publicKey),
  };
}

export function hasStoredOwnerPrivateKey() {
  return Boolean(localStorage.getItem(PRIVATE_KEY_STORAGE_KEY));
}

export async function encryptReportForOwner(reportData, ownerPublicKeyBase64) {
  if (!ownerPublicKeyBase64) {
    throw new Error('Bounty owner has not published an encryption public key.');
  }

  const ownerPublicKey = await crypto.subtle.importKey(
    'spki',
    base64ToBuffer(ownerPublicKeyBase64),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );

  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(reportData));
  const encryptedContent = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedAesKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, ownerPublicKey, rawAesKey);

  return {
    encryptionScheme: CLIENT_ENCRYPTION_SCHEME,
    encryptedContent: bufferToBase64(encryptedContent),
    encryptedAesKey: bufferToBase64(encryptedAesKey),
    iv: bufferToBase64(iv),
  };
}

export async function decryptOwnerReport(encryptedReport, passphrase) {
  const stored = JSON.parse(localStorage.getItem(PRIVATE_KEY_STORAGE_KEY) || 'null');
  if (!stored) {
    throw new Error('This browser does not have the owner private key.');
  }

  const wrappingKey = await derivePassphraseKey(passphrase, new Uint8Array(base64ToBuffer(stored.salt)));
  const privateKeyPkcs8 = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(base64ToBuffer(stored.iv)) },
    wrappingKey,
    base64ToBuffer(stored.encryptedPrivateKey),
  );
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyPkcs8,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );
  const rawAesKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    base64ToBuffer(encryptedReport.encryptedAesKey),
  );
  const aesKey = await crypto.subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(base64ToBuffer(encryptedReport.iv)) },
    aesKey,
    base64ToBuffer(encryptedReport.encryptedContent),
  );

  return JSON.parse(decoder.decode(plaintext));
}
