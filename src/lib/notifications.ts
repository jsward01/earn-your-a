import type { Assignment, AppNotification, NotificationTypeKey, NotificationTypeMeta } from "../types";

export const NOTIFICATION_TYPES: Record<NotificationTypeKey, NotificationTypeMeta> = {
  due3days: { icon: "📅", color: "bg-indigo-50 border-indigo-200", badge: "bg-indigo-100 text-indigo-700", label: "Due Soon" },
  due1day: { icon: "⚠️", color: "bg-yellow-50 border-yellow-200", badge: "bg-yellow-100 text-yellow-700", label: "Due Tomorrow" },
  dueToday: { icon: "🚨", color: "bg-red-50 border-red-200", badge: "bg-red-100 text-red-700", label: "Due Today" },
  makeup: { icon: "⏱", color: "bg-orange-50 border-orange-200", badge: "bg-orange-100 text-orange-700", label: "Makeup Window" },
  payout: { icon: "💰", color: "bg-green-50 border-green-200", badge: "bg-green-100 text-green-700", label: "Payout" },
  grade: { icon: "📝", color: "bg-purple-50 border-purple-200", badge: "bg-purple-100 text-purple-700", label: "New Grade" },
  weekly: { icon: "📋", color: "bg-gray-50 border-gray-200", badge: "bg-gray-100 text-gray-600", label: "Weekly Summary" },
};

export function generateNotifications(
  assignments: Assignment[],
  isParent: boolean,
  payoutPending: boolean,
): AppNotification[] {
  const today = new Date(2026, 2, 10);
  const notes: AppNotification[] = [];

  assignments.forEach(a => {
    if (a.status === "pending" && a.dueDate) {
      const days = Math.ceil((new Date(a.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const reward = a.type === "assignment" ? "$3" : "$20";
      if (days === 0) {
        notes.push({
          id: `dueToday-${a.id}`, type: "dueToday", read: false, time: "Today",
          title: `Due Today: ${a.title}`,
          body: `Your ${a.subject} ${a.type} is due today! Complete it to earn ${reward}.`,
          subject: a.subject,
        });
      } else if (days === 1) {
        notes.push({
          id: `due1day-${a.id}`, type: "due1day", read: false, time: "Yesterday",
          title: `Due Tomorrow: ${a.title}`,
          body: `Don't forget — your ${a.subject} ${a.type} is due tomorrow. Worth ${reward}!`,
          subject: a.subject,
        });
      } else if (days <= 3) {
        notes.push({
          id: `due3days-${a.id}`, type: "due3days", read: true, time: "2 days ago",
          title: `Coming Up: ${a.title}`,
          body: `Your ${a.subject} ${a.type} is due in ${days} days. Start early to earn ${reward}!`,
          subject: a.subject,
        });
      }
    }
    if (a.makeupAvailable && a.daysLeft !== null && a.daysLeft > 0) {
      notes.push({
        id: `makeup-${a.id}`, type: "makeup", read: a.daysLeft > 3, time: `${a.daysLeft} days left`,
        title: `Makeup Window: ${a.title}`,
        body: `You have ${a.daysLeft} day${a.daysLeft !== 1 ? "s" : ""} left to retake this ${a.subject} ${a.type} and earn back $20. Don't miss it!`,
        subject: a.subject,
      });
    }
    if (a.status === "graded" && a.grade !== null) {
      notes.push({
        id: `grade-${a.id}`, type: "grade", read: true, time: "This week",
        title: `Grade Posted: ${a.title}`,
        body: `You received ${a.grade}% on your ${a.subject} ${a.type}. ${a.grade >= 70 ? "Great job! 🎉" : "Retake available — don't give up!"}`,
        subject: a.subject,
      });
    }
  });

  if (payoutPending) {
    notes.push({
      id: "payout-pending", type: "payout", read: false, time: "Just now",
      title: isParent ? "Payout Request from Sarah" : "Payout Request Sent!",
      body: isParent
        ? "Sarah has requested a payout of $3.00. Tap to review and approve, delay, or deny."
        : "Your payout request of $3.00 is waiting for parent approval.",
    });
  }

  notes.push({
    id: "weekly-summary", type: "weekly", read: true, time: "Last Sunday",
    title: "Weekly Summary Ready",
    body: "Your week in review is ready. Net earnings: $23 • Avg grade: 80% • 1 makeup window open.",
  });

  return notes.sort((a, b) => (a.read === b.read ? 0 : a.read ? 1 : -1));
}
