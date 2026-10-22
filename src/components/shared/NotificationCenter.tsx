import { useEffect, useMemo, useState } from "react";
import type { Assignment, AppNotification } from "../../types";
import { NOTIFICATION_TYPES, generateNotifications } from "../../lib/notifications";
import { useRewardSettings } from "../../lib/rewardSettingsContext";
import { fetchNotificationState, fetchPayouts, saveNotificationState } from "../../lib/api";
import { EmailAlertsCard } from "./EmailAlertsCard";

interface NotificationCenterProps {
  assignments: Assignment[];
  isParent: boolean;
  payoutPending: boolean;
  studentName: string;
}

const FILTER_TABS = ["all", "unread", "due1day", "dueToday", "makeup", "payout", "grade"] as const;

export function NotificationCenter({ assignments, isParent, payoutPending, studentName }: NotificationCenterProps) {
  const rules = useRewardSettings();
  const [pendingPayout, setPendingPayout] = useState<{ id: string; amount: number } | null>(null);
  // What this person has read or dismissed, saved on the server so it survives leaving the page (and other devices).
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [stateLoaded, setStateLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetchNotificationState()
      .then(s => { setReadIds(new Set(s.read)); setDismissedIds(new Set(s.dismissed)); })
      .catch(err => console.error("Failed to load read alerts", err))
      .finally(() => setStateLoaded(true));
  }, []);

  useEffect(() => {
    if (!payoutPending) return;
    fetchPayouts()
      .then(payouts => {
        const p = payouts.find(x => x.status === "pending");
        if (p) setPendingPayout({ id: p.id, amount: p.amount });
      })
      .catch(err => console.error("Failed to load payouts", err));
  }, [payoutPending]);

  const notifications: AppNotification[] = useMemo(
    () =>
      generateNotifications(assignments, isParent, payoutPending, studentName, pendingPayout, rules)
        .filter(n => !dismissedIds.has(n.id))
        .map(n => (readIds.has(n.id) ? { ...n, read: true } : n))
        .sort((a, b) => (a.read === b.read ? 0 : a.read ? 1 : -1)),
    [assignments, isParent, payoutPending, studentName, pendingPayout, rules, readIds, dismissedIds],
  );

  const accentBg = isParent ? "bg-emerald-700" : "bg-indigo-600";

  // Until the saved state arrives, don't flash already-read alerts as new.
  const unreadCount = stateLoaded ? notifications.filter(n => !n.read).length : 0;
  const filtered = filter === "all" ? notifications : filter === "unread" ? notifications.filter(n => !n.read) : notifications.filter(n => n.type === filter);

  // Shown at once, saved in the background; a failed save says so (the alert would come back on the next visit).
  function persist(ids: string[], state: "read" | "dismissed") {
    setSaveError(null);
    saveNotificationState(ids, state).catch(() => setSaveError("Couldn't save that. It may show as new again next time."));
  }
  function markRead(id: string) {
    if (notifications.find(n => n.id === id)?.read) return;
    setReadIds(prev => new Set(prev).add(id));
    persist([id], "read");
  }
  function markAllRead() {
    const ids = notifications.filter(n => !n.read).map(n => n.id);
    if (ids.length === 0) return;
    setReadIds(prev => new Set([...prev, ...ids]));
    persist(ids, "read");
  }
  function dismiss(id: string) {
    setDismissedIds(prev => new Set(prev).add(id));
    persist([id], "dismissed");
  }

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
        <p className="text-xs opacity-80 mt-2">🔔 Alerts show here in the app. Email alerts are being set up — pick yours under ⚙️ Settings.</p>
      </div>

      {showSettings && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
          <p className="font-bold text-gray-800 text-sm">⚙️ Notification Settings</p>
          <EmailAlertsCard isParent={isParent} studentName={studentName} />
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
      {saveError && <p className="text-xs text-red-500 text-center">{saveError}</p>}
      {unreadCount > 0 && (
        <button onClick={markAllRead} className="text-xs text-indigo-500 font-semibold w-full text-right -mt-2">Mark all as read</button>
      )}

      <div className="space-y-3">
        {!stateLoaded && <p className="text-center py-12 text-sm text-gray-400">Loading…</p>}
        {stateLoaded && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🔔</p>
            <p className="font-medium">No notifications here</p>
          </div>
        )}
        {stateLoaded && filtered.map(n => {
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
