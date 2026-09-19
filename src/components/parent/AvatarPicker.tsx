import { useRef, useState } from "react";
import { PRESET_AVATARS, presetAvatarValue } from "../../data/avatars";
import { setStudentAvatar } from "../../lib/api";
import { fileToAvatarDataUrl } from "../../lib/avatarImage";
import { Avatar } from "../shared/Avatar";

interface AvatarPickerProps {
  student: { id: string; name: string; avatar: string | null };
  onClose: () => void;
  onSaved: () => void;
}

export function AvatarPicker({ student, onClose, onSaved }: AvatarPickerProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(avatar: string | null) {
    setBusy(true);
    setError(null);
    try {
      await setStudentAvatar(student.id, avatar);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the picture");
      setBusy(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await save(await fileToAvatarDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't use that image");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-md max-h-full overflow-y-auto rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar avatar={student.avatar} name={student.name} size={56} />
          <div>
            <h2 className="text-lg font-bold text-gray-800">Profile picture</h2>
            <p className="text-sm text-gray-500">{student.name}</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={e => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
          >
            📷 Upload a photo
          </button>
          <p className="text-xs text-gray-400 mt-1.5 text-center">It's cropped to a square and shrunk automatically.</p>
        </div>

        <div>
          <p className="text-xs text-gray-400 font-medium mb-2">OR PICK ONE</p>
          <div className="grid grid-cols-5 gap-2">
            {PRESET_AVATARS.map(p => {
              const value = presetAvatarValue(p.id);
              const selected = student.avatar === value;
              return (
                <button
                  key={p.id}
                  onClick={() => save(value)}
                  disabled={busy}
                  title={p.label}
                  aria-label={p.label}
                  className={`rounded-full p-0.5 disabled:opacity-40 ${selected ? "ring-2 ring-indigo-600" : "ring-1 ring-transparent hover:ring-indigo-200"}`}
                >
                  <Avatar avatar={value} name={p.label} size={52} className="w-full h-auto aspect-square" />
                </button>
              );
            })}
          </div>
        </div>

        {student.avatar && (
          <button onClick={() => save(null)} disabled={busy} className="w-full text-sm text-red-500 disabled:opacity-40">
            Remove picture (use initials)
          </button>
        )}
        <button onClick={onClose} className="w-full text-gray-400 text-sm">Cancel</button>
      </div>
    </div>
  );
}
