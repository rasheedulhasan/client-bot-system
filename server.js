const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/', webhookRoutes);

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI && process.env.NODE_ENV === 'production') {
    console.error('❌ ERROR: MONGODB_URI is not defined in production environment variables!');
    process.exit(1);
}

const dbUri = MONGODB_URI || 'mongodb://127.0.0.1:27017/whatsapp-bot';

mongoose.connect(dbUri)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        console.log('💡 Tip: If you are on a server, make sure you have set a remote MONGODB_URI (like MongoDB Atlas) in your environment variables.');
    });

// Start Server
app.listen(PORT, () => {
    const publicUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🔗 Webhook URL: ${publicUrl}/webhook`);
});
