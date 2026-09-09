import { useState } from "react";
import { changePassword } from "../../lib/api";

export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      setSaved(false);
      setError(null);
    };
  }

  async function handleSubmit() {
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      setSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
      <p className="text-xs text-gray-400 font-medium">CHANGE MY PASSWORD</p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <input
        type="password"
        placeholder="Current password"
        value={currentPassword}
        onChange={updateField(setCurrentPassword)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
      <input
        type="password"
        placeholder="New password (min. 8 characters)"
        value={newPassword}
        onChange={updateField(setNewPassword)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
      <input
        type="password"
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={updateField(setConfirmPassword)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
      <button
        onClick={handleSubmit}
        disabled={saving || !currentPassword || newPassword.length < 8 || !confirmPassword}
        className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40"
      >
        {saving ? "Updating…" : saved ? "✓ Password Updated!" : "Update Password"}
      </button>
    </div>
  );
}
