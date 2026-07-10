const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const ChromeLauncher = require('chrome-launcher');
const config = require('./config');
const { saveLead } = require('./leads');
const { sendCatalogEmail } = require('./mailer');
const { hasEmailPassword } = require('./credentials');

const QR_IMAGE_PATH = path.join(__dirname, 'qr.png');
const SESSION_DIR = path.join(__dirname, '.wwebjs_auth');
const BOOT_TIMEOUT_MS = 45_000; // if no qr/ready by then, the saved session is likely corrupted

function printStartupConfig() {
    console.log('--- Bot configuration ---');
    console.log(`Business Name  : ${config.businessName}`);
    console.log(`City           : ${config.city}`);
    console.log(`Address        : ${config.address}`);
    console.log(`Maps URL       : ${config.mapsUrl}`);
    console.log(`Catalog URL    : ${config.catalogUrl}`);
    console.log(`Gmail User     : ${config.gmailUser}`);
    console.log(`Greeting words : ${config.greetingKeywords.join(', ')}`);
    console.log(`Email sending  : ${hasEmailPassword() ? 'enabled (credentials found)' : 'DISABLED — run "node setup-email.js"'}`);
    console.log('-------------------------');
}
printStartupConfig();

// Use the system Chrome if we can find one (faster startup, no extra download).
// Fall back to the Chromium bundled with puppeteer otherwise.
const chromePath = ChromeLauncher.Launcher.getFirstInstallation();
console.log(chromePath ? `Detected Chrome at: ${chromePath}` : 'No system Chrome found, using bundled Chromium.');

// On multi-device WhatsApp, msg.from can be a LID (e.g. "135669561212928@lid")
// instead of the real phone number. whatsapp-web.js resolves the real number
// onto contact.id (server becomes 'c.us') when it can, but leaves the LID
// value on contact.number — so contact.id.user is the field to trust here.
function extractPhoneNumber(contact, msg) {
    if (contact.id && contact.id.server === 'c.us' && contact.id.user) {
        return contact.id.user;
    }
    if (contact.number) return contact.number;
    return msg.from.split('@')[0];
}

async function resolveContactInfo(msg) {
    try {
        const contact = await msg.getContact();
        return {
            phone: extractPhoneNumber(contact, msg),
            name: contact.name || '',
            pushname: contact.pushname || '',
            isBusiness: !!contact.isBusiness,
            isMyContact: !!contact.isMyContact,
        };
    } catch (err) {
        console.error('Could not resolve contact info:', err);
        return {
            phone: msg.from.split('@')[0],
            name: '',
            pushname: '',
            isBusiness: false,
            isMyContact: false,
        };
    }
}

function buildWelcomeMessage() {
    return (
        `*Vanakkam!* 🙏 Welcome to ${config.businessName}, ${config.city}.\n\n` +
        `Please reply with the digit of your choice:\n\n` +
        `*1* 📄 View Product Catalog / Price List\n` +
        `*2* 📍 Get Office/Shop Location\n` +
        `*3* 📞 Request a Callback from Sales Team\n` +
        `*4* 📧 Get Catalog via Email`
    );
}

const menuHandlers = {
    '1': async (msg) => {
        await msg.reply(`📄 Here is our latest catalog: ${config.catalogUrl}`);
    },
    '2': async (msg) => {
        await msg.reply(`📍 *Our Address:* ${config.address}\n🗺️ *Google Maps:* ${config.mapsUrl}`);
    },
    '3': async (msg, contactInfo) => {
        await msg.reply(`✅ Thank you! Our team will call you shortly on +${contactInfo.phone}.`);
        saveLead({ ...contactInfo, message: msg.body });
        const label = contactInfo.name || contactInfo.pushname || 'unknown name';
        console.log(`LEAD CAPTURED: callback requested by +${contactInfo.phone} (${label})`);
    },
    '4': async (msg, contactInfo) => {
        setAwaitingEmail(contactInfo.phone);
        await msg.reply(`📧 Sure! Please reply with the email address where we should send the catalog.`);
    },
};

// Tracks phone numbers who were just asked for an email address (option 4),
// so their next message is treated as an email reply instead of a menu command.
const EMAIL_REQUEST_TTL_MS = 15 * 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pendingEmailRequests = new Map();

function setAwaitingEmail(phone) {
    pendingEmailRequests.set(phone, Date.now() + EMAIL_REQUEST_TTL_MS);
}

function clearAwaitingEmail(phone) {
    pendingEmailRequests.delete(phone);
}

function isAwaitingEmail(phone) {
    const expiresAt = pendingEmailRequests.get(phone);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
        pendingEmailRequests.delete(phone);
        return false;
    }
    return true;
}

async function handleEmailReply(msg, contactInfo, rawText) {
    const email = rawText.trim();

    if (!EMAIL_REGEX.test(email)) {
        await msg.reply(
            `That doesn't look like a valid email address. Please send a valid email ` +
            `(e.g. name@example.com), or type *hi* to go back to the menu.`
        );
        return;
    }

    try {
        await sendCatalogEmail(email);
        clearAwaitingEmail(contactInfo.phone);
        await msg.reply(`✅ Catalog sent to ${email}. Please check your inbox (and spam folder).`);
        console.log(`CATALOG EMAILED to ${email} for +${contactInfo.phone}`);
    } catch (err) {
        console.error('Failed to send catalog email:', err);
        clearAwaitingEmail(contactInfo.phone);
        await msg.reply(`Sorry, something went wrong sending the email. Please try again later or type *hi* for other options.`);
    }
}

function createClient() {
    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            ...(chromePath && { executablePath: chromePath }),
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions'],
        },
    });

    client.on('qr', async (qr) => {
        bootSignalReceived = true;
        console.log('--- SCAN THIS QR CODE WITH YOUR WHATSAPP (Linked Devices > Link a Device) ---');
        qrcodeTerminal.generate(qr, { small: false });

        // Terminal QR codes can be clipped or distorted by small windows/fonts.
        // Save a PNG too, so it can be scanned reliably from an image viewer.
        try {
            await qrcode.toFile(QR_IMAGE_PATH, qr, { width: 400 });
            console.log(`If the terminal QR won't scan, open this file instead: ${QR_IMAGE_PATH}`);
        } catch (err) {
            console.error('Could not save QR image:', err);
        }
    });

    client.on('ready', () => {
        bootSignalReceived = true;
        console.log(`Bot is online for ${config.businessName}.`);
        fs.unlink(QR_IMAGE_PATH, () => {});
    });

    client.on('auth_failure', (msg) => {
        console.error('Authentication failed:', msg);
    });

    client.on('disconnected', (reason) => {
        console.error('Client disconnected:', reason, '- reinitializing...');
        client.initialize();
    });

    client.on('message', async (msg) => {
        try {
            // Ignore groups, status broadcasts and our own outgoing messages
            if (msg.from.includes('@g.us') || msg.isStatus || msg.fromMe) return;

            const incomingText = msg.body.trim().toLowerCase();
            const contactInfo = await resolveContactInfo(msg);

            console.log(`Message from ${contactInfo.phone}: "${msg.body}"`);

            if (config.greetingKeywords.includes(incomingText)) {
                clearAwaitingEmail(contactInfo.phone);
                await msg.reply(buildWelcomeMessage());
                return;
            }

            if (isAwaitingEmail(contactInfo.phone)) {
                await handleEmailReply(msg, contactInfo, msg.body);
                return;
            }

            const handler = menuHandlers[incomingText];
            if (handler) {
                await handler(msg, contactInfo);
                return;
            }

            await msg.reply(`Sorry, I didn't understand that. Type *hi* to see the menu.`);
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    return client;
}

// A force-killed process (crash, kill -9, closed terminal) can leave the Chrome
// profile in a state where the page hangs forever with no 'qr' or 'ready' event
// and no error. Track whether either fired, and if not, wipe the saved session
// and retry once — this is the same fix as manually deleting .wwebjs_auth.
let bootSignalReceived = false;
let currentClient = null;

async function boot(allowRetry = true) {
    bootSignalReceived = false;
    currentClient = createClient();

    try {
        await currentClient.initialize();
    } catch (err) {
        if (String(err.message).includes('already running for')) {
            console.error(
                '\nAnother instance of this bot is already running and holding the WhatsApp ' +
                'session lock (that other process is the one actually answering messages right ' +
                'now, likely with outdated code/config). Find and stop it first:\n' +
                '  pgrep -fl "node bot.js"   (lists the PID and its working directory)\n' +
                '  kill <pid>                (NOT kill -9 — let it shut down cleanly)\n' +
                'Then run "npm start" again.\n'
            );
        } else {
            console.error('Failed to start WhatsApp client:', err);
        }
        process.exit(1);
    }

    setTimeout(async () => {
        if (bootSignalReceived) return;

        if (!allowRetry) {
            console.error(
                `Still no QR code after ${BOOT_TIMEOUT_MS / 1000}s. Stop the bot, delete the ` +
                `${SESSION_DIR} folder manually, and try again.`
            );
            return;
        }

        console.warn(
            `No QR code after ${BOOT_TIMEOUT_MS / 1000}s — saved session looks corrupted ` +
            `(likely from an unclean shutdown). Clearing it and retrying...`
        );
        try {
            await currentClient.destroy();
        } catch {
            // ignore — browser may already be unresponsive
        }
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        boot(false);
    }, BOOT_TIMEOUT_MS);
}

async function shutdown() {
    console.log('\nShutting down bot...');
    if (currentClient) await currentClient.destroy().catch(() => {});
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

boot();
