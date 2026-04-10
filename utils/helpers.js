/**
 * Common helper functions
 */

const formatPrice = (price) => {
    return `AED ${price.toFixed(2)}`;
};

const validatePhoneNumber = (phone) => {
    const re = /^\d{10,15}$/;
    return re.test(phone);
};

module.exports = {
    formatPrice,
    validatePhoneNumber
};
