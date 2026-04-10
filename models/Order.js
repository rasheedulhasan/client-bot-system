const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true },
    items: [{
        name: { type: String, required: true },
        qty: { type: Number, required: true },
        price: { type: Number, required: true }
    }],
    total: { type: Number, required: true },
    address: { type: String, required: true },
    status: { type: String, enum: ['pending', 'preparing', 'shipped', 'delivered'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);
