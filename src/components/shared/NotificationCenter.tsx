import { useEffect, useState } from "react";
import type { Assignment, AppNotification } from "../../types";
import { NOTIFICATION_TYPES, generateNotifications } from "../../lib/notifications";
import { formatAmount } from "../../lib/rewards";
import { useRewardSettings } from "../../lib/rewardSettingsContext";
import { fetchPayouts } from "../../lib/api";

interface NotificationCenterProps {
  assignments: Assignment[];
  isParent: boolean;
  payoutPending: boolean;
  studentName: string;
}

const FILTER_TABS = ["all", "unread", "due1day", "dueToday", "makeup", "payout", "grade"] as const;

export function NotificationCenter({ assignments, isParent, payoutPending, studentName }: NotificationCenterProps) {
  const rules = useRewardSettings();
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    generateNotifications(assignments, isParent, payoutPending, studentName, null, rules),
  );
  const [filter, setFilter] = useState<string>("all");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!payoutPending) return;
    fetchPayouts()
      .then(payouts => {
        const amount = payouts.find(p => p.status === "pending")?.amount ?? null;
        if (amount === null) return;
        const amountText = formatAmount(amount, rules);
        setNotifications(prev => prev.map(n => n.id !== "payout-pending" ? n : {
          ...n,
          body: isParent
            ? `${studentName} has requested a payout of ${amountText}. Tap to review and approve, delay, or deny.`
            : `Your payout request of ${amountText} is waiting for parent approval.`,
        }));
      })
      .catch(err => console.error("Failed to load payouts", err));
  }, [payoutPending, isParent, studentName, rules]);

  const accentBg = isParent ? "bg-emerald-700" : "bg-indigo-600";

  const unreadCount = notifications.filter(n => !n.read).length;
  const filtered = filter === "all" ? notifications : filter === "unread" ? notifications.filter(n => !n.read) : notifications.filter(n => n.type === filter);

  function markRead(id: string) { setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)); }
  function markAllRead() { setNotifications(prev => prev.map(n => ({ ...n, read: true }))); }
  function dismiss(id: string) { setNotifications(prev => prev.filter(n => n.id !== id)); }

  return (
    <div className="pb-28 pt-4 space-y-4 px-4">
      <div className={`${accentBg} rounded-3xl px-5 py-4 text-white shadow-lg`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-70 font-semibold uppercase tracking-wide">Notifications</p>
            <p className="text-xl font-bold mt-0.5">Alert Center</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <div className="bg-red-500 rounded-full w-7 h-7 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{unreadCount}</span>
              </div>
            )}
            <button onClick={() => setShowSettings(!showSettings)}
              className="bg-white/20 rounded-xl px-3 py-1.5 text-xs font-semibold">
              ⚙️ Settings
            </button>
          </div>
        </div>
        <p className="text-xs opacity-80 mt-2">🔔 Alerts show here in the app. Email and text alerts are coming soon.</p>
      </div>

      {showSettings && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
          <p className="font-bold text-gray-800 text-sm">⚙️ Notification Settings</p>
          <p className="text-sm text-gray-600">
            Email and text alerts aren't set up yet, so there's nothing to save here for now.
            Alerts about due dates, retakes, grades and payouts show on this screen whenever you open the app.
          </p>
          <p className="text-xs text-gray-400">When email alerts arrive, you'll be able to enter your address and pick which alerts you get.</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {FILTER_TABS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${filter === f ? (isParent ? "bg-emerald-700 text-white" : "bg-indigo-600 text-white") : "bg-white text-gray-500 border border-gray-200"}`}>
              {f === "all" ? "All" : f === "unread" ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}` : NOTIFICATION_TYPES[f]?.label ?? f}
            </button>
          ))}
        </div>
      </div>
      {unreadCount > 0 && (
        <button onClick={markAllRead} className="text-xs text-indigo-500 font-semibold w-full text-right -mt-2">Mark all as read</button>
      )}

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🔔</p>
            <p className="font-medium">No notifications here</p>
          </div>
        )}
        {filtered.map(n => {
          const t = NOTIFICATION_TYPES[n.type];
          return (
            <div key={n.id} onClick={() => markRead(n.id)}
              className={`rounded-2xl border p-4 transition-all cursor-pointer ${t.color} ${n.read ? "opacity-70" : "shadow-sm"}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0 mt-0.5">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-bold text-gray-800 ${!n.read ? "" : "text-gray-600"}`}>{n.title}</p>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </div>
                    <button onClick={e => { e.stopPropagation(); dismiss(n.id); }} className="text-gray-300 hover:text-gray-500 text-lg shrink-0">×</button>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{n.body}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${t.badge}`}>{t.label}</span>
                    <span className="text-xs text-gray-400">{n.time}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
