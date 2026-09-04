import type { Role } from "../types";

interface LoginScreenProps {
  onLogin: (role: Role) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex flex-col items-center justify-center px-6">
      <div className="text-center mb-10">
        <p className="text-6xl mb-4">🎓</p>
        <h1 className="text-3xl font-bold text-white">Earn Your A</h1>
        <p className="text-indigo-200 mt-2">Academic accountability & rewards</p>
      </div>
      <div className="w-full max-w-sm space-y-4">
        <button onClick={() => onLogin("student")}
          className="w-full bg-white text-indigo-700 font-bold py-4 rounded-2xl shadow-lg text-lg flex items-center justify-center gap-3 hover:bg-indigo-50 transition-all">
          <span className="text-2xl">👩‍🎓</span> Login as Student
        </button>
        <button onClick={() => onLogin("parent")}
          className="w-full bg-indigo-500 bg-opacity-40 border-2 border-white border-opacity-40 text-white font-bold py-4 rounded-2xl text-lg flex items-center justify-center gap-3 hover:bg-opacity-50 transition-all">
          <span className="text-2xl">👨‍👩‍👧</span> Login as Parent
        </button>
      </div>
      <p className="text-indigo-300 text-xs mt-8">Demo mode — tap either to explore</p>
    </div>
  );
}
