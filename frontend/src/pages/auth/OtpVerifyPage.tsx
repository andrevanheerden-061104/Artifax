import { ClipboardEvent, FormEvent, KeyboardEvent, useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './LoginPage.css';
import { resendLoginCode, storeSessionUser, verifyLoginCode } from '../../services/authApi';

const OTP_LENGTH = 6;

// Define the allowed view states for the component
type VerifyStatus = 'input' | 'success' | 'failed';

function OtpVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [maskedEmail, setMaskedEmail] = useState<string | undefined>(
    () => (location.state as { email?: string } | null)?.email,
  );
  const [resendCooldown, setResendCooldown] = useState(30);
  const [resendMessage, setResendMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [signedIn, setSignedIn] = useState<{ name: string; role: string; branchName?: string } | null>(null);
  const [redirectIn, setRedirectIn] = useState(4);
  
  // 🌟 View state control
  const [status, setStatus] = useState<VerifyStatus>('input');
  
  const [digits, setDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ''));
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const code = useMemo(() => digits.join(''), [digits]);
  const isCodeComplete = code.length === OTP_LENGTH;

  // Count down before "Send a new code" is allowed again
  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    setResendMessage('');
    try {
      const result = await resendLoginCode();
      if (result?.email) setMaskedEmail(result.email);
      setResendMessage('A new code is on its way.');
      setResendCooldown(30);
    } catch (error) {
      const err = error as { status?: number; message?: string };
      if (err?.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setResendMessage(err?.message || 'Could not send a new code.');
    }
  };

  // After a successful login, go to the dashboard automatically
  useEffect(() => {
    if (status !== 'success') return undefined;
    if (redirectIn <= 0) {
      navigate('/dashboard', { replace: true });
      return undefined;
    }
    const timer = window.setTimeout(() => setRedirectIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [status, redirectIn, navigate]);

  const focusInput = (index: number) => {
    const target = inputRefs.current[index];
    if (target) {
      target.focus();
      target.select();
    }
  };

  const updateDigit = (index: number, value: string) => {
    const numeric = value.replace(/\D/g, '').slice(-1);
    setDigits((previous) => {
      const next = [...previous];
      next[index] = numeric;
      return next;
    });

    if (numeric && index < OTP_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      focusInput(index - 1);
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusInput(index - 1);
      return;
    }
    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      focusInput(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;

    event.preventDefault();
    const next = Array.from({ length: OTP_LENGTH }, (_, index) => pasted[index] || '');
    setDigits(next);
    focusInput(Math.min(pasted.length, OTP_LENGTH - 1));
  };

  // Resets the inputs when moving from the failed view back to the entry view
  const handleTryAgain = () => {
    setDigits(Array.from({ length: OTP_LENGTH }, () => ''));
    setSubmitAttempted(false);
    setErrorMessage('');
    setStatus('input');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setErrorMessage('');

    if (!isCodeComplete) return;

    setIsVerifying(true);
    try {
      // The backend checks the code with Supabase and starts the session
      const sessionUser = await verifyLoginCode(code);
      const stored = storeSessionUser(sessionUser);
      setSignedIn({ name: stored.name, role: stored.role, branchName: stored.branchName });
      setStatus('success');
    } catch (err) {
      const error = err as { status?: number; message?: string };
      if (error?.status === 401 && /session expired/i.test(error.message ?? '')) {
        navigate('/login', { replace: true });
        return;
      }
      setStatus('failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <main className="login-page-shell">
      <section className="login-card login-card-compact">
        
        {/* Render the standard header ONLY when we are inputting the code */}
        {status === 'input' && (
          <header className="login-card-header">
            <div className="login-title-row">
              <div className="login-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="4" y="6" width="16" height="12" rx="2" />
                  <path d="M8 10h8" />
                  <path d="M8 14h4" />
                </svg>
              </div>
              <h1>Verification Code</h1>
            </div>
          </header>
        )}

        <div className="login-card-body login-card-body-compact">
          
          {/* VIEW 1: CODE INPUT STAGE */}
          {status === 'input' && (
            <>
              <p className="login-subtitle">
                We emailed a 6-digit code to <strong>{maskedEmail ?? 'your email address'}</strong>. Enter it below to finish signing in.
              </p>

              <form className="login-form" onSubmit={handleSubmit} noValidate>
                <div className="login-otp-sequence" role="group" aria-label="One-time password input">
                  {digits.map((digit, index) => (
                    <input
                      key={`otp-${index}`}
                      ref={(element) => { inputRefs.current[index] = element; }}
                      className={`login-otp-input ${(submitAttempted && !isCodeComplete) || errorMessage ? 'invalid' : ''}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      maxLength={1}
                      value={digit}
                      onChange={(event) => updateDigit(index, event.target.value)}
                      onKeyDown={(event) => handleKeyDown(index, event)}
                      onPaste={handlePaste}
                      aria-label={`Code digit ${index + 1}`}
                    />
                  ))}
                </div>

                {errorMessage && <p className="login-inline-error" role="alert">{errorMessage}</p>}
                {submitAttempted && !isCodeComplete && !errorMessage && (
                  <p className="login-inline-error" role="alert">Enter the full 6-digit code.</p>
                )}

                <button type="submit" className="login-submit" disabled={!isCodeComplete || isVerifying}>
                  {isVerifying ? 'Checking...' : 'Verify Account'}
                </button>

                <div className="login-resend-row">
                  <span>Didn't get it?</span>
                  <button type="button" onClick={() => void handleResend()} disabled={resendCooldown > 0}>
                    {resendCooldown > 0 ? `Send a new code in ${resendCooldown}s` : 'Send a new code'}
                  </button>
                </div>
                {resendMessage ? <p className="login-subtitle" role="status">{resendMessage}</p> : null}

                <button type="button" className="login-secondary-action" onClick={() => navigate('/login')}>
                  Back To Login
                </button>
              </form>
            </>
          )}

          {/* VIEW 2: VERIFICATION SUCCESS STAGE */}
          {status === 'success' && (
            <div className="otp-success">
              <div className="otp-success-ring" aria-hidden="true">
                <svg viewBox="0 0 52 52">
                  <circle className="otp-success-circle" cx="26" cy="26" r="23" fill="none" />
                  <path className="otp-success-check" fill="none" d="M15 27l7.5 7.5L38 19" />
                </svg>
              </div>
              <span className="otp-success-kicker">Verified</span>
              <h1>Welcome back{signedIn?.name ? `, ${signedIn.name.split(' ')[0]}` : ''}!</h1>
              <p>Your code was accepted and you're signed in.</p>

              {signedIn ? (
                <div className="otp-success-pills">
                  <span>{signedIn.role}</span>
                  {signedIn.branchName ? <span>{signedIn.branchName}</span> : null}
                </div>
              ) : null}

              <button type="button" className="login-submit otp-success-cta" onClick={() => navigate('/dashboard', { replace: true })}>
                Continue to dashboard
              </button>
              <div className="otp-success-timer">
                <span style={{ width: `${((4 - redirectIn) / 4) * 100}%` }} />
              </div>
              <p className="otp-success-note">Taking you there in {Math.max(0, redirectIn)}s…</p>
            </div>
          )}

          {status === 'failed' && (
            <>
              <div className="login-status-card failed" role="alert">
                <div className="login-status-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M9.5 9.5l5 5" />
                    <path d="M14.5 9.5l-5 5" />
                  </svg>
                </div>
                <h1>Verification Failed</h1>
                <p>That code didn't match or has expired. Codes last a few minutes — try again with the newest email.</p>
              </div>

              <div className="login-actions-column">
                <button type="button" className="login-submit" onClick={handleTryAgain}>
                  Try Again
                </button>
                <button type="button" className="login-secondary-action" onClick={() => navigate('/login')}>
                  Back To Login
                </button>
              </div>
            </>
          )}

        </div>
      </section>
    </main>
  );
}

export default OtpVerifyPage;