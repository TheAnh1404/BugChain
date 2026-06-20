import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage({ mode = 'login', setCurrentView }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (isRegister) {
        await register({
          email: form.email,
          username: form.username,
          password: form.password,
        });
      } else {
        await login({
          email: form.email,
          password: form.password,
        });
      }

      setCurrentView('marketplace');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 min-h-[calc(100vh-80px)] flex items-center justify-center px-6 py-12">
      <div className="glass w-full max-w-md rounded-2xl p-8">
        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-[#d2bbff] mb-2">
            BugChain Account
          </p>
          <h1 className="text-3xl font-bold text-[#e8dfee]">
            {isRegister ? 'Create your account' : 'Sign in to BugChain'}
          </h1>
          <p className="text-sm text-[#ccc3d8] mt-2">
            {isRegister
              ? 'Launch bounties, submit reports, and link a Stellar wallet.'
              : 'Access your bounties, reports, wallets, and transaction records.'}
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-[#ffb4ab]/30 bg-[#93000a]/20 px-4 py-3 text-sm text-[#ffb4ab]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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

          {isRegister && (
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

          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
              Password
            </label>
            <input
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              className="input-dark w-full rounded-xl px-4 py-3 text-sm"
              type="password"
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </div>

          <button
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[#7c3aed] px-5 py-3 font-bold text-[#ede0ff] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
          >
            {isSubmitting
              ? 'Please wait...'
              : isRegister
                ? 'Create Account'
                : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 border-t border-[#4a4455]/40 pt-5 text-center text-sm text-[#ccc3d8]">
          {isRegister ? 'Already have an account?' : 'New to BugChain?'}{' '}
          <button
            onClick={() => setCurrentView(isRegister ? 'login' : 'register')}
            className="font-bold text-[#d2bbff] hover:underline"
          >
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </div>
      </div>
    </div>
  );
}
