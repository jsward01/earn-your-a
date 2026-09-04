const CONNECTED_ACCOUNTS = [
  { name: "Google Classroom", icon: "🎓", status: "Connected", color: "text-green-600" },
  { name: "Canvas", icon: "🖼️", status: "Connect", color: "text-indigo-500" },
  { name: "Infinite Campus", icon: "🏫", status: "Import CSV", color: "text-indigo-500" },
];

export function StudentProfile() {
  return (
    <div className="pb-4 px-4 pt-4 space-y-4">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-6 text-white text-center shadow-lg">
        <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">👩‍🎓</div>
        <p className="text-xl font-bold">Sarah</p>
        <p className="text-indigo-200 text-sm">10th Grade • Student</p>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <p className="text-xs text-gray-400 font-medium">CONNECTED ACCOUNTS</p>
        {CONNECTED_ACCOUNTS.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3"><span className="text-xl">{item.icon}</span><p className="text-sm font-medium text-gray-700">{item.name}</p></div>
            <span className={`text-sm font-semibold ${item.color}`}>{item.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
