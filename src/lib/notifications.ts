import type { Assignment, AppNotification, NotificationTypeKey, NotificationTypeMeta } from "../types";
import { daysUntilDate } from "./dates";
import { formatAmount, getRewardStatus, rewardAmountFor, type RewardRules } from "./rewards";

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
  studentName: string,
  /** The pending request once loaded: its amount for the text, its id so read/dismissed sticks to this request only. */
  pendingPayout: { id: string; amount: number } | null,
  rules: RewardRules,
): AppNotification[] {
  const notes: AppNotification[] = [];
  // A parent reads about their student; the student reads about themselves.
  const whose = isParent ? `${studentName}'s` : "Your";

  assignments.forEach(a => {
    if (a.status === "pending" && a.dueDate) {
      const days = daysUntilDate(a.dueDate);
      const reward = formatAmount(rewardAmountFor(a.type, rules), rules, { short: true });
      if (days === 0) {
        notes.push({
          id: `dueToday-${a.id}`, type: "dueToday", read: false, time: "Today",
          title: `Due Today: ${a.title}`,
          body: `${whose} ${a.subject} ${a.type} is due today! Complete it to earn ${reward}.`,
          subject: a.subject,
        });
      } else if (days === 1) {
        notes.push({
          id: `due1day-${a.id}`, type: "due1day", read: false, time: "Tomorrow",
          title: `Due Tomorrow: ${a.title}`,
          body: `Don't forget — ${isParent ? whose : "your"} ${a.subject} ${a.type} is due tomorrow. Worth ${reward}!`,
          subject: a.subject,
        });
      } else if (days <= 3) {
        notes.push({
          id: `due3days-${a.id}`, type: "due3days", read: true, time: `In ${days} days`,
          title: `Coming Up: ${a.title}`,
          body: `${whose} ${a.subject} ${a.type} is due in ${days} days. Start early to earn ${reward}!`,
          subject: a.subject,
        });
      }
    }
    if (a.makeupAvailable && a.daysLeft !== null && a.daysLeft > 0) {
      notes.push({
        id: `makeup-${a.id}`, type: "makeup", read: a.daysLeft > 3, time: `${a.daysLeft} days left`,
        title: `Makeup Window: ${a.title}`,
        body: `${isParent ? `${studentName} has` : "You have"} ${a.daysLeft} day${a.daysLeft !== 1 ? "s" : ""} left to retake this ${a.subject} ${a.type} and earn back ${formatAmount(rewardAmountFor(a.type, rules), rules, { short: true })}. Don't miss it!`,
        subject: a.subject,
      });
    }
    // No "graded on" date is stored, so "this week" means work due in the last 7 days (not every grade ever).
    if (a.status === "graded" && a.grade !== null && a.dueDate && daysUntilDate(a.dueDate) >= -7 && daysUntilDate(a.dueDate) <= 0) {
      notes.push({
        id: `grade-${a.id}`, type: "grade", read: true, time: "This week",
        title: `Grade Posted: ${a.title}`,
        body: `${isParent ? `${studentName} received` : "You received"} ${a.grade}% on ${isParent ? "their" : "your"} ${a.subject} ${a.type}. ${a.grade >= rules.passingThreshold ? "Great job! 🎉" : "Retake available — don't give up!"}`,
        subject: a.subject,
      });
    }
  });

  if (payoutPending) {
    const amountText = pendingPayout ? formatAmount(pendingPayout.amount, rules) : "a payout";
    notes.push({
      id: pendingPayout ? `payout-${pendingPayout.id}` : "payout-pending", type: "payout", read: false, time: "Just now",
      title: isParent ? `Payout Request from ${studentName}` : "Payout Request Sent!",
      body: isParent
        ? `${studentName} has requested a payout of ${amountText}. Tap to review and approve, delay, or deny.`
        : `Your payout request of ${amountText} is waiting for parent approval.`,
    });
  }

  const graded = assignments.filter(a => a.status === "graded" && a.grade !== null);
  const avgGrade = graded.length ? Math.round(graded.reduce((s, a) => s + (a.grade ?? 0), 0) / graded.length) : 0;
  const netEarnings = assignments.reduce((s, a) => s + (getRewardStatus(a, rules).earned ?? 0), 0);
  const openMakeups = assignments.filter(a => a.makeupAvailable && (a.daysLeft ?? 0) > 0).length;

  // One per week, so reading or dismissing this week's doesn't hide next week's.
  const sunday = new Date();
  sunday.setDate(sunday.getDate() - sunday.getDay());
  const week = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
  notes.push({
    id: `weekly-${week}`, type: "weekly", read: true, time: "Last Sunday",
    title: "Weekly Summary Ready",
    body: `Your week in review is ready. Net earnings: ${formatAmount(netEarnings, rules, { short: true })} • Avg grade: ${avgGrade}% • ${openMakeups} makeup window${openMakeups === 1 ? "" : "s"} open.`,
  });

  return notes.sort((a, b) => (a.read === b.read ? 0 : a.read ? 1 : -1));
}
