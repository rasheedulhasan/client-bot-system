const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
require('dotenv').config();

const appwriteService = require('../services/appwriteService');

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

// GET /api/menu - Fetches formatted menu from Appwrite
router.get('/api/menu', async (req, res) => {
    try {
        const menu = await appwriteService.getMenuFromAppwrite();
        res.json(menu);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Failed to fetch menu' });
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
