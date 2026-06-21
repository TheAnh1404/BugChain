import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmail({ token, setCurrentView }) {
  const { verifyEmail } = useAuth();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function doVerify() {
      if (!token) {
        setLoading(false);
        setSuccess(false);
        setMessage('Missing verification token.');
        return;
      }

      try {
        const result = await verifyEmail(token);
        if (active) {
          setSuccess(true);
          setMessage(result?.message || 'Email verified successfully!');
        }
      } catch (err) {
        if (active) {
          setSuccess(false);
          setMessage(err.message || 'Verification failed. The token may be invalid or expired.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    doVerify();

    return () => {
      active = false;
    };
  }, [token, verifyEmail]);

  return (
    <div className="flex-1 min-h-[calc(100vh-80px)] flex items-center justify-center px-6 py-12">
      <div className="glass w-full max-w-md rounded-2xl p-8 text-center">
        <div className="mb-6">
          <p className="text-xs font-mono uppercase tracking-widest text-[#d2bbff] mb-2">
            Email Verification
          </p>
          <h1 className="text-3xl font-bold text-[#e8dfee]">
            Verifying your account
          </h1>
        </div>

        {loading ? (
          <div className="py-12 space-y-4">
            <span className="material-symbols-outlined animate-spin text-5xl text-[#d2bbff]">
              progress_activity
            </span>
            <p className="text-sm text-[#ccc3d8]">Contacting Stellar Network authentication gate...</p>
          </div>
        ) : success ? (
          <div className="space-y-6 py-4 animate-fade-in">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="material-symbols-outlined text-4xl">
                check_circle
              </span>
            </div>
            <p className="text-sm text-[#ccc3d8] leading-relaxed">
              {message}
            </p>
            <button
              onClick={() => setCurrentView('login')}
              className="w-full rounded-xl bg-[#7c3aed] px-5 py-3 font-bold text-[#ede0ff] transition-all hover:brightness-110"
            >
              Sign In to Your Account
            </button>
          </div>
        ) : (
          <div className="space-y-6 py-4 animate-fade-in">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#93000a]/10 text-[#ffb4ab] border border-[#ffb4ab]/20">
              <span className="material-symbols-outlined text-4xl">
                error
              </span>
            </div>
            <p className="text-sm text-[#ffb4ab] leading-relaxed">
              {message}
            </p>
            <button
              onClick={() => setCurrentView('landing')}
              className="w-full rounded-xl border border-[#4a4455] bg-[#221e28] px-5 py-3 font-bold text-[#e8dfee] transition-all hover:bg-[#2c2833]"
            >
              Go to Home Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
