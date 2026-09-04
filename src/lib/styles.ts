const SUBJECT_COLORS: Record<string, string> = {
  Math: "bg-purple-500",
  English: "bg-blue-500",
  Science: "bg-green-500",
  History: "bg-yellow-500",
  Spanish: "bg-red-500",
  PE: "bg-orange-500",
  Art: "bg-pink-500",
};

const SUBJECT_LIGHT: Record<string, string> = {
  Math: "bg-purple-100 text-purple-700",
  English: "bg-blue-100 text-blue-700",
  Science: "bg-green-100 text-green-700",
  History: "bg-yellow-100 text-yellow-700",
  Spanish: "bg-red-100 text-red-700",
  PE: "bg-orange-100 text-orange-700",
  Art: "bg-pink-100 text-pink-700",
};

export function getSubjectColor(subject: string): string {
  return SUBJECT_COLORS[subject] || "bg-gray-500";
}

export function getSubjectLight(subject: string): string {
  return SUBJECT_LIGHT[subject] || "bg-gray-100 text-gray-700";
}

export function getStatusBadge(status: string): string {
  if (status === "graded") return "bg-blue-100 text-blue-700";
  if (status === "missing") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

export function getDaysLeftColor(daysLeft: number): string {
  if (daysLeft <= 1) return "bg-red-100 text-red-700 border-red-300";
  if (daysLeft <= 3) return "bg-yellow-100 text-yellow-700 border-yellow-300";
  return "bg-green-100 text-green-700 border-green-300";
}
