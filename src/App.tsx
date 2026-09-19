import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthUser, Assignment, RewardSettings, View } from "./types";
import { fetchCurrentUser, fetchAssignments, fetchFamilyAccounts, fetchRewardSettings, fetchRewardSummary, logout as apiLogout, setActiveStudent, type RewardSummary } from "./lib/api";
import { DEFAULT_REWARD_SETTINGS } from "./lib/rewards";
import { RewardSettingsContext } from "./lib/rewardSettingsContext";
import { LoginScreen } from "./components/LoginScreen";
import { AppHeader, type StudentOption } from "./components/AppHeader";
import { BottomNav, type NavItem } from "./components/BottomNav";
import { StudentDashboard } from "./components/student/StudentDashboard";
import { StudentRewards } from "./components/student/StudentRewards";
import { StudentProfile } from "./components/student/StudentProfile";
import { AIBreakdown } from "./components/student/AIBreakdown";
import { ParentOverview } from "./components/parent/ParentOverview";
import { ParentSettings } from "./components/parent/ParentSettings";
import { AssignmentEditor } from "./components/parent/AssignmentEditor";
import { BalancePage } from "./components/shared/BalancePage";
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
  { id: "profile", icon: "👤", label: "Profile" },
];

const PARENT_NAVS: NavItem[] = [
  { id: "dashboard", icon: "📊", label: "Overview" },
  { id: "calendar", icon: "📅", label: "Calendar" },
  { id: "weekly", icon: "📋", label: "Weekly" },
  { id: "notifications", icon: "🔔", label: "Alerts" },
  { id: "messages", icon: "💬", label: "Messages" },
  { id: "settings", icon: "⚙️", label: "Settings" },
];

const SELECTED_STUDENT_KEY = "selectedStudentId";

function readSavedStudentId(): string | null {
  try { return localStorage.getItem(SELECTED_STUDENT_KEY); } catch { return null; }
}

function saveStudentId(id: string): void {
  try { localStorage.setItem(SELECTED_STUDENT_KEY, id); } catch { /* per-viewer convenience only */ }
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [summary, setSummary] = useState<RewardSummary | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [rewardSettings, setRewardSettings] = useState<RewardSettings>(DEFAULT_REWARD_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  // Mirrors selectedStudentId so async callbacks can tell whether a response is still for the current student.
  const selectedRef = useRef<string | null>(null);
  // The parent assignment editor (null assignment = add new work). Lives here so Overview and the Balance page share it.
  const [editor, setEditor] = useState<{ assignment: Assignment | null } | null>(null);

  // Point every student-scoped request at `id`, and drop the previous student's
  // data right away so it can't flash under the new student's name.
  const applySelection = useCallback((id: string | null) => {
    selectedRef.current = id;
    setActiveStudent(id);
    setSelectedStudentId(id);
    setAssignments([]);
    setSummary(null);
    if (id) saveStudentId(id);
  }, []);

  const loadStudents = useCallback(() => {
    fetchFamilyAccounts()
      .then(accounts => {
        const list = accounts.filter(a => a.role === "student").map(a => ({ id: a.id, name: a.name }));
        setStudents(list);
        const saved = readSavedStudentId();
        const next =
          list.find(s => s.id === selectedRef.current)?.id ??
          list.find(s => s.id === saved)?.id ??
          list[0]?.id ??
          null;
        if (next !== selectedRef.current) applySelection(next);
      })
      .catch(err => console.error("Failed to load students", err))
      .finally(() => setStudentsLoaded(true));
  }, [applySelection]);

  const reloadAssignments = useCallback(() => {
    const requestedFor = selectedRef.current;
    fetchAssignments()
      .then(a => { if (selectedRef.current === requestedFor) setAssignments(a); })
      .catch(err => console.error("Failed to load assignments", err));
  }, []);

  const refreshSummary = useCallback(() => {
    const requestedFor = selectedRef.current;
    fetchRewardSummary()
      .then(s => { if (selectedRef.current === requestedFor) setSummary(s); })
      .catch(err => console.error("Failed to load reward summary", err));
  }, []);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (user?.role === "parent") loadStudents();
  }, [user, loadStudents]);

  // Reward settings are per family (not per student), so they load once per login rather than per selection.
  useEffect(() => {
    if (!user) return;
    fetchRewardSettings()
      .then(setRewardSettings)
      .catch(err => console.error("Failed to load reward settings; showing house defaults", err))
      .finally(() => setSettingsLoaded(true));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (user.role === "parent" && !selectedStudentId) return;
    let cancelled = false;
    fetchAssignments()
      .then(a => { if (!cancelled) setAssignments(a); })
      .catch(err => console.error("Failed to load assignments", err));
    refreshSummary();
    return () => { cancelled = true; };
  }, [user, selectedStudentId, refreshSummary]);

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

  function handleAssignmentSaved(a: Assignment) {
    setAssignments(prev => (prev.some(x => x.id === a.id) ? prev.map(x => (x.id === a.id ? a : x)) : [...prev, a]));
    refreshSummary();
  }

  function handleAssignmentDeleted(id: string) {
    setAssignments(prev => prev.filter(x => x.id !== id));
    refreshSummary();
  }

  function openBalance() {
    reloadAssignments(); // pick up anything a payout just archived
    setView("balance");
  }

  async function handleLogout() {
    await apiLogout();
    setUser(null);
    setAssignments([]);
    setSummary(null);
    setStudents([]);
    setStudentsLoaded(false);
    setRewardSettings(DEFAULT_REWARD_SETTINGS);
    setSettingsLoaded(false);
    selectedRef.current = null;
    setActiveStudent(null);
    setSelectedStudentId(null);
    setView("dashboard");
  }

  return (
    <RewardSettingsContext.Provider value={rewardSettings}>
    <div className="h-screen flex flex-col bg-gray-50 font-sans">
      <AppHeader
        isParent={isParent}
        totalEarned={totalEarned}
        viewedStudent={summary ? { name: summary.studentName, avatar: summary.studentAvatar } : null}
        payoutPending={payoutPending}
        students={students}
        selectedStudentId={selectedStudentId}
        onSelectStudent={applySelection}
        onBalanceClick={openBalance}
        onLogout={handleLogout}
      />

      {/* Keyed by student so switching remounts (and so refetches) every student-scoped view.
          Settings isn't student-scoped, so it keeps its state (e.g. a just-created temp password). */}
      <div key={view === "settings" ? "settings" : selectedStudentId ?? "none"} className="flex-1 min-h-0 overflow-y-auto pb-20">
        {isParent && studentsLoaded && students.length === 0 && view !== "settings" && (
          <div className="p-6 text-center text-sm text-gray-500">
            No students yet. Add one in Settings → Account Access.
          </div>
        )}
        {!isParent && view === "dashboard" && <StudentDashboard assignments={assignments} setAssignments={setAssignments} onChanged={refreshSummary} />}
        {!isParent && view === "rewards" && <StudentRewards summary={summary} onChanged={refreshSummary} />}
        {view === "messages" && <MessagesScreen isParent={isParent} />}
        {view === "calendar" && <CalendarView assignments={assignments} isParent={isParent} />}
        {view === "weekly" && <WeeklySummary assignments={assignments} isParent={isParent} studentName={studentName} />}
        {view === "notifications" && <NotificationCenter key={settingsLoaded ? "loaded" : "defaults"} assignments={assignments} isParent={isParent} payoutPending={payoutPending} studentName={studentName} />}
        {!isParent && view === "ai" && <AIBreakdown />}
        {!isParent && view === "profile" && <StudentProfile name={user.name} />}
        {view === "balance" && (
          <BalancePage
            assignments={assignments}
            summary={summary}
            readOnly={!isParent}
            onBack={() => setView("dashboard")}
            onEdit={a => setEditor({ assignment: a })}
            onAdd={() => setEditor({ assignment: null })}
          />
        )}
        {isParent && view === "dashboard" && (
          <ParentOverview
            assignments={assignments}
            summary={summary}
            onChanged={() => { reloadAssignments(); refreshSummary(); }}
            onEdit={a => setEditor({ assignment: a })}
          />
        )}
        {isParent && view === "settings" && <ParentSettings user={user} onStudentsChanged={() => { loadStudents(); refreshSummary(); }} onSettingsSaved={setRewardSettings} />}
      </div>

      <BottomNav navs={navs} view={view} isParent={isParent} payoutPending={payoutPending} onSelect={setView} />
      {isParent && editor && (
        <AssignmentEditor
          assignment={editor.assignment}
          studentName={summary?.studentName ?? "student"}
          onClose={() => setEditor(null)}
          onSaved={handleAssignmentSaved}
          onDeleted={handleAssignmentDeleted}
        />
      )}
    </div>
    </RewardSettingsContext.Provider>
  );
}
