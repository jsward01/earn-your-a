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
  /** Red count on a tab (e.g. unread messages); 0 or missing shows nothing. */
  badges?: Partial<Record<View, number>>;
  onSelect: (view: View) => void;
}

export function BottomNav({ navs, view, isParent, payoutPending, badges, onSelect }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex pb-[env(safe-area-inset-bottom)]">
      {navs.map(nav => {
        const badge = badges?.[nav.id] ?? 0;
        return (
        <button key={nav.id} onClick={() => onSelect(nav.id)} aria-label={badge > 0 ? `${nav.label}, ${badge} unread` : undefined}
          className={`flex-1 min-w-0 min-h-16 flex flex-col items-center justify-center gap-0.5 py-2 transition-all relative active:bg-gray-100 ${view === nav.id ? (isParent ? "text-emerald-700" : "text-indigo-600") : "text-gray-400"}`}>
          <span className="text-xl">{nav.icon}</span>
          <span className="text-[10px] min-[480px]:text-xs font-medium whitespace-nowrap">{nav.label}</span>
          {nav.id === "dashboard" && payoutPending && isParent && <div className="absolute top-2 left-1/2 ml-3 w-3 h-3 bg-yellow-400 rounded-full" />}
          {badge > 0 && (
            <span className="absolute top-1.5 left-1/2 ml-2 min-w-5 h-5 px-1 bg-red-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center" aria-hidden="true">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </button>
        );
      })}
    </div>
  );
}
