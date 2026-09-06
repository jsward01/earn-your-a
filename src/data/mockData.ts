import type { WeeklyHistoryWeek, PayoutHistoryEntry } from "../types";

export const SUBJECTS = ["Math", "English", "Science", "History", "Spanish", "PE", "Art"];

export const WEEKLY_HISTORY: WeeklyHistoryWeek[] = [
  { week: "Mar 3 – Mar 9", net: 23, items: [
    { title: "History Test - Civil War", subject: "History", amount: 20 },
    { title: "English Essay", subject: "English", amount: 3 },
    { title: "Science Quiz", subject: "Science", amount: -20 },
    { title: "Math Homework", subject: "Math", amount: 3 },
    { title: "Spanish Vocab", subject: "Spanish", amount: 3 },
    { title: "Art Project", subject: "Art", amount: 3 },
    { title: "PE Assignment", subject: "PE", amount: 3 },
  ]},
  { week: "Feb 24 – Mar 2", net: 46, items: [
    { title: "Math Test Ch4", subject: "Math", amount: 20 },
    { title: "English Quiz", subject: "English", amount: 20 },
    { title: "History HW", subject: "History", amount: 3 },
    { title: "Science HW", subject: "Science", amount: 3 },
  ]},
];

export const PAYOUT_HISTORY: PayoutHistoryEntry[] = [
  { date: "Mar 1, 2026", amount: 46, status: "paid", method: "Monthly" },
  { date: "Feb 1, 2026", amount: 38, status: "paid", method: "Monthly" },
];
