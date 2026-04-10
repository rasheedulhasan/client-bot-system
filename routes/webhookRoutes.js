const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
require('dotenv').config();

// Webhook Verification (GET)
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Webhook Event Handling (POST)
router.post('/webhook', (req, res, next) => {
    console.log('--- Incoming Webhook Request ---');
    console.log('Method:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    next();
}, messageController.handleIncomingMessage);

module.exports = router;
