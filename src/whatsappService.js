const axios = require('axios');
const googleSheetsService = require('./googleSheetsService');

// States
const STATE_INIT = 'INIT';
const STATE_ASK_NAME = 'ASK_NAME';
const STATE_ASK_LOCATION = 'ASK_LOCATION';
const STATE_ASK_TYPE = 'ASK_TYPE';
const STATE_ASK_DAY = 'ASK_DAY';
const STATE_ASK_COMMENT = 'ASK_COMMENT';
const STATE_COMPLETED = 'COMPLETED';

const processMessage = async (message, contact) => {
    // Check if service is active
    const serviceActive = process.env.SERVICE_ACTIVE === 'true';
    if (!serviceActive) {
        console.log('Service is inactive. Ignoring message.');
        return;
    }
    const from = message.from; // Phone number
    const text = message.text ? message.text.body : (
        message.interactive && message.interactive.button_reply ? message.interactive.button_reply.title : (
            message.interactive && message.interactive.list_reply ? message.interactive.list_reply.title : ''
        )
    );
    const location = message.location; // GPS location if shared
    const name = contact.profile.name;

    // 1. Get current session from Google Sheets
    let session = await googleSheetsService.getSession(from);

    if (!session) {
        // New session
        await googleSheetsService.createSession(from, name);
        session = { phone: from, state: STATE_INIT };
    }

    // 2. State Machine
    switch (session.state) {
        case STATE_INIT:
            // Start flow
            await sendWhatsAppMessage(from, `Hola ${name}, bienvenido al servicio de recolección. Para comenzar, ¿cuál es tu nombre completo?`);
            await googleSheetsService.updateSession(from, { state: STATE_ASK_NAME });
            break;

        case STATE_ASK_NAME:
            // User sent name
            await googleSheetsService.updateSession(from, { name: text, state: STATE_ASK_LOCATION });
            await sendWhatsAppMessage(from, `Gracias ${text}. Por favor, comparte tu *ubicación* usando el botón de adjuntar (📎) → Ubicación.`);
            break;

        case STATE_ASK_LOCATION:
            // User sent location
            if (location) {
                // GPS location shared
                const locationData = `${location.latitude},${location.longitude}`;
                await googleSheetsService.updateSession(from, { location: locationData, state: STATE_ASK_TYPE });
            } else {
                // Text sent instead of location (fallback)
                await googleSheetsService.updateSession(from, { location: text, state: STATE_ASK_TYPE });
            }
            // Send interactive buttons for waste type
            await sendInteractiveButtons(from, '¿Qué tipo de residuos deseas recolectar?', [
                { id: 'org', title: 'Orgánicos' },
                { id: 'inorg', title: 'Inorgánicos' },
                { id: 'ambos', title: 'Ambos' }
            ]);
            break;

        case STATE_ASK_TYPE:
            // User sent type
            await googleSheetsService.updateSession(from, { type: text, state: STATE_ASK_DAY });
            // Send day selection list
            await sendInteractiveList(from, '¿Qué día prefieres para la recolección?', [
                { id: 'lun', title: 'Lunes' },
                { id: 'mar', title: 'Martes' },
                { id: 'mie', title: 'Miércoles' },
                { id: 'jue', title: 'Jueves' },
                { id: 'vie', title: 'Viernes' },
                { id: 'sab', title: 'Sábado' },
                { id: 'dom', title: 'Domingo' }
            ]);
            break;

        case STATE_ASK_DAY:
            // User sent day
            await googleSheetsService.updateSession(from, { day: text, state: STATE_ASK_COMMENT });
            await sendWhatsAppMessage(from, 'Perfecto. ¿Tienes algún comentario adicional para el administrador? (Ejemplo: "Pasar después de las 3pm")');
            break;

        case STATE_ASK_COMMENT:
            // User sent comment - Finalize
            await googleSheetsService.updateSession(from, { comment: text, state: STATE_COMPLETED });

            // Move to completed log
            await googleSheetsService.archiveSession(from);

            await sendWhatsAppMessage(from, '¡Perfecto! Hemos registrado tu solicitud. Gracias por ayudarnos a mantener limpia la ciudad. ♻️');
            break;

        case STATE_COMPLETED:
            // Optional: Allow restart
            await sendWhatsAppMessage(from, 'Ya tenemos tu solicitud. Si deseas hacer una nueva, escribe "Hola" nuevamente.');
            await googleSheetsService.resetSession(from);
            break;

        default:
            await sendWhatsAppMessage(from, 'Lo siento, no entendí. Escribe "Hola" para reiniciar.');
            break;
    }
};

const sendWhatsAppMessage = async (to, body) => {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.PhoneNumberID;

    if (!token || !phoneNumberId) {
        console.error("Missing WhatsApp credentials");
        return;
    }

    // Clean phone number - remove NANP '1' for Mexico (521 -> 52)
    let cleanNumber = to;
    if (to.startsWith('521')) {
        cleanNumber = '52' + to.substring(3);
    }

    try {
        await axios.post(
            `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                to: cleanNumber,
                type: 'text',
                text: { body: body },
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch (error) {
        console.log('Original:', to, '| Cleaned:', cleanNumber);
        console.error('Error sending WhatsApp message:', error.response ? error.response.data : error.message);
    }
};

const sendInteractiveButtons = async (to, bodyText, buttons) => {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.PhoneNumberID;

    // Clean phone number - remove NANP '1' for Mexico (521 -> 52)
    let cleanNumber = to;
    if (to.startsWith('521')) {
        cleanNumber = '52' + to.substring(3);
    }

    const buttonRows = buttons.map(b => ({
        type: "reply",
        reply: {
            id: b.id,
            title: b.title
        }
    }));

    try {
        await axios.post(
            `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
            {
                messaging_product: "whatsapp",
                to: cleanNumber,
                type: "interactive",
                interactive: {
                    type: "button",
                    body: {
                        text: bodyText
                    },
                    action: {
                        buttons: buttonRows
                    }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch (error) {
        console.error('Error sending interactive message:', error.response ? error.response.data : error.message);
    }
};

async function sendInteractiveList(to, bodyText, items) {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.PhoneNumberID;

    // WhatsApp list requires sections (max 10 items total). We'll put all items in one section.
    const sections = [{
        title: 'Días de la semana',
        rows: items.map(item => ({
            id: item.id,
            title: item.title,
            description: ''
        }))
    }];

    // Clean phone number (same logic as other send functions)
    let cleanNumber = to;
    if (to.startsWith('521')) {
        cleanNumber = '52' + to.substring(3);
    }

    try {
        await axios.post(
            `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                to: cleanNumber,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    body: { text: bodyText },
                    action: {
                        button: 'Seleccionar día',
                        sections: sections
                    }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
    } catch (error) {
        console.error('Error sending interactive list:', error.response ? error.response.data : error.message);
    }
};


module.exports = { processMessage };
