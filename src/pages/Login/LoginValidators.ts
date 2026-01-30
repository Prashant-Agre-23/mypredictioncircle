import { EMAIL_REGEX, VALIDATION_MESSAGES } from './LoginConstants';

/**
 * Validates email format using regex pattern
 * @param email - Email address to validate
 * @returns boolean indicating if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  return EMAIL_REGEX.test(email);
};

/**
 * Validates password is not empty
 * @param password - Password to validate
 * @returns boolean indicating if password is not empty
 */
export const isValidPassword = (password: string): boolean => {
  return password.length > 0;
};

/**
 * Validates entire login form
 * @param email - Email address from form
 * @param password - Password from form
 * @returns error message if validation fails, empty string otherwise
 */
export const validateLoginForm = (email: string, password: string): string => {
  if (!email.trim()) {
    return VALIDATION_MESSAGES.EMAIL_REQUIRED;
  }
  if (!isValidEmail(email)) {
    return VALIDATION_MESSAGES.EMAIL_INVALID;
  }
  if (!password) {
    return VALIDATION_MESSAGES.PASSWORD_REQUIRED;
  }
  return '';
};

/**
 * Extracts error message from various error types
 * @param error - Error object or message
 * @returns string representation of the error
 */
export const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return VALIDATION_MESSAGES.LOGIN_FAILED;
};
