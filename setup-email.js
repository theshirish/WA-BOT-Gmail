const readline = require('readline');
const config = require('./config');
const { saveEmailPassword } = require('./credentials');

function askMasked(query) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl._writeToOutput = (chunk) => {
            rl.output.write(chunk.trim() === query.trim() ? chunk : '*');
        };
        rl.question(query, (value) => {
            rl.close();
            process.stdout.write('\n');
            resolve(value.trim());
        });
    });
}

(async () => {
    console.log(`This stores a Gmail App Password (encrypted on disk) for ${config.gmailUser}.`);
    console.log('Generate one at https://myaccount.google.com/apppasswords');
    console.log('(requires 2-Step Verification to be enabled on that account first).\n');

    const password = await askMasked('Paste the 16-character App Password: ');

    if (!password || password.replace(/\s+/g, '').length < 16) {
        console.error('\nThat does not look like a valid App Password (expected 16 characters). Aborting.');
        process.exit(1);
    }

    saveEmailPassword(password.replace(/\s+/g, ''));
    console.log('\nSaved. The password is encrypted at rest in email-credentials.enc, keyed by .email-key.');
    console.log('Neither file is committed to git. Restart the bot for it to take effect.');
})();
