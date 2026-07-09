const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY_FILE = path.join(__dirname, '.email-key');
const CRED_FILE = path.join(__dirname, 'email-credentials.enc');

function getOrCreateKey() {
    if (fs.existsSync(KEY_FILE)) {
        return fs.readFileSync(KEY_FILE);
    }
    const key = crypto.randomBytes(32);
    fs.writeFileSync(KEY_FILE, key, { mode: 0o600 });
    return key;
}

function encrypt(plaintext) {
    const key = getOrCreateKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(payloadBase64) {
    const key = getOrCreateKey();
    const payload = Buffer.from(payloadBase64, 'base64');
    const iv = payload.subarray(0, 12);
    const authTag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function saveEmailPassword(plainPassword) {
    fs.writeFileSync(CRED_FILE, encrypt(plainPassword), { mode: 0o600 });
}

function loadEmailPassword() {
    if (!fs.existsSync(CRED_FILE)) {
        throw new Error('No email credentials found. Run "node setup-email.js" first to store the Gmail App Password.');
    }
    return decrypt(fs.readFileSync(CRED_FILE, 'utf8'));
}

function hasEmailPassword() {
    return fs.existsSync(CRED_FILE);
}

module.exports = { saveEmailPassword, loadEmailPassword, hasEmailPassword };
