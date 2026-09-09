import { useCallback, useEffect, useState } from "react";
import type { AuthUser, Assignment, View } from "./types";
import { fetchCurrentUser, fetchAssignments, fetchRewardSummary, logout as apiLogout, type RewardSummary } from "./lib/api";
import { LoginScreen } from "./components/LoginScreen";
import { AppHeader } from "./components/AppHeader";
import { BottomNav, type NavItem } from "./components/BottomNav";
import { StudentDashboard } from "./components/student/StudentDashboard";
import { StudentRewards } from "./components/student/StudentRewards";
import { StudentProfile } from "./components/student/StudentProfile";
import { AIBreakdown } from "./components/student/AIBreakdown";
import { ParentOverview } from "./components/parent/ParentOverview";
import { ParentSettings } from "./components/parent/ParentSettings";
import { MessagesScreen } from "./components/shared/MessagesScreen";
import { CalendarView } from "./components/shared/CalendarView";
import { WeeklySummary } from "./components/shared/WeeklySummary";
import { NotificationCenter } from "./components/shared/NotificationCenter";

const STUDENT_NAVS: NavItem[] = [
  { id: "dashboard", icon: "📚", label: "Assignments" },
  { id: "calendar", icon: "📅", label: "Calendar" },
  { id: "ai", icon: "🤖", label: "AI Planner" },
  { id: "rewards", icon: "💰", label: "Rewards" },
  { id: "weekly", icon: "📊", label: "Weekly" },
  { id: "notifications", icon: "🔔", label: "Alerts" },
];

const PARENT_NAVS: NavItem[] = [
  { id: "dashboard", icon: "📊", label: "Overview" },
  { id: "calendar", icon: "📅", label: "Calendar" },
  { id: "weekly", icon: "📋", label: "Weekly" },
  { id: "notifications", icon: "🔔", label: "Alerts" },
  { id: "messages", icon: "💬", label: "Messages" },
  { id: "settings", icon: "⚙️", label: "Settings" },
];

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [summary, setSummary] = useState<RewardSummary | null>(null);

  const refreshSummary = useCallback(() => {
    fetchRewardSummary()
      .then(setSummary)
      .catch(err => console.error("Failed to load reward summary", err));
  }, []);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchAssignments()
      .then(setAssignments)
      .catch(err => console.error("Failed to load assignments", err));
    refreshSummary();
  }, [user, refreshSummary]);

  const totalEarned = summary?.balance ?? 0;
  const payoutPending = summary?.payoutPending ?? false;
  const studentName = summary?.studentName ?? "your student";

  if (checkingSession) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!user) {
    return <LoginScreen onLogin={u => { setUser(u); setView("dashboard"); }} />;
  }

  const isParent = user.role === "parent";
  const navs = isParent ? PARENT_NAVS : STUDENT_NAVS;

  async function handleLogout() {
    await apiLogout();
    setUser(null);
    setAssignments([]);
    setSummary(null);
    setView("dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <AppHeader
        isParent={isParent}
        totalEarned={totalEarned}
        payoutPending={payoutPending}
        onLogout={handleLogout}
      />

      <div className="overflow-y-auto" style={{ height: "calc(100vh - 130px)" }}>
        {!isParent && view === "dashboard" && <StudentDashboard assignments={assignments} setAssignments={setAssignments} onChanged={refreshSummary} />}
        {!isParent && view === "rewards" && <StudentRewards summary={summary} onChanged={refreshSummary} />}
        {view === "messages" && <MessagesScreen isParent={isParent} />}
        {view === "calendar" && <CalendarView assignments={assignments} isParent={isParent} />}
        {view === "weekly" && <WeeklySummary assignments={assignments} isParent={isParent} studentName={studentName} />}
        {view === "notifications" && <NotificationCenter assignments={assignments} isParent={isParent} payoutPending={payoutPending} studentName={studentName} />}
        {!isParent && view === "ai" && <AIBreakdown />}
        {!isParent && view === "profile" && <StudentProfile />}
        {isParent && view === "dashboard" && <ParentOverview assignments={assignments} summary={summary} onChanged={refreshSummary} />}
        {isParent && view === "assignments" && <StudentDashboard assignments={assignments} setAssignments={setAssignments} onChanged={refreshSummary} />}
        {isParent && view === "settings" && <ParentSettings />}
      </div>

      <BottomNav navs={navs} view={view} isParent={isParent} payoutPending={payoutPending} onSelect={setView} />
    </div>
  );
}
