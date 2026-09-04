interface AppHeaderProps {
  isParent: boolean;
  totalEarned: number;
  payoutPending: boolean;
  onLogout: () => void;
}

export function AppHeader({ isParent, totalEarned, payoutPending, onLogout }: AppHeaderProps) {
  return (
    <div className={`${isParent ? "bg-emerald-700" : "bg-indigo-600"} text-white px-4 py-4 flex items-center justify-between shadow-lg`}>
      <div>
        <h1 className="text-xl font-bold tracking-tight">🎓 Earn Your A</h1>
        <p className={`${isParent ? "text-emerald-200" : "text-indigo-200"} text-xs`}>
          {isParent ? "Parent Dashboard" : "Student Dashboard"}
          {payoutPending && isParent && <span className="ml-2 bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full text-xs font-bold">💸 Payout Pending</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className={`${isParent ? "bg-emerald-800" : "bg-indigo-700"} rounded-xl px-3 py-2 text-center`}>
          <p className={`${isParent ? "text-emerald-300" : "text-indigo-300"} text-xs`}>Balance</p>
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
