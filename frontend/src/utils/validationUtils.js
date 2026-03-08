/**
 * Validates an Egyptian phone number.
 * matches patterns like: 01012345678, 01112345678, 01212345678, 01512345678
 * Rules:
 * - Must start with 01
 * - Third digit must be 0, 1, 2, or 5
 * - Must be followed by exactly 8 digits
 * - Total length: 11 digits
 * 
 * @param {string} phone - The phone number to validate
 * @returns {object} { isValid: boolean, message: string | null }
 */
export const validateEgyptianPhone = (phone) => {
    if (!phone) {
        return { isValid: true, message: null }; // Allow empty if not required (handle required check separately)
    }

    const regex = /^01[0125][0-9]{8}$/;

    if (!regex.test(phone)) {
        return {
            isValid: false,
            message: "رقم الهاتف يجب أن يكون مصرياً صحيحاً (مثل: 01xxxxxxxxx)"
        };
    }

    return { isValid: true, message: null };
};
