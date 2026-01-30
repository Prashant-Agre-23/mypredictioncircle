import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  InputAdornment,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EmailIcon from '@mui/icons-material/Email';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useAuth } from '../../context/AuthContext';
import { FORM_FIELDS } from './LoginConstants';
import { validateLoginForm, getErrorMessage } from './LoginValidators';
import type { LoginFormState } from './LoginTypes';
import styles from './Login.module.css';

/**
 * Login component providing secure authentication via Supabase
 * Features:
 * - Email/password authentication
 * - Password visibility toggle
 * - Remember me checkbox
 * - Form validation
 * - Error handling with user feedback
 * - Loading states with disabled inputs
 * - Full accessibility support
 */
const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  // Form state
  const [formState, setFormState] = useState<LoginFormState>({
    email: '',
    password: '',
    rememberMe: false,
  });

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Handles form submission and authentication
   * @param e - Form submission event
   */
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate form
    const validationError = validateLoginForm(formState.email, formState.password);
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      const { error: signInError } = await signIn(formState.email, formState.password);
      if (signInError) {
        setError(signInError);
      } else {
        // Redirect to dashboard on successful login
        navigate('/dashboard');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Updates email field in form state
   * @param newEmail - New email value
   */
  const handleEmailChange = (newEmail: string): void => {
    setFormState((prev) => ({ ...prev, email: newEmail }));
  };

  /**
   * Updates password field in form state
   * @param newPassword - New password value
   */
  const handlePasswordChange = (newPassword: string): void => {
    setFormState((prev) => ({ ...prev, password: newPassword }));
  };

  /**
   * Updates remember me checkbox state
   * @param isChecked - New checkbox state
   */
  const handleRememberMeChange = (isChecked: boolean): void => {
    setFormState((prev) => ({ ...prev, rememberMe: isChecked }));
  };

  /**
   * Toggles password visibility
   */
  const handlePasswordVisibilityToggle = (): void => {
    setShowPassword((prev) => !prev);
  };

  return (
    <Box className={styles.loginContainer}>
      {/* Decorative Background Elements */}
      <Box className={styles.decorativeCircle1} aria-hidden="true" />
      <Box className={styles.decorativeCircle2} aria-hidden="true" />

      {/* Main Content */}
      <Box className={styles.contentWrapper} role="main">
        {/* Welcome Message Section */}
        <Box className={styles.welcomeSection}>

          <Typography
            variant="h4"
            className={styles.welcomeTitle}
            component="h1"
          >
            Cricket Predictions
          </Typography>
          <Typography
            variant="body1"
            className={styles.welcomeSubtitle}
            component="p"
          >
            Make smart predictions and win big. Log in to your prediction dashboard
          </Typography>
        </Box>

        {/* Login Form Card */}
        <Paper className={styles.formCard} elevation={10}>
          {/* Error Message */}
          {error && (
            <Alert
              severity="error"
              className={styles.errorAlert}
              role="alert"
              aria-live="polite"
            >
              {error}
            </Alert>
          )}

          {/* Login Form */}
          <Box
            component="form"
            onSubmit={handleLogin}
            noValidate
            className={styles.form}
            role="form"
            aria-label="Login form"
          >
            {/* Email Field Section */}
            <Box className={styles.fieldSection}>
              <Typography
                variant="subtitle2"
                className={styles.fieldLabel}
                component="label"
                htmlFor={FORM_FIELDS.EMAIL}
              >
                Email Id
              </Typography>
              <TextField
                fullWidth
                id={FORM_FIELDS.EMAIL}
                name={FORM_FIELDS.EMAIL}
                type="email"
                placeholder="Enter your email"
                value={formState.email}
                onChange={(e) => handleEmailChange(e.target.value)}
                variant="outlined"
                disabled={loading}
                required
                autoComplete="email"
                inputProps={{
                  'aria-label': 'Email address',
                  'aria-required': true,
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon
                        className={styles.iconColor}
                        aria-hidden="true"
                      />
                    </InputAdornment>
                  ),
                }}
                className={styles.textField}
              />
            </Box>

            {/* Password Field Section */}
            <Box className={styles.fieldSection}>
              <Typography
                variant="subtitle2"
                className={styles.fieldLabel}
                component="label"
                htmlFor={FORM_FIELDS.PASSWORD}
              >
                Password
              </Typography>
              <TextField
                fullWidth
                id={FORM_FIELDS.PASSWORD}
                name={FORM_FIELDS.PASSWORD}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={formState.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                disabled={loading}
                variant="outlined"
                required
                autoComplete="current-password"
                inputProps={{
                  'aria-label': 'Password',
                  'aria-required': true,
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon
                        className={styles.iconColor}
                        aria-hidden="true"
                      />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <button
                        type="button"
                        onClick={handlePasswordVisibilityToggle}
                        className={styles.visibilityToggleButton}
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                        tabIndex={loading ? -1 : 0}
                      >
                        {showPassword ? (
                          <VisibilityIcon
                            className={styles.visibilityIcon}
                            aria-hidden="true"
                          />
                        ) : (
                          <VisibilityOffIcon
                            className={styles.visibilityIcon}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </InputAdornment>
                  ),
                }}
                className={styles.textField}
              />
            </Box>

            {/* Remember Me Checkbox */}
            <Box className={styles.rememberMeSection}>
              <FormControlLabel
                control={
                  <Checkbox
                    id="rememberMe"
                    checked={formState.rememberMe}
                    onChange={(e) =>
                      handleRememberMeChange(e.target.checked)
                    }
                    disabled={loading}
                    size="small"
                    aria-label="Remember me"
                    className={styles.checkbox}
                  />
                }
                label={
                  <Typography variant="body2" className={styles.checkboxLabel}>
                    Remember me
                  </Typography>
                }
              />
            </Box>

            {/* Login Button */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              className={styles.loginButton}
              disabled={loading}
              aria-busy={loading}
              aria-label={
                loading ? 'Signing in, please wait' : 'Sign in to your account'
              }
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default Login;
