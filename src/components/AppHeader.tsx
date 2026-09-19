import logo from "../assets/logo.png";

export interface StudentOption {
  id: string;
  name: string;
}

interface AppHeaderProps {
  isParent: boolean;
  totalEarned: number;
  payoutPending: boolean;
  students: StudentOption[];
  selectedStudentId: string | null;
  onSelectStudent: (id: string) => void;
  onLogout: () => void;
}

export function AppHeader({ isParent, totalEarned, payoutPending, students, selectedStudentId, onSelectStudent, onLogout }: AppHeaderProps) {
  const showSwitcher = isParent && students.length > 1;
  const selected = students.find(s => s.id === selectedStudentId);

  return (
    <div className={`${isParent ? "bg-emerald-700" : "bg-indigo-600"} text-white px-4 py-4 grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_1fr] items-center gap-y-3 shadow-lg`}>
      <div className="flex items-center gap-3">
        <img src={logo} alt="Earn Your A" className="h-14 drop-shadow" />
        <p className={`${isParent ? "text-emerald-200" : "text-indigo-200"} text-xs`}>
          {isParent ? "Parent Dashboard" : "Student Dashboard"}
          {payoutPending && isParent && <span className="ml-2 bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full text-xs font-bold">💸 Payout Pending</span>}
        </p>
      </div>

      {showSwitcher && (
        <label className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1 flex items-center justify-center gap-2">
          <span className="text-emerald-200 text-xs">Student</span>
          <select
            value={selectedStudentId ?? ""}
            onChange={e => onSelectStudent(e.target.value)}
            className="bg-emerald-800 text-white text-sm font-semibold rounded-xl px-3 py-2 border border-emerald-500 focus:outline-none focus:ring-2 focus:ring-white [&>option]:bg-white [&>option]:text-gray-900"
          >
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}

      <div className="flex items-center gap-2 justify-self-end sm:col-start-3 sm:row-start-1">
        <div className={`${isParent ? "bg-emerald-800" : "bg-indigo-700"} rounded-xl px-3 py-2 text-center`}>
          <p className={`${isParent ? "text-emerald-300" : "text-indigo-300"} text-xs`}>
            {showSwitcher && selected ? `${selected.name.split(" ")[0]}'s Balance` : "Balance"}
          </p>
          <p className={`text-lg font-bold ${totalEarned >= 0 ? "text-green-300" : "text-red-300"}`}>${totalEarned.toFixed(2)}</p>
        </div>
        <button onClick={onLogout}
          className={`${isParent ? "bg-emerald-600" : "bg-indigo-500"} rounded-xl px-3 py-2 text-xs font-medium`}>
          Log out
        </button>
      </div>
    </div>
  );
}
