import type { Assignment, RewardStatus } from "../types";

/**
 * House reward rules:
 * - Regular assignments: $3 if on time and >=70%, otherwise $0.
 * - Tests/quizzes: +$20 if >=70%, otherwise -$20 (reversible via makeup window).
 * - Missing work earns $0 with no negative penalty (the penalty applies to
 *   graded-but-failing tests/quizzes only).
 */
export function getRewardStatus(a: Assignment): RewardStatus {
  const { type, status, grade, daysLeft } = a;

  if (status === "missing") return { earned: 0, label: "Missing", color: "text-red-500" };
  if (status === "pending") return { earned: null, label: "Pending", color: "text-gray-400" };

  if (type === "assignment") {
    if (grade !== null && grade >= 70) return { earned: 3, label: "+$3.00", color: "text-green-500" };
    return { earned: 0, label: "$0.00", color: "text-gray-400" };
  }

  if (type === "test" || type === "quiz") {
    if (grade !== null && grade >= 70) return { earned: 20, label: "+$20.00", color: "text-green-500" };
    if (daysLeft !== null && daysLeft > 0) return { earned: -20, label: "-$20.00 (Makeup Available)", color: "text-orange-500" };
    return { earned: -20, label: "-$20.00", color: "text-red-500" };
  }

  return { earned: 0, label: "$0.00", color: "text-gray-400" };
}
