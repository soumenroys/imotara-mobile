#!/usr/bin/env node
// Upload a ProGuard/R8 deobfuscation mapping file to Google Play Console.
//
// Usage:
//   node scripts/upload-android-mapping.js <path/to/mapping.txt> <versionCode>
//
// The mapping.txt can be extracted from an AAB via:
//   unzip -p release.aab BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map > mapping.txt
//
// Or from a local release build at:
//   android/app/build/outputs/mapping/release/mapping.txt

'use strict';
const fs     = require('fs');
const https  = require('https');
const crypto = require('crypto');

const PACKAGE_NAME         = 'com.imotara.imotara';
const SERVICE_ACCOUNT_PATH =
  '/Users/soumenroy/Documents/Imotara/Administrative Docs/imotara-651b778a7dbb.json';

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function req(method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const u   = new URL(url);
    const buf = Buffer.isBuffer(body) ? body : body ? Buffer.from(body) : Buffer.alloc(0);
    const r   = https.request(
      { method, hostname: u.hostname, path: u.pathname + u.search,
        headers: { 'Content-Length': buf.length, ...headers } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode} ${method} ${url}\n${text}`));
          } else {
            resolve(text);
          }
        });
      }
    );
    r.on('error', reject);
    if (buf.length) r.write(buf);
    r.end();
  });
}

async function getToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const hdr = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const pay = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  })).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${hdr}.${pay}`);
  const jwt = `${hdr}.${pay}.${sign.sign(sa.private_key).toString('base64url')}`;
  const res = await req('POST', 'https://oauth2.googleapis.com/token',
    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    { 'Content-Type': 'application/x-www-form-urlencoded' });
  return JSON.parse(res).access_token;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const [, , mappingPath, versionCodeArg] = process.argv;
  if (!mappingPath || !versionCodeArg) {
    console.error('Usage: node scripts/upload-android-mapping.js <mapping.txt> <versionCode>');
    console.error('Example: node scripts/upload-android-mapping.js mapping.txt 85');
    process.exit(1);
  }
  const versionCode = parseInt(versionCodeArg, 10);
  if (isNaN(versionCode)) {
    console.error('versionCode must be an integer');
    process.exit(1);
  }
  if (!fs.existsSync(mappingPath)) {
    console.error(`File not found: ${mappingPath}`);
    process.exit(1);
  }

  const mappingBuf = fs.readFileSync(mappingPath);
  console.log(`Mapping: ${mappingPath} (${(mappingBuf.length / 1024).toFixed(1)} KB)`);

  const sa    = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  const token = await getToken(sa);
  console.log('Authenticated.');

  const base   = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;
  const auth   = { Authorization: `Bearer ${token}` };

  // Create edit
  const edit   = JSON.parse(await req('POST', `${base}/edits`, '', { ...auth, 'Content-Type': 'application/json' }));
  console.log(`Edit created: ${edit.id}`);

  // Upload deobfuscation file
  const uploadUrl =
    `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE_NAME}` +
    `/edits/${edit.id}/apks/${versionCode}/deobfuscationFiles/proguard`;
  await req('POST', uploadUrl, mappingBuf, { ...auth, 'Content-Type': 'application/octet-stream' });
  console.log('Mapping uploaded.');

  // Commit edit
  await req('POST', `${base}/edits/${edit.id}:commit`, '', { ...auth, 'Content-Type': 'application/json' });
  console.log('Done. Mapping is now visible in Play Console for version code', versionCode);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
