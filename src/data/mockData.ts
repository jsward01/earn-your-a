import type { Assignment, WeeklyHistoryWeek, PayoutHistoryEntry } from "../types";

export const SUBJECTS = ["Math", "English", "Science", "History", "Spanish", "PE", "Art"];

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  { id: 1, title: "Chapter 5 Math Homework", subject: "Math", type: "assignment", dueDate: "2026-03-11", status: "pending", grade: null, daysLeft: 7 },
  { id: 2, title: "Essay Draft - To Kill a Mockingbird", subject: "English", type: "assignment", dueDate: "2026-03-12", status: "graded", grade: 85, daysLeft: null },
  { id: 3, title: "Chapter 4 Science Quiz", subject: "Science", type: "quiz", dueDate: "2026-03-09", status: "graded", grade: 62, daysLeft: 5, makeupAvailable: true },
  { id: 4, title: "History Test - Civil War", subject: "History", type: "test", dueDate: "2026-03-08", status: "graded", grade: 91, daysLeft: null },
  { id: 5, title: "Spanish Vocab Assignment", subject: "Spanish", type: "assignment", dueDate: "2026-03-10", status: "missing", grade: null, daysLeft: 6, makeupAvailable: true },
  { id: 6, title: "Algebra Test - Quadratics", subject: "Math", type: "test", dueDate: "2026-03-13", status: "pending", grade: null, daysLeft: null },
];

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
