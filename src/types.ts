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
  rewardValue?: number;
}

export interface RewardStatus {
  earned: number | null;
  label: string;
  color: string;
}

export interface WeeklyHistoryItem {
  title: string;
  subject: string;
  amount: number;
}

export interface WeeklyHistoryWeek {
  week: string;
  net: number;
  items: WeeklyHistoryItem[];
}

export interface PayoutHistoryEntry {
  date: string;
  amount: number;
  status: string;
  method: string;
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

export interface NotificationSettings {
  sms: boolean;
  email: boolean;
  inApp: boolean;
  due3days: boolean;
  due1day: boolean;
  dueToday: boolean;
  makeup: boolean;
  payout: boolean;
  grade: boolean;
  weekly: boolean;
  phone: string;
  emailAddr: string;
  quietStart: string;
  quietEnd: string;
}

export type Role = "student" | "parent";

export interface AuthUser {
  id: string;
  familyId: string;
  role: Role;
  name: string;
  email: string;
}

export type View =
  | "dashboard"
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

export interface RewardSettings {
  assignmentReward: number;
  testReward: number;
  passingThreshold: number;
  makeupWindow: number;
  holdback: number;
  rewardType: RewardType;
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
  status: AssignmentStatus;
  grade: string;
}

export type MessageSender = "parent" | "student";

export interface ChatMessage {
  id: number;
  from: MessageSender;
  text: string;
  time: string;
}

export type PayoutAction = "approve" | "delay" | "deny";
