# Fresh Machine Setup

Steps to clone this bot onto a **new machine** with a clean WhatsApp session and a
fresh, locally-encrypted Gmail App Password — nothing sensitive is ever copied
between machines or committed to git.

Run these commands in order, in a terminal, from wherever you want the project folder to live.

## 0. Stop the old instance first

Before linking WhatsApp on the new machine, stop the bot wherever it's currently
running (old laptop, old folder, etc.) — two instances of this bot both linked to
the same WhatsApp account will both try to answer the same messages, causing
duplicate/conflicting replies.

**On the old machine**, find and stop the process (a plain `kill`, not `-9`, so it
shuts down the browser cleanly):

```bash
pgrep -fl "node bot.js"
kill <pid>
```

**On your phone**, also remove the old linked session so it can't keep answering
in the background even if the process wasn't stopped cleanly:

WhatsApp → Settings → Linked Devices → tap the old bot's device entry → **Log out**.

## 1. Prerequisites on the new machine

- [Node.js](https://nodejs.org) 18 or newer (`node -v` to check)
- **Google Chrome installed** — the bot always drives your system Chrome via
  `chrome-launcher`; it does not use Puppeteer's own bundled Chromium (that
  download is skipped entirely in step 3, since it's been unreliable)
- A phone with WhatsApp, ready to scan a QR code
- A Gmail account with **2-Step Verification enabled**, so you can generate an
  **App Password** (regular Gmail passwords don't work for SMTP)

## 2. Clone the repository

```bash
git clone https://github.com/theshirish/WA-BOT-Gmail.git
cd WA-BOT-Gmail
```

If the latest fixes haven't been merged into `main` yet, switch to the branch that has them:

```bash
git checkout Dev
```

## 3. Install dependencies

```bash
PUPPETEER_SKIP_DOWNLOAD=true npm install
```

Always use the `PUPPETEER_SKIP_DOWNLOAD=true` flag. Without it, Puppeteer tries to
download its own bundled Chromium during install, which fails on some networks/machines
with an error like:

```
Error: ERROR: Failed to set up chrome-headless-shell ...! Set "PUPPETEER_SKIP_DOWNLOAD" env variable to skip download.
```

When that happens, `npm install` aborts partway through and leaves `node_modules`
incomplete — which shows up later as a confusing, unrelated-looking error like
`Cannot find module 'dotenv'` when you try to run the bot. The bot never uses
Puppeteer's bundled browser anyway (it always uses your system Chrome from
step 1), so this download isn't needed. If you ever hit that error:

```bash
rm -rf node_modules
PUPPETEER_SKIP_DOWNLOAD=true npm install
```

## 4. Configure business details

```bash
cp .env.example .env
```

Then edit `.env` with this machine's real values (any text editor):

```
BUSINESS_NAME=Your Business Name
BUSINESS_CITY=Your City
BUSINESS_ADDRESS=Your full address
MAPS_URL=https://maps.google.com/...
CATALOG_URL=https://your-catalog-link
GMAIL_USER=your-business-gmail@gmail.com
```

`.env` is gitignored — it stays local to this machine and is never committed.

## 5. Set up a fresh Gmail App Password (encrypted, this machine only)

Generate an App Password for the Gmail account (requires 2-Step Verification):
https://myaccount.google.com/apppasswords

Then store it locally, encrypted:

```bash
node setup-email.js
```

This prompts for the 16-character App Password with masked input and saves it
AES-256-GCM encrypted into `.email-key` / `email-credentials.enc` — both
gitignored, both unique to this machine. The plaintext password is never
printed, logged, or committed.

## 6. Start the bot and link WhatsApp fresh

```bash
npm start
```

Since this is a new machine, there's no existing WhatsApp session, so a QR code
appears — both in the terminal and saved as `qr.png` in the project folder (useful
if the terminal QR renders too small/garbled to scan).

Scan it from your phone: **WhatsApp → Settings → Linked Devices → Link a Device**.

Wait for:

```
Bot is online for <Your Business Name>.
```

## 7. Verify

The startup log prints the active config before anything else — confirm it
shows the values you expect:

```
--- Bot configuration ---
Business Name  : ...
Catalog URL    : ...
Gmail User     : ...
Email sending  : enabled (credentials found)
-------------------------
```

Then send the bot a WhatsApp message from your phone: `hi`, then try each menu
option (`1`–`4`) to confirm replies, the callback lead capture, and the
catalog-via-email flow all work.

## Stopping the bot

`Ctrl+C` in the terminal — this triggers a graceful shutdown (closes the browser
cleanly) rather than leaving an orphaned process that would block the next start.

## Troubleshooting

**"Another instance of this bot is already running..."**
Something on this machine still holds the WhatsApp session lock. Find and stop it:
```bash
pgrep -fl "node bot.js"
kill <pid>
```

**QR code never appears / bot hangs after "Detected Chrome at..."**
The bot has a built-in 45-second watchdog: if no QR/ready event fires, it
assumes the saved session is corrupted, clears it, and retries automatically.
If it still doesn't recover, stop the bot and delete the session folder manually:
```bash
rm -rf .wwebjs_auth
```

**Email sending shows "DISABLED" at startup**
Re-run `node setup-email.js` — the encrypted credential files weren't found.

**`Error: Cannot find module 'dotenv'` (or any other module) when starting the bot**
`npm install` didn't actually finish — almost always because Puppeteer's bundled-Chromium
download failed partway through (see step 3) and npm aborted before installing everything.
Fix:
```bash
rm -rf node_modules
PUPPETEER_SKIP_DOWNLOAD=true npm install
```
