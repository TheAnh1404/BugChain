import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBugChainEvents } from '../hooks/useBugChainEvents';
import { notificationService } from '../services/notificationService';

function formatRelative(value) {
  if (!value) return '';
  const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 1) return 'Now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

export default function NotificationBell() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');

  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const [items, unread] = await Promise.all([
        notificationService.list({ limit: 10 }),
        notificationService.unreadCount(),
      ]);
      setNotifications(items);
      setUnreadCount(unread.count);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    async function loadNotifications() {
      await refreshNotifications();
    }

    loadNotifications();
  }, [refreshNotifications]);

  useBugChainEvents((event) => {
    if (event.type !== 'notification_created') {
      return;
    }
    if (!event.data?.userId || event.data.userId === user?.id) {
      refreshNotifications();
    }
  }, isAuthenticated);

  const handleMarkRead = async (notificationId) => {
    try {
      await notificationService.markRead(notificationId);
      await refreshNotifications();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      await refreshNotifications();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#4a4455] bg-[#221e28] text-[#e8dfee] hover:border-[#7c3aed]/60"
        aria-label="Notifications"
        type="button"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-[#ffb4ab] px-1.5 py-0.5 text-center text-[10px] font-bold text-[#690005]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[#4a4455] bg-[#100d16] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#4a4455]/50 px-4 py-3">
            <h3 className="text-sm font-bold text-[#e8dfee]">Notifications</h3>
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] font-bold text-[#d2bbff] hover:underline disabled:opacity-40"
              disabled={unreadCount === 0}
              type="button"
            >
              Mark all read
            </button>
          </div>

          {error && (
            <div className="border-b border-[#ffb4ab]/20 px-4 py-2 text-xs text-[#ffb4ab]">
              {error}
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[#ccc3d8]">
                No notifications.
              </p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleMarkRead(notification.id)}
                  className={`w-full border-b border-[#4a4455]/30 px-4 py-3 text-left transition-colors hover:bg-[#1d1a24] ${
                    notification.isRead ? 'opacity-70' : ''
                  }`}
                  type="button"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        notification.isRead ? 'bg-[#4a4455]' : 'bg-[#d2bbff]'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold text-[#e8dfee]">
                          {notification.title}
                        </p>
                        <span className="shrink-0 font-mono text-[10px] text-[#958da1]">
                          {formatRelative(notification.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#ccc3d8]">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
