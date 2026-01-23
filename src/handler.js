const whatsappService = require('./whatsappService');
//const googleSheetsService = require('./googleSheetsService');

module.exports.webhook = async (event) => {
  // 1. WhatsApp Webhook Verification (GET)
  if (event.httpMethod === 'GET') {
    const queryParams = event.queryStringParameters || {};
    const mode = queryParams['hub.mode'];
    const token = queryParams['hub.verify_token'];
    const challenge = queryParams['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      console.log('Webhook verified!');
      return {
        statusCode: 200,
        body: challenge,
      };
    } else {
      return {
        statusCode: 403,
        body: 'Verification failed',
      };
    }
  }

  // 2. Message Handling (POST)
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);

      // Check if this is a message from WhatsApp
      if (body.object === 'whatsapp_business_account') {
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
          const message = body.entry[0].changes[0].value.messages[0];
          const contact = body.entry[0].changes[0].value.contacts[0];

          await whatsappService.processMessage(message, contact);
        }
      }

      return {
        statusCode: 200,
        body: 'EVENT_RECEIVED',
      };
    } catch (error) {
      console.error('Error processing message:', error);
      return {
        statusCode: 500,
        body: 'Internal Server Error',
      };
    }
  }
};
