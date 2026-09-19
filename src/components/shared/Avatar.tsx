import { useState } from "react";

interface AvatarProps {
  /** `preset:<id>`, an uploaded `data:image/...` URL, or empty for initials. */
  avatar?: string | null;
  name: string;
  size?: number;
  /** Neutral gray initials, for accounts that don't get a picture (parents). */
  muted?: boolean;
  className?: string;
}

function avatarSrc(avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  if (avatar.startsWith("preset:")) return `/avatars/${encodeURIComponent(avatar.slice("preset:".length))}.webp`;
  if (avatar.startsWith("data:image/")) return avatar;
  return null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : "");
}

export function Avatar({ avatar, name, size = 40, muted = false, className = "" }: AvatarProps) {
  const src = avatarSrc(avatar);
  // A preset that's been removed from public/avatars falls back to initials rather than a broken image.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const style = { width: size, height: size };

  if (src && src !== failedSrc) {
    return <img src={src} alt={name} style={style} onError={() => setFailedSrc(src)} className={`rounded-full object-cover shrink-0 ${className}`} />;
  }
  return (
    <div
      style={{ ...style, fontSize: size * 0.4 }}
      aria-label={name}
      className={`rounded-full ${muted ? "bg-gray-100 text-gray-500" : "bg-indigo-100 text-indigo-700"} font-bold flex items-center justify-center shrink-0 ${className}`}
    >
      {initials(name)}
    </div>
  );
}
