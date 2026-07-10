require('dotenv').config();

module.exports = {
    businessName: process.env.BUSINESS_NAME || 'Dhoon.ai LLP.',
    city: process.env.BUSINESS_CITY || 'Chennai',
    address: process.env.BUSINESS_ADDRESS || '2B, 5/3, Shakti Krishna Apartment, 1st Main Road, C.I.T. Colony, Mylapore, Chennai - 600004',
    mapsUrl: process.env.MAPS_URL || 'https://maps.google.com',
    catalogUrl: process.env.CATALOG_URL || 'https://tuezdayai.com/roadmap',
    gmailUser: process.env.GMAIL_USER || 'sgj.2b.600004@gmail.com',
    greetingKeywords: ['hi', 'hello', 'hey', 'vanakkam', 'menu'],
};
