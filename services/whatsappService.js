const axios = require('axios');
require('dotenv').config();

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

console.log('--- WhatsApp Service Initialization ---');
console.log('PHONE_NUMBER_ID:', PHONE_NUMBER_ID ? 'Set ✅' : 'NOT SET ❌');
console.log('WHATSAPP_TOKEN:', WHATSAPP_TOKEN ? `Set (${WHATSAPP_TOKEN.substring(0, 10)}...) ✅` : 'NOT SET ❌');

const API_URL = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

const sendMessage = async (data) => {
    try {
        console.log('--- Sending WhatsApp Message ---');
        console.log('To:', data.to);
        console.log('Type:', data.type);
        console.log('Payload:', JSON.stringify(data, null, 2));

        const response = await axios.post(API_URL, data, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('--- WhatsApp API Success ---');
        console.log('Response:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.error('--- WhatsApp API Error ---');
        if (error.response) {
            const { status, data } = error.response;
            if (status === 401) {
                console.error('❌ WHATSAPP_TOKEN EXPIRED OR INVALID. Please update your .env file with a new token.');
            } else if (status === 403) {
                console.error('❌ PERMISSION ERROR: Your token doesn\'t have the required permissions.');
            }
            console.error('Status Code:', status);
            console.error('Error Response:', JSON.stringify(data, null, 2));
        } else {
            console.error('Connection Error:', error.message);
        }
        throw error;
    }
};

/**
 * Send a simple text message
 */
const sendTextMessage = async (to, text) => {
    const data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: { body: text }
    };
    return await sendMessage(data);
};

/**
 * Send an interactive button message
 * @param {string} to - Recipient phone number
 * @param {string} text - Message body text
 * @param {Array} buttons - Array of button objects {id: 'btn1', title: 'Button 1'}
 */
const sendButtonMessage = async (to, text, buttons) => {
    const data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "interactive",
        interactive: {
            type: "button",
            body: { text: text },
            action: {
                buttons: buttons.map(btn => ({
                    type: "reply",
                    reply: { id: btn.id, title: btn.title }
                }))
            }
        }
    };
    return await sendMessage(data);
};

/**
 * Send an interactive list message
 * @param {string} to - Recipient phone number
 * @param {string} text - Message body text
 * @param {string} buttonText - Text on the list trigger button
 * @param {Array} sections - Array of sections [{title: 'Section 1', rows: [{id: 'row1', title: 'Row 1', description: ''}]}]
 */
const sendListMessage = async (to, text, buttonText, sections) => {
    const data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "interactive",
        interactive: {
            type: "list",
            body: { text: text },
            action: {
                button: buttonText,
                sections: sections
            }
        }
    };
    return await sendMessage(data);
};

/**
 * Send an image message
 */
const sendImageMessage = async (to, imageUrl, caption) => {
    const data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "image",
        image: {
            link: imageUrl,
            caption: caption
        }
    };
    return await sendMessage(data);
};

module.exports = {
    sendTextMessage,
    sendButtonMessage,
    sendListMessage,
    sendImageMessage
};
