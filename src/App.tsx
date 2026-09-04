import { useEffect, useState } from "react";
import type { AuthUser, Assignment, View } from "./types";
import { INITIAL_ASSIGNMENTS } from "./data/mockData";
import { getRewardStatus } from "./lib/rewards";
import { fetchCurrentUser, logout as apiLogout } from "./lib/api";
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
  const [assignments, setAssignments] = useState<Assignment[]>(INITIAL_ASSIGNMENTS);
  const [payoutPending, setPayoutPending] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .finally(() => setCheckingSession(false));
  }, []);

  const totalEarned = assignments.reduce((s, a) => {
    const r = getRewardStatus(a);
    return s + (r.earned ?? 0);
  }, 0);

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
        {!isParent && view === "dashboard" && <StudentDashboard assignments={assignments} setAssignments={setAssignments} />}
        {!isParent && view === "rewards" && <StudentRewards payoutPending={payoutPending} setPayoutPending={setPayoutPending} />}
        {view === "messages" && <MessagesScreen isParent={isParent} />}
        {view === "calendar" && <CalendarView assignments={assignments} isParent={isParent} />}
        {view === "weekly" && <WeeklySummary assignments={assignments} isParent={isParent} />}
        {view === "notifications" && <NotificationCenter assignments={assignments} isParent={isParent} payoutPending={payoutPending} />}
        {!isParent && view === "ai" && <AIBreakdown />}
        {!isParent && view === "profile" && <StudentProfile />}
        {isParent && view === "dashboard" && <ParentOverview assignments={assignments} payoutPending={payoutPending} setPayoutPending={setPayoutPending} />}
        {isParent && view === "assignments" && <StudentDashboard assignments={assignments} setAssignments={setAssignments} />}
        {isParent && view === "settings" && <ParentSettings />}
      </div>

      <BottomNav navs={navs} view={view} isParent={isParent} payoutPending={payoutPending} onSelect={setView} />
    </div>
  );
}
