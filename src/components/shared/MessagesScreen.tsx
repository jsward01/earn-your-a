import { useState } from "react";
import type { ChatMessage, MessageSender } from "../../types";

interface MessagesScreenProps {
  isParent: boolean;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: 1, from: "parent", text: "Hey! Great job on that History test! 🎉", time: "Mon 4:30 PM" },
  { id: 2, from: "student", text: "Thanks dad! I studied really hard for it.", time: "Mon 4:45 PM" },
  { id: 3, from: "parent", text: "Don't forget you have that Science quiz makeup due by Friday.", time: "Tue 9:00 AM" },
  { id: 4, from: "student", text: "I know, I'm going to retake it tomorrow!", time: "Tue 9:15 AM" },
];

export function MessagesScreen({ isParent }: MessagesScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const me: MessageSender = isParent ? "parent" : "student";

  function send() {
    if (!input.trim()) return;
    setMessages([...messages, { id: messages.length + 1, from: me, text: input, time: "Now" }]);
    setInput("");
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 130px)" }}>
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-lg">{isParent ? "👩‍🎓" : "👨"}</div>
        <div><p className="font-bold text-gray-800 text-sm">{isParent ? "Sarah (Daughter)" : "Dad"}</p><p className="text-xs text-green-500">Online</p></div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.from === me ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-xs rounded-2xl px-4 py-2.5 ${msg.from === me ? "bg-indigo-600 text-white rounded-br-sm" : "bg-white text-gray-800 shadow-sm rounded-bl-sm"}`}>
              <p className="text-sm">{msg.text}</p>
              <p className={`text-xs mt-1 ${msg.from === me ? "text-indigo-300" : "text-gray-400"}`}>{msg.time}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex gap-2">
        <input className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder={`Message ${isParent ? "Sarah" : "Dad"}...`} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} />
        <button onClick={send} className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg">↑</button>
      </div>
    </div>
  );
}
