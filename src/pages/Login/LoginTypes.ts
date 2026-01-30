/**
 * Login Form State Interface
 * Represents the structure of login form data
 */
export interface LoginFormState {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * Login Validation Errors
 * Represents possible validation error states
 */
export interface LoginValidationError {
  field: 'email' | 'password' | 'form';
  message: string;
}
