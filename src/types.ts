export type AssignmentType = "assignment" | "quiz" | "test";
export type AssignmentStatus = "pending" | "graded" | "missing";

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  type: AssignmentType;
  dueDate: string; // YYYY-MM-DD
  status: AssignmentStatus;
  grade: number | null;
  daysLeft: number | null;
  makeupAvailable?: boolean;
  /** What the ledger recorded for this item (null = nothing, i.e. $0). Graded cards show this, not a recomputation. */
  recordedReward?: number | null;
  /** Set once a payout has settled this item: archived under Past Grades, no longer editable. */
  payoutId?: string | null;
  paidAt?: string | null;
  /** Due before the student's rewards started: recorded (grades, averages) but never earns or costs anything. */
  historyOnly?: boolean;
  /** In a class the parent set to Track only: recorded (grades, averages) but never earns or costs anything. */
  trackOnly?: boolean;
}

export interface RewardStatus {
  earned: number | null;
  label: string;
  color: string;
}

export interface SavingsGoal {
  name: string;
  amount: number;
}

export type NotificationTypeKey =
  | "due3days"
  | "due1day"
  | "dueToday"
  | "makeup"
  | "payout"
  | "grade"
  | "weekly";

export interface NotificationTypeMeta {
  icon: string;
  color: string;
  badge: string;
  label: string;
}

export interface AppNotification {
  id: string;
  type: NotificationTypeKey;
  read: boolean;
  time: string;
  title: string;
  body: string;
  subject?: string;
}

/** A user's own email alert choices (`/api/notification-settings`). */
export interface EmailAlertSettings {
  email: boolean;
  emailAddr: string;
  due1day: boolean;
  dueToday: boolean;
  makeup: boolean;
  payout: boolean;
  /** New messages in the family chat. */
  messages: boolean;
  /** No emails from quietStart until quietEnd (local hours 0–23, wrapping past midnight). Default 8pm–6am. */
  quietHours: boolean;
  quietStart: number;
  quietEnd: number;
  /** Students: false when a parent turned off email alerts for them (Settings → Family). Read-only. */
  allowedByParent?: boolean;
}

export type Role = "student" | "parent";

export interface AuthUser {
  id: string;
  familyId: string;
  role: Role;
  name: string;
  email: string;
  isAdmin: boolean;
  /** Their own accent color (src/lib/accent.ts); null = the role's default. */
  accent?: string | null;
}

export type View =
  | "dashboard"
  | "balance"
  | "calendar"
  | "ai"
  | "rewards"
  | "weekly"
  | "notifications"
  | "messages"
  | "settings"
  | "assignments"
  | "profile";

export type RewardType = "money" | "screen" | "points" | "custom";
export type PayoutSchedule = "request" | "monthly" | "manual";
export type HoldbackType = "amount" | "percent";

export interface RewardSettings {
  assignmentReward: number;
  quizReward: number;
  testReward: number;
  /** What finishing below the pass mark costs, per kind of work (0 = no penalty). */
  assignmentPenalty: number;
  quizPenalty: number;
  testPenalty: number;
  /** Missing work costs the same as a failing grade of its type (off = it just earns nothing). */
  penalizeMissing: boolean;
  passingThreshold: number;
  /** Days to retake missing or failing work; 0 = retakes are off. */
  makeupWindow: number;
  /** A fixed amount, or a percentage of the balance when holdbackType is "percent". */
  holdback: number;
  holdbackType: HoldbackType;
  rewardType: RewardType;
  /** The family's own word for the reward when rewardType is "custom" (blank shows "units"). */
  customUnit: string;
  excellenceBonus: boolean;
  streakBonus: boolean;
  payoutSchedule: PayoutSchedule;
}

export interface PlanStep {
  day: string;
  task: string;
  duration: string;
  tip?: string;
}

export interface AssignmentPlan {
  summary: string;
  estimatedHours: number;
  steps: PlanStep[];
}

/** A plan the AI Planner made, saved to the student's account (private to them). */
export interface SavedPlan {
  id: string;
  title: string;
  subject: string;
  type: string;
  dueDate: string;
  details: string;
  plan: AssignmentPlan;
  /** Indexes of the steps the student has checked off. */
  checked: number[];
  createdAt: string;
}

export interface AssignmentPlanForm {
  title: string;
  subject: string;
  type: string;
  dueDate: string;
  details: string;
}

export interface NewAssignmentForm {
  title: string;
  subject: string;
  type: AssignmentType;
  dueDate: string;
}

/** One message in a student's family chat (the student and all of the family's parents). */
export interface FamilyMessage {
  /** Order within the chat (also what "read up to" is measured in). */
  seq: number;
  id: string;
  senderId: string;
  senderName: string;
  senderRole: "parent" | "student";
  body: string;
  /** UTC "YYYY-MM-DD HH:MM:SS". */
  createdAt: string;
}

export interface MessageThread {
  /** false = a parent turned messaging off for this student (parents still see the history, nobody can post). */
  allowed: boolean;
  members: { id: string; name: string; role: "parent" | "student" }[];
  messages: FamilyMessage[];
}

export type PayoutAction = "approve" | "delay" | "deny";
