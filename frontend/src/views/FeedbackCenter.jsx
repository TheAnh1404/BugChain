import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../lib/analytics';
import { notifyToast } from '../lib/errors';
import { feedbackService } from '../services/feedbackService';

const roles = ['Owner', 'Hunter', 'Tester'];

export default function FeedbackCenter() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    rating: 5,
    role: 'Hunter',
    comment: '',
  });
  const [myFeedback, setMyFeedback] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const mine = await feedbackService.mine();
      setMyFeedback(mine);
      try {
        setSummary(await feedbackService.summary({ suppressToast: true }));
      } catch {
        setSummary(null);
      }
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      load();
    }, 0);
  }, [load]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await feedbackService.create({
        rating: Number(form.rating),
        role: form.role,
        comment: form.comment,
      });
      trackEvent('feedback_submitted', { rating: Number(form.rating), role: form.role, userId: user?.id });
      notifyToast({ type: 'success', message: 'Feedback submitted. Thank you.' });
      setForm((current) => ({ ...current, comment: '' }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 w-full px-8 py-8">
        <LoadingState label="Loading feedback center..." />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-8">
        <p className="mb-2 text-xs font-mono font-bold uppercase tracking-widest text-[#d2bbff]">
          Product Validation
        </p>
        <h1 className="text-3xl font-bold text-[#e8dfee] sm:text-4xl">Feedback Center</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#ccc3d8]">
          Collect real user feedback for Level 4 validation. Submissions are tied to authenticated users.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-[#ffb4ab]/30 bg-[#93000a]/20 px-4 py-3 text-sm text-[#ffb4ab]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 xl:col-span-1">
          <h2 className="text-xl font-bold text-[#e8dfee]">Submit Feedback</h2>

          <div className="mt-5 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
                Rating
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => setForm((current) => ({ ...current, rating }))}
                    className={`h-11 rounded-xl border text-sm font-bold ${
                      form.rating === rating
                        ? 'border-[#7c3aed] bg-[#7c3aed] text-[#ede0ff]'
                        : 'border-[#4a4455] bg-[#100d16] text-[#ccc3d8]'
                    }`}
                    type="button"
                  >
                    {rating}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
                Role
              </label>
              <select
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                className="input-dark w-full rounded-xl px-4 py-3 text-sm"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
                Comment
              </label>
              <textarea
                value={form.comment}
                onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))}
                className="input-dark min-h-36 w-full rounded-xl px-4 py-3 text-sm"
                maxLength={1000}
                placeholder="What worked, what failed, and what should improve?"
                required
              />
              <p className="text-right font-mono text-[10px] text-[#958da1]">
                {form.comment.length}/1000
              </p>
            </div>

            <button
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-bold text-[#ede0ff] disabled:opacity-60"
              type="submit"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>

        <section className="glass rounded-2xl p-6 xl:col-span-2">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#e8dfee]">Feedback Summary</h2>
              <p className="mt-1 text-sm text-[#ccc3d8]">
                Summary is visible to product/admin roles when permitted.
              </p>
            </div>
            {summary && (
              <div className="grid grid-cols-2 gap-3 text-right">
                <div className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] px-4 py-3">
                  <p className="font-mono text-xs text-[#958da1]">Count</p>
                  <p className="text-2xl font-bold text-[#e8dfee]">{summary.total}</p>
                </div>
                <div className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] px-4 py-3">
                  <p className="font-mono text-xs text-[#958da1]">Avg</p>
                  <p className="text-2xl font-bold text-[#d2bbff]">{summary.averageRating}</p>
                </div>
              </div>
            )}
          </div>

          {!summary ? (
            <EmptyState
              icon="forum"
              title="Summary unavailable"
              description="Submit feedback as a user. Summary access is limited by role."
            />
          ) : summary.latest.length === 0 ? (
            <EmptyState
              icon="rate_review"
              title="No feedback yet"
              description="Real user feedback will appear here after testers submit it."
            />
          ) : (
            <div className="space-y-3">
              {summary.latest.map((item) => (
                <div key={item.id} className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-bold text-[#e8dfee]">
                      {item.user?.username || item.userId}
                    </p>
                    <p className="font-mono text-xs text-[#d2bbff]">
                      {item.role} - {item.rating}/5
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#ccc3d8]">{item.comment}</p>
                </div>
              ))}
            </div>
          )}

          {myFeedback.length > 0 && (
            <p className="mt-5 text-xs text-[#958da1]">
              You have submitted {myFeedback.length} feedback item{myFeedback.length === 1 ? '' : 's'}.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
