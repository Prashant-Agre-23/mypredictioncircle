/**
 * Form field names for consistency and type safety
 */
export const FORM_FIELDS = {
  EMAIL: 'email',
  PASSWORD: 'password',
} as const;

/**
 * Email validation regex pattern
 * Matches standard email format: name@domain.extension
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Error messages for form validation
 */
export const VALIDATION_MESSAGES = {
  EMAIL_REQUIRED: 'Email is required',
  EMAIL_INVALID: 'Please enter a valid email address',
  PASSWORD_REQUIRED: 'Password is required',
  LOGIN_FAILED: 'Login failed. Please try again.',
} as const;
