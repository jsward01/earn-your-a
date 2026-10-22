import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FamilyMessage, MessageThread } from "../../types";
import { fetchMessages, sendMessage } from "../../lib/api";
import { shortDateTime } from "../../lib/dates";

interface MessagesScreenProps {
  isParent: boolean;
  /** The signed-in user, to tell "my" messages from everyone else's. */
  userId: string;
  /** The student this chat is with (parents) or the student's own name. */
  studentName: string;
  /** Called after the chat has been loaded (and so marked read), to refresh the tab badge. */
  onRead: () => void;
}

/** How often an open chat checks for new messages. */
const POLL_MS = 10_000;
const MAX_LENGTH = 2000;

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * The family chat with one student: the student and all of the family's parents see every message. Messages can't be
 * deleted (Jonathan, Oct 21 2026). Checks for new ones every 10 seconds while the page is visible.
 */
export function MessagesScreen({ isParent, userId, studentName, onRead }: MessagesScreenProps) {
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Scroll to the newest message on first load, after sending, and when new ones arrive while already at the bottom.
  const stickToBottom = useRef(true);
  const lastSeq = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const t = await fetchMessages();
      setLoadError(null);
      const newest = t.messages.at(-1)?.seq ?? 0;
      if (newest !== lastSeq.current) {
        lastSeq.current = newest;
        setThread(t);
      } else {
        setThread(prev => (prev && prev.allowed === t.allowed ? prev : t));
      }
      onRead();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load messages.");
    }
  }, [onRead]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [thread]);

  function onScroll() {
    const el = listRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const msg = await sendMessage(text);
      stickToBottom.current = true;
      lastSeq.current = msg.seq;
      setThread(prev => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev));
      setInput("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Couldn't send. Please try again.");
    }
    setSending(false);
  }

  const mine = isParent ? "bg-emerald-700 text-white" : "bg-indigo-600 text-white";
  const mineTime = isParent ? "text-emerald-100" : "text-indigo-200";
  const others = thread?.members.filter(m => m.id !== userId).map(m => firstName(m.name)) ?? [];
  const title = isParent ? `Chat with ${firstName(studentName)}` : "Family chat";

  return (
    // h-full = the content scroller minus its bottom padding (pb-24), which already clears the bottom tab bar.
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <p className="font-bold text-gray-800 text-sm">💬 {title}</p>
        <p className="text-xs text-gray-400">
          {others.length > 0 ? `You, ${others.join(", ")}. Everyone here sees every message.` : "Everyone in the family chat sees every message."}
        </p>
      </div>

      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-gray-50" aria-live="polite">
        {!thread && !loadError && <p className="text-center text-sm text-gray-400 py-8">Loading…</p>}
        {loadError && !thread && <p className="text-center text-sm text-red-500 py-8">{loadError}</p>}
        {thread && thread.messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">No messages yet. Say hi 👋</p>
        )}
        {thread?.messages.map((msg, i) => (
          <Bubble key={msg.id} msg={msg} isMine={msg.senderId === userId} showName={msg.senderId !== userId && thread.messages[i - 1]?.senderId !== msg.senderId}
            mineClass={mine} mineTimeClass={mineTime} />
        ))}
      </div>

      {thread && !thread.allowed ? (
        <div className="bg-white border-t border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-500 text-center">
            Messaging is off for {firstName(studentName)}. Turn it on in Settings → Family to send messages.
          </p>
        </div>
      ) : (
        <div className="bg-white border-t border-gray-100 px-4 py-3 space-y-1">
          {sendError && <p className="text-xs text-red-500">{sendError}</p>}
          {loadError && thread && <p className="text-xs text-red-500">{loadError}</p>}
          <div className="flex gap-2 items-end">
            <label htmlFor="message-input" className="sr-only">Message</label>
            <textarea id="message-input" rows={1} maxLength={MAX_LENGTH}
              className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm resize-none max-h-32 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder={isParent ? `Message ${firstName(studentName)}…` : "Message your family…"}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                // Enter sends; Shift+Enter starts a new line.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button onClick={send} disabled={!input.trim() || sending || !thread} aria-label="Send message"
              className={`${isParent ? "bg-emerald-700" : "bg-indigo-600"} text-white w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 disabled:opacity-40`}>
              {sending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "↑"}
            </button>
          </div>
          {input.length > MAX_LENGTH - 200 && <p className="text-xs text-gray-400 text-right">{input.length}/{MAX_LENGTH}</p>}
        </div>
      )}
    </div>
  );
}

function Bubble({ msg, isMine, showName, mineClass, mineTimeClass }: {
  msg: FamilyMessage; isMine: boolean; showName: boolean; mineClass: string; mineTimeClass: string;
}) {
  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} ${showName ? "pt-2" : ""}`}>
      {showName && <p className="text-xs font-semibold text-gray-500 mb-0.5 px-1">{firstName(msg.senderName)}</p>}
      <div className={`max-w-[80%] sm:max-w-md rounded-2xl px-4 py-2.5 ${isMine ? `${mineClass} rounded-br-sm` : "bg-white text-gray-800 shadow-sm rounded-bl-sm"}`}>
        <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
        <p className={`text-xs mt-1 ${isMine ? mineTimeClass : "text-gray-400"}`}>{shortDateTime(msg.createdAt)}</p>
      </div>
    </div>
  );
}
