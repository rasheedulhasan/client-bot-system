const whatsappService = require('../services/whatsappService');
const sessionManager = require('../sessions/sessionManager');
const appwriteService = require('../services/appwriteService');
const Order = require('../models/Order');
const User = require('../models/User');

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

            // Fetch dynamic menu from Appwrite
            const menu = await appwriteService.getMenuFromAppwrite();

            // State Machine / Flow Logic
            try {
                await processFlow(from, userName, text, payload, session, menu);
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

const processFlow = async (from, userName, text, payload, session, menu) => {
    // Global commands
    if (text === 'hi' || text === 'hello' || text === 'menu' || payload === 'START') {
        return await sendWelcomeMessage(from, userName);
    }

    switch (session.currentStep) {
        case 'START':
            if (payload === 'VIEW_MENU' || text.includes('menu')) {
                await sendCategories(from, menu);
                sessionManager.updateSession(from, { currentStep: 'SELECT_CATEGORY' });
            } else if (payload === 'PLACE_ORDER' || text.includes('order')) {
                await sendCategories(from, menu);
                sessionManager.updateSession(from, { currentStep: 'SELECT_CATEGORY' });
            } else if (payload === 'CONTACT_SUPPORT' || text.includes('support')) {
                await whatsappService.sendTextMessage(from, "Our support team will contact you shortly. Type 'hi' to return to menu.");
                sessionManager.clearSession(from);
            } else {
                await sendWelcomeMessage(from, userName);
            }
            break;

        case 'SELECT_CATEGORY':
            const category = menu.categories.find(c => c.category === payload || c.name.toLowerCase().includes(text));
            if (category) {
                await sendItems(from, category);
                sessionManager.updateSession(from, { currentStep: 'SELECT_ITEM' });
            } else {
                await sendCategories(from, menu);
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
                    await whatsappService.sendTextMessage(from, `How many ${selectedItem.title} would you like? (Please enter a number)`);
                }
            } else if (payload === 'BACK_TO_CATEGORIES' || text.includes('back')) {
                await sendCategories(from, menu);
                sessionManager.updateSession(from, { currentStep: 'SELECT_CATEGORY' });
            }
            break;

        case 'ASK_QUANTITY':
            const qty = parseInt(text);
            if (!isNaN(qty) && qty > 0) {
                const cart = session.cart || [];
                cart.push({
                    name: session.selectedItem.title,
                    price: session.selectedItem.price,
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
                await sendCategories(from, menu);
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

const sendCategories = async (to, menu) => {
    if (!menu.categories || menu.categories.length === 0) {
        return await whatsappService.sendTextMessage(to, "Sorry, the menu is currently empty. Please check back later!");
    }

    // WhatsApp List Messages limit: max 10 rows total
    const categoriesToShow = menu.categories.slice(0, 10);

    const sections = [
        {
            title: "Our Categories",
            rows: categoriesToShow.map(cat => ({
                id: cat.category,
                title: cat.name.substring(0, 24), // Max 24 chars
                description: `View our delicious ${cat.name}`.substring(0, 72) // Max 72 chars
            }))
        }
    ];
    await whatsappService.sendListMessage(to, "Please select a category:", "View Categories", sections);
};

const sendItems = async (to, category) => {
    try {
        // WhatsApp List Messages limit: max 10 rows total
        // We leave 1 row for the "Back" option, so we show up to 9 items
        const itemsToShow = category.items.slice(0, 9);

        const sections = [
            {
                title: category.name.substring(0, 24),
                rows: itemsToShow.map(item => ({
                    id: `ADD_${item.id}`,
                    title: item.title.substring(0, 24),
                    description: `AED ${Number(item.price).toFixed(2)} - ${item.description || ''}`.substring(0, 72)
                }))
            },
            {
                title: "Options",
                rows: [{ id: 'BACK_TO_CATEGORIES', title: 'Back to Categories', description: 'Go back' }]
            }
        ];
        await whatsappService.sendListMessage(to, `Menu: ${category.name}`, "Select Item", sections);
    } catch (error) {
        console.error('Error sending items list:', error);
        // Fallback: Send as a plain text message if list fails
        let fallbackText = `*Menu: ${category.name}*\n\n`;
        category.items.forEach((item, index) => {
            fallbackText += `${index + 1}. ${item.title} - AED ${item.price}\n`;
        });
        fallbackText += `\nType 'hi' to return to menu.`;
        await whatsappService.sendTextMessage(to, fallbackText);
    }
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
