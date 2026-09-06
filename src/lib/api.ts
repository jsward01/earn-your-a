import type { AuthUser, Assignment } from "../types";
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
