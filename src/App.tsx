import { useState } from "react";

const SUBJECTS = ["Math", "English", "Science", "History", "Spanish", "PE", "Art"];

const INITIAL_ASSIGNMENTS = [
  { id: 1, title: "Chapter 5 Math Homework", subject: "Math", type: "assignment", dueDate: "2026-03-11", status: "pending", grade: null, daysLeft: 7 },
  { id: 2, title: "Essay Draft - To Kill a Mockingbird", subject: "English", type: "assignment", dueDate: "2026-03-12", status: "graded", grade: 85, daysLeft: null },
  { id: 3, title: "Chapter 4 Science Quiz", subject: "Science", type: "quiz", dueDate: "2026-03-09", status: "graded", grade: 62, daysLeft: 5, makeupAvailable: true },
  { id: 4, title: "History Test - Civil War", subject: "History", type: "test", dueDate: "2026-03-08", status: "graded", grade: 91, daysLeft: null },
  { id: 5, title: "Spanish Vocab Assignment", subject: "Spanish", type: "assignment", dueDate: "2026-03-10", status: "missing", grade: null, daysLeft: 6, makeupAvailable: true },
  { id: 6, title: "Algebra Test - Quadratics", subject: "Math", type: "test", dueDate: "2026-03-13", status: "pending", grade: null, daysLeft: null },
];

const WEEKLY_HISTORY = [
  { week: "Mar 3 – Mar 9", net: 23, items: [
    { title: "History Test - Civil War", subject: "History", amount: 20 },
    { title: "English Essay", subject: "English", amount: 3 },
    { title: "Science Quiz", subject: "Science", amount: -20 },
    { title: "Math Homework", subject: "Math", amount: 3 },
    { title: "Spanish Vocab", subject: "Spanish", amount: 3 },
    { title: "Art Project", subject: "Art", amount: 3 },
    { title: "PE Assignment", subject: "PE", amount: 3 },
  ]},
  { week: "Feb 24 – Mar 2", net: 46, items: [
    { title: "Math Test Ch4", subject: "Math", amount: 20 },
    { title: "English Quiz", subject: "English", amount: 20 },
    { title: "History HW", subject: "History", amount: 3 },
    { title: "Science HW", subject: "Science", amount: 3 },
  ]},
];

const PAYOUT_HISTORY = [
  { date: "Mar 1, 2026", amount: 46, status: "paid", method: "Monthly" },
  { date: "Feb 1, 2026", amount: 38, status: "paid", method: "Monthly" },
];

function getRewardStatus(a) {
  const { type, status, grade, daysLeft } = a;
  if (status === "missing") return { earned: 0, label: "Missing", color: "text-red-500" };
  if (status === "pending") return { earned: null, label: "Pending", color: "text-gray-400" };
  if (type === "assignment") {
    if (grade >= 70) return { earned: 3, label: "+$3.00", color: "text-green-500" };
    return { earned: 0, label: "$0.00", color: "text-gray-400" };
  }
  if (type === "test" || type === "quiz") {
    if (grade >= 70) return { earned: 20, label: "+$20.00", color: "text-green-500" };
    if (daysLeft > 0) return { earned: -20, label: "-$20.00 (Makeup Available)", color: "text-orange-500" };
    return { earned: -20, label: "-$20.00", color: "text-red-500" };
  }
  return { earned: 0, label: "$0.00", color: "text-gray-400" };
}

function getSubjectColor(s) {
  const c = { Math:"bg-purple-500",English:"bg-blue-500",Science:"bg-green-500",History:"bg-yellow-500",Spanish:"bg-red-500",PE:"bg-orange-500",Art:"bg-pink-500" };
  return c[s] || "bg-gray-500";
}
function getSubjectLight(s) {
  const c = { Math:"bg-purple-100 text-purple-700",English:"bg-blue-100 text-blue-700",Science:"bg-green-100 text-green-700",History:"bg-yellow-100 text-yellow-700",Spanish:"bg-red-100 text-red-700",PE:"bg-orange-100 text-orange-700",Art:"bg-pink-100 text-pink-700" };
  return c[s] || "bg-gray-100 text-gray-700";
}
function getStatusBadge(s) {
  return s==="graded"?"bg-blue-100 text-blue-700":s==="missing"?"bg-red-100 text-red-700":"bg-gray-100 text-gray-600";
}
function getDaysLeftColor(d) {
  return d<=1?"bg-red-100 text-red-700 border-red-300":d<=3?"bg-yellow-100 text-yellow-700 border-yellow-300":"bg-green-100 text-green-700 border-green-300";
}

// ── LOGIN SCREEN ─────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
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

// ── STUDENT SCREENS ──────────────────────────────────────────────
function StudentDashboard({ assignments, setAssignments }) {
  const [activeTab, setActiveTab] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newA, setNewA] = useState({ title:"", subject:"Math", type:"assignment", dueDate:"", status:"pending", grade:"" });
  const filtered = activeTab==="all"?assignments:activeTab==="makeup"?assignments.filter(a=>a.makeupAvailable):assignments.filter(a=>a.status===activeTab);

  function handleAdd() {
    const isTestQuiz = newA.type==="test"||newA.type==="quiz";
    setAssignments([...assignments,{...newA,id:assignments.length+1,grade:newA.grade?parseInt(newA.grade):null,daysLeft:7,rewardValue:isTestQuiz?20:3}]);
    setShowAddModal(false);
    setNewA({title:"",subject:"Math",type:"assignment",dueDate:"",status:"pending",grade:""});
  }

  return (
    <div className="pb-4">
      <div className="grid grid-cols-3 gap-3 px-4 py-4">
        {[
          {label:"Pending",val:assignments.filter(a=>a.status==="pending").length,color:"text-indigo-600"},
          {label:"Completed",val:assignments.filter(a=>a.status==="graded").length,color:"text-green-600"},
          {label:"Makeups",val:assignments.filter(a=>a.makeupAvailable&&a.daysLeft>0).length,color:"text-orange-500"},
        ].map((s,i)=>(
          <div key={i} className="bg-white rounded-2xl p-3 shadow-sm text-center border border-gray-100">
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      {assignments.filter(a=>a.makeupAvailable&&a.daysLeft<=3).map(a=>(
        <div key={a.id} className="mx-4 mb-3 bg-orange-50 border border-orange-200 rounded-2xl p-3 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div><p className="text-sm font-semibold text-orange-700">{a.title}</p>
          <p className="text-xs text-orange-500">Makeup window closes in {a.daysLeft} day{a.daysLeft!==1?"s":""}!</p></div>
        </div>
      ))}
      <div className="px-4 mb-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all","pending","graded","missing","makeup"].map(tab=>(
            <button key={tab} onClick={()=>setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeTab===tab?"bg-indigo-600 text-white shadow":"bg-white text-gray-500 border border-gray-200"}`}>
              {tab.charAt(0).toUpperCase()+tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 space-y-3">
        {filtered.map(a=>{
          const r=getRewardStatus(a);
          return (
            <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-stretch">
                <div className={`w-1.5 ${getSubjectColor(a.subject)}`}/>
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-sm leading-tight">{a.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-gray-500">{a.subject}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(a.status)}`}>{a.status.charAt(0).toUpperCase()+a.status.slice(1)}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.type.charAt(0).toUpperCase()+a.type.slice(1)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-sm ${r.color}`}>{r.label??"—"}</p>
                      {a.grade!==null&&<p className="text-xs text-gray-400 mt-0.5">{a.grade}%</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-400">Due: {a.dueDate}</p>
                    {a.makeupAvailable&&a.daysLeft>0&&(
                      <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getDaysLeftColor(a.daysLeft)}`}>⏱ {a.daysLeft}d left</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length===0&&<div className="text-center py-12 text-gray-400"><p className="text-4xl mb-3">📋</p><p>No assignments here</p></div>}
      </div>
      <div className="fixed bottom-20 right-4">
        <button onClick={()=>setShowAddModal(true)} className="bg-indigo-600 text-white w-14 h-14 rounded-full shadow-xl text-2xl flex items-center justify-center">+</button>
      </div>
      {showAddModal&&(
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Add Assignment</h2><button onClick={()=>setShowAddModal(false)} className="text-gray-400 text-xl">✕</button></div>
            <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Assignment title" value={newA.title} onChange={e=>setNewA({...newA,title:e.target.value})}/>
            <div className="grid grid-cols-2 gap-3">
              <select className="border border-gray-200 rounded-xl px-4 py-3 text-sm" value={newA.subject} onChange={e=>setNewA({...newA,subject:e.target.value})}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
              <select className="border border-gray-200 rounded-xl px-4 py-3 text-sm" value={newA.type} onChange={e=>setNewA({...newA,type:e.target.value})}><option value="assignment">Assignment</option><option value="quiz">Quiz</option><option value="test">Test</option></select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" className="border border-gray-200 rounded-xl px-4 py-3 text-sm" value={newA.dueDate} onChange={e=>setNewA({...newA,dueDate:e.target.value})}/>
              <input type="number" className="border border-gray-200 rounded-xl px-4 py-3 text-sm" placeholder="Grade % (optional)" value={newA.grade} onChange={e=>setNewA({...newA,grade:e.target.value})}/>
            </div>
            <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" value={newA.status} onChange={e=>setNewA({...newA,status:e.target.value})}><option value="pending">Pending</option><option value="graded">Graded</option><option value="missing">Missing</option></select>
            <button onClick={handleAdd} disabled={!newA.title||!newA.dueDate} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">Add Assignment</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentRewards({ payoutPending, setPayoutPending }) {
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goal, setGoal] = useState({ name:"New Jordans 👟", amount:120 });
  const [goalDraft, setGoalDraft] = useState({ name:"", amount:"" });
  const [requested, setRequested] = useState(false);
  const balance=23; const holdback=20; const available=Math.max(0,balance-holdback);
  const goalProgress=Math.min(100,Math.round((84/goal.amount)*100));

  return (
    <div className="pb-4 px-4 pt-4 space-y-4">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-5 text-white shadow-lg">
        <p className="text-indigo-200 text-sm">Current Balance</p>
        <p className="text-4xl font-bold mt-1">${balance.toFixed(2)}</p>
        <div className="flex gap-4 mt-3 text-sm">
          <div><p className="text-indigo-300 text-xs">Holdback</p><p className="font-semibold text-yellow-300">-${holdback}.00</p></div>
          <div><p className="text-indigo-300 text-xs">Available</p><p className="font-semibold text-green-300">${available}.00</p></div>
        </div>
        {payoutPending
          ? <div className="mt-4 w-full bg-yellow-400 text-yellow-900 font-bold py-2.5 rounded-2xl text-sm text-center">⏳ Payout Pending Parent Approval</div>
          : <button onClick={()=>setShowPayoutModal(true)} disabled={available<=0} className="mt-4 w-full bg-white text-indigo-600 font-bold py-2.5 rounded-2xl text-sm disabled:opacity-40">💸 Request Payout</button>
        }
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex justify-between mb-3">
          <div><p className="text-xs text-gray-400 font-medium">SAVINGS GOAL</p><p className="font-bold text-gray-800">{goal.name}</p></div>
          <div className="text-right"><p className="text-xs text-gray-400">Target</p><p className="font-bold text-indigo-600">${goal.amount}</p></div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full" style={{width:`${goalProgress}%`}}/>
        </div>
        <div className="flex justify-between mt-2">
          <p className="text-xs text-gray-500">{goalProgress}% saved</p>
          <button onClick={()=>{setGoalDraft({name:goal.name,amount:goal.amount});setShowGoalModal(true);}} className="text-xs text-indigo-500 font-medium">Edit Goal</button>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-xs text-gray-400 font-medium mb-3">PAYOUT HISTORY</p>
        {PAYOUT_HISTORY.map((p,i)=>(
          <div key={i} className="flex justify-between items-center mb-2">
            <div><p className="text-sm font-semibold text-gray-700">{p.date}</p><p className="text-xs text-gray-400">{p.method}</p></div>
            <div className="text-right"><p className="font-bold text-green-600">+${p.amount}</p><span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Paid</span></div>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium mb-2 px-1">WEEKLY HISTORY</p>
        {WEEKLY_HISTORY.map((w,i)=>(
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-3">
            <button onClick={()=>setExpandedWeek(expandedWeek===i?null:i)} className="w-full flex items-center justify-between p-4">
              <div className="text-left"><p className="font-semibold text-gray-700 text-sm">{w.week}</p><p className="text-xs text-gray-400">{w.items.length} assignments</p></div>
              <div className="flex items-center gap-3"><p className={`font-bold ${w.net>=0?"text-green-600":"text-red-500"}`}>{w.net>=0?"+":""}${w.net}</p><span className="text-gray-400 text-sm">{expandedWeek===i?"▲":"▼"}</span></div>
            </button>
            {expandedWeek===i&&<div className="border-t border-gray-100 divide-y divide-gray-50">
              {w.items.map((item,j)=>(
                <div key={j} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(item.subject)}`}>{item.subject}</span><p className="text-sm text-gray-600">{item.title}</p></div>
                  <p className={`text-sm font-bold ${item.amount>0?"text-green-600":item.amount<0?"text-red-500":"text-gray-400"}`}>{item.amount>0?"+":""}${item.amount}</p>
                </div>
              ))}
            </div>}
          </div>
        ))}
      </div>
      {showPayoutModal&&(
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
            <h2 className="text-lg font-bold">Request Payout</h2>
            {!requested?<>
              <div className="bg-indigo-50 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span>Balance</span><span className="font-bold">${balance}</span></div>
                <div className="flex justify-between text-sm"><span>Holdback</span><span className="font-bold text-yellow-600">-${holdback}</span></div>
                <div className="border-t border-indigo-200 pt-2 flex justify-between text-sm"><span className="font-bold">Requesting</span><span className="font-bold text-green-600">${available}</span></div>
              </div>
              <p className="text-xs text-gray-400">A $20 buffer is held back to cover any upcoming penalties. Negative balances carry forward.</p>
              <button onClick={()=>{setRequested(true);setPayoutPending(true);}} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm">Send Request to Parent</button>
              <button onClick={()=>setShowPayoutModal(false)} className="w-full text-gray-400 text-sm">Cancel</button>
            </>:<div className="text-center py-6">
              <p className="text-5xl mb-3">✅</p>
              <p className="font-bold text-lg">Request Sent!</p>
              <p className="text-sm text-gray-500 mt-1">Your parent will review and approve.</p>
              <button onClick={()=>{setShowPayoutModal(false);setRequested(false);}} className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-semibold">Done</button>
            </div>}
          </div>
        </div>
      )}
      {showGoalModal&&(
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
            <h2 className="text-lg font-bold">Edit Savings Goal</h2>
            <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Goal name" value={goalDraft.name} onChange={e=>setGoalDraft({...goalDraft,name:e.target.value})}/>
            <input type="number" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Target amount ($)" value={goalDraft.amount} onChange={e=>setGoalDraft({...goalDraft,amount:e.target.value})}/>
            <button onClick={()=>{setGoal({name:goalDraft.name,amount:parseFloat(goalDraft.amount)});setShowGoalModal(false);}} disabled={!goalDraft.name||!goalDraft.amount} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40">Save Goal</button>
            <button onClick={()=>setShowGoalModal(false)} className="w-full text-gray-400 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessagesScreen({ isParent }) {
  const [messages, setMessages] = useState([
    { id:1, from:"parent", text:"Hey! Great job on that History test! 🎉", time:"Mon 4:30 PM" },
    { id:2, from:"student", text:"Thanks dad! I studied really hard for it.", time:"Mon 4:45 PM" },
    { id:3, from:"parent", text:"Don't forget you have that Science quiz makeup due by Friday.", time:"Tue 9:00 AM" },
    { id:4, from:"student", text:"I know, I'm going to retake it tomorrow!", time:"Tue 9:15 AM" },
  ]);
  const [input, setInput] = useState("");
  const me = isParent ? "parent" : "student";
  const other = isParent ? "student" : "parent";

  function send() {
    if (!input.trim()) return;
    setMessages([...messages,{id:messages.length+1,from:me,text:input,time:"Now"}]);
    setInput("");
  }

  return (
    <div className="flex flex-col" style={{height:"calc(100vh - 130px)"}}>
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-lg">{isParent?"👩‍🎓":"👨"}</div>
        <div><p className="font-bold text-gray-800 text-sm">{isParent?"Sarah (Daughter)":"Dad"}</p><p className="text-xs text-green-500">Online</p></div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
        {messages.map(msg=>(
          <div key={msg.id} className={`flex ${msg.from===me?"justify-end":"justify-start"}`}>
            <div className={`max-w-xs rounded-2xl px-4 py-2.5 ${msg.from===me?"bg-indigo-600 text-white rounded-br-sm":"bg-white text-gray-800 shadow-sm rounded-bl-sm"}`}>
              <p className="text-sm">{msg.text}</p>
              <p className={`text-xs mt-1 ${msg.from===me?"text-indigo-300":"text-gray-400"}`}>{msg.time}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex gap-2">
        <input className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder={`Message ${isParent?"Sarah":"Dad"}...`} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
        <button onClick={send} className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg">↑</button>
      </div>
    </div>
  );
}

// ── CALENDAR VIEW ────────────────────────────────────────────────
function CalendarView({ assignments, isParent }) {
  const today = new Date(2026, 2, 10);
  // Start of current 2-week window — snap to nearest Monday
  function getWindowStart(base) {
    const d = new Date(base);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0,0,0,0);
    return d;
  }
  const [windowStart, setWindowStart] = useState(() => getWindowStart(today));

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNamesShort = ["Mon","Tue","Wed","Thu","Fri"];

  // Build 10 school days (Mon–Fri x 2 weeks)
  function buildSchoolDays(start) {
    const days = [];
    let d = new Date(start);
    while (days.length < 10) {
      const dow = d.getDay();
      if (dow >= 1 && dow <= 5) days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }
  const schoolDays = buildSchoolDays(windowStart);
  const week1 = schoolDays.slice(0, 5);
  const week2 = schoolDays.slice(5, 10);

  function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function getAssignmentsFor(d) {
    return assignments.filter(a => a.dueDate === toDateStr(d));
  }
  function isToday(d) {
    return toDateStr(d) === toDateStr(today);
  }
  function isPast(d) {
    return d < today && !isToday(d);
  }

  function prevWindow() { const d = new Date(windowStart); d.setDate(d.getDate()-14); setWindowStart(d); }
  function nextWindow() { const d = new Date(windowStart); d.setDate(d.getDate()+14); setWindowStart(d); }
  function goToToday() { setWindowStart(getWindowStart(today)); }

  // Week label e.g. "Mar 10 – Mar 14"
  function weekLabel(days) {
    const s = days[0], e = days[4];
    const sm = monthNames[s.getMonth()].slice(0,3), em = monthNames[e.getMonth()].slice(0,3);
    return sm === em ? `${sm} ${s.getDate()} – ${e.getDate()}` : `${sm} ${s.getDate()} – ${em} ${e.getDate()}`;
  }

  const accentBg = isParent ? "bg-emerald-700" : "bg-indigo-600";
  const accentRing = isParent ? "ring-emerald-400" : "ring-indigo-400";
  const accentText = isParent ? "text-emerald-700" : "text-indigo-600";

  function DayColumn({ day }) {
    const items = getAssignmentsFor(day);
    const todayCell = isToday(day);
    const pastCell = isPast(day);
    return (
      <div className={`flex-1 min-w-0 rounded-2xl overflow-hidden border transition-all
        ${todayCell ? (isParent ? "border-emerald-400 shadow-md" : "border-indigo-400 shadow-md") : "border-gray-100"}
        ${pastCell ? "opacity-60" : ""}
        bg-white`}>
        {/* Day Header */}
        <div className={`px-1.5 py-2 text-center ${todayCell ? accentBg : "bg-gray-50"}`}>
          <p className={`text-xs font-bold ${todayCell ? "text-white" : "text-gray-400"}`}>
            {dayNamesShort[day.getDay()-1]}
          </p>
          <p className={`text-base font-bold leading-tight ${todayCell ? "text-white" : "text-gray-700"}`}>
            {day.getDate()}
          </p>
          {todayCell && <p className="text-white text-xs opacity-80">Today</p>}
        </div>
        {/* Assignments */}
        <div className="p-1.5 space-y-1.5 min-h-16">
          {items.length === 0
            ? <div className="flex items-center justify-center h-10"><p className="text-gray-200 text-lg">—</p></div>
            : items.map(a => {
              const r = getRewardStatus(a);
              return (
                <div key={a.id} className={`rounded-xl px-2 py-1.5 border-l-2 ${
                  a.status==="missing" ? "bg-red-50 border-red-400" :
                  a.status==="graded" && a.grade < 70 ? "bg-orange-50 border-orange-400" :
                  a.status==="graded" ? "bg-green-50 border-green-400" :
                  "bg-indigo-50 border-indigo-400"
                }`}>
                  <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{a.title}</p>
                  <div className="flex items-center justify-between mt-0.5 gap-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium truncate ${getSubjectLight(a.subject)}`} style={{fontSize:"0.6rem"}}>{a.subject}</span>
                    <span className={`text-xs font-bold shrink-0 ${r.color}`} style={{fontSize:"0.65rem"}}>{r.label ?? "—"}</span>
                  </div>
                  {a.grade !== null && <p className="text-gray-400 mt-0.5" style={{fontSize:"0.6rem"}}>{a.grade}% • {a.type}</p>}
                  {a.makeupAvailable && a.daysLeft > 0 && (
                    <p className="text-orange-500 font-semibold mt-0.5" style={{fontSize:"0.6rem"}}>⏱ {a.daysLeft}d makeup</p>
                  )}
                </div>
              );
            })
          }
        </div>
      </div>
    );
  }

  // Month label for header
  const allMonths = [...new Set(schoolDays.map(d => monthNames[d.getMonth()]))];
  const headerLabel = allMonths.join(" / ");
  const yearLabel = schoolDays[0].getFullYear();

  return (
    <div className="pb-28 pt-4 space-y-4">
      {/* Header */}
      <div className={`${accentBg} mx-4 rounded-3xl px-5 py-4 text-white shadow-lg`}>
        <div className="flex items-center justify-between mb-1">
          <button onClick={prevWindow} className="w-9 h-9 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-xl font-bold">‹</button>
          <div className="text-center">
            <p className="font-bold text-lg">{headerLabel} {yearLabel}</p>
            <p className="text-xs opacity-70">2-Week School Calendar</p>
          </div>
          <button onClick={nextWindow} className="w-9 h-9 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-xl font-bold">›</button>
        </div>
        <button onClick={goToToday} className="w-full mt-2 bg-white bg-opacity-20 rounded-xl py-1.5 text-xs font-semibold">
          Jump to Today
        </button>
      </div>

      {/* Legend */}
      <div className="mx-4 flex items-center justify-center gap-3 flex-wrap">
        {[
          {color:"bg-indigo-400", label:"Pending"},
          {color:"bg-green-400", label:"Graded ✓"},
          {color:"bg-orange-400", label:"Low Grade"},
          {color:"bg-red-400", label:"Missing"},
        ].map((l,i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${l.color}`}/>
            <span className="text-xs text-gray-500">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Week 1 */}
      <div className="px-3 space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Week 1</p>
          <p className="text-xs text-gray-400">{weekLabel(week1)}</p>
        </div>
        <div className="flex gap-1.5">
          {week1.map((d,i) => <DayColumn key={i} day={d}/>)}
        </div>
      </div>

      {/* Week 2 */}
      <div className="px-3 space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Week 2</p>
          <p className="text-xs text-gray-400">{weekLabel(week2)}</p>
        </div>
        <div className="flex gap-1.5">
          {week2.map((d,i) => <DayColumn key={i} day={d}/>)}
        </div>
      </div>

      {/* Summary row */}
      <div className="mx-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">2-Week Summary</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label:"Due", val: schoolDays.reduce((s,d) => s + getAssignmentsFor(d).filter(a=>a.status==="pending").length, 0), color:"text-indigo-600" },
            { label:"Missing", val: schoolDays.reduce((s,d) => s + getAssignmentsFor(d).filter(a=>a.status==="missing").length, 0), color:"text-red-500" },
            { label:"Low Grade", val: schoolDays.reduce((s,d) => s + getAssignmentsFor(d).filter(a=>a.grade<70&&a.grade!==null).length, 0), color:"text-orange-500" },
            { label:"Potential", val: `${schoolDays.reduce((s,d) => s + getAssignmentsFor(d).filter(a=>a.status==="pending").reduce((ss,a)=>ss+(a.type==="assignment"?3:20),0), 0)}`, color:"text-green-600" },
          ].map((s,i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-2">
              <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── NOTIFICATION CENTER ──────────────────────────────────────────
const NOTIFICATION_TYPES = {
  due3days:   { icon:"📅", color:"bg-indigo-50 border-indigo-200",  badge:"bg-indigo-100 text-indigo-700",  label:"Due Soon" },
  due1day:    { icon:"⚠️", color:"bg-yellow-50 border-yellow-200", badge:"bg-yellow-100 text-yellow-700", label:"Due Tomorrow" },
  dueToday:   { icon:"🚨", color:"bg-red-50 border-red-200",       badge:"bg-red-100 text-red-700",       label:"Due Today" },
  makeup:     { icon:"⏱",  color:"bg-orange-50 border-orange-200", badge:"bg-orange-100 text-orange-700", label:"Makeup Window" },
  payout:     { icon:"💰", color:"bg-green-50 border-green-200",   badge:"bg-green-100 text-green-700",   label:"Payout" },
  grade:      { icon:"📝", color:"bg-purple-50 border-purple-200", badge:"bg-purple-100 text-purple-700", label:"New Grade" },
  weekly:     { icon:"📋", color:"bg-gray-50 border-gray-200",     badge:"bg-gray-100 text-gray-600",     label:"Weekly Summary" },
};

function generateNotifications(assignments, isParent, payoutPending) {
  const today = new Date(2026, 2, 10);
  const notes = [];

  assignments.forEach(a => {
    if (a.status === "pending" && a.dueDate) {
      const days = Math.ceil((new Date(a.dueDate) - today) / (1000*60*60*24));
      if (days === 0) notes.push({
        id:`dueToday-${a.id}`, type:"dueToday", read:false, time:"Today",
        title:`Due Today: ${a.title}`,
        body:`Your ${a.subject} ${a.type} is due today! Complete it to earn ${a.type==="assignment"?"$3":"$20"}.`,
        subject: a.subject,
      });
      else if (days === 1) notes.push({
        id:`due1day-${a.id}`, type:"due1day", read:false, time:"Yesterday",
        title:`Due Tomorrow: ${a.title}`,
        body:`Don't forget — your ${a.subject} ${a.type} is due tomorrow. Worth ${a.type==="assignment"?"$3":"$20"}!`,
        subject: a.subject,
      });
      else if (days <= 3) notes.push({
        id:`due3days-${a.id}`, type:"due3days", read:true, time:"2 days ago",
        title:`Coming Up: ${a.title}`,
        body:`Your ${a.subject} ${a.type} is due in ${days} days. Start early to earn ${a.type==="assignment"?"$3":"$20"}!`,
        subject: a.subject,
      });
    }
    if (a.makeupAvailable && a.daysLeft > 0) notes.push({
      id:`makeup-${a.id}`, type:"makeup", read:a.daysLeft > 3, time:`${a.daysLeft} days left`,
      title:`Makeup Window: ${a.title}`,
      body:`You have ${a.daysLeft} day${a.daysLeft!==1?"s":""} left to retake this ${a.subject} ${a.type} and earn back $20. Don't miss it!`,
      subject: a.subject,
    });
    if (a.status === "graded" && a.grade !== null) notes.push({
      id:`grade-${a.id}`, type:"grade", read:true, time:"This week",
      title:`Grade Posted: ${a.title}`,
      body:`You received ${a.grade}% on your ${a.subject} ${a.type}. ${a.grade>=70?"Great job! 🎉":"Retake available — don't give up!"}`,
      subject: a.subject,
    });
  });

  if (payoutPending) notes.push({
    id:"payout-pending", type:"payout", read:false, time:"Just now",
    title: isParent ? "Payout Request from Sarah" : "Payout Request Sent!",
    body: isParent ? "Sarah has requested a payout of $3.00. Tap to review and approve, delay, or deny." : "Your payout request of $3.00 is waiting for parent approval.",
  });

  notes.push({
    id:"weekly-summary", type:"weekly", read:true, time:"Last Sunday",
    title:"Weekly Summary Ready",
    body:"Your week in review is ready. Net earnings: $23 • Avg grade: 80% • 1 makeup window open.",
  });

  // Sort: unread first, then by recency implied by order
  return notes.sort((a,b) => (a.read===b.read ? 0 : a.read ? 1 : -1));
}

function NotificationCenter({ assignments, isParent, payoutPending }) {
  const [notifications, setNotifications] = useState(() => generateNotifications(assignments, isParent, payoutPending));
  const [filter, setFilter] = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [notifSettings, setNotifSettings] = useState({
    sms: true, email: true, inApp: true,
    due3days: true, due1day: true, dueToday: true,
    makeup: true, payout: true, grade: true, weekly: true,
    phone: "+1 (720) 555-0192",
    emailAddr: "sarah@example.com",
    quietStart: "09:00 PM",
    quietEnd: "07:00 AM",
  });

  const accentBg = isParent ? "bg-emerald-700" : "bg-indigo-600";
  const accentLight = isParent ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-indigo-50 text-indigo-700 border-indigo-200";

  const unreadCount = notifications.filter(n => !n.read).length;
  const filtered = filter === "all" ? notifications : filter === "unread" ? notifications.filter(n => !n.read) : notifications.filter(n => n.type === filter);

  function markRead(id) { setNotifications(prev => prev.map(n => n.id===id ? {...n, read:true} : n)); }
  function markAllRead() { setNotifications(prev => prev.map(n => ({...n, read:true}))); }
  function dismiss(id) { setNotifications(prev => prev.filter(n => n.id!==id)); }

  function toggleSetting(key) { setNotifSettings(prev => ({...prev, [key]: !prev[key]})); }

  return (
    <div className="pb-28 pt-4 space-y-4 px-4">
      {/* Header */}
      <div className={`${accentBg} rounded-3xl px-5 py-4 text-white shadow-lg`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-70 font-semibold uppercase tracking-wide">Notifications</p>
            <p className="text-xl font-bold mt-0.5">Alert Center</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <div className="bg-red-500 rounded-full w-7 h-7 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{unreadCount}</span>
              </div>
            )}
            <button onClick={() => setShowSettings(!showSettings)}
              className="bg-white bg-opacity-20 rounded-xl px-3 py-1.5 text-xs font-semibold">
              ⚙️ Settings
            </button>
          </div>
        </div>
        {/* Delivery method badges */}
        <div className="flex gap-2 mt-3">
          {[
            {key:"inApp", icon:"🔔", label:"In-App"},
            {key:"sms", icon:"📱", label:"SMS"},
            {key:"email", icon:"📧", label:"Email"},
          ].map(m => (
            <div key={m.key} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${notifSettings[m.key] ? "bg-white bg-opacity-25 text-white" : "bg-white bg-opacity-10 text-white opacity-40"}`}>
              <span>{m.icon}</span>{m.label} {notifSettings[m.key] ? "✓" : "off"}
            </div>
          ))}
        </div>
      </div>

      {/* Notification Settings Panel */}
      {showSettings && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-gray-100">
            <p className="font-bold text-gray-800 text-sm">⚙️ Notification Settings</p>
          </div>
          <div className="p-4 space-y-4">
            {/* Delivery Methods */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Delivery Methods</p>
              <div className="space-y-3">
                {[
                  {key:"inApp", icon:"🔔", label:"In-App Alerts", desc:"Shown inside the app"},
                  {key:"sms", icon:"📱", label:"SMS Text", desc:"Requires Twilio (deployment)"},
                  {key:"email", icon:"📧", label:"Email", desc:"Requires Resend (deployment)"},
                ].map(m => (
                  <div key={m.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{m.icon}</span>
                      <div><p className="text-sm font-medium text-gray-700">{m.label}</p><p className="text-xs text-gray-400">{m.desc}</p></div>
                    </div>
                    <button onClick={() => toggleSetting(m.key)}
                      className={`w-12 h-6 rounded-full transition-all relative ${notifSettings[m.key] ? (isParent?"bg-emerald-600":"bg-indigo-600") : "bg-gray-200"}`}>
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow transition-all ${notifSettings[m.key]?"left-6":"left-0.5"}`}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* Contact Info */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Contact Info</p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">Phone (for SMS)</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={notifSettings.phone} onChange={e => setNotifSettings({...notifSettings, phone:e.target.value})}/>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Email Address</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={notifSettings.emailAddr} onChange={e => setNotifSettings({...notifSettings, emailAddr:e.target.value})}/>
                </div>
              </div>
            </div>
            {/* Triggers */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Alert Triggers</p>
              <div className="space-y-2">
                {[
                  {key:"due3days", label:"Assignment due in 3 days"},
                  {key:"due1day", label:"Assignment due tomorrow"},
                  {key:"dueToday", label:"Assignment due today"},
                  {key:"makeup", label:"Makeup window expiring"},
                  {key:"payout", label:"Payout approved / denied"},
                  {key:"grade", label:"New grade posted"},
                  {key:"weekly", label:"Weekly Sunday summary"},
                ].map(t => (
                  <div key={t.key} className="flex items-center justify-between py-1">
                    <p className="text-sm text-gray-700">{t.label}</p>
                    <button onClick={() => toggleSetting(t.key)}
                      className={`w-10 h-5 rounded-full transition-all relative ${notifSettings[t.key] ? (isParent?"bg-emerald-600":"bg-indigo-600") : "bg-gray-200"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow transition-all ${notifSettings[t.key]?"left-5":"left-0.5"}`}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* Quiet Hours */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Quiet Hours</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Start</label>
                  <input type="time" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1" defaultValue="21:00"/></div>
                <div><label className="text-xs text-gray-500">End</label>
                  <input type="time" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1" defaultValue="07:00"/></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">No notifications will be sent during quiet hours</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs + Mark All Read */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {["all","unread","due1day","dueToday","makeup","payout","grade"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${filter===f?(isParent?"bg-emerald-700 text-white":"bg-indigo-600 text-white"):"bg-white text-gray-500 border border-gray-200"}`}>
              {f==="all"?"All":f==="unread"?`Unread${unreadCount>0?` (${unreadCount})`:""}`:NOTIFICATION_TYPES[f]?.label??f}
            </button>
          ))}
        </div>
      </div>
      {unreadCount > 0 && (
        <button onClick={markAllRead} className="text-xs text-indigo-500 font-semibold w-full text-right -mt-2">Mark all as read</button>
      )}

      {/* Notification List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🔔</p>
            <p className="font-medium">No notifications here</p>
          </div>
        )}
        {filtered.map(n => {
          const t = NOTIFICATION_TYPES[n.type];
          return (
            <div key={n.id} onClick={() => markRead(n.id)}
              className={`rounded-2xl border p-4 transition-all cursor-pointer ${t.color} ${n.read ? "opacity-70" : "shadow-sm"}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0 mt-0.5">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-bold text-gray-800 ${!n.read?"":"text-gray-600"}`}>{n.title}</p>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"/>}
                    </div>
                    <button onClick={e => {e.stopPropagation(); dismiss(n.id);}} className="text-gray-300 hover:text-gray-500 text-lg shrink-0">×</button>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{n.body}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${t.badge}`}>{t.label}</span>
                    <span className="text-xs text-gray-400">{n.time}</span>
                  </div>
                </div>
              </div>
              {/* Delivery method row */}
              <div className="flex gap-1.5 mt-3 pt-2 border-t border-black border-opacity-5">
                <span className="text-xs text-gray-400">Sent via:</span>
                {[{key:"inApp",icon:"🔔"},{key:"sms",icon:"📱"},{key:"email",icon:"📧"}].map(m => (
                  <span key={m.key} className={`text-xs ${notifSettings[m.key]?"text-gray-500":"text-gray-300 line-through"}`}>{m.icon}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* SMS & Email Preview Cards */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Delivery Previews</p>

        {/* SMS Preview */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📱</span>
            <p className="text-white font-bold text-sm">SMS Preview</p>
            <span className="ml-auto text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Via Twilio</span>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 space-y-2">
            <div className="flex justify-end">
              <div className="bg-green-500 text-white text-xs rounded-2xl rounded-br-sm px-3 py-2 max-w-xs">
                📚 ScholarRewards: ⚠️ Algebra Test due TOMORROW! Complete it to earn $20. Good luck! 💪
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-green-500 text-white text-xs rounded-2xl rounded-br-sm px-3 py-2 max-w-xs">
                ⏱ Makeup window closes in 2 days for Science Quiz. Retake now to earn back $20!
              </div>
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-2">~$0.008 per text via Twilio</p>
        </div>

        {/* Email Preview */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-lg">📧</span>
            <p className="font-bold text-gray-800 text-sm">Email Preview</p>
            <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Via Resend</span>
          </div>
          <div className="px-4 py-3 space-y-1 text-xs text-gray-500 border-b border-gray-100">
            <p><span className="font-semibold text-gray-700">From:</span> ScholarRewards &lt;alerts@scholarrewards.app&gt;</p>
            <p><span className="font-semibold text-gray-700">To:</span> {isParent ? "parent@example.com" : "sarah@example.com"}</p>
            <p><span className="font-semibold text-gray-700">Subject:</span> 📚 Weekly Summary — Net +$23 this week</p>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div className="bg-indigo-600 rounded-xl p-3 text-white text-center">
              <p className="text-xs opacity-70">📚 ScholarRewards</p>
              <p className="font-bold text-base mt-1">Weekly Summary</p>
              <p className="text-xs opacity-80">Mar 3 – Mar 9, 2026</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-50 rounded-xl p-2"><p className="font-bold text-green-600 text-base">+$26</p><p className="text-xs text-gray-400">Earned</p></div>
              <div className="bg-red-50 rounded-xl p-2"><p className="font-bold text-red-500 text-base">-$3</p><p className="text-xs text-gray-400">Lost</p></div>
              <div className="bg-indigo-50 rounded-xl p-2"><p className="font-bold text-indigo-600 text-base">$23</p><p className="text-xs text-gray-400">Net</p></div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <p className="text-xs font-bold text-orange-700">⏱ Action Required</p>
              <p className="text-xs text-orange-600 mt-1">Science Quiz makeup window closes in 5 days. Retake to earn back $20!</p>
            </div>
            <div className="text-center">
              <div className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl inline-block">View Full Summary →</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WEEKLY SUMMARY SCREEN ────────────────────────────────────────
function WeeklySummary({ assignments, isParent }) {
  const accentBg = isParent ? "bg-emerald-700" : "bg-indigo-600";
  const accentLight = isParent ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700";
  const accentText = isParent ? "text-emerald-700" : "text-indigo-600";

  // This week stats
  const graded = assignments.filter(a => a.status === "graded" && a.grade !== null);
  const avgGrade = graded.length ? Math.round(graded.reduce((s,a) => s+a.grade, 0) / graded.length) : 0;
  const missing = assignments.filter(a => a.status === "missing");
  const pending = assignments.filter(a => a.status === "pending");
  const lowGrade = assignments.filter(a => a.grade !== null && a.grade < 70);
  const makeupOpen = assignments.filter(a => a.makeupAvailable && a.daysLeft > 0);

  // Earned this week
  const weekEarned = assignments.reduce((s,a) => {
    const r = getRewardStatus(a);
    return s + (r.earned > 0 ? r.earned : 0);
  }, 0);
  const weekLost = assignments.reduce((s,a) => {
    const r = getRewardStatus(a);
    return s + (r.earned < 0 ? Math.abs(r.earned) : 0);
  }, 0);
  const weekNet = weekEarned - weekLost;

  // Subject breakdown
  const subjectStats = ["Math","English","Science","History","Spanish","PE","Art"].map(sub => {
    const subs = assignments.filter(a => a.subject === sub && a.grade !== null);
    const avg = subs.length ? Math.round(subs.reduce((s,a) => s+a.grade,0)/subs.length) : null;
    const subMissing = assignments.filter(a => a.subject === sub && a.status === "missing").length;
    return { subject: sub, avg, count: subs.length, missing: subMissing };
  }).filter(s => s.count > 0 || s.missing > 0);

  // Upcoming next week
  const nextWeek = assignments.filter(a => {
    const d = new Date(a.dueDate);
    const today = new Date(2026,2,10);
    const diff = Math.ceil((d - today)/(1000*60*60*24));
    return diff >= 0 && diff <= 7;
  }).sort((a,b) => new Date(a.dueDate)-new Date(b.dueDate));

  // Performance badge
  function getPerformanceBadge() {
    if (missing.length === 0 && avgGrade >= 90) return { emoji:"🏆", label:"Outstanding Week!", color:"text-yellow-600", bg:"bg-yellow-50 border-yellow-200" };
    if (missing.length === 0 && avgGrade >= 80) return { emoji:"⭐", label:"Great Week!", color:"text-green-600", bg:"bg-green-50 border-green-200" };
    if (missing.length === 0 && avgGrade >= 70) return { emoji:"✅", label:"Solid Week", color:"text-indigo-600", bg:"bg-indigo-50 border-indigo-200" };
    if (missing.length > 0 && avgGrade >= 70) return { emoji:"⚠️", label:"Missing Work to Fix", color:"text-orange-600", bg:"bg-orange-50 border-orange-200" };
    return { emoji:"🚨", label:"Needs Attention", color:"text-red-600", bg:"bg-red-50 border-red-200" };
  }
  const badge = getPerformanceBadge();

  // AI-generated encouragement message per role
  const studentMessages = [
    "You're making progress — keep showing up every day and the grades will follow! 💪",
    "Every assignment you complete is one step closer to your goal. Stay consistent!",
    "Don't let the small setbacks define the week. Focus on what you can fix right now.",
  ];
  const parentMessages = [
    "Stay engaged — a quick check-in conversation goes a long way this week.",
    "Review the makeup windows below before they expire. There's still time to recover points.",
    "Consider celebrating the wins this week, even the small ones. Motivation matters!",
  ];
  const tip = isParent ? parentMessages[1] : studentMessages[0];

  return (
    <div className="pb-28 pt-4 space-y-4 px-4">

      {/* Header */}
      <div className={`${accentBg} rounded-3xl p-5 text-white shadow-lg`}>
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs opacity-70 font-semibold uppercase tracking-wide">Earn Your A</p>
            <p className="text-xl font-bold mt-0.5">Mar 3 – Mar 9, 2026</p>
          </div>
          <div className="text-4xl">📋</div>
        </div>
        <p className="text-xs opacity-60 mt-1">Generated Sunday evening • Next summary in 6 days</p>
      </div>

      {/* Performance Badge */}
      <div className={`rounded-2xl border p-4 flex items-center gap-4 ${badge.bg}`}>
        <span className="text-4xl">{badge.emoji}</span>
        <div>
          <p className={`text-lg font-bold ${badge.color}`}>{badge.label}</p>
          <p className="text-sm text-gray-500 mt-0.5">{tip}</p>
        </div>
      </div>

      {/* Reward Summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className={`${accentBg} px-4 py-3 flex items-center gap-2`}>
          <span className="text-lg">💰</span>
          <p className="text-white font-bold text-sm">This Week's Rewards</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">+${weekEarned}</p>
            <p className="text-xs text-gray-400 mt-1">Earned</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">-${weekLost}</p>
            <p className="text-xs text-gray-400 mt-1">Lost</p>
          </div>
          <div className="p-4 text-center">
            <p className={`text-2xl font-bold ${weekNet>=0?"text-indigo-600":"text-red-500"}`}>${weekNet}</p>
            <p className="text-xs text-gray-400 mt-1">Net Total</p>
          </div>
        </div>
        {/* Running monthly total */}
        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50">
          <p className="text-sm text-gray-500">Running Monthly Total</p>
          <p className="font-bold text-gray-800">$23.00</p>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium mb-1">Average Grade</p>
          <p className={`text-3xl font-bold ${avgGrade>=90?"text-green-600":avgGrade>=70?"text-indigo-600":"text-red-500"}`}>{avgGrade}%</p>
          <p className="text-xs text-gray-400 mt-1">{graded.length} assignments graded</p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div className={`h-1.5 rounded-full ${avgGrade>=90?"bg-green-500":avgGrade>=70?"bg-indigo-500":"bg-red-500"}`} style={{width:`${avgGrade}%`}}/>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium mb-1">Completion Rate</p>
          <p className={`text-3xl font-bold ${missing.length===0?"text-green-600":"text-orange-500"}`}>
            {assignments.length > 0 ? Math.round(((assignments.length - missing.length)/assignments.length)*100) : 100}%
          </p>
          <p className="text-xs text-gray-400 mt-1">{missing.length} missing</p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div className={`h-1.5 rounded-full ${missing.length===0?"bg-green-500":"bg-orange-500"}`}
              style={{width:`${assignments.length>0?Math.round(((assignments.length-missing.length)/assignments.length)*100):100}%`}}/>
          </div>
        </div>
      </div>

      {/* Subject Breakdown */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <span>📚</span>
          <p className="font-bold text-gray-800 text-sm">Grade by Subject</p>
        </div>
        <div className="divide-y divide-gray-50">
          {subjectStats.map((s,i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(s.subject)}`}>{s.subject}</span>
                  {s.missing > 0 && <span className="text-xs text-red-500 font-semibold">⚠️ {s.missing} missing</span>}
                </div>
                <span className={`font-bold text-sm ${s.avg===null?"text-gray-400":s.avg>=90?"text-green-600":s.avg>=70?"text-indigo-600":"text-red-500"}`}>
                  {s.avg !== null ? `${s.avg}%` : "—"}
                </span>
              </div>
              {s.avg !== null && (
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${s.avg>=90?"bg-green-500":s.avg>=70?"bg-indigo-500":"bg-red-500"}`} style={{width:`${s.avg}%`}}/>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Open Makeup Windows */}
      {makeupOpen.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
          <div className="bg-orange-50 px-4 py-3 flex items-center gap-2 border-b border-orange-100">
            <span className="text-lg">⏱</span>
            <p className="font-bold text-orange-700 text-sm">Open Makeup Windows</p>
            <span className="ml-auto bg-orange-200 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">{makeupOpen.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {makeupOpen.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{a.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(a.subject)}`}>{a.subject}</span>
                    <span className="text-xs text-gray-400 capitalize">{a.type}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full border font-bold ${getDaysLeftColor(a.daysLeft)}`}>⏱ {a.daysLeft}d left</span>
                  {a.grade && <p className="text-xs text-gray-400 mt-1">Current: {a.grade}%</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coming Up Next Week */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <span>🔭</span>
          <p className="font-bold text-gray-800 text-sm">Coming Up Next Week</p>
          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${accentLight}`}>{nextWeek.length} due</span>
        </div>
        {nextWeek.length === 0
          ? <p className="text-sm text-gray-400 px-4 pb-4 text-center">Nothing due next week 🎉</p>
          : <div className="divide-y divide-gray-50">
            {nextWeek.map(a => {
              const daysAway = Math.ceil((new Date(a.dueDate) - new Date(2026,2,10))/(1000*60*60*24));
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center shrink-0 ${daysAway<=2?"bg-red-100":daysAway<=4?"bg-yellow-100":"bg-gray-100"}`}>
                    <p className="text-xs font-bold text-gray-500 leading-none">{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][new Date(a.dueDate).getMonth()]}</p>
                    <p className={`text-base font-bold leading-tight ${daysAway<=2?"text-red-600":daysAway<=4?"text-yellow-600":"text-gray-700"}`}>{new Date(a.dueDate).getDate()}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{a.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(a.subject)}`}>{a.subject}</span>
                      <span className="text-xs text-gray-400 capitalize">{a.type}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-semibold ${daysAway<=2?"text-red-500":daysAway<=4?"text-yellow-600":"text-gray-400"}`}>
                      {daysAway===0?"Today":daysAway===1?"Tomorrow":`In ${daysAway}d`}
                    </p>
                    <p className="text-xs text-indigo-500 font-semibold">{a.type==="assignment"?"$3":"$20"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>

      {/* Notification Preview */}
      <div className="bg-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔔</span>
          <p className="text-white font-bold text-sm">Sunday Notification Preview</p>
          <span className="ml-auto text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded-full">9:00 PM</span>
        </div>
        <div className="bg-gray-700 rounded-xl p-3 space-y-1">
          <p className="text-white text-sm font-semibold">📚 ScholarRewards Weekly Summary</p>
          <p className="text-gray-300 text-xs">
            {isParent
              ? `Sarah earned ${weekNet} this week • Avg grade: ${avgGrade}% • ${missing.length} missing • ${makeupOpen.length} makeup windows open`
              : `You earned ${weekNet} this week! Avg: ${avgGrade}% • ${nextWeek.length} assignments due next week • ${makeupOpen.length} makeup windows still open`
            }
          </p>
          <p className="text-indigo-300 text-xs font-medium mt-1">Tap to view full summary →</p>
        </div>
      </div>

    </div>
  );
}

// ── AI BREAKDOWN SCREEN ──────────────────────────────────────────
function AIBreakdown() {
  const [step, setStep] = useState("form");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    title: "", subject: "English", type: "assignment",
    dueDate: "", details: ""
  });
  const [checkedSteps, setCheckedSteps] = useState({});

  async function generatePlan() {
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const prompt = `You are an academic coach helping a high school student break down a big assignment into a manageable step-by-step plan.

Assignment: "${form.title}"
Subject: ${form.subject}
Type: ${form.type}
Due Date: ${form.dueDate}
Today's Date: ${today}
Extra details: ${form.details || "None"}

Create a realistic day-by-day action plan to complete this assignment successfully. 
Respond ONLY with a valid JSON object in this exact format, no extra text, no markdown:
{
  "summary": "One sentence overview of the approach",
  "estimatedHours": 4,
  "steps": [
    {
      "day": "Monday, Mar 11",
      "task": "What to do this day",
      "duration": "30 min",
      "tip": "A helpful tip for this step"
    }
  ]
}`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const text = data.content.map(b => b.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setPlan(parsed);
      setCheckedSteps({});
      setStep("plan");
    } catch(e) {
      setError("Couldn't generate plan. Please try again.");
    }
    setLoading(false);
  }

  function toggleStep(i) {
    setCheckedSteps(prev => ({ ...prev, [i]: !prev[i] }));
  }

  const completedCount = Object.values(checkedSteps).filter(Boolean).length;
  const totalSteps = plan?.steps?.length || 0;
  const progress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  return (
    <div className="pb-28 px-4 pt-4 space-y-4">
      {step === "form" && (
        <>
          {/* Header Card */}
          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🤖</span>
              <div>
                <p className="font-bold text-lg">AI Assignment Planner</p>
                <p className="text-violet-200 text-xs">Break any assignment into a step-by-step plan</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignment Title</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
                placeholder="e.g. Research paper on the Civil War"
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</label>
                <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</label>
                <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                  <option value="assignment">Assignment</option>
                  <option value="essay">Essay</option>
                  <option value="research paper">Research Paper</option>
                  <option value="project">Project</option>
                  <option value="test">Test / Exam</option>
                  <option value="quiz">Quiz</option>
                  <option value="presentation">Presentation</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</label>
              <input type="date"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
                value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})}/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Extra Details <span className="text-gray-300 font-normal">(optional)</span></label>
              <textarea
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                rows={3}
                placeholder="e.g. Must be 5 pages, MLA format, needs 3 sources, teacher wants an outline first..."
                value={form.details}
                onChange={e => setForm({...form, details: e.target.value})}
              />
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <button
              onClick={generatePlan}
              disabled={!form.title || !form.dueDate || loading}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-sm disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  Building your plan...
                </>
              ) : (
                <> 🤖 Generate My Plan </>
              )}
            </button>
          </div>

          {/* Examples */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Try an example</p>
            <div className="space-y-2">
              {[
                { title:"10-page research paper on WW2", subject:"History", type:"research paper" },
                { title:"Study for Algebra midterm exam", subject:"Math", type:"test" },
                { title:"Book report on To Kill a Mockingbird", subject:"English", type:"essay" },
              ].map((ex,i) => (
                <button key={i} onClick={() => setForm({...form, title:ex.title, subject:ex.subject, type:ex.type})}
                  className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-violet-50 rounded-xl text-sm text-gray-600 hover:text-violet-700 transition-all border border-transparent hover:border-violet-200">
                  <span className="font-medium">{ex.title}</span>
                  <span className="text-gray-400 ml-2">• {ex.subject}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {step === "plan" && plan && (
        <>
          {/* Plan Header */}
          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl p-5 text-white shadow-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-violet-300 font-semibold uppercase tracking-wide mb-1">{form.subject} • {form.type}</p>
                <p className="font-bold text-lg leading-tight">{form.title}</p>
                <p className="text-violet-200 text-xs mt-1">Due {form.dueDate} • ~{plan.estimatedHours}h total</p>
              </div>
              <button onClick={() => setStep("form")}
                className="bg-white bg-opacity-20 rounded-xl px-3 py-1.5 text-xs font-semibold ml-3 shrink-0">
                New Plan
              </button>
            </div>
            <p className="text-violet-100 text-sm mt-3 leading-relaxed">{plan.summary}</p>
          </div>

          {/* Progress Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-bold text-gray-700">Your Progress</p>
              <p className="text-sm font-bold text-violet-600">{completedCount}/{totalSteps} steps</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className="bg-gradient-to-r from-violet-500 to-indigo-500 h-3 rounded-full transition-all duration-500"
                style={{width:`${progress}%`}}/>
            </div>
            {progress === 100 && (
              <p className="text-center text-green-600 font-bold text-sm mt-2">🎉 Assignment Complete!</p>
            )}
          </div>

          {/* Step-by-Step Plan */}
          <div className="space-y-3">
            {plan.steps.map((s, i) => (
              <div key={i}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${checkedSteps[i] ? "border-green-200 opacity-70" : "border-gray-100"}`}>
                <div className="flex items-start gap-3 p-4">
                  <button onClick={() => toggleStep(i)}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${checkedSteps[i] ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                    {checkedSteps[i] && <span className="text-xs font-bold">✓</span>}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-violet-600 uppercase tracking-wide">{s.day}</p>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">⏱ {s.duration}</span>
                    </div>
                    <p className={`text-sm font-semibold ${checkedSteps[i] ? "line-through text-gray-400" : "text-gray-800"}`}>{s.task}</p>
                    {!checkedSteps[i] && s.tip && (
                      <div className="mt-2 flex items-start gap-1.5 bg-violet-50 rounded-xl px-3 py-2">
                        <span className="text-sm">💡</span>
                        <p className="text-xs text-violet-700">{s.tip}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add to Assignments */}
          <button
            onClick={() => setStep("form")}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
          >
            🤖 Plan Another Assignment
          </button>
        </>
      )}
    </div>
  );
}

// ── PARENT SCREENS ───────────────────────────────────────────────
function ParentOverview({ assignments, payoutPending, setPayoutPending }) {
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAction, setPayoutAction] = useState(null);
  const balance = 23; const holdback = 20; const available = balance - holdback;

  const upcoming = assignments
    .filter(a => a.status === "pending")
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const missing = assignments.filter(a => a.status === "missing");

  const lowGrade = assignments.filter(a => a.status === "graded" && a.grade !== null && a.grade < 70);

  const graded = assignments.filter(a => a.grade);
  const avgGrade = graded.length ? Math.round(graded.reduce((s,a) => s + a.grade, 0) / graded.length) : 0;

  function getDueSoonColor(date) {
    const days = Math.ceil((new Date(date) - new Date()) / (1000*60*60*24));
    if (days <= 1) return "border-red-300 bg-red-50";
    if (days <= 3) return "border-yellow-300 bg-yellow-50";
    return "border-gray-200 bg-white";
  }
  function getDueSoonLabel(date) {
    const days = Math.ceil((new Date(date) - new Date()) / (1000*60*60*24));
    if (days <= 0) return { text:"Due Today", color:"text-red-600 font-bold" };
    if (days === 1) return { text:"Due Tomorrow", color:"text-red-500 font-bold" };
    if (days <= 3) return { text:`Due in ${days} days`, color:"text-yellow-600 font-semibold" };
    return { text: `Due ${date}`, color:"text-gray-400" };
  }

  return (
    <div className="pb-4 px-4 pt-4 space-y-4">

      {/* Payout Request Banner */}
      {payoutPending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💸</span>
            <div><p className="font-bold text-yellow-800">Payout Request from Sarah</p><p className="text-xs text-yellow-600">Requesting ${available}.00 • Submitted just now</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>{setPayoutAction("approve");setShowPayoutModal(true);}} className="flex-1 bg-green-500 text-white py-2 rounded-xl text-sm font-bold">✅ Approve</button>
            <button onClick={()=>{setPayoutAction("delay");setShowPayoutModal(true);}} className="flex-1 bg-yellow-400 text-yellow-900 py-2 rounded-xl text-sm font-bold">⏰ Delay</button>
            <button onClick={()=>{setPayoutAction("deny");setShowPayoutModal(true);}} className="flex-1 bg-red-100 text-red-600 py-2 rounded-xl text-sm font-bold">❌ Deny</button>
          </div>
        </div>
      )}

      {/* At-a-Glance Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label:"Upcoming", val:upcoming.length, color:"text-indigo-600", bg:"bg-indigo-50" },
          { label:"Missing", val:missing.length, color:missing.length>0?"text-red-500":"text-green-600", bg:missing.length>0?"bg-red-50":"bg-green-50" },
          { label:"Low Grade", val:lowGrade.length, color:lowGrade.length>0?"text-orange-500":"text-green-600", bg:lowGrade.length>0?"bg-orange-50":"bg-green-50" },
          { label:"Avg Grade", val:`${avgGrade}%`, color:avgGrade>=90?"text-green-600":avgGrade>=70?"text-indigo-600":"text-red-500", bg:"bg-white" },
        ].map((s,i) => (
          <div key={i} className={`${s.bg} rounded-2xl p-3 shadow-sm text-center border border-gray-100`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* SECTION 1: Upcoming Assignments */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <p className="font-bold text-gray-800 text-sm">Upcoming Assignments</p>
          </div>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{upcoming.length}</span>
        </div>
        {upcoming.length === 0
          ? <p className="text-sm text-gray-400 px-4 pb-4">No upcoming assignments 🎉</p>
          : <div className="divide-y divide-gray-50">
            {upcoming.map(a => {
              const due = getDueSoonLabel(a.dueDate);
              return (
                <div key={a.id} className={`flex items-center justify-between px-4 py-3 border-l-4 ${getDueSoonColor(a.dueDate)}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${getSubjectColor(a.subject)}`}/>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{a.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(a.subject)}`}>{a.subject}</span>
                        <span className="text-xs text-gray-400 capitalize">{a.type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className={`text-xs ${due.color}`}>{due.text}</p>
                    <p className="text-xs text-indigo-500 font-semibold mt-0.5">{a.type==="assignment"?"$3":"$20"} potential</p>
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>

      {/* SECTION 2: Missing Assignments */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚨</span>
            <p className="font-bold text-gray-800 text-sm">Missing Assignments</p>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${missing.length>0?"bg-red-100 text-red-700":"bg-green-100 text-green-700"}`}>{missing.length}</span>
        </div>
        {missing.length === 0
          ? <p className="text-sm text-gray-400 px-4 pb-4">No missing assignments 🎉</p>
          : <div className="divide-y divide-gray-50">
            {missing.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 border-l-4 border-red-400 bg-red-50">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${getSubjectColor(a.subject)}`}/>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{a.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(a.subject)}`}>{a.subject}</span>
                      {a.daysLeft > 0 && <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getDaysLeftColor(a.daysLeft)}`}>⏱ {a.daysLeft}d to fix</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs text-red-500 font-bold">$0.00</p>
                  <p className="text-xs text-gray-400">was ${a.type==="assignment"?"$3":"$20"}</p>
                </div>
              </div>
            ))}
          </div>
        }
      </div>

      {/* SECTION 3: Low Grade Assignments */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📉</span>
            <p className="font-bold text-gray-800 text-sm">Low Grade Assignments</p>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${lowGrade.length>0?"bg-orange-100 text-orange-700":"bg-green-100 text-green-700"}`}>{lowGrade.length}</span>
        </div>
        {lowGrade.length === 0
          ? <p className="text-sm text-gray-400 px-4 pb-4">No low grade assignments 🎉</p>
          : <div className="divide-y divide-gray-50">
            {lowGrade.map(a => {
              const canMakeup = (a.type==="test"||a.type==="quiz") && a.daysLeft > 0;
              return (
                <div key={a.id} className="flex items-center justify-between px-4 py-3 border-l-4 border-orange-400 bg-orange-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${getSubjectColor(a.subject)}`}/>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{a.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSubjectLight(a.subject)}`}>{a.subject}</span>
                        <span className="text-xs text-gray-400 capitalize">{a.type}</span>
                        {canMakeup && <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getDaysLeftColor(a.daysLeft)}`}>⏱ {a.daysLeft}d to retake</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xl font-bold text-orange-600">{a.grade}%</p>
                    {canMakeup
                      ? <p className="text-xs text-green-600 font-semibold">Retake available</p>
                      : <p className="text-xs text-red-400">No retake</p>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>

      {/* Payout Modal */}
      {showPayoutModal&&(
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
            {payoutAction==="approve"&&<>
              <h2 className="text-lg font-bold text-gray-800">✅ Approve Payout</h2>
              <div className="bg-green-50 rounded-2xl p-4">
                <div className="flex justify-between text-sm mb-2"><span>Amount</span><span className="font-bold text-green-600">${available}.00</span></div>
                <div className="flex justify-between text-sm"><span>Holdback retained</span><span className="font-bold">${holdback}.00</span></div>
              </div>
              <button onClick={()=>{setPayoutPending(false);setShowPayoutModal(false);}} className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold">Confirm Approval</button>
            </>}
            {payoutAction==="delay"&&<>
              <h2 className="text-lg font-bold text-gray-800">⏰ Delay Payout</h2>
              <p className="text-sm text-gray-500">The payout will stay pending. Sarah will be notified you'll pay soon.</p>
              <div className="grid grid-cols-3 gap-2">
                {["Tonight","This Weekend","Next Week"].map(d=>(
                  <button key={d} onClick={()=>{setPayoutPending(false);setShowPayoutModal(false);}} className="bg-yellow-100 text-yellow-800 py-3 rounded-xl text-sm font-semibold">{d}</button>
                ))}
              </div>
            </>}
            {payoutAction==="deny"&&<>
              <h2 className="text-lg font-bold text-gray-800">❌ Deny Payout</h2>
              <p className="text-sm text-gray-500">Sarah will be notified the payout was denied and the balance will remain.</p>
              <button onClick={()=>{setPayoutPending(false);setShowPayoutModal(false);}} className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold">Confirm Denial</button>
            </>}
            <button onClick={()=>setShowPayoutModal(false)} className="w-full text-gray-400 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ParentSettings() {
  const [settings, setSettings] = useState({
    assignmentReward: 3, testReward: 20, passingThreshold: 70,
    makeupWindow: 7, holdback: 20, rewardType: "money",
    excellenceBonus: true, streakBonus: true,
    payoutSchedule: "request",
  });

  function update(key, val) { setSettings({...settings,[key]:val}); }

  return (
    <div className="pb-4 px-4 pt-4 space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
        <p className="text-xs text-gray-400 font-medium">REWARD TYPE</p>
        <div className="grid grid-cols-2 gap-2">
          {[{val:"money",icon:"💰",label:"Money"},{val:"screen",icon:"🎮",label:"Screen Time"},{val:"points",icon:"⭐",label:"Points"},{val:"custom",icon:"🎁",label:"Custom"}].map(r=>(
            <button key={r.val} onClick={()=>update("rewardType",r.val)}
              className={`py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${settings.rewardType===r.val?"bg-indigo-600 text-white":"bg-gray-100 text-gray-600"}`}>
              <span>{r.icon}</span>{r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
        <p className="text-xs text-gray-400 font-medium">REWARD AMOUNTS</p>
        {[
          {label:"Assignment Reward",key:"assignmentReward",prefix:"$",suffix:"each"},
          {label:"Test / Quiz Reward",key:"testReward",prefix:"$",suffix:"each"},
          {label:"Passing Threshold",key:"passingThreshold",prefix:"",suffix:"%"},
          {label:"Makeup Window",key:"makeupWindow",prefix:"",suffix:"days"},
          {label:"Payout Holdback",key:"holdback",prefix:"$",suffix:"buffer"},
        ].map(f=>(
          <div key={f.key} className="flex items-center justify-between">
            <p className="text-sm text-gray-700">{f.label}</p>
            <div className="flex items-center gap-1">
              {f.prefix&&<span className="text-gray-500 text-sm">{f.prefix}</span>}
              <input type="number" value={settings[f.key]} onChange={e=>update(f.key,parseFloat(e.target.value))}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
              <span className="text-gray-400 text-xs">{f.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <p className="text-xs text-gray-400 font-medium">BONUS FEATURES</p>
        {[{key:"excellenceBonus",label:"Excellence Bonus",desc:"Extra reward for 80%+ and 90%+ grades"},{key:"streakBonus",label:"Weekly Streak Bonus",desc:"Bonus for completing all assignments in a week"}].map(b=>(
          <div key={b.key} className="flex items-center justify-between">
            <div><p className="text-sm font-medium text-gray-700">{b.label}</p><p className="text-xs text-gray-400">{b.desc}</p></div>
            <button onClick={()=>update(b.key,!settings[b.key])}
              className={`w-12 h-6 rounded-full transition-all relative ${settings[b.key]?"bg-indigo-600":"bg-gray-200"}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${settings[b.key]?"left-6":"left-0.5"}`}/>
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <p className="text-xs text-gray-400 font-medium">PAYOUT SCHEDULE</p>
        {[{val:"request",label:"Student Request + Approval"},{val:"monthly",label:"Monthly Automatic"},{val:"manual",label:"Parent Initiated Only"}].map(p=>(
          <button key={p.val} onClick={()=>update("payoutSchedule",p.val)}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${settings.payoutSchedule===p.val?"bg-indigo-50 text-indigo-700 border border-indigo-200":"bg-gray-50 text-gray-600 border border-transparent"}`}>
            {settings.payoutSchedule===p.val?"✅ ":""}{p.label}
          </button>
        ))}
      </div>

      <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm shadow">Save Settings</button>
    </div>
  );
}

// ── ROOT APP ─────────────────────────────────────────────────────
export default function App() {
  const [role, setRole] = useState(null);
  const [view, setView] = useState("dashboard");
  const [assignments, setAssignments] = useState(INITIAL_ASSIGNMENTS);
  const [payoutPending, setPayoutPending] = useState(false);

  const totalEarned = assignments.reduce((s,a)=>{ const r=getRewardStatus(a); return s+(r.earned||0); },0);

  if (!role) return <LoginScreen onLogin={r=>{setRole(r);setView("dashboard");}}/>;

  const isParent = role==="parent";

  const studentNavs = [
    {id:"dashboard",icon:"📚",label:"Assignments"},
    {id:"calendar",icon:"📅",label:"Calendar"},
    {id:"ai",icon:"🤖",label:"AI Planner"},
    {id:"rewards",icon:"💰",label:"Rewards"},
    {id:"weekly",icon:"📊",label:"Weekly"},
    {id:"notifications",icon:"🔔",label:"Alerts"},
  ];
  const parentNavs = [
    {id:"dashboard",icon:"📊",label:"Overview"},
    {id:"calendar",icon:"📅",label:"Calendar"},
    {id:"weekly",icon:"📋",label:"Weekly"},
    {id:"notifications",icon:"🔔",label:"Alerts"},
    {id:"messages",icon:"💬",label:"Messages"},
    {id:"settings",icon:"⚙️",label:"Settings"},
  ];
  const navs = isParent ? parentNavs : studentNavs;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className={`${isParent?"bg-emerald-700":"bg-indigo-600"} text-white px-4 py-4 flex items-center justify-between shadow-lg`}>
        <div>
          <h1 className="text-xl font-bold tracking-tight">🎓 Earn Your A</h1>
          <p className={`${isParent?"text-emerald-200":"text-indigo-200"} text-xs`}>
            {isParent?"Parent Dashboard":"Student Dashboard"}
            {payoutPending&&isParent&&<span className="ml-2 bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full text-xs font-bold">💸 Payout Pending</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`${isParent?"bg-emerald-800":"bg-indigo-700"} rounded-xl px-3 py-2 text-center`}>
            <p className={`${isParent?"text-emerald-300":"text-indigo-300"} text-xs`}>Balance</p>
            <p className={`text-lg font-bold ${totalEarned>=0?"text-green-300":"text-red-300"}`}>${totalEarned.toFixed(2)}</p>
          </div>
          <button onClick={()=>{setRole(null);setView("dashboard");}}
            className={`${isParent?"bg-emerald-600":"bg-indigo-500"} rounded-xl px-3 py-2 text-xs font-medium`}>
            {isParent?"👨‍👩‍👧":"👩‍🎓"} Switch
          </button>
        </div>
      </div>

      {/* Screen */}
      <div className="overflow-y-auto" style={{height:"calc(100vh - 130px)"}}>
        {!isParent&&view==="dashboard"&&<StudentDashboard assignments={assignments} setAssignments={setAssignments}/>}
        {!isParent&&view==="rewards"&&<StudentRewards payoutPending={payoutPending} setPayoutPending={setPayoutPending}/>}
        {view==="messages"&&<MessagesScreen isParent={isParent}/>}
        {view==="calendar"&&<CalendarView assignments={assignments} isParent={isParent}/>}
        {view==="weekly"&&<WeeklySummary assignments={assignments} isParent={isParent}/>}
        {view==="notifications"&&<NotificationCenter assignments={assignments} isParent={isParent} payoutPending={payoutPending}/>}
        {!isParent&&view==="ai"&&<AIBreakdown/>}
        {!isParent&&view==="profile"&&(
          <div className="pb-4 px-4 pt-4 space-y-4">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-6 text-white text-center shadow-lg">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">👩‍🎓</div>
              <p className="text-xl font-bold">Sarah</p>
              <p className="text-indigo-200 text-sm">10th Grade • Student</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
              <p className="text-xs text-gray-400 font-medium">CONNECTED ACCOUNTS</p>
              {[{name:"Google Classroom",icon:"🎓",status:"Connected",color:"text-green-600"},{name:"Canvas",icon:"🖼️",status:"Connect",color:"text-indigo-500"},{name:"Infinite Campus",icon:"🏫",status:"Import CSV",color:"text-indigo-500"}].map((item,i)=>(
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><span className="text-xl">{item.icon}</span><p className="text-sm font-medium text-gray-700">{item.name}</p></div>
                  <span className={`text-sm font-semibold ${item.color}`}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {isParent&&view==="dashboard"&&<ParentOverview assignments={assignments} payoutPending={payoutPending} setPayoutPending={setPayoutPending}/>}
        {isParent&&view==="assignments"&&<StudentDashboard assignments={assignments} setAssignments={setAssignments}/>}
        {isParent&&view==="settings"&&<ParentSettings/>}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-3 px-4">
        {navs.map(nav=>(
          <button key={nav.id} onClick={()=>setView(nav.id)}
            className={`flex flex-col items-center gap-0.5 transition-all relative ${view===nav.id?(isParent?"text-emerald-700":"text-indigo-600"):"text-gray-400"}`}>
            <span className="text-xl">{nav.icon}</span>
            <span className="text-xs font-medium">{nav.label}</span>
            {nav.id==="dashboard"&&payoutPending&&isParent&&<div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full"/>}
          </button>
        ))}
      </div>
    </div>
  );
}