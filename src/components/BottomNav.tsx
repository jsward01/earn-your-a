import type { View } from "../types";

export interface NavItem {
  id: View;
  icon: string;
  label: string;
}

interface BottomNavProps {
  navs: NavItem[];
  view: View;
  isParent: boolean;
  payoutPending: boolean;
  onSelect: (view: View) => void;
}

export function BottomNav({ navs, view, isParent, payoutPending, onSelect }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-3 px-4">
      {navs.map(nav => (
        <button key={nav.id} onClick={() => onSelect(nav.id)}
          className={`flex flex-col items-center gap-0.5 transition-all relative ${view === nav.id ? (isParent ? "text-emerald-700" : "text-indigo-600") : "text-gray-400"}`}>
          <span className="text-xl">{nav.icon}</span>
          <span className="text-xs font-medium">{nav.label}</span>
          {nav.id === "dashboard" && payoutPending && isParent && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full" />}
        </button>
      ))}
    </div>
  );
}
