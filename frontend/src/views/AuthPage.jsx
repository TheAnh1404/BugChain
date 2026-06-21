import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage({ mode: initialMode = 'login', token = null, setCurrentView }) {
  const [mode, setMode] = useState(initialMode);
  const { login, register, forgotPassword, resetPassword } = useAuth();
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setMode(initialMode);
      setError('');
      setSuccessMessage('');
    }, 0);
  }, [initialMode]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      if (mode === 'register') {
        if (form.password !== form.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const result = await register({
          email: form.email,
          username: form.username,
          password: form.password,
          confirmPassword: form.confirmPassword,
        });
        setSuccessMessage(result.message || 'Registration successful! Please check your email to verify your account.');
      } else if (mode === 'forgot-password') {
        const result = await forgotPassword(form.email);
        setSuccessMessage(result.message || 'If that email is registered, we have sent password reset instructions.');
      } else if (mode === 'reset-password') {
        if (form.password !== form.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const result = await resetPassword({
          token,
          password: form.password,
          confirmPassword: form.confirmPassword,
        });
        setSuccessMessage(result.message || 'Password reset successfully! You can now sign in.');
      } else {
        // Login
        await login({
          email: form.email,
          password: form.password,
        });
        setCurrentView('marketplace');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleMap = {
    login: 'Sign in to BugChain',
    register: 'Create your account',
    'forgot-password': 'Reset password',
    'reset-password': 'Set new password',
  };

  const descriptionMap = {
    login: 'Access your bounties, reports, wallets, and transaction records.',
    register: 'Launch bounties, submit reports, and link a Stellar wallet.',
    'forgot-password': 'Enter your email address and we will send you a link to reset your password.',
    'reset-password': 'Enter a strong, secure new password for your account.',
  };

  return (
    <div className="flex-1 min-h-[calc(100vh-80px)] flex items-center justify-center px-6 py-12">
      <div className="glass w-full max-w-md rounded-2xl p-8">
        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-[#d2bbff] mb-2">
            BugChain Account
          </p>
          <h1 className="text-3xl font-bold text-[#e8dfee]">
            {titleMap[mode]}
          </h1>
          <p className="text-sm text-[#ccc3d8] mt-2">
            {descriptionMap[mode]}
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-[#ffb4ab]/30 bg-[#93000a]/20 px-4 py-3 text-sm text-[#ffb4ab] animate-fade-in">
            {error}
          </div>
        )}

        {successMessage ? (
          <div className="space-y-6 text-center py-4 animate-fade-in">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="material-symbols-outlined text-4xl">
                mark_email_read
              </span>
            </div>
            <p className="text-sm text-[#ccc3d8] leading-relaxed">
              {successMessage}
            </p>
            <button
              onClick={() => {
                setSuccessMessage('');
                setMode('login');
                setCurrentView('login');
              }}
              className="w-full rounded-xl bg-[#7c3aed] px-5 py-3 font-bold text-[#ede0ff] transition-all hover:brightness-110"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {(mode === 'login' || mode === 'register' || mode === 'forgot-password') && (
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
                  Email
                </label>
                <input
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                  type="email"
                  placeholder="researcher@bugchain.dev"
                  required
                />
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
                  Username
                </label>
                <input
                  value={form.username}
                  onChange={(event) => updateField('username', event.target.value)}
                  className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                  type="text"
                  placeholder="stellar_hunter"
                  required
                />
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'reset-password') && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot-password')}
                      className="text-xs font-bold text-[#d2bbff] hover:underline"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <input
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                  type="password"
                  placeholder={mode === 'login' ? '••••••••' : 'At least 8 chars (A-Z, a-z, 0-9)'}
                  minLength={8}
                  required
                />
              </div>
            )}

            {(mode === 'register' || mode === 'reset-password') && (
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
                  Confirm Password
                </label>
                <input
                  value={form.confirmPassword}
                  onChange={(event) => updateField('confirmPassword', event.target.value)}
                  className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                  type="password"
                  placeholder="Repeat your password"
                  minLength={8}
                  required
                />
              </div>
            )}

            <button
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[#7c3aed] px-5 py-3 font-bold text-[#ede0ff] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
            >
              {isSubmitting
                ? 'Please wait...'
                : mode === 'register'
                  ? 'Create Account'
                  : mode === 'forgot-password'
                    ? 'Send Reset Instructions'
                    : mode === 'reset-password'
                      ? 'Reset Password'
                      : 'Sign In'}
            </button>
          </form>
        )}

        {!successMessage && (
          <div className="mt-6 border-t border-[#4a4455]/40 pt-5 text-center text-sm text-[#ccc3d8]">
            {mode === 'login' && (
              <>
                New to BugChain?{' '}
                <button
                  onClick={() => setMode('register')}
                  className="font-bold text-[#d2bbff] hover:underline"
                >
                  Create one
                </button>
              </>
            )}
            {mode === 'register' && (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="font-bold text-[#d2bbff] hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
            {(mode === 'forgot-password' || mode === 'reset-password') && (
              <button
                onClick={() => setMode('login')}
                className="font-bold text-[#d2bbff] hover:underline"
              >
                Back to sign in
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
