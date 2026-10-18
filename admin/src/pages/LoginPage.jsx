import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { PANEL_ROLES } from '../store/authStore.js';

function plainLoginError(error) {
  const message = String(error?.message || '');
  if (/invalid login credentials/i.test(message)) return 'That email or password is not right. Please try again.';
  if (/cannot use the shop panel/i.test(message)) return 'This account cannot use the shop panel.';
  if (/network|fetch/i.test(message)) return 'Cannot reach the shop server. Check the internet and try again.';
  return message || 'Could not sign in. Please try again.';
}

export default function LoginPage() {
  const { session, profile, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!loading && session && profile && PANEL_ROLES.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  async function submit(event) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Please type your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(plainLoginError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Print Shop</h1>
        <p className="hint">Sign in to see the jobs.</p>
        <label className="field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoFocus
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="button" className="btn" style={{ minHeight: 44, marginBottom: 16 }} onClick={() => setShowPassword((value) => !value)}>
          {showPassword ? 'Hide password' : 'Show password'}
        </button>
        {error ? <p className="error-text" style={{ marginBottom: 12 }}>{error}</p> : null}
        <button type="submit" className="btn btn-primary btn-big btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
