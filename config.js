require('dotenv').config();

module.exports = {
    businessName: process.env.BUSINESS_NAME || 'ABC Enterprises',
    city: process.env.BUSINESS_CITY || 'Chennai',
    address: process.env.BUSINESS_ADDRESS || 'Plot No. 12, Industrial Estate, Ambattur, Chennai - 600058',
    mapsUrl: process.env.MAPS_URL || 'https://maps.google.com',
    catalogUrl: process.env.CATALOG_URL || 'https://example.com/catalog',
    gmailUser: process.env.GMAIL_USER || 'sgj.2b.600004@gmail.com',
    greetingKeywords: ['hi', 'hello', 'hey', 'vanakkam', 'menu'],
};
