const whatsappService = require('../services/whatsappService');
const sessionManager = require('../sessions/sessionManager');
const Order = require('../models/Order');
const User = require('../models/User');
const menu = require('../utils/menu.json');

const handleIncomingMessage = async (req, res) => {
    try {
        const body = req.body;

        if (body.object !== 'whatsapp_business_account') {
            return res.sendStatus(404);
        }

        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const message = body.entry[0].changes[0].value.messages[0];
            const from = message.from;
            const userName = body.entry[0].changes[0].value.contacts[0].profile.name;

            // Get or initialize session
            let session = sessionManager.getSession(from);
            
            // Determine message type
            const type = message.type;
            let text = '';
            let payload = '';

            if (type === 'text') {
                text = message.text.body.toLowerCase();
            } else if (type === 'interactive') {
                const interactive = message.interactive;
                if (interactive.type === 'button_reply') {
                    payload = interactive.button_reply.id;
                } else if (interactive.type === 'list_reply') {
                    payload = interactive.list_reply.id;
                }
            }

            console.log(`Message from ${from}: ${text || payload} (Step: ${session.currentStep})`);

            // State Machine / Flow Logic
            try {
                await processFlow(from, userName, text, payload, session);
            } catch (flowError) {
                console.error('Flow Error:', flowError);
                await whatsappService.sendTextMessage(from, "⚠️ Sorry, something went wrong while processing your request. Please type 'hi' to start over.");
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error handling message:', error);
        res.sendStatus(500);
    }
};

const processFlow = async (from, userName, text, payload, session) => {
    // Global commands
    if (text === 'hi' || text === 'hello' || text === 'menu' || payload === 'START') {
        return await sendWelcomeMessage(from, userName);
    }

    switch (session.currentStep) {
        case 'START':
            if (payload === 'VIEW_MENU' || text.includes('menu')) {
                await sendCategories(from);
                sessionManager.updateSession(from, { currentStep: 'SELECT_CATEGORY' });
            } else if (payload === 'PLACE_ORDER' || text.includes('order')) {
                await sendCategories(from);
                sessionManager.updateSession(from, { currentStep: 'SELECT_CATEGORY' });
            } else if (payload === 'CONTACT_SUPPORT' || text.includes('support')) {
                await whatsappService.sendTextMessage(from, "Our support team will contact you shortly. Type 'hi' to return to menu.");
                sessionManager.clearSession(from);
            } else {
                await sendWelcomeMessage(from, userName);
            }
            break;

        case 'SELECT_CATEGORY':
            const category = menu.categories.find(c => c.id === payload || c.title.toLowerCase().includes(text));
            if (category) {
                await sendItems(from, category);
                sessionManager.updateSession(from, { currentStep: 'SELECT_ITEM' });
            } else {
                await sendCategories(from);
            }
            break;

        case 'SELECT_ITEM':
            if (payload.startsWith('ADD_')) {
                const itemId = payload.replace('ADD_', '');
                let selectedItem = null;
                menu.categories.forEach(cat => {
                    const item = cat.items.find(i => i.id === itemId);
                    if (item) selectedItem = item;
                });

                if (selectedItem) {
                    sessionManager.updateSession(from, { 
                        currentStep: 'ASK_QUANTITY',
                        selectedItem: selectedItem
                    });
                    await whatsappService.sendTextMessage(from, `How many ${selectedItem.name} would you like? (Please enter a number)`);
                }
            } else if (payload === 'BACK_TO_CATEGORIES' || text.includes('back')) {
                await sendCategories(from);
                sessionManager.updateSession(from, { currentStep: 'SELECT_CATEGORY' });
            }
            break;

        case 'ASK_QUANTITY':
            const qty = parseInt(text);
            if (!isNaN(qty) && qty > 0) {
                const cart = session.cart || [];
                cart.push({
                    ...session.selectedItem,
                    qty: qty
                });
                sessionManager.updateSession(from, { 
                    cart: cart,
                    selectedItem: null,
                    currentStep: 'POST_ADD_ACTION'
                });

                await whatsappService.sendButtonMessage(from, `Added to cart! What would you like to do next?`, [
                    { id: 'VIEW_MENU', title: 'Add More' },
                    { id: 'CHECKOUT', title: 'Checkout 🛒' }
                ]);
            } else {
                await whatsappService.sendTextMessage(from, "Please enter a valid quantity (number greater than 0).");
            }
            break;

        case 'POST_ADD_ACTION':
            if (payload === 'VIEW_MENU' || text.includes('more')) {
                await sendCategories(from);
                sessionManager.updateSession(from, { currentStep: 'SELECT_CATEGORY' });
            } else if (payload === 'CHECKOUT' || text.includes('checkout')) {
                await whatsappService.sendTextMessage(from, "Great! Let's get your details.\nWhat is your full name?");
                sessionManager.updateSession(from, { currentStep: 'ASK_NAME' });
            }
            break;

        case 'ASK_NAME':
            if (text.length > 2) {
                sessionManager.updateSession(from, { 
                    userDetails: { ...session.userDetails, name: text },
                    currentStep: 'ASK_ADDRESS'
                });
                await whatsappService.sendTextMessage(from, "Got it! Now, what is your delivery address?");
            } else {
                await whatsappService.sendTextMessage(from, "Please enter a valid name.");
            }
            break;

        case 'ASK_ADDRESS':
            if (text.length > 5) {
                sessionManager.updateSession(from, { 
                    userDetails: { ...session.userDetails, address: text },
                    currentStep: 'ASK_PAYMENT'
                });
                await whatsappService.sendButtonMessage(from, "How would you like to pay?", [
                    { id: 'PAY_COD', title: 'Cash on Delivery' },
                    { id: 'PAY_ONLINE', title: 'Online Payment' }
                ]);
            } else {
                await whatsappService.sendTextMessage(from, "Please enter a valid delivery address.");
            }
            break;

        case 'ASK_PAYMENT':
            if (payload === 'PAY_COD' || text.includes('cash')) {
                await confirmOrder(from, session, 'Cash on Delivery');
            } else if (payload === 'PAY_ONLINE' || text.includes('online')) {
                // Inform the user about the simulation
                await whatsappService.sendTextMessage(from, "💳 *Online Payment Simulation*\n\nIn a real app, you would be redirected to a payment gateway.\n\n🔗 Click here to simulate payment: https://pay.stripe.com/test_payment\n\n_Your order will be confirmed automatically in 3 seconds..._");
                
                // Simulate a small delay as if waiting for payment
                setTimeout(async () => {
                    // Fetch fresh session to ensure data is up to date
                    const latestSession = sessionManager.getSession(from);
                    await confirmOrder(from, latestSession, 'Online Payment');
                }, 3000);
            } else {
                await whatsappService.sendButtonMessage(from, "Please choose a payment method:", [
                    { id: 'PAY_COD', title: 'Cash on Delivery' },
                    { id: 'PAY_ONLINE', title: 'Online Payment' }
                ]);
            }
            break;

        default:
            await sendWelcomeMessage(from, userName);
            break;
    }
};

const sendWelcomeMessage = async (to, userName) => {
    sessionManager.updateSession(to, { currentStep: 'START', cart: [] });
    const text = `Welcome to Our Restaurant, ${userName}! 👋\n\nHow can we help you today?`;
    const buttons = [
        { id: 'VIEW_MENU', title: 'View Menu 🍕' },
        { id: 'PLACE_ORDER', title: 'Place Order 🛍️' },
        { id: 'CONTACT_SUPPORT', title: 'Support 🎧' }
    ];
    await whatsappService.sendButtonMessage(to, text, buttons);
};

const sendCategories = async (to) => {
    const sections = [
        {
            title: "Our Categories",
            rows: menu.categories.map(cat => ({
                id: cat.id,
                title: cat.title,
                description: `View our delicious ${cat.title}`
            }))
        }
    ];
    await whatsappService.sendListMessage(to, "Please select a category:", "View Categories", sections);
};

const sendItems = async (to, category) => {
    // Meta API List messages are better for multiple items
    const sections = [
        {
            title: category.title,
            rows: category.items.map(item => ({
                id: `ADD_${item.id}`,
                title: item.name,
                description: `AED ${item.price}`
            }))
        },
        {
            title: "Options",
            rows: [{ id: 'BACK_TO_CATEGORIES', title: 'Back to Categories', description: 'Go back' }]
        }
    ];
    await whatsappService.sendListMessage(to, `Menu: ${category.title}`, "Select Item", sections);
};

const confirmOrder = async (from, session, paymentMethod) => {
    try {
        console.log(`Attempting to confirm order for ${from} via ${paymentMethod}`);
        
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            console.error('Database not connected. ReadyState:', mongoose.connection.readyState);
            return await whatsappService.sendTextMessage(from, "❌ System Error: Database is currently unavailable. Please contact support.");
        }

        if (!session || !session.cart || session.cart.length === 0) {
            console.warn(`Empty cart detected for ${from}`);
            return await whatsappService.sendTextMessage(from, "Your cart is empty! Please start over by typing 'hi'.");
        }

        const total = session.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        // Save to DB
        console.log('Saving order to MongoDB...');
        const order = new Order({
            phoneNumber: from,
            items: session.cart,
            total: total,
            address: session.userDetails.address || 'N/A',
            status: 'pending'
        });
        await order.save();
        console.log('Order saved successfully');

        // Update or Create User
        console.log('Updating user profile...');
        await User.findOneAndUpdate(
            { phoneNumber: from },
            { name: session.userDetails.name, address: session.userDetails.address },
            { upsert: true }
        );
        console.log('User profile updated');

        let orderSummary = `Order Confirmed ✅\n\n`;
        orderSummary += `*Items:*\n`;
        session.cart.forEach(item => {
            orderSummary += `- ${item.name} x${item.qty} (AED ${item.price * item.qty})\n`;
        });
        orderSummary += `\n*Total:* AED ${total}\n`;
        orderSummary += `*Payment:* ${paymentMethod}\n`;
        orderSummary += `*Delivery Address:* ${session.userDetails.address}\n\n`;
        orderSummary += `Thank you, ${session.userDetails.name}! Your order is being prepared.`;

        await whatsappService.sendTextMessage(from, orderSummary);
        console.log('Confirmation message sent');
        
        // Clear session after order
        sessionManager.clearSession(from);
    } catch (error) {
        console.error('Confirm Order Error Detailed:', error);
        await whatsappService.sendTextMessage(from, "❌ Sorry, there was an error confirming your order. Our team has been notified.");
    }
};

module.exports = {
    handleIncomingMessage
};
