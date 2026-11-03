import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';
import { loginEmployee, storeSessionUser } from '../../services/authApi';

function LoginPage() {
  const navigate = useNavigate();

  // State strictly for credentials and form tracking
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Email validation
  const emailError = useMemo(() => {
    if (!email.trim()) {
      return 'Email is required';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Enter a valid email address';
    }
    return '';
  }, [email]);

  // Password validation
  const passwordError = useMemo(() => {
    if (!password.trim()) {
      return 'Password is required';
    }
    return '';
  }, [password]);

  // Form validity matches backend expectations (Email + Password only)
  const isFormValid = !emailError && !passwordError;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    
    if (!isFormValid) {
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      // Maps precisely to LoginDto: { Email, Password }
      const loginResponse = await loginEmployee({
        email: email.trim(),
        password,
      });

      if (!loginResponse.requires2FA && loginResponse.user) {
        // Demo accounts skip the emailed code
        storeSessionUser(loginResponse.user);
        navigate('/dashboard', { replace: true });
        return;
      }

      navigate('/login/verify', { state: { email: loginResponse.email } });
    } catch (error) {
      let message = 'Login failed. Please check your credentials.';
      const errAny = error as any;
      if (errAny?.status === 401) {
        message = 'Incorrect email or password.';
      } else if (errAny?.status === 503) {
        message = errAny.message || 'We could not send your login code. Please try again shortly.';
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page-shell">
      <section className="login-card">
        <header className="login-card-header">
          <div className="login-title-row">
            <div className="login-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M4.5 20c1.8-3.3 4.5-5 7.5-5s5.7 1.7 7.5 5" />
              </svg>
            </div>
            <h1>Login</h1>
          </div>
        </header>

        <div className="login-card-body">
          <div className="login-section-heading">Required User Information</div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            
            {/* Email Field */}
            <label className="login-field">
              <span className="login-label">Email</span>
              <div className={`login-input-shell ${((submitAttempted || emailTouched) && emailError) ? 'error' : ''}`}>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  type="email"
                  autoComplete="email"
                  className="login-input"
                  aria-invalid={!!(submitAttempted || emailTouched) && !!emailError}
                  aria-describedby="email-hint"
                />
                {((submitAttempted || emailTouched) && emailError) ? (
                  <span className="login-field-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8.3v4.2" />
                      <path d="M12 15.8h.01" />
                    </svg>
                  </span>
                ) : null}
              </div>
              {((submitAttempted || emailTouched) && emailError) ? (
                <p id="email-hint" className="login-field-hint error">{emailError}</p>
              ) : (
                <p id="email-hint" className="login-field-hint">We'll email you a 6-digit code to finish signing in.</p>
              )}
            </label>

            {/* Password Field */}
            <label className="login-field">
              <span className="login-label">Password</span>
              <div className={`login-input-shell has-password-toggle ${((submitAttempted || passwordTouched) && passwordError) ? 'error' : ''}`}>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  aria-invalid={!!(submitAttempted || passwordTouched) && !!passwordError}
                  aria-describedby="password-hint"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="login-input"
                />
                {((submitAttempted || passwordTouched) && passwordError) ? (
                  <span className="login-field-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8.3v4.2" />
                      <path d="M12 15.8h.01" />
                    </svg>
                  </span>
                ) : null}
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
                      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.8 0 9.7 4.9 10.8 6.5a1.4 1.4 0 0 1 0 1.5c-.6.9-1.6 2.3-3.1 3.7" />
                      <path d="M6.6 6.6C4.3 8.2 2.8 10.1 2 11.5a1.4 1.4 0 0 0 0 1.5C3.1 14.7 7 19.6 12.8 19.6c1.2 0 2.4-.2 3.5-.6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2.8 12C4 10.1 7.6 5.4 12 5.4S20 10.1 21.2 12c-1.2 1.9-4.8 6.6-9.2 6.6S4 13.9 2.8 12Z" />
                      <circle cx="12" cy="12" r="2.8" />
                    </svg>
                  )}
                </button>
              </div>
              {((submitAttempted || passwordTouched) && passwordError) ? <p id="password-hint" className="login-field-hint error">{passwordError}</p> : null}
            </label>

            {/* Alert Message Box */}
            <div className={`login-alert ${submitError ? 'error' : ''}`} role="alert" aria-live="polite">
              <div className="login-alert-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8.3v4.2" />
                  <path d="M12 15.8h.01" />
                </svg>
              </div>
              <div>
                <strong>{submitError ? 'Login error' : 'Input required'}</strong>
                <p>{submitError || 'Enter details to continue.'}</p>
              </div>
            </div>

            {/* Submit button */}
            <button type="submit" className="login-submit" disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>

            {/* Portfolio reviewers: one-click demo credentials (these accounts skip the emailed code) */}
            <div className="login-demo-box">
              <p className="login-demo-title">Just looking around?</p>
              <div className="login-demo-actions">
                <button type="button" className="login-secondary-action" onClick={() => { setEmail('demo@artifax.app'); setPassword('ArtifaxDemo2026!'); }}>
                  Demo · Warehouse 1
                </button>
                <button type="button" className="login-secondary-action" onClick={() => { setEmail('cpt@artifax.app'); setPassword('ArtifaxDemo2026!'); }}>
                  Demo · Warehouse 2
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;