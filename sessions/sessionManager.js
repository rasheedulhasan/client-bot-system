/**
 * Simple in-memory session manager.
 * For production with multiple instances, use Redis.
 */
const sessions = new Map();

const getSession = (phoneNumber) => {
    if (!sessions.has(phoneNumber)) {
        sessions.set(phoneNumber, {
            currentStep: 'START',
            cart: [],
            userDetails: {
                name: '',
                address: ''
            },
            selectedItem: null,
            lastInteraction: new Date()
        });
    }
    return sessions.get(phoneNumber);
};

const updateSession = (phoneNumber, data) => {
    const session = getSession(phoneNumber);
    const updatedSession = { ...session, ...data, lastInteraction: new Date() };
    sessions.set(phoneNumber, updatedSession);
    return updatedSession;
};

const clearSession = (phoneNumber) => {
    sessions.delete(phoneNumber);
};

module.exports = {
    getSession,
    updateSession,
    clearSession
};
