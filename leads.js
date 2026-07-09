const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.join(__dirname, 'leads.csv');
const COLUMNS = ['timestamp', 'phone', 'name', 'pushname', 'is_business', 'saved_contact', 'message'];
const HEADER = COLUMNS.join(',');

function csvEscape(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function istTimestamp(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} IST`;
}

function ensureFile() {
    if (!fs.existsSync(LEADS_FILE)) {
        fs.writeFileSync(LEADS_FILE, HEADER + '\n');
        return;
    }

    // If an older version of the bot already wrote a file with fewer columns,
    // keep that data intact but move it aside so the new column layout stays consistent.
    const firstLine = fs.readFileSync(LEADS_FILE, 'utf8').split('\n', 1)[0].trim();
    if (firstLine !== HEADER) {
        const backupPath = path.join(__dirname, `leads.legacy-${Date.now()}.csv`);
        fs.renameSync(LEADS_FILE, backupPath);
        fs.writeFileSync(LEADS_FILE, HEADER + '\n');
        console.log(`Lead file columns changed — old leads moved to ${backupPath}`);
    }
}

function saveLead({ phone, name = '', pushname = '', isBusiness = false, isMyContact = false, message = '' }) {
    ensureFile();
    const row = [
        istTimestamp(),
        phone,
        name,
        pushname,
        isBusiness,
        isMyContact,
        message,
    ].map(csvEscape).join(',') + '\n';
    fs.appendFileSync(LEADS_FILE, row);
}

module.exports = { saveLead };
