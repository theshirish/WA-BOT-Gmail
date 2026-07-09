const nodemailer = require('nodemailer');
const config = require('./config');
const { loadEmailPassword } = require('./credentials');

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: config.gmailUser, pass: loadEmailPassword() },
        });
    }
    return transporter;
}

async function sendCatalogEmail(toEmail) {
    await getTransporter().sendMail({
        from: `"${config.businessName}" <${config.gmailUser}>`,
        to: toEmail,
        subject: `${config.businessName} - Product Catalog`,
        text: `Hello,\n\nThank you for your interest in ${config.businessName}.\nHere is our product catalog: ${config.catalogUrl}\n\nRegards,\n${config.businessName}`,
        html:
            `<p>Hello,</p>` +
            `<p>Thank you for your interest in <b>${config.businessName}</b>.</p>` +
            `<p>Here is our product catalog: <a href="${config.catalogUrl}">${config.catalogUrl}</a></p>` +
            `<p>Regards,<br>${config.businessName}</p>`,
    });
}

module.exports = { sendCatalogEmail };
