/**
 * Script para generar el Apple Client Secret (JWT)
 * Este secret se usa en Supabase para Sign in with Apple
 * 
 * IMPORTANTE: El secret expira en 6 meses, hay que regenerarlo periódicamente
 */

const crypto = require('crypto');

// ============ TUS DATOS ============
const TEAM_ID = 'K4TADJ2262';
const SERVICE_ID = 'com.ondeon.service'; // Client ID en Supabase
const KEY_ID = '5XC9Z7NYB3';

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg/SEp+sTFyR7TSAaq
Pj/nzu1M7HZ6ov2s+7OqZEWjDCOgCgYIKoZIzj0DAQehRANCAATKtkSQYgdwu91F
xlPVYurW4sHgdU6UIF/V+UhC/Hdug1UcSp4nF2rupIOb9eUUr0q4LL4F7xzvrTxR
C4dUvhZ8
-----END PRIVATE KEY-----`;
// ===================================

function generateAppleClientSecret() {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + (86400 * 180); // 180 días (6 meses)

  // Header
  const header = {
    alg: 'ES256',
    kid: KEY_ID,
    typ: 'JWT'
  };

  // Payload
  const payload = {
    iss: TEAM_ID,
    iat: now,
    exp: expiry,
    aud: 'https://appleid.apple.com',
    sub: SERVICE_ID
  };

  // Encode header and payload
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  // Create signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const sign = crypto.createSign('SHA256');
  sign.update(signatureInput);
  sign.end();

  const signature = sign.sign(PRIVATE_KEY);
  
  // Convert DER signature to raw format for ES256
  // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  const derToRaw = (derSig) => {
    let offset = 2; // Skip 0x30 and total length
    
    // Read r
    offset++; // Skip 0x02
    let rLength = derSig[offset++];
    let r = derSig.slice(offset, offset + rLength);
    offset += rLength;
    
    // Read s
    offset++; // Skip 0x02
    let sLength = derSig[offset++];
    let s = derSig.slice(offset, offset + sLength);
    
    // Pad or trim r and s to 32 bytes each
    const padTo32 = (buf) => {
      if (buf.length === 32) return buf;
      if (buf.length > 32) return buf.slice(buf.length - 32);
      const padded = Buffer.alloc(32);
      buf.copy(padded, 32 - buf.length);
      return padded;
    };
    
    return Buffer.concat([padTo32(r), padTo32(s)]);
  };

  const rawSignature = derToRaw(signature);
  const encodedSignature = rawSignature.toString('base64url');

  // Complete JWT
  const jwt = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

  return jwt;
}

// Generate and print the secret
const secret = generateAppleClientSecret();

console.log('\n========================================');
console.log('🍎 APPLE CLIENT SECRET GENERADO');
console.log('========================================\n');
console.log('Copia este valor en Supabase → Apple → Secret Key:\n');
console.log(secret);
console.log('\n========================================');
console.log('⚠️  Este secret expira en 6 meses');
console.log('    Fecha de expiración:', new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES'));
console.log('========================================\n');
