import { useState } from "react";
import type { Assignment, AppNotification, NotificationSettings } from "../../types";
import { NOTIFICATION_TYPES, generateNotifications } from "../../lib/notifications";

interface NotificationCenterProps {
  assignments: Assignment[];
  isParent: boolean;
  payoutPending: boolean;
}

const FILTER_TABS = ["all", "unread", "due1day", "dueToday", "makeup", "payout", "grade"] as const;

const DEFAULT_SETTINGS: NotificationSettings = {
  sms: true, email: true, inApp: true,
  due3days: true, due1day: true, dueToday: true,
  makeup: true, payout: true, grade: true, weekly: true,
  phone: "+1 (720) 555-0192",
  emailAddr: "sarah@example.com",
  quietStart: "09:00 PM",
  quietEnd: "07:00 AM",
};

export function NotificationCenter({ assignments, isParent, payoutPending }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => generateNotifications(assignments, isParent, payoutPending));
  const [filter, setFilter] = useState<string>("all");
  const [showSettings, setShowSettings] = useState(false);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  const accentBg = isParent ? "bg-emerald-700" : "bg-indigo-600";

  const unreadCount = notifications.filter(n => !n.read).length;
  const filtered = filter === "all" ? notifications : filter === "unread" ? notifications.filter(n => !n.read) : notifications.filter(n => n.type === filter);

  function markRead(id: string) { setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)); }
  function markAllRead() { setNotifications(prev => prev.map(n => ({ ...n, read: true }))); }
  function dismiss(id: string) { setNotifications(prev => prev.filter(n => n.id !== id)); }

  function toggleSetting(key: keyof NotificationSettings) {
    setNotifSettings(prev => ({ ...prev, [key]: !prev[key] }));
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
              className="bg-white bg-opacity-20 rounded-xl px-3 py-1.5 text-xs font-semibold">
              ⚙️ Settings
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {([
            { key: "inApp", icon: "🔔", label: "In-App" },
            { key: "sms", icon: "📱", label: "SMS" },
            { key: "email", icon: "📧", label: "Email" },
          ] as const).map(m => (
            <div key={m.key} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${notifSettings[m.key] ? "bg-white bg-opacity-25 text-white" : "bg-white bg-opacity-10 text-white opacity-40"}`}>
              <span>{m.icon}</span>{m.label} {notifSettings[m.key] ? "✓" : "off"}
            </div>
          ))}
        </div>
      </div>

      {showSettings && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-gray-100">
            <p className="font-bold text-gray-800 text-sm">⚙️ Notification Settings</p>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Delivery Methods</p>
              <div className="space-y-3">
                {([
                  { key: "inApp", icon: "🔔", label: "In-App Alerts", desc: "Shown inside the app" },
                  { key: "sms", icon: "📱", label: "SMS Text", desc: "Requires Twilio (deployment)" },
                  { key: "email", icon: "📧", label: "Email", desc: "Requires Resend (deployment)" },
                ] as const).map(m => (
                  <div key={m.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{m.icon}</span>
                      <div><p className="text-sm font-medium text-gray-700">{m.label}</p><p className="text-xs text-gray-400">{m.desc}</p></div>
                    </div>
                    <button onClick={() => toggleSetting(m.key)}
                      className={`w-12 h-6 rounded-full transition-all relative ${notifSettings[m.key] ? (isParent ? "bg-emerald-600" : "bg-indigo-600") : "bg-gray-200"}`}>
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow transition-all ${notifSettings[m.key] ? "left-6" : "left-0.5"}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Contact Info</p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">Phone (for SMS)</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={notifSettings.phone} onChange={e => setNotifSettings({ ...notifSettings, phone: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Email Address</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={notifSettings.emailAddr} onChange={e => setNotifSettings({ ...notifSettings, emailAddr: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Alert Triggers</p>
              <div className="space-y-2">
                {([
                  { key: "due3days", label: "Assignment due in 3 days" },
                  { key: "due1day", label: "Assignment due tomorrow" },
                  { key: "dueToday", label: "Assignment due today" },
                  { key: "makeup", label: "Makeup window expiring" },
                  { key: "payout", label: "Payout approved / denied" },
                  { key: "grade", label: "New grade posted" },
                  { key: "weekly", label: "Weekly Sunday summary" },
                ] as const).map(t => (
                  <div key={t.key} className="flex items-center justify-between py-1">
                    <p className="text-sm text-gray-700">{t.label}</p>
                    <button onClick={() => toggleSetting(t.key)}
                      className={`w-10 h-5 rounded-full transition-all relative ${notifSettings[t.key] ? (isParent ? "bg-emerald-600" : "bg-indigo-600") : "bg-gray-200"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow transition-all ${notifSettings[t.key] ? "left-5" : "left-0.5"}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Quiet Hours</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Start</label>
                  <input type="time" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1" defaultValue="21:00" /></div>
                <div><label className="text-xs text-gray-500">End</label>
                  <input type="time" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1" defaultValue="07:00" /></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">No notifications will be sent during quiet hours</p>
            </div>
          </div>
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
              <div className="flex gap-1.5 mt-3 pt-2 border-t border-black border-opacity-5">
                <span className="text-xs text-gray-400">Sent via:</span>
                {([{ key: "inApp", icon: "🔔" }, { key: "sms", icon: "📱" }, { key: "email", icon: "📧" }] as const).map(m => (
                  <span key={m.key} className={`text-xs ${notifSettings[m.key] ? "text-gray-500" : "text-gray-300 line-through"}`}>{m.icon}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Delivery Previews</p>

        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📱</span>
            <p className="text-white font-bold text-sm">SMS Preview</p>
            <span className="ml-auto text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Via Twilio</span>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 space-y-2">
            <div className="flex justify-end">
              <div className="bg-green-500 text-white text-xs rounded-2xl rounded-br-sm px-3 py-2 max-w-xs">
                📚 ScholarRewards: ⚠️ Algebra Test due TOMORROW! Complete it to earn $20. Good luck! 💪
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-green-500 text-white text-xs rounded-2xl rounded-br-sm px-3 py-2 max-w-xs">
                ⏱ Makeup window closes in 2 days for Science Quiz. Retake now to earn back $20!
              </div>
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-2">~$0.008 per text via Twilio</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-lg">📧</span>
            <p className="font-bold text-gray-800 text-sm">Email Preview</p>
            <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Via Resend</span>
          </div>
          <div className="px-4 py-3 space-y-1 text-xs text-gray-500 border-b border-gray-100">
            <p><span className="font-semibold text-gray-700">From:</span> ScholarRewards &lt;alerts@scholarrewards.app&gt;</p>
            <p><span className="font-semibold text-gray-700">To:</span> {isParent ? "parent@example.com" : "sarah@example.com"}</p>
            <p><span className="font-semibold text-gray-700">Subject:</span> 📚 Weekly Summary — Net +$23 this week</p>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div className="bg-indigo-600 rounded-xl p-3 text-white text-center">
              <p className="text-xs opacity-70">📚 ScholarRewards</p>
              <p className="font-bold text-base mt-1">Weekly Summary</p>
              <p className="text-xs opacity-80">Mar 3 – Mar 9, 2026</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-50 rounded-xl p-2"><p className="font-bold text-green-600 text-base">+$26</p><p className="text-xs text-gray-400">Earned</p></div>
              <div className="bg-red-50 rounded-xl p-2"><p className="font-bold text-red-500 text-base">-$3</p><p className="text-xs text-gray-400">Lost</p></div>
              <div className="bg-indigo-50 rounded-xl p-2"><p className="font-bold text-indigo-600 text-base">$23</p><p className="text-xs text-gray-400">Net</p></div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <p className="text-xs font-bold text-orange-700">⏱ Action Required</p>
              <p className="text-xs text-orange-600 mt-1">Science Quiz makeup window closes in 5 days. Retake to earn back $20!</p>
            </div>
            <div className="text-center">
              <div className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl inline-block">View Full Summary →</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
