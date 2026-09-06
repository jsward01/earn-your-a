import { useState } from "react";
import type { AuthUser } from "../types";
import { login } from "../lib/api";
import logo from "../assets/logo.png";

interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex flex-col items-center justify-center px-6">
      <div className="text-center mb-10">
        <img src={logo} alt="Earn Your A" className="w-56 mx-auto mb-2 drop-shadow-lg" />
        <p className="text-indigo-200 mt-2">Academic accountability & rewards</p>
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full bg-white bg-opacity-95 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full bg-white bg-opacity-95 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white"
        />
        {error && <p className="text-red-200 text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={!email || !password || loading}
          className="w-full bg-white text-indigo-700 font-bold py-4 rounded-2xl shadow-lg text-lg disabled:opacity-50 hover:bg-indigo-50 transition-all"
        >
          {loading ? "Logging in..." : "Log In"}
        </button>
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="w-full text-center text-indigo-200 text-sm hover:text-white transition-colors"
        >
          Forgot password or username?
        </button>
      </form>
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-end z-50">
          <div className="bg-white w-full max-w-sm rounded-t-3xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Forgot password or username?</h2>
            <p className="text-sm text-gray-500">
              This app doesn't send reset emails — ask your parent to look up your username or reset your
              password for you. They can do it from the Parent Dashboard under Settings → Account Access.
            </p>
            <button
              onClick={() => setShowHelp(false)}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
