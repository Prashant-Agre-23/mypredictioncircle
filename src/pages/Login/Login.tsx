import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
import EmojiPeopleIcon from '@mui/icons-material/EmojiPeople';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EmailIcon from '@mui/icons-material/Email';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import BarChartIcon from '@mui/icons-material/BarChart';
import StarIcon from '@mui/icons-material/Star';
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

      {/* ── Left Brand Panel (desktop only) ───────────────────── */}
      <Box className={styles.brandPanel}>
        <Box className={styles.brandTop}>
          {/* Logo */}
          <Box className={styles.brandLogoRow}>
            <Box className={styles.brandLogoBox}>
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" fill="#000" />
                <path d="M20 6 L26 14 L34 16 L28 23 L30 32 L20 28 L10 32 L12 23 L6 16 L14 14 Z" fill="#fff" opacity="0.15"/>
                <circle cx="20" cy="20" r="10" stroke="#fff" strokeWidth="2" fill="none"/>
                <circle cx="20" cy="20" r="5" fill="#fff" opacity="0.9"/>
                <circle cx="20" cy="20" r="2" fill="#000"/>
                <line x1="20" y1="2" x2="20" y2="10" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                <line x1="20" y1="30" x2="20" y2="38" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                <line x1="2" y1="20" x2="10" y2="20" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                <line x1="30" y1="20" x2="38" y2="20" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
              </svg>
            </Box>
            <Typography className={styles.brandAppName}>
              <span style={{ color: '#000' }}>sahi</span><span style={{ color: 'rgba(0,0,0,0.55)' }}>Predict</span>
            </Typography>
          </Box>

          {/* Headline */}
          <Typography className={styles.brandHeadline}>
            Predict.<br />
            <span className={styles.brandHeadlineAccent}>Compete.</span><br />
            Win.
          </Typography>
          <Typography className={styles.brandSubline}>
            Make smart match predictions, climb the leaderboard, and
            prove you know cricket better than anyone else.
          </Typography>

          {/* Feature pills */}
          <Box className={styles.brandFeatures}>
            <Box className={styles.featurePill}>
              <Box className={styles.featurePillIcon}>
                <BarChartIcon sx={{ fontSize: '1rem', color: '#000' }} />
              </Box>
              <Typography className={styles.featurePillText}>
                Live leaderboard & rankings
              </Typography>
            </Box>
            <Box className={styles.featurePill}>
              <Box className={styles.featurePillIcon}>
                <StarIcon sx={{ fontSize: '1rem', color: '#000' }} />
              </Box>
              <Typography className={styles.featurePillText}>
                Double Trouble bonus rounds
              </Typography>
            </Box>
            <Box className={styles.featurePill}>
              <Box className={styles.featurePillIcon}>
                <EmojiPeopleIcon sx={{ fontSize: '1rem', color: '#000' }} />
              </Box>
              <Typography className={styles.featurePillText}>
                Compete with your circle
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box className={styles.brandBottom}>
          © {new Date().getFullYear()} sahiPredict
        </Box>
      </Box>

      {/* ── Right Form Panel ───────────────────────────────────── */}
      <Box className={styles.formPanel}>
        <Box className={styles.formInner}>

          {/* Mobile-only logo strip */}
          <Box className={styles.mobileBrandStrip}>
            <Box className={styles.mobileLogoBox}>
              <svg width="24" height="24" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" fill="#000" />
                <path d="M20 6 L26 14 L34 16 L28 23 L30 32 L20 28 L10 32 L12 23 L6 16 L14 14 Z" fill="#fff" opacity="0.15"/>
                <circle cx="20" cy="20" r="10" stroke="#fff" strokeWidth="2" fill="none"/>
                <circle cx="20" cy="20" r="5" fill="#fff" opacity="0.9"/>
                <circle cx="20" cy="20" r="2" fill="#000"/>
                <line x1="20" y1="2" x2="20" y2="10" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                <line x1="20" y1="30" x2="20" y2="38" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                <line x1="2" y1="20" x2="10" y2="20" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                <line x1="30" y1="20" x2="38" y2="20" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
              </svg>
            </Box>
            <Typography className={styles.mobileAppName}>
              <span style={{ color: '#000' }}>sahi</span><span style={{ color: 'rgba(0,0,0,0.55)' }}>Predict</span>
            </Typography>
          </Box>

          {/* Form heading */}
          <Typography className={styles.formHeading}>
            Welcome back
          </Typography>
          <Typography className={styles.formSubheading}>
            Sign in to your account to continue
          </Typography>

          {/* Card */}
          <Paper className={styles.formCard} elevation={0}>
            {/* Error */}
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

            <Box
              component="form"
              onSubmit={handleLogin}
              noValidate
              className={styles.form}
              role="form"
              aria-label="Login form"
            >
              {/* Email */}
              <Box className={styles.fieldSection}>
                <Typography
                  variant="subtitle2"
                  className={styles.fieldLabel}
                  component="label"
                  htmlFor={FORM_FIELDS.EMAIL}
                >
                  Email
                </Typography>
                <TextField
                  fullWidth
                  id={FORM_FIELDS.EMAIL}
                  name={FORM_FIELDS.EMAIL}
                  type="email"
                  placeholder="you@example.com"
                  value={formState.email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  variant="outlined"
                  disabled={loading}
                  required
                  autoComplete="email"
                  inputProps={{ 'aria-label': 'Email address', 'aria-required': true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon className={styles.iconColor} aria-hidden="true" />
                      </InputAdornment>
                    ),
                  }}
                  className={styles.textField}
                />
              </Box>

              {/* Password */}
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
                  inputProps={{ 'aria-label': 'Password', 'aria-required': true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon className={styles.iconColor} aria-hidden="true" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <button
                          type="button"
                          onClick={handlePasswordVisibilityToggle}
                          className={styles.visibilityToggleButton}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          tabIndex={loading ? -1 : 0}
                        >
                          {showPassword ? (
                            <VisibilityIcon className={styles.visibilityIcon} aria-hidden="true" />
                          ) : (
                            <VisibilityOffIcon className={styles.visibilityIcon} aria-hidden="true" />
                          )}
                        </button>
                      </InputAdornment>
                    ),
                  }}
                  className={styles.textField}
                />
              </Box>

              {/* Remember me */}
              <Box className={styles.rememberMeSection}>
                <FormControlLabel
                  control={
                    <Checkbox
                      id="rememberMe"
                      checked={formState.rememberMe}
                      onChange={(e) => handleRememberMeChange(e.target.checked)}
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

              {/* Submit */}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                className={styles.loginButton}
                disabled={loading}
                aria-busy={loading}
                aria-label={loading ? 'Signing in, please wait' : 'Sign in to your account'}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </Box>
          </Paper>

          {/* Footer */}
          <Box className={styles.formFooter}>
            <Typography className={styles.footerNote}>
              Having trouble? Contact your league admin for access.
            </Typography>
            <Link
              to="/rules-public?from=login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                marginTop: '0.75rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#000',
                opacity: 0.5,
                textDecoration: 'none',
              }}
            >
              📖 View Rulebook
            </Link>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
