import { useState } from "react";
import { ChangePasswordCard } from "../shared/ChangePasswordCard";
import { Avatar } from "../shared/Avatar";
import { AvatarPicker } from "../shared/AvatarPicker";
import { AppearanceCard } from "../shared/AppearanceCard";
import { AccentCard } from "../shared/AccentCard";

const CONNECTED_ACCOUNTS = [
  { name: "Google Classroom", icon: "🎓" },
  { name: "Canvas", icon: "🖼️" },
  { name: "Infinite Campus", icon: "🏫" },
];

interface StudentProfileProps {
  userId: string;
  name: string;
  /** null until the reward summary loads, or when no picture has been chosen. */
  avatar: string | null;
  /** After a new picture is saved, so the header and this page pick it up. */
  onAvatarChanged: () => void;
  accent: string | null;
  onAccentSaved: (accent: string | null) => void;
}

export function StudentProfile({ userId, name, avatar, onAvatarChanged, accent, onAccentSaved }: StudentProfileProps) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="pb-4 px-4 pt-4 space-y-4">
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-6 text-white text-center shadow-lg">
        <button onClick={() => setPicking(true)} className="relative mx-auto mb-3 block" aria-label="Change your profile picture">
          <Avatar avatar={avatar} name={name} size={80} className="ring-4 ring-white/30" />
          <span className="absolute -bottom-0.5 -right-0.5 bg-white text-gray-700 rounded-full w-7 h-7 text-sm flex items-center justify-center shadow">✏️</span>
        </button>
        <p className="text-xl font-bold">{name}</p>
        <p className="text-indigo-200 text-sm">Student</p>
        <button onClick={() => setPicking(true)} className="mt-3 bg-white/20 hover:bg-white/30 rounded-xl px-3 py-1.5 text-xs font-semibold">
          {avatar ? "Change picture" : "Choose a picture"}
        </button>
      </div>
      {picking && (
        <AvatarPicker student={{ id: userId, name, avatar }} onClose={() => setPicking(false)} onSaved={onAvatarChanged} />
      )}
      <AppearanceCard />
      <AccentCard role="student" accent={accent} onSaved={onAccentSaved} />
      <ChangePasswordCard />
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <p className="text-xs text-gray-400 font-medium">CONNECTED ACCOUNTS</p>
        {CONNECTED_ACCOUNTS.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3"><span className="text-xl">{item.icon}</span><p className="text-sm font-medium text-gray-700">{item.name}</p></div>
            <span className="text-sm font-semibold text-gray-400">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}
