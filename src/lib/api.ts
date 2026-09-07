import type { AuthUser, Assignment, RewardSettings, SavingsGoal } from "../types";
import { fromApiRow, type AssignmentApiRow } from "./assignments";

async function parseJsonOrThrow(res: Response): Promise<unknown> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "Request failed";
    throw new Error(message);
  }
  return data;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me");
  if (res.status === 401) return null;
  return (await parseJsonOrThrow(res)) as AuthUser;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return (await parseJsonOrThrow(res)) as AuthUser;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  await parseJsonOrThrow(res);
}

export interface AssignmentInput {
  title: string;
  subject: string;
  type: Assignment["type"];
  dueDate: string;
  status: Assignment["status"];
  grade: number | null;
}

export async function fetchAssignments(): Promise<Assignment[]> {
  const res = await fetch("/api/assignments");
  const data = (await parseJsonOrThrow(res)) as AssignmentApiRow[];
  return data.map(fromApiRow);
}

export async function createAssignment(input: AssignmentInput): Promise<Assignment> {
  const res = await fetch("/api/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await parseJsonOrThrow(res)) as AssignmentApiRow;
  return fromApiRow(data);
}

export async function updateAssignment(id: string, input: Partial<AssignmentInput>): Promise<Assignment> {
  const res = await fetch(`/api/assignments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await parseJsonOrThrow(res)) as AssignmentApiRow;
  return fromApiRow(data);
}

export async function deleteAssignment(id: string): Promise<void> {
  const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" });
  if (res.status !== 204 && !res.ok) {
    await parseJsonOrThrow(res);
  }
}

export interface RewardSummary {
  studentId: string;
  studentName: string;
  balance: number;
  holdback: number;
  available: number;
  rewardType: string;
  payoutPending: boolean;
  pendingPayoutId: string | null;
}

export async function fetchRewardSummary(): Promise<RewardSummary> {
  const res = await fetch("/api/rewards/summary");
  return (await parseJsonOrThrow(res)) as RewardSummary;
}

export interface RewardTransaction {
  id: string;
  amount: number;
  reason: string;
  subject: string | null;
  type: string | null;
  createdAt: string;
}

export async function fetchRewardTransactions(): Promise<RewardTransaction[]> {
  const res = await fetch("/api/rewards/transactions");
  return (await parseJsonOrThrow(res)) as RewardTransaction[];
}

export interface PayoutRequestRow {
  id: string;
  amount: number;
  holdbackAmount: number;
  status: "pending" | "paid" | "denied" | "delayed";
  requestedAt: string;
  resolvedAt: string | null;
}

export async function fetchPayouts(): Promise<PayoutRequestRow[]> {
  const res = await fetch("/api/payouts");
  return (await parseJsonOrThrow(res)) as PayoutRequestRow[];
}

export async function requestPayout(): Promise<PayoutRequestRow> {
  const res = await fetch("/api/payouts", { method: "POST" });
  return (await parseJsonOrThrow(res)) as PayoutRequestRow;
}

export async function resolvePayout(id: string, action: "approve" | "deny"): Promise<PayoutRequestRow> {
  const res = await fetch(`/api/payouts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  return (await parseJsonOrThrow(res)) as PayoutRequestRow;
}

export async function fetchSavingsGoal(): Promise<SavingsGoal | null> {
  const res = await fetch("/api/savings-goal");
  return (await parseJsonOrThrow(res)) as SavingsGoal | null;
}

export async function saveSavingsGoal(goal: SavingsGoal): Promise<SavingsGoal> {
  const res = await fetch("/api/savings-goal", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(goal),
  });
  return (await parseJsonOrThrow(res)) as SavingsGoal;
}

export async function fetchRewardSettings(): Promise<RewardSettings> {
  const res = await fetch("/api/reward-settings");
  return (await parseJsonOrThrow(res)) as RewardSettings;
}

export async function saveRewardSettings(settings: RewardSettings): Promise<RewardSettings> {
  const res = await fetch("/api/reward-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return (await parseJsonOrThrow(res)) as RewardSettings;
}

export interface FamilyAccount {
  id: string;
  name: string;
  role: "parent" | "student";
  email: string;
}

export async function fetchFamilyAccounts(): Promise<FamilyAccount[]> {
  const res = await fetch("/api/users");
  return (await parseJsonOrThrow(res)) as FamilyAccount[];
}

export interface PasswordResetResult {
  userId: string;
  name: string;
  email: string;
  password: string;
}

export async function resetUserPassword(userId: string): Promise<PasswordResetResult> {
  const res = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return (await parseJsonOrThrow(res)) as PasswordResetResult;
}
