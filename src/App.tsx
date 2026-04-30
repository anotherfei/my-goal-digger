import { useCallback, useEffect, useMemo, useState, useRef } from "react";

// ─── Constants & Types ───────────────────────────────────────────────
const TODAY = new Date(2026, 3, 15);
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

type NavKey = "task" | "calendar" | "planner" | "community" | "companion";
type Energy = "low" | "steady" | "high";
type Mood = "great" | "okay" | "tired";

type SubTask = { id: number; title: string; goalId: number; duration: string; load: "light"|"focus"|"stretch"; done: boolean; points: number; scheduledDate: Date; guidance?: string };
type GoalItem = { id: number; title: string; importance: number; category: string; deadline: Date; color: string; subtasks: SubTask[] };
type CommunityUser = { name: string; compatibility: number | null; avatar: string };
type FocusApp = { name: string; icon: string; allowed: boolean };
type Reminder = { id: number; title: string; time: string; taskId?: number };
type CurrentUser = { name: string; email: string; joined: string };
type ChatMsg = { role: "ai" | "user"; text: string };
type Routine = { id: number; title: string; time: string; frequency: "Daily" | "Weekly" | "Monthly" | "Once" | "Custom" };
type Friend = { name: string; status: string; color: string };
type CommunityGroup = { name: string; members: number; tag: string; creator: string; created: string; about: string };

type IconProps = { className?: string };

const sameDay = (a: Date, b: Date) => a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime()-a.getTime())/86400000);
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
const monthYearLabel = (y: number, m: number) => `${MONTH_NAMES[m]} ${y}`;
const durationToMinutes = (duration: string) => {
  const match = duration.match(/\d+/);
  return match ? Math.max(1, Number(match[0])) : 10;
};
function buildMonthGrid(y: number, m: number) {
  const first = new Date(y, m, 1);
  const off = (first.getDay()+6)%7;
  const dim = new Date(y, m+1, 0).getDate();
  const dip = new Date(y, m, 0).getDate();
  return Array.from({length:42},(_,i)=>{
    const d=i-off+1;
    if(d<1){const dt=new Date(y,m-1,dip+d);return{date:dt,displayDay:dt.getDate(),isOutside:true};}
    if(d>dim){const dt=new Date(y,m+1,d-dim);return{date:dt,displayDay:dt.getDate(),isOutside:true};}
    return{date:new Date(y,m,d),displayDay:d,isOutside:false};
  });
}

// ─── Data ────────────────────────────────────────────────────────────
const navItems: Array<{key:NavKey;label:string;Icon:(p:IconProps)=>React.ReactNode}> = [
  {key:"task",label:"Task",Icon:TaskIcon},{key:"calendar",label:"Calendar",Icon:CalendarIcon},
  {key:"planner",label:"Home",Icon:PlannerIcon},{key:"community",label:"Community",Icon:CommunityIcon},
  {key:"companion",label:"Pet shop",Icon:CompanionIcon},
];

const taskGuidance: Record<string,string> = {
  "Draft project outline": "Start with 3 bullet points of what your project does. Don't aim for perfect — just capture the core idea. Set a 12-min timer and stop when it rings.",
  "Sketch homepage layout": "Use paper or a whiteboard. Draw 3 boxes: hero, about, projects. Label each. You're not designing — you're deciding order.",
  "Write project descriptions": "For each project write: 1 sentence what it does, 1 sentence why it matters. Max 2 paragraphs each.",
  "Choose color palette": "Go to coolors.co, hit spacebar 5 times, and pick the one you like best. Don't overthink it.",
  "Build hero section": "Copy a hero section you like. Replace the text and image. Start ugly, refine later.",
  "Deploy first draft": "Use Vercel or Netlify — drag and drop your folder. It takes 2 minutes. Ship imperfect.",
  "Solve 5 practice problems": "Pick problems you're 70% confident about — challenging but doable. Write the solution before checking the answer.",
  "Make flashcards (chapter 4)": "One concept per card. Use questions on front, answers on back. 15 cards max per session.",
  "Mock exam timed": "Set a timer for 30 min. Close everything else. If you get stuck, skip and return. Grade honestly.",
  "Review weak topics": "Look at your last test errors. Re-read those sections only. Write 1 sentence summary for each.",
  "Send weekly update": "Template: 'Here's what I did, here's what's next, here's where I need help.' 3 sentences max.",
  "Reply to pending DMs": "Batch reply. Start with the oldest. Keep each reply under 3 sentences. Close the app when done.",
  "Schedule sync meeting": "Send 2 time options. Let them pick. Don't over-negotiate the time slot.",
  "Choose next practice problem": "Pick one that scares you a little. If it's too easy, you won't grow. Set a 10-min attempt limit.",
  "Journal 3 wins": "Write 3 things you did today, no matter how small. 'I showed up' counts.",
  "Reflect on the week": "3 questions: What worked? What didn't? What will I try differently? 1 line each.",
};
const defaultGuidance = "Focus on starting, not finishing. Set a timer for the listed duration. Begin with the smallest possible step. You can always stop after the timer — but you'll probably want to keep going.";

const initialGoals: GoalItem[] = [
  {id:1,title:"Launch portfolio",importance:5,category:"Career",deadline:new Date(2026,3,22),color:"from-teal-400 to-emerald-500",subtasks:[
    {id:101,title:"Draft project outline",goalId:1,duration:"12 min",load:"focus",done:false,points:20,scheduledDate:new Date(2026,3,15)},
    {id:102,title:"Sketch homepage layout",goalId:1,duration:"15 min",load:"focus",done:false,points:20,scheduledDate:new Date(2026,3,16)},
    {id:103,title:"Write project descriptions",goalId:1,duration:"20 min",load:"stretch",done:false,points:25,scheduledDate:new Date(2026,3,17)},
    {id:104,title:"Choose color palette",goalId:1,duration:"8 min",load:"light",done:false,points:10,scheduledDate:new Date(2026,3,18)},
    {id:105,title:"Build hero section",goalId:1,duration:"25 min",load:"stretch",done:false,points:30,scheduledDate:new Date(2026,3,19)},
    {id:106,title:"Deploy first draft",goalId:1,duration:"20 min",load:"focus",done:false,points:25,scheduledDate:new Date(2026,3,21)},
  ]},
  {id:2,title:"Exam prep",importance:4,category:"Study",deadline:new Date(2026,3,28),color:"from-amber-400 to-orange-500",subtasks:[
    {id:201,title:"Review chapter 3 notes",goalId:2,duration:"8 min",load:"light",done:true,points:10,scheduledDate:new Date(2026,3,14)},
    {id:202,title:"Solve 5 practice problems",goalId:2,duration:"15 min",load:"focus",done:false,points:20,scheduledDate:new Date(2026,3,15)},
    {id:203,title:"Make flashcards (chapter 4)",goalId:2,duration:"12 min",load:"focus",done:false,points:15,scheduledDate:new Date(2026,3,17)},
    {id:204,title:"Mock exam timed",goalId:2,duration:"30 min",load:"stretch",done:false,points:35,scheduledDate:new Date(2026,3,20)},
    {id:205,title:"Review weak topics",goalId:2,duration:"15 min",load:"focus",done:false,points:20,scheduledDate:new Date(2026,3,24)},
  ]},
  {id:3,title:"Team comms",importance:2,category:"Work",deadline:new Date(2026,3,30),color:"from-violet-400 to-purple-500",subtasks:[
    {id:301,title:"Send weekly update",goalId:3,duration:"5 min",load:"light",done:false,points:10,scheduledDate:new Date(2026,3,15)},
    {id:302,title:"Reply to pending DMs",goalId:3,duration:"10 min",load:"light",done:false,points:10,scheduledDate:new Date(2026,3,18)},
    {id:303,title:"Schedule sync meeting",goalId:3,duration:"5 min",load:"light",done:false,points:10,scheduledDate:new Date(2026,3,22)},
  ]},
  {id:4,title:"Build consistency",importance:3,category:"Wellness",deadline:new Date(2026,4,5),color:"from-rose-400 to-pink-500",subtasks:[
    {id:401,title:"Choose next practice problem",goalId:4,duration:"10 min",load:"stretch",done:false,points:15,scheduledDate:new Date(2026,3,15)},
    {id:402,title:"Journal 3 wins",goalId:4,duration:"5 min",load:"light",done:false,points:10,scheduledDate:new Date(2026,3,16)},
    {id:403,title:"Reflect on the week",goalId:4,duration:"10 min",load:"light",done:false,points:10,scheduledDate:new Date(2026,3,21)},
    {id:404,title:"Plan May routine",goalId:4,duration:"15 min",load:"focus",done:false,points:20,scheduledDate:new Date(2026,4,2)},
  ]},
];

const categoryOptions = ["Career","Study","Work","Wellness","Hobby","Creative","Family","Finance","Other"];

const initialRoutines: Routine[] = [
  {id:1,title:"Morning stretch",time:"07:00",frequency:"Daily"},
  {id:2,title:"Drink water",time:"07:15",frequency:"Daily"},
  {id:3,title:"Read 10 pages",time:"21:00",frequency:"Weekly"},
];

const leaderboard = [{name:"Maya",streak:19,score:2840,pace:"+12%"},{name:"Ari",streak:16,score:2695,pace:"+8%"},{name:"Jon",streak:12,score:2310,pace:"+4%"},{name:"Nia",streak:9,score:2055,pace:"+3%"}];
const initialFriends: Friend[] = [{name:"Sam",status:"Finished 3 tiny wins",color:"bg-sky-400"},{name:"Lee",status:"Needs a gentle nudge",color:"bg-amber-400"},{name:"Zoe",status:"Planning tomorrow",color:"bg-violet-400"}];
const communityUsers: CommunityUser[] = [{name:"Alex K.",compatibility:90,avatar:"AK"},{name:"Mira S.",compatibility:72,avatar:"MS"},{name:"Dev P.",compatibility:56,avatar:"DP"},{name:"Luna R.",compatibility:23,avatar:"LR"},{name:"New User",compatibility:null,avatar:"??"}];

const suggestedGroups: CommunityGroup[] = [
  {name:"Portfolio Builders",members:142,tag:"They build portfolios like you",creator:"Maya Chen",created:"Apr 2026",about:"Portfolio builders sharing weekly reviews and design feedback."},
  {name:"Study Sprint Club",members:89,tag:"Exam prep community",creator:"Dr. Noor",created:"Mar 2026",about:"Focused study sprints for students preparing for exams."},
  {name:"Consistency Crew",members:234,tag:"Looking for habit trackers",creator:"Ari Reed",created:"Feb 2026",about:"Gentle accountability for daily routines and tiny wins."},
  {name:"Creative Side Hustle",members:67,tag:"Needs designers & writers",creator:"Zoe Park",created:"Apr 2026",about:"Creative workers building side projects after school or work."},
];

const shopItems = [
  {name:"Cloud Bed",price:120,note:"Rest bonus",image:"☁️",type:"Furniture"},
  {name:"Focus Lamp",price:80,note:"Deep work glow",image:"💡",type:"Room"},
  {name:"Trail Cape",price:150,note:"Streak style",image:"🧣",type:"Costume"},
  {name:"Star Hat",price:95,note:"Motivation charm",image:"🎩",type:"Costume"},
  {name:"Tiny Backpack",price:110,note:"Adventure gear",image:"🎒",type:"Costume"},
  {name:"Snack Bowl",price:70,note:"Happy pet boost",image:"🥣",type:"Food"},
];
const petLooks = [
  {id:"mint", name:"Mint", from:"#7dd3fc", to:"#34d399", body:"linear-gradient(135deg,#7dd3fc 0%,#34d399 100%)", accent:"#d1fae5"},
  {id:"peach",name:"Peach",from:"#fdba74", to:"#fb7185", body:"linear-gradient(135deg,#fdba74 0%,#fb7185 100%)", accent:"#ffedd5"},
  {id:"lunar",name:"Lunar",from:"#a78bfa", to:"#475569", body:"linear-gradient(135deg,#a78bfa 0%,#475569 100%)", accent:"#ede9fe"},
];
const defaultFocusApps: FocusApp[] = [{name:"Notes",icon:"📝",allowed:true},{name:"Music",icon:"🎵",allowed:true},{name:"Browser",icon:"🌐",allowed:false},{name:"Messages",icon:"💬",allowed:false},{name:"Calculator",icon:"🔢",allowed:true},{name:"Social",icon:"📱",allowed:false}];

const moodToEnergy: Record<Mood,Energy> = {great:"high",okay:"steady",tired:"low"};
const moodEmojis: {mood:Mood;emoji:string;label:string;helper:string}[] = [
  {mood:"great",emoji:"😊",label:"Great",helper:"Stretch tasks unlocked"},
  {mood:"okay",emoji:"😐",label:"Okay",helper:"Balanced day"},
  {mood:"tired",emoji:"😔",label:"Tired",helper:"Light wins only"},
];
const energyCopy: Record<Energy,string> = {
  low:"Low energy detected. I'm prioritizing only your most important goals and shrinking each task to ≤8 min.",
  steady:"Steady energy. Balanced mix: 1 stretch task + light wins from your top-priority goals.",
  high:"High energy! I'm front-loading stretch tasks from your highest-importance goals.",
};

// ─── ATS Engine ──────────────────────────────────────────────────────
function scoreSubtask(s:SubTask,goal:GoalItem,energy:Energy,today:Date){
  const dud=Math.max(1,daysBetween(today,goal.deadline));
  const dd=daysBetween(today,s.scheduledDate);
  return goal.importance*2+10/dud+(dd===0?5:dd<0?3:Math.max(0,4-dd))+(energy==="low"?(s.load==="light"?4:s.load==="focus"?1:-3):energy==="high"?(s.load==="stretch"?4:s.load==="focus"?2:1):2);
}
function computeATS(goals:GoalItem[],energy:Energy,today:Date):SubTask[]{
  const all=goals.flatMap(g=>g.subtasks.filter(s=>!s.done));
  if(!all.length)return[];
  const slots=energy==="low"?2:energy==="steady"?4:5;
  const scored=all.map(s=>({sub:s,score:scoreSubtask(s,goals.find(g=>g.id===s.goalId)!,energy,today)}));
  scored.sort((a,b)=>b.score-a.score);
  return scored.slice(0,slots).map(x=>x.sub);
}

// ─── App ─────────────────────────────────────────────────────────────
export default function App(){
  const [activeTab,setActiveTab]=useState<NavKey>("planner");
  const [goals,setGoals]=useState<GoalItem[]>(initialGoals);
  const [energy,setEnergy]=useState<Energy>("steady");
  const [mood,setMood]=useState<Mood>("okay");
  const [adaptiveMessage,setAdaptiveMessage]=useState(energyCopy.steady);
  const [selectedDay,setSelectedDay]=useState<Date>(TODAY);
  const [viewYear,setViewYear]=useState(TODAY.getFullYear());
  const [viewMonth,setViewMonth]=useState(TODAY.getMonth());
  const [selectedPet,setSelectedPet]=useState("mint");
  const [petHunger,setPetHunger]=useState(35);
  const [petCoins,setPetCoins]=useState(430);
  const [focusApps,setFocusApps]=useState<FocusApp[]>(defaultFocusApps);
  const [focusSeconds,setFocusSeconds]=useState(0);
  const [focusRunning,setFocusRunning]=useState(false);
  const [focusDuration,setFocusDuration]=useState(25*60);
  const [showFocusOverlay,setShowFocusOverlay]=useState(false);
  const [showGoalDeconstructor,setShowGoalDeconstructor]=useState(false);
  void showGoalDeconstructor;
  const [deconGoalInput,setDeconGoalInput]=useState("Become a YouTuber");
  const [deconGoalImportance,setDeconGoalImportance]=useState(3);
  const [deconGoalCategory,setDeconGoalCategory]=useState("Hobby");
  const [deconGoalDeadline,setDeconGoalDeadline]=useState<Date>(addDays(TODAY,14));
  const [todayTaskIds,setTodayTaskIds]=useState<number[]>(()=>computeATS(initialGoals,"steady",TODAY).map(s=>s.id));
  const [activeReminder,setActiveReminder]=useState<Reminder|null>(null);
  const [currentUser,setCurrentUser]=useState<CurrentUser|null>({name:"Ari Reed",email:"ari@goaldigger.app",joined:"April 2026"});
  const [showProfile,setShowProfile]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [showAuth,setShowAuth]=useState(false);
  const [authMode,setAuthMode]=useState<"login"|"signup">("login");
  const [settingNotifications,setSettingNotifications]=useState(true);
  const [settingSound,setSettingSound]=useState(true);
  const [settingDarkMode,setSettingDarkMode]=useState(false);
  const [settingKindMode,setSettingKindMode]=useState(true);
  const [settingDailyReminder,setSettingDailyReminder]=useState(true);
  const [datePicker,setDatePicker]=useState<{initial:Date;onPick:(d:Date)=>void}|null>(null);
  const [expandedTask,setExpandedTask]=useState<number|null>(null);
  const [calendarDayPopup,setCalendarDayPopup]=useState<Date|null>(null);
  const [routines,setRoutines]=useState<Routine[]>(initialRoutines);
  const [showAddRoutine,setShowAddRoutine]=useState(false);
  const [newRoutineName,setNewRoutineName]=useState("");
  const [newRoutineTime,setNewRoutineTime]=useState("08:00");
  const [newRoutineFrequency,setNewRoutineFrequency]=useState<Routine["frequency"]>("Daily");
  const [newRoutineCustom,setNewRoutineCustom]=useState("");
  const [breakdownChat,setBreakdownChat]=useState<{goalTitle:string;messages:ChatMsg[]}|null>(null);
  const [customFocusMin,setCustomFocusMin]=useState("");
  const [selectedFocusTask,setSelectedFocusTask]=useState<number|null>(null);
  const [joinGroupInput,setJoinGroupInput]=useState("");
  const [myFriends,setMyFriends]=useState<Friend[]>(initialFriends);
  const [myCommunities,setMyCommunities]=useState<CommunityGroup[]>([suggestedGroups[0]]);
  const [friendSuggestions,setFriendSuggestions]=useState<CommunityUser[]>(communityUsers);
  const [communitySuggestions,setCommunitySuggestions]=useState<CommunityGroup[]>(suggestedGroups.filter(g=>g.name!==suggestedGroups[0].name));

  const allSubtasks=useMemo(()=>goals.flatMap(g=>g.subtasks),[goals]);
  const todayTasks=useMemo(()=>todayTaskIds.map(id=>allSubtasks.find(s=>s.id===id)).filter(Boolean) as SubTask[],[todayTaskIds,allSubtasks]);
  const todayCompleted=todayTasks.filter(t=>t.done).length;
  const todayCompletion=todayTasks.length===0?100:Math.round((todayCompleted/todayTasks.length)*100);
  const activePet=petLooks.find(p=>p.id===selectedPet)??petLooks[0];
  const focusTask=selectedFocusTask?allSubtasks.find(t=>t.id===selectedFocusTask):undefined;
  const focusRemaining=Math.max(0,focusDuration-focusSeconds);
  const focusMinutes=Math.floor(focusRemaining/60);
  const focusSecs=focusRemaining%60;

  const recompute=useCallback((e:Energy,g:GoalItem[])=>{
    const fresh=computeATS(g,e,TODAY);
    setTodayTaskIds(prev=>{
      const kept=prev.filter(id=>{const t=g.flatMap(x=>x.subtasks).find(s=>s.id===id);return t?.done;});
      const merged=[...kept];
      for(const t of fresh)if(!merged.includes(t.id))merged.push(t.id);
      return merged;
    });
  },[]);

  // Demo reminder
  useEffect(()=>{
    if(!settingNotifications)return;
    const t=setTimeout(()=>setActiveReminder({id:1,title:"Time for your next micro-task!",time:"Now",taskId:todayTaskIds[0]}),30000);
    return()=>clearTimeout(t);
  }, [todayTaskIds, settingNotifications]);

  // Focus timer
  useEffect(()=>{
    if(!focusRunning)return;
    if(focusSeconds>=focusDuration){setFocusRunning(false);return;}
    const id=setInterval(()=>setFocusSeconds(s=>s+1),1000);
    return()=>clearInterval(id);
  }, [focusRunning, focusSeconds, focusDuration]);

  const toggleTask=useCallback((taskId:number)=>{
    setGoals(cur=>cur.map(g=>({...g,subtasks:g.subtasks.map(s=>{
      if(s.id!==taskId)return s;
      if(!s.done){setPetHunger(h=>Math.min(100,h+15));setPetCoins(c=>c+s.points);}
      else{setPetHunger(h=>Math.max(0,h-15));setPetCoins(c=>Math.max(0,c-s.points));}
      return{...s,done:!s.done};
    })})));
  },[]);

  const handleMoodSelect=useCallback((m:Mood)=>{
    const requested=moodToEnergy[m];
    const urgentLoad=goals
      .filter(g=>daysBetween(TODAY,g.deadline)<=1)
      .reduce((sum,g)=>sum+g.subtasks.filter(s=>!s.done).length,0);
    const effective = requested==="low" && urgentLoad>2 ? "steady" : requested;
    setMood(m);setEnergy(effective);
    setAdaptiveMessage(requested==="low" && urgentLoad>2
      ? "I hear that energy is low, but a deadline is very close. I kept the urgent tasks and made the approach gentler instead of removing them."
      : energyCopy[effective]);
    recompute(effective,goals);
  },[goals,recompute]);

  const updateGoalImportance=useCallback((gid:number,v:number)=>{
    setGoals(g=>{const n=g.map(x=>x.id===gid?{...x,importance:v}:x);recompute(energy,n);return n;});
  },[energy,recompute]);
  const updateGoalCategory=useCallback((gid:number,c:string)=>setGoals(g=>g.map(x=>x.id===gid?{...x,category:c}:x)),[]);
  const updateGoalDeadline=useCallback((gid:number,d:Date)=>{
    setGoals(g=>{const n=g.map(x=>x.id===gid?{...x,deadline:d}:x);recompute(energy,n);return n;});
  },[energy,recompute]);

  const deconstructGoal=useCallback(()=>{
    const sm:Record<string,string[]>={"become a youtuber":["Write first script","Film pilot video","Edit and add effects","Review and publish"]};
    const subs=sm[deconGoalInput.toLowerCase()]??["Research the topic","Create a plan outline","Execute first step","Review and iterate"];
    const nid=Math.max(...goals.map(g=>g.id))+1;
    const ng:GoalItem={id:nid,title:deconGoalInput,importance:deconGoalImportance,category:deconGoalCategory,deadline:deconGoalDeadline,color:"from-cyan-400 to-blue-500",
      subtasks:subs.map((l,i)=>({id:nid*100+i,title:l,goalId:nid,duration:"10 min",load:i===subs.length-1?"stretch":"focus" as const,done:false,points:15,scheduledDate:addDays(TODAY,i+1)}))};
    const next=[...goals,ng];setGoals(next);recompute(energy,next);
    // Open chat
    setBreakdownChat({goalTitle:deconGoalInput,messages:[
      {role:"ai",text:`Great! Let's break down "${deconGoalInput}" into actionable steps. I've created ${subs.length} micro-tasks:\n\n${subs.map((s,i)=>`${i+1}. ${s}`).join("\n")}\n\nDoes this look right? Would you like to adjust any step, add more detail, or change the order?`},
    ]});
    setDeconGoalInput("");setShowGoalDeconstructor(false);
  },[deconGoalInput,deconGoalImportance,deconGoalCategory,deconGoalDeadline,goals,energy,recompute]);

  const addRoutine=useCallback(()=>{
    if(!newRoutineName.trim())return;
    const freq = newRoutineFrequency==="Custom" && newRoutineCustom.trim() ? newRoutineCustom : newRoutineFrequency;
    setRoutines(r=>[...r,{id:Math.max(0,...r.map(x=>x.id))+1,title:newRoutineName,time:newRoutineTime,frequency:freq as Routine["frequency"]}]);
    setNewRoutineName("");setNewRoutineCustom("");setShowAddRoutine(false);
  },[newRoutineName,newRoutineTime,newRoutineFrequency,newRoutineCustom]);
  const removeRoutine=useCallback((id:number)=>setRoutines(r=>r.filter(x=>x.id!==id)),[]);

  const findReplacement=useCallback((excludeId:number)=>{
    const current = new Set(todayTaskIds);
    const candidates = allSubtasks.filter(s=>!s.done && !current.has(s.id) && s.id!==excludeId);
    if(!candidates.length)return null;
    return candidates.map(s=>({s,score:scoreSubtask(s,goals.find(g=>g.id===s.goalId)!,energy,TODAY)})).sort((a,b)=>b.score-a.score)[0].s;
  },[allSubtasks,todayTaskIds,goals,energy]);
  const swapTask=useCallback((taskId:number)=>{
    const r=findReplacement(taskId); if(!r)return;
    setTodayTaskIds(ids=>ids.map(id=>id===taskId?r.id:id));
  },[findReplacement]);
  const addMoreTask=useCallback(()=>{
    const r=findReplacement(-1); if(!r)return;
    setTodayTaskIds(ids=>[...ids,r.id]);
  },[findReplacement]);

  const removeGoal=useCallback((goalId:number)=>{
    setGoals(g=>g.filter(goal=>goal.id!==goalId));
    setTodayTaskIds(ids=>ids.filter(id=>!goals.find(goal=>goal.id===goalId)?.subtasks.some(s=>s.id===id)));
  },[goals]);

  const addFriend=useCallback((u:CommunityUser)=>{
    setMyFriends(f=>f.some(x=>x.name===u.name)?f:[...f,{name:u.name,status:`${u.compatibility ?? 0}% match`,color:"bg-emerald-400"}]);
    setFriendSuggestions(list=>list.filter(x=>x.name!==u.name));
  },[]);
  const removeFriend=useCallback((name:string)=>setMyFriends(f=>f.filter(x=>x.name!==name)),[]);
  const joinCommunity=useCallback((group:CommunityGroup)=>{
    setMyCommunities(c=>c.some(x=>x.name===group.name)?c:[...c,group]);
    setCommunitySuggestions(list=>list.filter(x=>x.name!==group.name));
  },[]);
  const createCommunity=useCallback(()=>{
    if(!joinGroupInput.trim())return;
    const group={name:joinGroupInput,members:1,tag:"Created by you",creator:currentUser?.name??"You",created:"Today",about:"A new community for shared goals and gentle accountability."};
    setMyCommunities(c=>[...c,group]); setJoinGroupInput("");
  },[joinGroupInput,currentUser]);
  const removeCommunity=useCallback((name:string)=>setMyCommunities(c=>c.filter(x=>x.name!==name)),[]);

  const openDatePicker=useCallback((initial:Date,onPick:(d:Date)=>void)=>setDatePicker({initial,onPick}),[]);
  const totalEarnedToday=todayTasks.filter(t=>t.done).reduce((s,t)=>s+t.points,0);
  const feedPet=useCallback(()=>{if(totalEarnedToday>=10&&petHunger<100){setPetHunger(h=>Math.min(100,h+20));setPetCoins(c=>Math.max(0,c-10));}},[totalEarnedToday,petHunger]);

  return (
    <div className="min-h-screen overflow-hidden bg-[#f7f1e8] text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="ambient-blob absolute -left-24 top-8 h-72 w-72 rounded-full bg-[#f8c987]/45 blur-3xl" />
        <div className="ambient-blob animation-delay-2000 absolute right-0 top-20 h-96 w-96 rounded-full bg-[#9bd8cf]/45 blur-3xl" />
        <div className="ambient-blob animation-delay-4000 absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#c8b6ff]/35 blur-3xl" />
      </div>

      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-3 sm:px-7">
        <button onClick={()=>currentUser?setShowProfile(true):(setAuthMode("login"),setShowAuth(true))} className="group flex items-center gap-3 rounded-full border border-white/70 bg-white/75 px-3 py-2 text-left shadow-[0_18px_60px_rgba(57,48,33,0.13)] backdrop-blur-xl transition hover:-translate-y-0.5">
          <span className="relative grid h-11 w-11 place-items-center rounded-full bg-slate-950 text-sm font-bold text-white">{currentUser?currentUser.name.split(" ").map(p=>p[0]).slice(0,2).join(""):"?"}{currentUser&&<span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400"/>}</span>
          <span className="hidden leading-tight sm:block"><span className="block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">{currentUser?"Profile":"Sign in"}</span><span className="block text-sm font-black text-slate-950">{currentUser?.name??"Guest"}</span></span>
        </button>
        <div className="hidden rounded-full border border-slate-950/10 bg-white/55 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-slate-500 backdrop-blur-xl md:block">Goal Digger</div>
        <button onClick={()=>setShowSettings(true)} className="group flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-2 shadow-[0_18px_60px_rgba(57,48,33,0.13)] backdrop-blur-xl transition hover:-translate-y-0.5">
          <span className="hidden text-sm font-black text-slate-950 sm:inline">Settings</span>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-950 text-white transition group-hover:rotate-45"><GearIcon className="h-5 w-5"/></span>
        </button>
      </header>

      <main className="relative z-10 px-4 pb-32 pt-22 sm:px-7 lg:pb-36">
        {activeTab==="planner"&&<HomePage goals={goals} activePet={activePet}
          deconGoalInput={deconGoalInput} onDeconGoalInputChange={setDeconGoalInput}
          deconGoalImportance={deconGoalImportance} onDeconGoalImportanceChange={setDeconGoalImportance}
          deconGoalCategory={deconGoalCategory} onDeconGoalCategoryChange={setDeconGoalCategory}
          deconGoalDeadline={deconGoalDeadline} onDeconGoalDeadlineChange={setDeconGoalDeadline}
          onDeconstructGoal={deconstructGoal} openDatePicker={openDatePicker}
          onUpdateImportance={updateGoalImportance} onUpdateCategory={updateGoalCategory} onUpdateDeadline={updateGoalDeadline}
          onRemoveGoal={removeGoal} kindMode={settingKindMode} petHunger={petHunger} earnedPoints={totalEarnedToday} onFeedPet={feedPet}
        />}
        {activeTab==="task"&&<TaskPage activePet={activePet} todayTasks={todayTasks} todayCompletion={todayCompletion} todayCompleted={todayCompleted} goals={goals} onToggleTask={toggleTask}
          mood={mood} adaptiveMessage={adaptiveMessage} onMoodSelect={handleMoodSelect}
          expandedTask={expandedTask} onExpandTask={setExpandedTask}
          showFocusOverlay={showFocusOverlay} onShowFocusOverlay={setShowFocusOverlay}
          focusApps={focusApps} onToggleFocusApp={n=>setFocusApps(a=>a.map(x=>x.name===n?{...x,allowed:!x.allowed}:x))}
          focusSeconds={focusSeconds} focusRunning={focusRunning} focusDuration={focusDuration}
          onSetFocusDuration={setFocusDuration} onStartFocus={()=>{if(selectedFocusTask&&!customFocusMin){const t=allSubtasks.find(task=>task.id===selectedFocusTask); if(t) setFocusDuration(durationToMinutes(t.duration)*60);} setFocusRunning(true);setFocusSeconds(0);setShowFocusOverlay(false);}}
          customFocusMin={customFocusMin} onCustomFocusMin={setCustomFocusMin}
          selectedFocusTask={selectedFocusTask} onSelectedFocusTask={setSelectedFocusTask}
          onSwapTask={swapTask} onAddMoreTask={addMoreTask} hasMoreTasks={allSubtasks.some(s=>!s.done&&!todayTaskIds.includes(s.id))}
        />}
        {activeTab==="calendar"&&<CalendarPage activePet={activePet} selectedDay={selectedDay} onSelectDay={setSelectedDay} goals={goals} viewYear={viewYear} viewMonth={viewMonth}
          onNavigateMonth={delta=>{let m=viewMonth+delta,y=viewYear;while(m<0){m+=12;y-=1;}while(m>11){m-=12;y+=1;}setViewMonth(m);setViewYear(y);}}
          onJumpToToday={()=>{setViewYear(TODAY.getFullYear());setViewMonth(TODAY.getMonth());setSelectedDay(TODAY);}}
          openMonthYearPicker={()=>openDatePicker(new Date(viewYear,viewMonth,1),d=>{setViewYear(d.getFullYear());setViewMonth(d.getMonth());})}
          calendarDayPopup={calendarDayPopup} onCalendarDayPopup={setCalendarDayPopup}
          routines={routines} onAddRoutine={addRoutine} onRemoveRoutine={removeRoutine}
          newRoutineName={newRoutineName} onNewRoutineName={setNewRoutineName} newRoutineTime={newRoutineTime} onNewRoutineTime={setNewRoutineTime}
          newRoutineFrequency={newRoutineFrequency} onNewRoutineFrequency={setNewRoutineFrequency}
          showAddRoutine={showAddRoutine} setShowAddRoutine={setShowAddRoutine} newRoutineCustom={newRoutineCustom} onNewRoutineCustom={setNewRoutineCustom}
        />}
        {activeTab==="community"&&<CommunityPage activePet={activePet} joinGroupInput={joinGroupInput} onJoinGroupInput={setJoinGroupInput} myFriends={myFriends} myCommunities={myCommunities} friendSuggestions={friendSuggestions} communitySuggestions={communitySuggestions} onAddFriend={addFriend} onRemoveFriend={removeFriend} onJoinCommunity={joinCommunity} onCreateCommunity={createCommunity} onRemoveCommunity={removeCommunity}/>}
        {activeTab==="companion"&&<CompanionPage activePet={activePet} petCoins={petCoins} selectedPet={selectedPet} onSelectPet={setSelectedPet}/>}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[min(94vw,860px)] rounded-[2rem] border border-white/70 bg-white/80 p-2 shadow-[0_24px_80px_rgba(44,39,31,0.18)] backdrop-blur-2xl">
        <div className="grid grid-cols-5 gap-1">
          {navItems.map(item=>{const isA=activeTab===item.key;return(
            <button key={item.key} className={`group relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-[1.45rem] px-2 text-center transition duration-300 ${isA?"animate-dock-pop bg-slate-950 text-white shadow-[0_16px_45px_rgba(15,23,42,0.28)]":"text-slate-500 hover:bg-slate-950/5 hover:text-slate-950"}`} onClick={()=>setActiveTab(item.key)}>
              {item.key==="planner" ? (
                <div className="relative -top-1">
                  <Pet size={58} role="planner" bodyFrom={activePet.from} bodyTo={activePet.to} accent={activePet.accent} expression="smile" staticMode />
                </div>
              ) : (
                <item.Icon className="h-5 w-5"/>
              )}
              {item.key==="planner"?<span className="sr-only">Home</span>:<span className="text-[11px] font-black sm:text-xs">{item.label}</span>}
            </button>
          );})}
        </div>
      </nav>

      {focusRunning&&(
        <div className="fixed inset-0 z-[190] overflow-hidden bg-slate-950 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(20,184,166,0.34),transparent_32%),radial-gradient(circle_at_75%_80%,rgba(251,191,36,0.22),transparent_34%)]" />
          <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-10 text-center">
            <Pet size={132} role="task" bodyFrom={activePet.from} bodyTo={activePet.to} accent={activePet.accent} expression="calm" />
            <p className="mt-6 text-xs font-black uppercase tracking-[0.32em] text-white/45">Focus session</p>
            <div className="mt-4 tabular-nums text-7xl font-black tracking-[-0.08em] sm:text-8xl">
              {String(focusMinutes).padStart(2,"0")}:{String(focusSecs).padStart(2,"0")}
            </div>
            <div className="mt-6 w-full max-w-xl rounded-[2rem] bg-white/10 p-5 text-left backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Working on</p>
              <p className="mt-2 text-xl font-black tracking-[-0.03em] text-white">{focusTask?.title??"Open focus block"}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/55">Stay with one task. If your mind wanders, return to the next tiny action.</p>
            </div>
            <div className="mt-8 flex w-full max-w-xl gap-3">
              <button onClick={()=>setFocusRunning(false)} className="flex-1 rounded-full bg-red-500 px-5 py-4 text-sm font-black text-white shadow-[0_14px_35px_rgba(239,68,68,0.25)] transition hover:-translate-y-0.5">End session</button>
              {focusTask&&!focusTask.done&&<button onClick={()=>{toggleTask(focusTask.id);setFocusRunning(false);}} className="flex-1 rounded-full bg-white px-5 py-4 text-sm font-black text-slate-950 transition hover:-translate-y-0.5">Complete task</button>}
            </div>
          </div>
        </div>
      )}

      {/* Overlays */}
      {activeReminder&&<OverlayShell onClose={()=>setActiveReminder(null)}><div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal-500/10"><span className="text-3xl">🔔</span></div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.26em] text-slate-400">Scheduled reminder</p>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">{activeReminder.title}</h2>
        <p className="mt-2 text-xl font-black text-teal-600">{activeReminder.time}</p>
        <div className="mt-6 flex gap-3">
          <button onClick={()=>{if(activeReminder.taskId)toggleTask(activeReminder.taskId);setActiveReminder(null);}} className="flex-1 rounded-full bg-emerald-500 px-5 py-4 text-sm font-black text-white transition hover:-translate-y-0.5">Complete</button>
          <button onClick={()=>setActiveReminder(null)} className="flex-1 rounded-full bg-slate-950 px-5 py-4 text-sm font-black text-white transition hover:-translate-y-0.5">Dismiss</button>
        </div>
      </div></OverlayShell>}

      {showProfile&&currentUser&&<OverlayShell onClose={()=>setShowProfile(false)} mw="max-w-lg"><div className="flex items-start justify-between">
        <div className="flex items-center gap-4"><span className="grid h-16 w-16 place-items-center rounded-full bg-slate-950 text-xl font-black text-white">{currentUser.name.split(" ").map(p=>p[0]).slice(0,2).join("")}</span><div><p className="text-xs font-black uppercase tracking-[0.26em] text-slate-400">Profile</p><h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950">{currentUser.name}</h2><p className="text-sm font-semibold text-slate-500">{currentUser.email}</p></div></div>
        <button onClick={()=>setShowProfile(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-950/5 text-slate-700 hover:bg-slate-950/10">✕</button>
      </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[{l:"Goals",v:goals.length,c:"from-teal-400 to-emerald-500"},{l:"Done",v:allSubtasks.filter(t=>t.done).length,c:"from-amber-400 to-orange-500"},{l:"Coins",v:petCoins,c:"from-violet-400 to-purple-500"}].map(x=>(
            <div key={x.l} className={`rounded-2xl bg-gradient-to-br ${x.c} p-4 text-white shadow-[0_10px_30px_rgba(0,0,0,0.15)]`}><p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/80">{x.l}</p><p className="mt-1 text-3xl font-black tracking-[-0.04em]">{x.v}</p></div>
          ))}
        </div>
        <div className="mt-5 space-y-2">{[{l:"Member since",v:currentUser.joined},{l:"Plan",v:"Free · Adaptive"},{l:"Streak",v:"🔥 16-day streak"}].map(x=><div key={x.l} className="flex items-center justify-between rounded-2xl bg-slate-950/5 p-3"><span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{x.l}</span><span className="text-sm font-black text-slate-950">{x.v}</span></div>)}</div>
        <div className="mt-5 flex gap-3"><button className="flex-1 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5">Edit profile</button><button onClick={()=>{setCurrentUser(null);setShowProfile(false);}} className="rounded-full border border-red-500/30 bg-red-500/5 px-5 py-3 text-sm font-black text-red-600 transition hover:bg-red-500/10">Log out</button></div>
      </OverlayShell>}

      {showSettings&&<OverlayShell onClose={()=>setShowSettings(false)} mw="max-w-lg"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-[0.26em] text-slate-400">Settings</p><h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950">Preferences</h2></div><button onClick={()=>setShowSettings(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-950/5 text-slate-700 hover:bg-slate-950/10">✕</button></div>
        <div className="mt-6 space-y-5">
          <SG t="Notifications"><ST l="Push reminders" d="Full-screen reminders" v={settingNotifications} o={setSettingNotifications}/><ST l="Daily morning plan" d="ATS-built tasks at 8am" v={settingDailyReminder} o={setSettingDailyReminder}/><ST l="Sound" d="Play sound on reminders" v={settingSound} o={setSettingSound}/></SG>
          <SG t="Appearance"><ST l="Dark mode" d="Easier on the eyes" v={settingDarkMode} o={setSettingDarkMode}/></SG>
          <SG t="Engine"><ST l="Kind mode" d="Never penalize missed tasks" v={settingKindMode} o={setSettingKindMode}/></SG>
          <SG t="Account">{currentUser?<p className="rounded-2xl bg-slate-950/5 p-4 text-sm font-bold text-slate-700">Signed in as <span className="text-slate-950">{currentUser.name}</span></p>:<button onClick={()=>{setShowSettings(false);setAuthMode("login");setShowAuth(true);}} className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">Sign in</button>}</SG>
        </div>
      </OverlayShell>}

      {showAuth&&<OverlayShell onClose={()=>setShowAuth(false)}>
        <AuthForm mode={authMode} onSwitch={()=>setAuthMode(m=>m==="login"?"signup":"login")} onSubmit={(e,n)=>{setCurrentUser({name:n,email:e,joined:"April 2026"});setShowAuth(false);}} onClose={()=>setShowAuth(false)}/>
      </OverlayShell>}

      {datePicker&&<OverlayShell onClose={()=>setDatePicker(null)}><DatePickerInner initial={datePicker.initial} onPick={d=>{datePicker.onPick(d);setDatePicker(null);}} onClose={()=>setDatePicker(null)}/></OverlayShell>}

      {breakdownChat&&<OverlayShell onClose={()=>setBreakdownChat(null)} mw="max-w-xl">
        <BreakdownChatUI chat={breakdownChat} onSend={msg=>setBreakdownChat(prev=>prev?{...prev,messages:[...prev.messages,{role:"user",text:msg},{role:"ai",text:"Got it! I've updated the plan accordingly. Anything else you'd like to adjust, or shall we finalize?"}]}:null)} onClose={()=>setBreakdownChat(null)}/>
      </OverlayShell>}
    </div>
  );
}

// ─── HOME (was Planner) ──────────────────────────────────────────────
function HomePage({goals,activePet,deconGoalInput,onDeconGoalInputChange,deconGoalImportance,onDeconGoalImportanceChange,deconGoalCategory,onDeconGoalCategoryChange,deconGoalDeadline,onDeconGoalDeadlineChange,onDeconstructGoal,openDatePicker,onUpdateImportance,onUpdateCategory,onUpdateDeadline,onRemoveGoal,kindMode,petHunger,earnedPoints,onFeedPet}:{
  goals:GoalItem[];activePet:typeof petLooks[number];
  deconGoalInput:string;onDeconGoalInputChange:(v:string)=>void;
  deconGoalImportance:number;onDeconGoalImportanceChange:(v:number)=>void;
  deconGoalCategory:string;onDeconGoalCategoryChange:(v:string)=>void;
  deconGoalDeadline:Date;onDeconGoalDeadlineChange:(d:Date)=>void;
  onDeconstructGoal:()=>void;openDatePicker:(i:Date,o:(d:Date)=>void)=>void;
  onUpdateImportance:(id:number,v:number)=>void;onUpdateCategory:(id:number,c:string)=>void;onUpdateDeadline:(id:number,d:Date)=>void;
  onRemoveGoal:(id:number)=>void;kindMode:boolean;petHunger:number;earnedPoints:number;onFeedPet:()=>void;
}){
  return(
    <section className="animate-page-in mx-auto max-w-7xl space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* ── GOAL DECONSTRUCTOR (ATS theme dark) ── */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 p-6 text-white shadow-[0_30px_90px_rgba(15,23,42,0.32)] sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(45,212,191,0.32),transparent_30%),radial-gradient(circle_at_70%_70%,rgba(251,191,36,0.22),transparent_28%)]"/>
          <div className="relative z-10">
            <div className="relative mx-auto mt-3 mb-6 flex w-full max-w-sm flex-col items-center">
              <div className="relative mb-3 max-w-xs rounded-[1.5rem] bg-white px-4 py-3 text-center text-sm font-black leading-6 text-slate-950 shadow-[0_18px_45px_rgba(255,255,255,0.15)]">
                Tell me your next big goal. I will break it down, schedule it, and keep it kind.
                <span className="absolute left-1/2 -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 bg-white" />
              </div>
              <Pet size={176} role="planner" bodyFrom={activePet.from} bodyTo={activePet.to} accent={activePet.accent} expression="smile"/>
            </div>

            <div className="mb-5 rounded-2xl bg-white/10 p-4">
              <div className="flex items-center justify-between text-sm font-black"><span>Pet energy</span><span>{petHunger}%</span></div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${petHunger<30?"bg-gradient-to-r from-red-400 to-amber-400":petHunger<60?"bg-gradient-to-r from-amber-400 to-emerald-400":"bg-gradient-to-r from-emerald-400 to-teal-300"}`} style={{width:`${petHunger}%`}}/></div>
              <button onClick={onFeedPet} disabled={earnedPoints<10 || petHunger>=100} className="mt-3 w-full rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-40">{petHunger>=100?"Pet is full":earnedPoints<10?"Complete tasks to feed":"Feed pet (10 coins)"}</button>
            </div>

            {/* Goal input */}
            <input value={deconGoalInput} onChange={e=>onDeconGoalInputChange(e.target.value)} className="w-full rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/40 focus:border-teal-400" placeholder="e.g. Become a YouTuber"/>

            <div className="mt-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Category</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {categoryOptions.map(c=>(
                  <button key={c} onClick={()=>onDeconGoalCategoryChange(c)} className={`rounded-full px-3 py-1.5 text-xs font-black transition ${deconGoalCategory===c?"bg-white text-slate-950":"bg-white/10 text-white/60 hover:bg-white/15"}`}>{c}</button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Interest & priority</p><p className="text-[11px] font-black text-white/60">{["Low","Casual","Medium","High","Top focus"][deconGoalImportance-1]}</p></div>
              <div className="mt-2 flex gap-1.5">{[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>onDeconGoalImportanceChange(n)} className={`flex-1 rounded-lg py-2 text-base transition ${n<=deconGoalImportance?"bg-gradient-to-br from-teal-400 to-emerald-500 text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)]":"bg-white/10 text-white/30 hover:bg-white/15"}`}>★</button>
              ))}</div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button onClick={()=>openDatePicker(deconGoalDeadline,d=>onDeconGoalDeadlineChange(d))} className="flex flex-1 items-center gap-3 rounded-2xl bg-white/10 p-3 text-left transition hover:bg-white/15">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20"><CalendarIcon className="h-4 w-4"/></span>
                <span><span className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Deadline</span><span className="block text-sm font-black">{deconGoalDeadline.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}</span></span>
              </button>
              <button onClick={()=>onDeconGoalDeadlineChange(addDays(deconGoalDeadline,-1))} className="grid h-12 w-10 place-items-center rounded-xl bg-white/10 text-white/60 hover:bg-white/15">−</button>
              <button onClick={()=>onDeconGoalDeadlineChange(addDays(deconGoalDeadline,1))} className="grid h-12 w-10 place-items-center rounded-xl bg-white/10 text-white/60 hover:bg-white/15">+</button>
            </div>

            <button onClick={onDeconstructGoal} disabled={!deconGoalInput.trim()} className="mt-5 w-full rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed">Break down & schedule</button>
          </div>
        </div>

        {/* ── YOUR GOALS ── */}
        <div className="space-y-4">
          <div className="flex items-end justify-between px-1"><h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">My goals</h2><span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{goals.length} active</span></div>
          <div className="space-y-4 max-h-[72vh] overflow-y-auto scrollbar-hide pr-1">
            {goals.map(g=><GoalCardComp key={g.id} goal={g} onUpdateImportance={onUpdateImportance} onUpdateCategory={onUpdateCategory} onUpdateDeadline={onUpdateDeadline} openDatePicker={openDatePicker} onRemoveGoal={onRemoveGoal} kindMode={kindMode}/>)}
          </div>
        </div>
      </div>
    </section>
  );
}

function GoalCardComp({goal:g,onUpdateImportance,onUpdateCategory,onUpdateDeadline,openDatePicker,onRemoveGoal,kindMode}:{goal:GoalItem;onUpdateImportance:(id:number,v:number)=>void;onUpdateCategory:(id:number,c:string)=>void;onUpdateDeadline:(id:number,d:Date)=>void;openDatePicker:(i:Date,o:(d:Date)=>void)=>void;onRemoveGoal:(id:number)=>void;kindMode:boolean}){
  const [editCat,setEditCat]=useState(false);
  const done=g.subtasks.filter(s=>s.done).length;const pct=g.subtasks.length?Math.round(done/g.subtasks.length*100):0;
  const dl=daysBetween(TODAY,g.deadline);const urg=dl<=3?"urgent":dl<=7?"soon":"ok";
  return(
    <div className="overflow-hidden rounded-[1.6rem] bg-white shadow-[0_8px_24px_rgba(74,61,39,0.06)]">
      <div className={`h-1.5 bg-gradient-to-r ${g.color}`}/>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black tracking-[-0.02em] text-slate-950">{g.title}</h3><button onClick={()=>setEditCat(v=>!v)} className={`rounded-full bg-gradient-to-r ${g.color} px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white transition hover:scale-105`}>{g.category}</button></div>
          <p className="mt-1 text-xs font-bold text-slate-500">{done}/{g.subtasks.length} · {pct}%</p>
        </div><div className="flex shrink-0 items-center gap-2"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-400/15 text-sm font-black text-amber-700">★{g.importance}</span><button onClick={()=>onRemoveGoal(g.id)} title={kindMode?"Kind remove: no guilt, no penalty":"Remove goal"} className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/10 text-xs font-black text-red-500 transition hover:bg-red-500 hover:text-white">✕</button></div></div>
        {editCat&&<div className="mt-3 flex flex-wrap gap-1.5 rounded-xl bg-slate-950/5 p-2 animate-page-in">{categoryOptions.map(c=><button key={c} onClick={()=>{onUpdateCategory(g.id,c);setEditCat(false);}} className={`rounded-full px-2.5 py-1 text-[11px] font-black transition ${g.category===c?"bg-slate-950 text-white":"bg-white text-slate-600 hover:bg-slate-100"}`}>{c}</button>)}</div>}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950/5"><div className={`h-full rounded-full bg-gradient-to-r ${g.color} transition-all duration-700`} style={{width:`${pct}%`}}/></div>
        <div className="mt-3"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Interest & priority</p></div>
          <div className="mt-2 flex gap-1">{[1,2,3,4,5].map(n=><button key={n} onClick={()=>onUpdateImportance(g.id,n)} className={`flex-1 rounded-md py-1.5 text-sm transition ${n<=g.importance?`bg-gradient-to-br ${g.color} text-white`:"bg-slate-950/5 text-slate-300 hover:bg-slate-950/10"}`}>★</button>)}</div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={()=>openDatePicker(g.deadline,d=>onUpdateDeadline(g.id,d))} className="flex flex-1 items-center gap-2 rounded-xl bg-slate-950/5 p-2.5 text-left transition hover:bg-slate-950/10">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-950"><CalendarIcon className="h-4 w-4"/></span>
            <span><span className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Deadline</span><span className="block text-xs font-black text-slate-950">{g.deadline.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}</span></span>
            <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${urg==="urgent"?"bg-red-500/15 text-red-600":urg==="soon"?"bg-amber-500/15 text-amber-700":"bg-emerald-500/15 text-emerald-700"}`}>{dl}d</span>
          </button>
          <button onClick={()=>onUpdateDeadline(g.id,addDays(g.deadline,-1))} className="grid h-10 w-8 place-items-center rounded-xl bg-slate-950/5 text-sm text-slate-700 hover:bg-slate-950/10">−</button>
          <button onClick={()=>onUpdateDeadline(g.id,addDays(g.deadline,1))} className="grid h-10 w-8 place-items-center rounded-xl bg-slate-950/5 text-sm text-slate-700 hover:bg-slate-950/10">+</button>
        </div>
      </div>
    </div>
  );
}

// ─── TASK PAGE ───────────────────────────────────────────────────────
function TaskPage({activePet,todayTasks,todayCompletion,todayCompleted,goals,onToggleTask,mood,adaptiveMessage,onMoodSelect,expandedTask,onExpandTask,showFocusOverlay,onShowFocusOverlay,focusApps,onToggleFocusApp,focusSeconds,focusRunning,focusDuration,onSetFocusDuration,onStartFocus,customFocusMin,onCustomFocusMin,selectedFocusTask,onSelectedFocusTask,onSwapTask,onAddMoreTask,hasMoreTasks}:{
  activePet:{from:string;to:string;accent:string};todayTasks:SubTask[];todayCompletion:number;todayCompleted:number;goals:GoalItem[];onToggleTask:(id:number)=>void;
  mood:Mood;adaptiveMessage:string;onMoodSelect:(m:Mood)=>void;
  expandedTask:number|null;onExpandTask:(id:number|null)=>void;
  showFocusOverlay:boolean;onShowFocusOverlay:(v:boolean)=>void;
  focusApps:FocusApp[];onToggleFocusApp:(n:string)=>void;
  focusSeconds:number;focusRunning:boolean;focusDuration:number;
  onSetFocusDuration:(d:number)=>void;onStartFocus:()=>void;
  customFocusMin:string;onCustomFocusMin:(v:string)=>void;selectedFocusTask:number|null;onSelectedFocusTask:(id:number|null)=>void;
  onSwapTask:(id:number)=>void;onAddMoreTask:()=>void;hasMoreTasks:boolean;
}){
  const remaining=focusDuration-focusSeconds;const mins=Math.floor(Math.max(0,remaining)/60);const secs=Math.max(0,remaining)%60;
  const allDone=todayTasks.length>0&&todayCompleted===todayTasks.length;
  const focusDurationOptions=Array.from(new Set(todayTasks.filter(t=>!t.done).map(t=>durationToMinutes(t.duration)))).sort((a,b)=>a-b);
  const completedGoals=todayTasks.filter(t=>t.done).map(t=>goals.find(g=>g.id===t.goalId)?.color).filter(Boolean) as string[];
  const gradientKey=completedGoals.join(" ")||"from-slate-300 to-slate-400";
  const progressStart=gradientKey.includes("amber")?"#fbbf24":gradientKey.includes("violet")?"#a78bfa":gradientKey.includes("rose")?"#fb7185":"#14b8a6";
  const progressEnd=gradientKey.includes("orange")?"#f97316":gradientKey.includes("purple")?"#8b5cf6":gradientKey.includes("pink")?"#ec4899":"#10b981";

  return(
    <section className="animate-page-in mx-auto max-w-6xl space-y-6">
      <PageBuddy variant="task" pet={activePet} title="Focus Buddy" text="Tap a task to see how to start. Mood changes will reshape today's plan in real time, but I'll protect anything urgent."/>
      {/* ── ATS CARD (moved from Planner) ── */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.3)] sm:p-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(45,212,191,0.32),transparent_30%),radial-gradient(circle_at_70%_70%,rgba(251,191,36,0.22),transparent_28%)]"/>
        <div className="relative z-10">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-white/50">Adaptive task suggestions</p>
          <p className="mt-3 rounded-2xl bg-white/10 p-4 text-sm font-semibold leading-6">{adaptiveMessage}</p>
          <div className="mt-4">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/50">Mood check · real-time</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {moodEmojis.map(m=>(
                <button key={m.mood} onClick={()=>onMoodSelect(m.mood)} className={`flex flex-col items-center gap-1 rounded-2xl p-3 transition ${mood===m.mood?"bg-white text-slate-950":"bg-white/10 text-white/70 hover:bg-white/15"}`}>
                  <span className="text-2xl">{m.emoji}</span><span className="text-[11px] font-black">{m.label}</span>
                  <span className={`text-[10px] font-bold ${mood===m.mood?"text-slate-500":"text-white/40"}`}>{m.helper}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.55fr_1.45fr]">
        {/* ── ENHANCED TODAY'S PROGRESS ── */}
        <div className="rounded-[2.5rem] border border-white/70 bg-gradient-to-br from-white/80 to-[#fffaf2] p-6 shadow-[0_24px_70px_rgba(74,61,39,0.12)] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-slate-500">Today</p>
            <button onClick={()=>onShowFocusOverlay(true)} className="rounded-full bg-slate-950 px-4 py-2 text-[11px] font-black text-white transition hover:-translate-y-0.5">{focusRunning?`⏱ ${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`:"⏱ Focus"}</button>
          </div>
          {/* Animated ring progress */}
          <div className="relative mx-auto mt-6 h-52 w-52">
            <div className="shimmer-ring absolute inset-0 rounded-full p-1.5">
              <div className="h-full w-full rounded-full bg-[#f7f1e8]"/>
            </div>
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="8" opacity="0.3"/>
              <circle cx="60" cy="60" r="52" fill="none" stroke="url(#pgrd)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${todayCompletion*3.27} 327`} className="transition-all duration-1000"/>
              <defs><linearGradient id="pgrd" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={progressStart}/><stop offset="100%" stopColor={progressEnd}/></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-5xl font-black tracking-[-0.08em] text-slate-950">{todayCompletion}%</p>
              <p className="mt-1 text-sm font-bold text-slate-500">{todayCompleted}/{todayTasks.length} tasks</p>
            </div>
          </div>
          {allDone&&<div className="mt-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 p-4 text-center text-white shadow-[0_12px_30px_rgba(16,185,129,0.3)]"><p className="text-xl">🎉</p><p className="mt-1 text-sm font-black">All done!</p>{hasMoreTasks&&<button onClick={onAddMoreTask} className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-black text-emerald-700">Add more for today</button>}</div>}
        </div>

        {/* ── TODAY TASKS (no add/pull buttons, guidance on expand) ── */}
        <div className="rounded-[2.5rem] border border-white/70 bg-white/70 p-5 shadow-[0_24px_70px_rgba(74,61,39,0.12)] backdrop-blur-xl sm:p-7">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950 mb-4">Today</h2>
          <div className="space-y-3">
            {todayTasks.map(t=>{
              const goal=goals.find(g=>g.id===t.goalId);
              const isExpanded=expandedTask===t.id&&!t.done;
              const guide=taskGuidance[t.title]??defaultGuidance;
              return(
                <div key={t.id} className={`overflow-hidden rounded-[1.7rem] transition ${t.done?"bg-emerald-500/10":"bg-white/65 hover:bg-white"}`}>
                  <div className="flex items-center gap-4 p-4">
                    <button onClick={()=>onToggleTask(t.id)} className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border transition ${t.done?"border-emerald-500 bg-emerald-500 text-white":"border-slate-950/10 bg-slate-950/5 text-slate-400 hover:border-slate-950/25 hover:text-slate-950"}`}>
                      {t.done?<CheckIcon className="h-5 w-5"/>:<span className="h-2.5 w-2.5 rounded-full bg-current"/>}
                    </button>
                    <button onClick={()=>onExpandTask(isExpanded?null:t.id)} className="min-w-0 flex-1 text-left">
                      <span className={`block text-lg font-black ${t.done?"text-slate-500 line-through":"text-slate-950"}`}>{t.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
                        <span>{t.duration}</span>
                        <span className={`rounded-full bg-gradient-to-r ${goal?.color??"from-slate-300 to-slate-400"} px-2 py-0.5 text-[10px] font-black text-white`}>{goal?.title}</span>
                        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-700">+{t.points}pts</span>
                      </span>
                    </button>
                    {!t.done&&hasMoreTasks&&<button onClick={()=>onSwapTask(t.id)} className="rounded-full border border-slate-950/10 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition hover:bg-slate-950 hover:text-white">Swap</button>}
                  </div>
                  {/* Guidance drawer */}
                  {isExpanded&&(
                    <div className="animate-page-in border-t border-slate-950/5 bg-gradient-to-r from-teal-500/5 to-amber-400/5 px-5 py-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-500/15 text-sm">💡</span>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">How to do this</p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{guide}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {todayTasks.length===0&&<div className="rounded-2xl bg-white/60 p-8 text-center"><p className="text-sm font-bold text-slate-500">No tasks scheduled. Add a goal on Home.</p></div>}
          </div>
        </div>
      </div>

      {/* Focus overlay */}
      {showFocusOverlay&&(
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#f7f1e8] p-4 sm:p-7">
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-[#f8c987]/45 blur-3xl" />
            <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-[#9bd8cf]/45 blur-3xl" />
          </div>
          <div className="relative z-10 mx-auto max-w-5xl py-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.26em] text-teal-700">Focus mode</p>
                <h2 className="mt-2 text-5xl font-black tracking-[-0.07em] text-slate-950 sm:text-6xl">Deep work session</h2>
              </div>
              <button onClick={()=>onShowFocusOverlay(false)} className="grid h-12 w-12 place-items-center rounded-full bg-slate-950 text-white shadow-[0_14px_30px_rgba(15,23,42,0.22)]">✕</button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[2.5rem] border border-white/70 bg-white/75 p-5 shadow-[0_24px_70px_rgba(74,61,39,0.12)] backdrop-blur-xl sm:p-7">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Duration</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  Pick a task to use its duration, choose a task-length preset, or enter a custom focus length.
                </p>
                <div className="mt-4 space-y-2 max-h-[42vh] overflow-y-auto scrollbar-hide">
                  {todayTasks.filter(t=>!t.done).map(t=>(
                    <button key={t.id} onClick={()=>{const next=selectedFocusTask===t.id?null:t.id;onSelectedFocusTask(next); if(next){onSetFocusDuration(durationToMinutes(t.duration)*60);onCustomFocusMin("");}}} className={`flex w-full items-center gap-3 rounded-2xl p-4 text-left transition ${selectedFocusTask===t.id?"bg-slate-950 text-white shadow-[0_14px_30px_rgba(15,23,42,0.22)]":"bg-white/70 text-slate-950 hover:bg-white hover:-translate-y-0.5"}`}>
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-xs font-black ${selectedFocusTask===t.id?"bg-white/15 text-white":"bg-slate-950/5 text-slate-500"}`}>{durationToMinutes(t.duration)}</span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-black">{t.title}</span><span className={`text-xs font-bold ${selectedFocusTask===t.id?"text-white/55":"text-slate-500"}`}>{t.duration} from task</span></span>
                    </button>
                  ))}
                </div>
                {focusDurationOptions.length>0&&(
                  <div className="mt-4 border-t border-slate-950/10 pt-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Task duration presets</p>
                    <div className="grid grid-cols-2 gap-2">
                      {focusDurationOptions.map(m=>(
                        <button key={m} onClick={()=>{onSelectedFocusTask(null);onSetFocusDuration(m*60);onCustomFocusMin("");}} className={`rounded-2xl px-5 py-4 text-sm font-black transition ${focusDuration===m*60&&!customFocusMin&&!selectedFocusTask?"bg-slate-950 text-white shadow-[0_12px_25px_rgba(15,23,42,0.2)]":"bg-white text-slate-600 hover:bg-slate-50"}`}>{m} min</button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white p-3">
                  <input value={customFocusMin} onChange={e=>{onSelectedFocusTask(null);onCustomFocusMin(e.target.value);const v=parseInt(e.target.value);if(v>0)onSetFocusDuration(v*60);}} className="w-28 rounded-full border border-slate-950/10 bg-[#fffaf2] px-4 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500" placeholder="Custom"/>
                  <span className="text-xs font-bold text-slate-400">minutes</span>
                </div>

                <div className="mt-4 rounded-2xl bg-slate-950/5 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Selected</p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {selectedFocusTask ? todayTasks.find(t=>t.id===selectedFocusTask)?.title : customFocusMin ? "Custom focus block" : "Open focus block"}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{Math.ceil(focusDuration/60)} min</p>
                </div>

              </div>

              <div className="rounded-[2.5rem] border border-white/70 bg-white/75 p-5 shadow-[0_24px_70px_rgba(74,61,39,0.12)] backdrop-blur-xl sm:p-7">

                <div className="mt-6">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-3">Allowed apps</p>
                  <div className="grid grid-cols-3 gap-2">
                    {focusApps.map(app=>(
                      <button key={app.name} onClick={()=>onToggleFocusApp(app.name)} className={`flex flex-col items-center gap-1 rounded-2xl p-3 transition ${app.allowed?"bg-emerald-500/10 text-slate-950":"bg-slate-950/5 text-slate-400"}`}>
                        <span className="text-2xl">{app.icon}</span><span className="text-[9px] font-black">{app.name}</span>
                        <span className={`h-1.5 w-1.5 rounded-full ${app.allowed?"bg-emerald-500":"bg-red-400"}`}/>
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={onStartFocus} className="mt-6 w-full rounded-full bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-[0_14px_30px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5">Start focus session</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}

// ─── CALENDAR ────────────────────────────────────────────────────────
function CalendarPage({activePet,onSelectDay,goals,viewYear,viewMonth,onNavigateMonth,onJumpToToday,openMonthYearPicker,calendarDayPopup,onCalendarDayPopup,routines,onAddRoutine,onRemoveRoutine,newRoutineName,onNewRoutineName,newRoutineTime,onNewRoutineTime,newRoutineFrequency,onNewRoutineFrequency,showAddRoutine,setShowAddRoutine,newRoutineCustom,onNewRoutineCustom}:{
  activePet:{from:string;to:string;accent:string};selectedDay:Date;onSelectDay:(d:Date)=>void;goals:GoalItem[];viewYear:number;viewMonth:number;
  onNavigateMonth:(d:number)=>void;onJumpToToday:()=>void;openMonthYearPicker:()=>void;
  calendarDayPopup:Date|null;onCalendarDayPopup:(d:Date|null)=>void;
  routines:Routine[];onAddRoutine:()=>void;onRemoveRoutine:(id:number)=>void;
  newRoutineName:string;onNewRoutineName:(v:string)=>void;newRoutineTime:string;onNewRoutineTime:(v:string)=>void;newRoutineFrequency:Routine["frequency"];onNewRoutineFrequency:(v:Routine["frequency"])=>void;
  showAddRoutine:boolean;setShowAddRoutine:(v:boolean)=>void;newRoutineCustom:string;onNewRoutineCustom:(v:string)=>void;
}){
  const [goalPreview,setGoalPreview]=useState<GoalItem|null>(null);
  const allSubs=useMemo(()=>goals.flatMap(g=>g.subtasks.map(s=>({...s,goalColor:g.color,goalTitle:g.title}))),[goals]);
  const tasksByDate=useMemo(()=>{const m:Record<string,typeof allSubs>={};for(const s of allSubs){const k=s.scheduledDate.toDateString();if(!m[k])m[k]=[];m[k].push(s);}return m;},[allSubs]);
  const deadlinesByDate=useMemo(()=>{const m:Record<string,GoalItem[]>={};for(const g of goals){const k=g.deadline.toDateString();if(!m[k])m[k]=[];m[k].push(g);}return m;},[goals]);
  const cells=useMemo(()=>buildMonthGrid(viewYear,viewMonth),[viewYear,viewMonth]);
  const popupTasks=calendarDayPopup?tasksByDate[calendarDayPopup.toDateString()]??[]:[];
  const routineTone=(frequency:Routine["frequency"])=>frequency==="Daily"?"from-amber-400 to-rose-400":frequency==="Weekly"?"from-violet-400 to-sky-400":frequency==="Monthly"?"from-emerald-400 to-teal-400":frequency==="Once"?"from-slate-400 to-slate-500":"from-fuchsia-400 to-cyan-400";
  const routinesForDate=(date:Date)=>routines.filter(r=>{
    if(r.frequency==="Daily") return true;
    if(r.frequency==="Weekly") return date.getDay()===TODAY.getDay();
    if(r.frequency==="Monthly") return date.getDate()===TODAY.getDate();
    if(r.frequency==="Once") return sameDay(date,TODAY);
    return Math.abs(daysBetween(TODAY,date))%3===0;
  });
  const popupRoutines=calendarDayPopup?routinesForDate(calendarDayPopup):[];

  return(
    <section className="animate-page-in mx-auto max-w-6xl space-y-6">
      <PageBuddy variant="calendar" pet={activePet} title="Time Keeper" text="I keep every day visible. Tap a date to preview its plan — view-only, nothing will change."/>
      {/* Month nav */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-white/70 bg-white/75 px-3 py-2 shadow-[0_16px_45px_rgba(74,61,39,0.1)] backdrop-blur-xl">
        <div className="flex items-center gap-2"><button onClick={()=>onNavigateMonth(-1)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-white transition hover:scale-105">‹</button><button onClick={openMonthYearPicker} className="rounded-full bg-white px-5 py-2 text-base font-black text-slate-950 transition hover:bg-slate-100">{monthYearLabel(viewYear,viewMonth)}</button><button onClick={()=>onNavigateMonth(1)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-white transition hover:scale-105">›</button></div>
        <button onClick={onJumpToToday} className="rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-amber-950 transition hover:-translate-y-0.5">Today</button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">{goals.map(g=><button key={g.id} onClick={()=>setGoalPreview(g)} className={`rounded-full bg-gradient-to-r ${g.color} px-3 py-1 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}>★{g.importance} · {g.title}</button>)}</div>

      {/* Grid */}
      <div className="rounded-[2.5rem] border border-white/70 bg-white/70 p-4 shadow-[0_24px_70px_rgba(74,61,39,0.12)] backdrop-blur-xl sm:p-5">
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{DAY_NAMES_SHORT.map(d=><span key={d} className="py-1.5">{d}</span>)}</div>
        <div className="mt-1.5 grid grid-cols-7 gap-1.5">
          {cells.map((c,i)=>{
            const isT=sameDay(c.date,TODAY);
            const items=tasksByDate[c.date.toDateString()]??[];
            const dayRoutines=routinesForDate(c.date);
            const dls=deadlinesByDate[c.date.toDateString()]??[];
            return(
              <button key={i} onClick={()=>{onSelectDay(c.date);onCalendarDayPopup(c.date);}} className={`group relative min-h-24 rounded-[1.2rem] p-1.5 text-left transition sm:min-h-28 sm:p-2.5 ${c.isOutside?"bg-white/25 text-slate-300 hover:bg-white/40":isT?"bg-amber-100 text-slate-700 ring-2 ring-amber-400 hover:-translate-y-0.5":"bg-white/60 text-slate-700 hover:-translate-y-0.5 hover:bg-white"}`}>
                <div className="flex items-center justify-between"><span className="text-sm font-black">{c.displayDay}</span>{isT&&<span className="text-[8px] font-black uppercase text-amber-700">Today</span>}</div>
                {dls.length>0&&<div className="mt-0.5 flex gap-0.5">{dls.map(g=><span key={g.id} className={`h-1.5 w-1.5 rounded-full bg-gradient-to-r ${g.color} ring-1 ring-white`}/>)}</div>}
                <div className="mt-1.5 space-y-0.5">
                  {items.slice(0,1).map(s=><span key={s.id} className={`block truncate rounded px-1 py-0.5 text-[8px] font-bold ${`bg-gradient-to-r ${s.goalColor} text-white opacity-90`}`}>{s.done?"✓ ":""}{s.title}</span>)}
                  {dayRoutines.slice(0,1).map(r=><span key={`routine-${r.id}`} className={`block truncate rounded border border-dashed border-amber-400/70 bg-amber-50 px-1 py-0.5 text-[8px] font-black text-amber-700`}>🔔 {r.title}</span>)}
                  {items.length+dayRoutines.length>2&&<span className="block text-[8px] font-black text-slate-400">+{items.length+dayRoutines.length-2} more</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day popup */}
      {goalPreview&&<OverlayShell onClose={()=>setGoalPreview(null)} mw="max-w-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-slate-400">Goal schedule</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950">{goalPreview.title}</h2>
            <span className={`mt-2 inline-block rounded-full bg-gradient-to-r ${goalPreview.color} px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white`}>{goalPreview.category} · ★{goalPreview.importance}</span>
          </div>
          <button onClick={()=>setGoalPreview(null)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-950/5 text-slate-700 hover:bg-slate-950/10">✕</button>
        </div>
        <div className="mt-5 rounded-2xl bg-slate-950/5 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Deadline</p>
          <p className="mt-1 text-sm font-black text-slate-950">{goalPreview.deadline.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
        </div>
        <div className="mt-5 space-y-3 max-h-80 overflow-y-auto scrollbar-hide">
          {goalPreview.subtasks.map((task,index)=>(
            <div key={task.id} className={`overflow-hidden rounded-2xl border ${task.done?"border-emerald-500/20 bg-emerald-500/5":"border-slate-950/5 bg-white shadow-sm"}`}>
              <div className={`h-1 bg-gradient-to-r ${goalPreview.color}`} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Step {index+1}</p>
                    <p className={`mt-1 text-sm font-black leading-6 ${task.done?"text-slate-400 line-through":"text-slate-950"}`}>{task.title}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Assigned: {task.scheduledDate.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short",year:"numeric"})} · {task.duration}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${task.done?"bg-emerald-500/10 text-emerald-700":"bg-slate-950/5 text-slate-500"}`}>{task.done?"Done":"Planned"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </OverlayShell>}

      {/* Day popup */}
      {calendarDayPopup&&<OverlayShell onClose={()=>onCalendarDayPopup(null)} mw="max-w-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-slate-400">Day preview</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950">{calendarDayPopup.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"})}</h2>
            <span className="mt-2 inline-block rounded-full bg-teal-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">View only</span>
          </div>
          <button onClick={()=>onCalendarDayPopup(null)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-950/5 text-slate-700 hover:bg-slate-950/10">✕</button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-slate-950/5 p-3 text-center"><p className="text-2xl font-black text-slate-950">{popupTasks.length}</p><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Tasks</p></div>
          <div className="rounded-2xl bg-amber-500/10 p-3 text-center"><p className="text-2xl font-black text-amber-700">{popupRoutines.length}</p><p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Routines</p></div>
        </div>
        <div className="mt-5 space-y-4 max-h-80 overflow-y-auto scrollbar-hide">
          {popupTasks.length===0&&popupRoutines.length===0&&(
            <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white p-6 text-center shadow-inner">
              <Pet size={80} role="calendar" bodyFrom={activePet.from} bodyTo={activePet.to} accent={activePet.accent} expression="calm"/>
              <p className="mt-4 text-sm font-bold text-slate-500">No tasks scheduled for this day</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">A quiet day to catch up or rest</p>
            </div>
          )}
          {popupTasks.length>0&&(
            <div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Scheduled tasks</p>
              <div className="space-y-2">
                {popupTasks.map(t=>{
                  const goal=goals.find(g=>g.id===t.goalId);
                  return(
                    <div key={t.id} className={`overflow-hidden rounded-2xl border ${t.done?"border-emerald-500/20 bg-emerald-500/5":"border-slate-950/5 bg-white shadow-sm"}`}>
                      <div className={`h-1 bg-gradient-to-r ${goal?.color??"from-slate-300 to-slate-400"}`} />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-black leading-6 ${t.done?"text-slate-400 line-through":"text-slate-950"}`}>{t.title}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{goal?.title} · {t.duration}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${t.done?"bg-emerald-500/10 text-emerald-700":"bg-slate-950/5 text-slate-500"}`}>{t.done?"Completed":"Planned"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {popupRoutines.length>0&&(
            <div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-700">Routine reminders</p>
              <div className="space-y-2">
                {popupRoutines.map(r=>{
                  const tone=routineTone(r.frequency);
                  return(
                    <div key={r.id} className="overflow-hidden rounded-2xl border border-dashed border-amber-300 bg-amber-50/80 shadow-sm">
                      <div className={`h-1 bg-gradient-to-r ${tone}`} />
                      <div className="flex items-center gap-3 p-4">
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-sm`}>🔔</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-slate-950">{r.title}</p>
                          <p className="mt-1 text-xs font-semibold text-amber-700">{r.time} · {r.frequency}</p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">Reminder</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </OverlayShell>}

      {/* ── ROUTINES ── */}
      <div className="rounded-[2.5rem] border border-white/70 bg-white/70 p-5 shadow-[0_24px_70px_rgba(74,61,39,0.12)] backdrop-blur-xl sm:p-7">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">Routines</h2>
          <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Reminder only</span>
        </div>
        <div className="space-y-2">
          {routines.map(r=>{
            const tone = r.frequency==="Daily"?"from-amber-400 to-rose-400":r.frequency==="Weekly"?"from-violet-400 to-sky-400":r.frequency==="Monthly"?"from-emerald-400 to-teal-400":"from-slate-400 to-slate-500";
            return(
              <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-white/80 p-3 shadow-[0_4px_12px_rgba(74,61,39,0.06)] transition hover:-translate-y-0.5">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br ${tone} text-sm text-white shadow-sm`}>🔔</span>
                <span className="flex-1 text-sm font-black text-slate-950">{r.title}<span className={`ml-2 rounded-full bg-gradient-to-r ${tone} px-2 py-0.5 text-[10px] font-black text-white`}>{r.frequency}</span></span>
                <span className="text-xs font-bold text-slate-400">{r.time}</span>
                <button onClick={()=>onRemoveRoutine(r.id)} className="grid h-7 w-7 place-items-center rounded-lg bg-red-500/10 text-xs font-black text-red-500 hover:bg-red-500 hover:text-white">✕</button>
              </div>
            );
          })}
        </div>
        {/* Add routine button */}
        <button onClick={()=>setShowAddRoutine(!showAddRoutine)} className={`mt-4 w-full rounded-2xl border-2 border-dashed p-4 text-sm font-black transition ${showAddRoutine?"border-slate-950 bg-slate-950/5 text-slate-950":"border-slate-950/20 text-slate-500 hover:border-slate-950/40 hover:bg-slate-950/5"}`}>
          {showAddRoutine?"✕ Cancel":"+ Add new routine"}
        </button>
        {/* Expandable form */}
        {showAddRoutine&&(
          <div className="mt-4 animate-page-in space-y-3 rounded-2xl bg-gradient-to-br from-slate-50 to-white p-4 shadow-inner">
            <input value={newRoutineName} onChange={e=>onNewRoutineName(e.target.value)} className="w-full rounded-xl border border-slate-950/10 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500" placeholder="Routine name (e.g., Morning stretch)"/>
            <div className="flex gap-2">
              <input type="time" value={newRoutineTime} onChange={e=>onNewRoutineTime(e.target.value)} className="w-32 rounded-xl border border-slate-950/10 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500"/>
              <select value={newRoutineFrequency} onChange={e=>onNewRoutineFrequency(e.target.value as Routine["frequency"])} className="flex-1 rounded-xl border border-slate-950/10 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:border-teal-500">
                <option>Daily</option><option>Weekly</option><option>Monthly</option><option>Once</option><option>Custom</option>
              </select>
            </div>
            {newRoutineFrequency==="Custom"&&(
              <input value={newRoutineCustom} onChange={e=>onNewRoutineCustom(e.target.value)} className="w-full rounded-xl border border-slate-950/10 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500" placeholder="Custom frequency (e.g., Every 3 days, Weekdays only)"/>
            )}
            <button onClick={onAddRoutine} disabled={!newRoutineName.trim()} className="w-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-5 py-3 text-sm font-black text-white shadow-[0_8px_20px_rgba(20,184,166,0.3)] transition hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed">Add routine</button>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── COMMUNITY ───────────────────────────────────────────────────────
function CommunityPage({activePet,joinGroupInput,onJoinGroupInput,myFriends,myCommunities,friendSuggestions,communitySuggestions,onAddFriend,onRemoveFriend,onJoinCommunity,onCreateCommunity,onRemoveCommunity}:{activePet:{from:string;to:string;accent:string};joinGroupInput:string;onJoinGroupInput:(v:string)=>void;myFriends:Friend[];myCommunities:CommunityGroup[];friendSuggestions:CommunityUser[];communitySuggestions:CommunityGroup[];onAddFriend:(u:CommunityUser)=>void;onRemoveFriend:(name:string)=>void;onJoinCommunity:(g:CommunityGroup)=>void;onCreateCommunity:()=>void;onRemoveCommunity:(name:string)=>void}){
  const [communityChat,setCommunityChat]=useState<CommunityGroup|null>(null);
  const [chatInput,setChatInput]=useState("");
  const [chatMessages,setChatMessages]=useState<Array<{author:string;text:string}>>([
    {author:"Maya",text:"Welcome! Share what tiny win you're working on today."},
    {author:"Ari",text:"I'm finishing my portfolio outline before lunch."},
  ]);
  return(
    <section className="animate-page-in mx-auto max-w-6xl space-y-6">
      <PageBuddy variant="community" pet={activePet} title="Social Friend" text="I'll match you with friends and groups that share your goals or fill the role you're missing."/>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-[2.5rem] border border-white/70 bg-white/70 p-5 shadow-[0_24px_70px_rgba(74,61,39,0.12)] backdrop-blur-xl sm:p-7">
            <div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">Weekly leaderboard</h2><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-700">Kind mode</span></div>
            <div className="space-y-3">{leaderboard.map((p,i)=>(
              <div key={p.name} className={`flex items-center justify-between gap-4 rounded-[1.6rem] p-4 transition hover:-translate-y-0.5 ${p.name==="Ari"?"bg-slate-950 text-white":"bg-white/60 text-slate-950"}`}>
                <div className="flex items-center gap-4"><span className={`grid h-11 w-11 place-items-center rounded-full text-sm font-black ${p.name==="Ari"?"bg-white text-slate-950":"bg-slate-950 text-white"}`}>{i+1}</span><div><p className="text-lg font-black">{p.name}</p><p className={`text-sm font-bold ${p.name==="Ari"?"text-white/55":"text-slate-500"}`}>{p.streak} day streak</p></div></div>
                <div className="text-right"><p className="font-black">{p.score}</p><p className={`text-sm font-bold ${p.name==="Ari"?"text-emerald-200":"text-emerald-600"}`}>{p.pace}</p></div>
              </div>
            ))}</div>
          </div>
          <div className="rounded-[1.8rem] bg-[#fff2d6] p-5"><p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Team challenge</p><p className="mt-2 text-xl font-black tracking-[-0.04em] text-slate-950">Complete 25 tiny wins together</p><div className="mt-4 h-3 overflow-hidden rounded-full bg-amber-900/10"><div className="h-full w-[68%] rounded-full bg-amber-400"/></div></div>
        </div>

        <div className="space-y-6">
          {/* Friends */}
          <div className="rounded-[2.5rem] border border-white/70 bg-white/70 p-5 shadow-[0_24px_70px_rgba(74,61,39,0.12)] backdrop-blur-xl sm:p-7">
            <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">My friends</h2>
            <div className="mt-5 space-y-3">{myFriends.map(f=>(
              <div key={f.name} className="flex items-center justify-between gap-4 rounded-[1.6rem] bg-white/60 p-4"><div className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${f.color}`}/><div><p className="font-black text-slate-950">{f.name}</p><p className="text-sm font-semibold text-slate-500">{f.status}</p></div></div><div className="flex gap-2"><button className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:scale-105">Cheer</button><button onClick={()=>onRemoveFriend(f.name)} className="rounded-full bg-red-500/10 px-3 py-2 text-xs font-black text-red-500 hover:bg-red-500 hover:text-white">Remove</button></div></div>
            ))}</div>
          </div>

          <div className="rounded-[2.5rem] border border-white/70 bg-white/70 p-5 shadow-[0_24px_70px_rgba(74,61,39,0.12)] backdrop-blur-xl sm:p-7">
            <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">My community</h2>
            <div className="mt-4 space-y-3">{myCommunities.map(g=>(
              <div key={g.name} className="rounded-[1.6rem] bg-white/65 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{g.name}</p><p className="mt-1 text-xs font-bold text-slate-500">Made by {g.creator} · {g.created}</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{g.about}</p></div><div className="flex shrink-0 flex-col gap-2"><button onClick={()=>setCommunityChat(g)} className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white hover:-translate-y-0.5">Chat</button><button onClick={()=>onRemoveCommunity(g.name)} className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-500 hover:bg-red-500 hover:text-white">Remove</button></div></div>
              </div>
            ))}</div>
          </div>

          {/* Friends Suggestions (renamed from Community Finder) */}
          <div className="rounded-[2.5rem] border border-white/70 bg-white/70 p-5 shadow-[0_24px_70px_rgba(74,61,39,0.12)] backdrop-blur-xl sm:p-7">
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">Friends suggestions</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">People with similar goals.</p>
            <div className="mt-4 space-y-2">{friendSuggestions.map(u=>(
              <div key={u.name} className="flex items-center justify-between gap-4 rounded-[1.4rem] bg-white/80 p-3 shadow-[0_4px_12px_rgba(74,61,39,0.06)]">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-sky-400 text-xs font-black text-white shadow-sm">{u.avatar}</span><p className="font-black text-slate-950">{u.name}</p></div>
                <div className="flex items-center gap-2">{u.compatibility!=null?<span className={`text-sm font-black ${u.compatibility>=70?"text-emerald-600":u.compatibility>=40?"text-amber-600":"text-red-500"}`}>{u.compatibility}%</span>:<span className="text-xs font-bold text-slate-400">No data</span>}<button onClick={()=>onAddFriend(u)} className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-[11px] font-black text-white shadow-[0_6px_15px_rgba(16,185,129,0.3)] transition hover:scale-105">+ Add</button></div>
              </div>
            ))}</div>
          </div>

          {/* ── COMMUNITY FINDER (new) ── */}
          <div className="rounded-[2.5rem] border border-white/70 bg-white/70 p-5 shadow-[0_24px_70px_rgba(74,61,39,0.12)] backdrop-blur-xl sm:p-7">
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">Community Finder</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Create or join a community group.</p>
            <div className="mt-4 flex gap-2">
              <input value={joinGroupInput} onChange={e=>onJoinGroupInput(e.target.value)} className="flex-1 rounded-full border border-slate-950/10 bg-[#fffaf2] px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500" placeholder="Group name to create or join..."/>
              <button onClick={()=>{const g=suggestedGroups.find(x=>x.name.toLowerCase()===joinGroupInput.toLowerCase()); if(g) onJoinCommunity(g);}} disabled={!joinGroupInput.trim()} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:opacity-40">Join</button>
              <button onClick={onCreateCommunity} disabled={!joinGroupInput.trim()} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:opacity-40">Create</button>
            </div>
            <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Suggested for you</p>
            <div className="mt-3 space-y-2">{communitySuggestions.map(g=>(
              <div key={g.name} className="flex items-center justify-between gap-3 rounded-[1.4rem] bg-white/60 p-3">
                <div><p className="text-sm font-black text-slate-950">{g.name}</p><p className="text-[11px] font-semibold text-slate-500">{g.tag}</p></div>
                <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-400">{g.members} members</span><button onClick={()=>onJoinCommunity(g)} className="rounded-full bg-teal-500 px-3 py-1.5 text-[11px] font-black text-white transition hover:scale-105">Join</button></div>
              </div>
            ))}</div>
          </div>
        </div>
      </div>
      {communityChat&&<OverlayShell onClose={()=>setCommunityChat(null)} mw="max-w-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-slate-400">Community chat</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950">{communityChat.name}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{communityChat.members} members · made by {communityChat.creator}</p>
          </div>
          <button onClick={()=>setCommunityChat(null)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-950/5 text-slate-700 hover:bg-slate-950/10">✕</button>
        </div>
        <div className="mt-5 max-h-80 space-y-3 overflow-y-auto scrollbar-hide rounded-2xl bg-slate-950/5 p-4">
          {chatMessages.map((msg,index)=>(
            <div key={index} className={`flex ${msg.author==="Ari"?"justify-end":"justify-start"}`}>
              <div className={`max-w-[82%] rounded-2xl p-3 ${msg.author==="Ari"?"bg-slate-950 text-white":"bg-white text-slate-800"}`}>
                <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${msg.author==="Ari"?"text-white/45":"text-slate-400"}`}>{msg.author}</p>
                <p className="mt-1 text-sm font-semibold leading-6">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&chatInput.trim()){setChatMessages(m=>[...m,{author:"Ari",text:chatInput}]);setChatInput("");}}} className="flex-1 rounded-full border border-slate-950/10 bg-[#fffaf2] px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500" placeholder="Message the group..."/>
          <button onClick={()=>{if(chatInput.trim()){setChatMessages(m=>[...m,{author:"Ari",text:chatInput}]);setChatInput("");}}} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">Send</button>
        </div>
      </OverlayShell>}
    </section>
  );
}

// ─── COMPANION (enhanced) ────────────────────────────────────────────
function CompanionPage({activePet,petCoins,selectedPet,onSelectPet}:{activePet:{from:string;to:string;accent:string};petCoins:number;selectedPet:string;onSelectPet:(id:string)=>void}){
  return(
    <section className="animate-page-in mx-auto max-w-5xl space-y-6">
      <PageBuddy variant="shop" pet={activePet} title="Shopkeeper" text="Spend the coins your tasks earned on costumes, room items, and tiny pet treats."/>
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-950 to-slate-900 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.25)]">
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-black uppercase tracking-[0.24em] text-white/50">Wallet</p><p className="mt-2 text-4xl font-black tracking-[-0.06em]">{petCoins}</p><p className="text-sm font-bold text-white/50">coins earned</p></div>
              <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-2xl font-black text-amber-950 shadow-[0_8px_24px_rgba(251,191,36,0.4)]">C</div>
            </div>
          </div>
          <div className="rounded-[2.5rem] border border-white/70 bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50 p-5 shadow-[0_24px_70px_rgba(74,61,39,0.12)]">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-700">Pet preview</p>
            <div className="mt-4 flex justify-center"><Pet size={140} role="shop" bodyFrom={petLooks.find(p=>p.id===selectedPet)?.from} bodyTo={petLooks.find(p=>p.id===selectedPet)?.to} accent={petLooks.find(p=>p.id===selectedPet)?.accent} expression="wink"/></div>
            <div className="mt-4 grid grid-cols-3 gap-2">{petLooks.map(p=><button key={p.id} onClick={()=>onSelectPet(p.id)} className={`rounded-2xl p-3 text-xs font-black transition ${selectedPet===p.id?"bg-slate-950 text-white shadow-[0_8px_20px_rgba(0,0,0,0.15)]":"bg-white text-slate-600 hover:bg-slate-100"}`}>{p.name}</button>)}</div>
          </div>
        </div>
        <div className="rounded-[2.5rem] border border-white/70 bg-white/70 p-5 shadow-[0_24px_70px_rgba(74,61,39,0.12)] backdrop-blur-xl sm:p-7">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950">Pet shop</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">{shopItems.map(it=>(<div key={it.name} className="group overflow-hidden rounded-[1.8rem] bg-white shadow-[0_8px_24px_rgba(74,61,39,0.08)] transition hover:-translate-y-1"><div className="grid h-28 place-items-center bg-gradient-to-br from-[#fff2d6] to-[#e0f2fe] text-5xl">{it.image}</div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{it.name}</p><p className="mt-1 text-xs font-bold text-slate-500">{it.type} · {it.note}</p></div><button className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white transition group-hover:scale-105"><span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-[10px] font-black text-amber-950 shadow-[0_4px_12px_rgba(251,191,36,0.35)]">C</span>{it.price}</button></div></div></div>))}</div>
        </div>
      </div>
    </section>
  );
}

// ─── SHARED ──────────────────────────────────────────────────────────
function PageBuddy({variant,text,title,pet}:{variant:PetRole;text:string;title?:string;pet:{from:string;to:string;accent:string}}){
  const a = roleAccent[variant];
  const expression: "smile"|"wink"|"calm"|"wow" = variant === "calendar" ? "calm" : variant === "shop" ? "wink" : variant === "community" ? "wow" : "smile";
  return(
    <div className={`relative overflow-hidden rounded-[2rem] border border-white/70 bg-gradient-to-br ${a.bg} p-4 shadow-[0_18px_50px_rgba(74,61,39,0.1)]`}>
      <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/40 blur-2xl"/>
      <div className="relative flex items-center gap-4">
        <div className="shrink-0">
          <Pet size={84} role={variant} bodyFrom={pet.from} bodyTo={pet.to} accent={pet.accent} expression={expression}/>
        </div>
        <div className="relative min-w-0 flex-1 rounded-[1.3rem] bg-white px-4 py-3 shadow-sm">
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${a.ink}`}>{title ?? a.tagline}</p>
          <p className="mt-1 text-sm font-bold leading-6 text-slate-700">{text}</p>
          <span className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-white"/>
        </div>
      </div>
    </div>
  );
}

function OverlayShell({children,onClose,mw="max-w-md"}:{children:React.ReactNode;onClose:()=>void;mw?:string}){
  return(<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4" onClick={onClose}><div onClick={e=>e.stopPropagation()} className={`animate-page-in w-full ${mw} max-h-[90vh] overflow-y-auto scrollbar-hide rounded-[2.5rem] bg-white p-7 shadow-[0_40px_120px_rgba(15,23,42,0.4)]`}>{children}</div></div>);
}
function SG({t,children}:{t:string;children:React.ReactNode}){return(<div className="rounded-2xl bg-slate-950/5 p-4"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t}</p><div className="mt-3 space-y-2">{children}</div></div>);}
function ST({l,d,v,o}:{l:string;d:string;v:boolean;o:(v:boolean)=>void}){
  return(<button onClick={()=>o(!v)} className="flex w-full items-center justify-between gap-4 rounded-xl bg-white p-3 text-left transition hover:bg-slate-50"><div className="min-w-0"><p className="text-sm font-black text-slate-950">{l}</p><p className="text-xs font-semibold text-slate-500">{d}</p></div><span className={`relative h-7 w-12 shrink-0 rounded-full transition ${v?"bg-emerald-500":"bg-slate-300"}`}><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${v?"left-[calc(100%-1.625rem)]":"left-0.5"}`}/></span></button>);
}
function AuthForm({mode,onSwitch,onSubmit}:{mode:"login"|"signup";onSwitch:()=>void;onSubmit:(e:string,n:string)=>void;onClose:()=>void}){
  const [email,setEmail]=useState("");const [name,setName]=useState("");const [password,setPassword]=useState("");
  const valid=email.includes("@")&&password.length>=4&&(mode==="login"||name.trim().length>0);
  return(<div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 text-white shadow-[0_10px_30px_rgba(16,185,129,0.3)]">🌱</div><h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-slate-950">{mode==="login"?"Welcome back":"Create account"}</h2><div className="mt-5 space-y-3 text-left">{mode==="signup"&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" className="w-full rounded-2xl border border-slate-950/10 bg-[#fffaf2] px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500"/>}<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" className="w-full rounded-2xl border border-slate-950/10 bg-[#fffaf2] px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500"/><input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" className="w-full rounded-2xl border border-slate-950/10 bg-[#fffaf2] px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500"/></div><button onClick={()=>valid&&onSubmit(email,mode==="login"?email.split("@")[0]:name)} disabled={!valid} className={`mt-5 w-full rounded-full px-5 py-4 text-sm font-black transition ${valid?"bg-slate-950 text-white hover:-translate-y-0.5":"bg-slate-950/10 text-slate-400 cursor-not-allowed"}`}>{mode==="login"?"Sign in":"Create account"}</button><p className="mt-4 text-sm font-semibold text-slate-500">{mode==="login"?"New here?":"Have an account?"} <button onClick={onSwitch} className="text-teal-600 hover:underline">{mode==="login"?"Create one":"Sign in"}</button></p></div>);
}
function DatePickerInner({initial,onPick,onClose}:{initial:Date;onPick:(d:Date)=>void;onClose:()=>void}){
  const [y,setY]=useState(initial.getFullYear());const [m,setM]=useState(initial.getMonth());const [d,setD]=useState(initial.getDate());const [showY,setShowY]=useState(false);
  const cells=useMemo(()=>buildMonthGrid(y,m),[y,m]);const years=useMemo(()=>Array.from({length:11},(_,i)=>TODAY.getFullYear()-1+i),[]);
  return(<div><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.26em] text-slate-400">Pick a date</p><h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-slate-950">{new Date(y,m,d).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</h2></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-950/5 text-slate-700 hover:bg-slate-950/10">✕</button></div>
    <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-950/5 p-2"><button onClick={()=>{let nm=m-1,ny=y;if(nm<0){nm=11;ny-=1;}setM(nm);setY(ny);}} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-700 hover:bg-slate-100">‹</button><button onClick={()=>setShowY(v=>!v)} className="rounded-xl bg-white px-3 py-1.5 text-sm font-black text-slate-950 hover:bg-slate-100">{MONTH_NAMES[m]} {y}</button><button onClick={()=>{let nm=m+1,ny=y;if(nm>11){nm=0;ny+=1;}setM(nm);setY(ny);}} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-700 hover:bg-slate-100">›</button></div>
    {showY?<div className="mt-3 grid max-h-60 grid-cols-3 gap-1.5 overflow-y-auto rounded-2xl bg-slate-950/5 p-2">{MONTH_NAMES.map((mn,i)=><button key={mn} onClick={()=>{setM(i);setShowY(false);}} className={`rounded-lg px-2 py-1.5 text-xs font-black transition ${m===i?"bg-slate-950 text-white":"bg-white text-slate-700 hover:bg-slate-100"}`}>{mn.slice(0,3)}</button>)}<div className="col-span-3 mt-2 grid grid-cols-4 gap-1.5">{years.map(yr=><button key={yr} onClick={()=>{setY(yr);setShowY(false);}} className={`rounded-lg px-2 py-1.5 text-xs font-black transition ${y===yr?"bg-slate-950 text-white":"bg-white text-slate-700 hover:bg-slate-100"}`}>{yr}</button>)}</div></div>
    :<><div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{DAY_NAMES_SHORT.map(x=><span key={x} className="py-1">{x}</span>)}</div><div className="mt-1 grid grid-cols-7 gap-1">{cells.map((c,i)=>{const isSel=!c.isOutside&&c.date.getDate()===d&&c.date.getMonth()===m&&c.date.getFullYear()===y;const isT=sameDay(c.date,TODAY);return(<button key={i} onClick={()=>{if(!c.isOutside)setD(c.displayDay);else{setM(c.date.getMonth());setY(c.date.getFullYear());setD(c.displayDay);}}} className={`grid aspect-square place-items-center rounded-lg text-sm font-black transition ${isSel?"bg-slate-950 text-white shadow-[0_8px_20px_rgba(15,23,42,0.22)]":c.isOutside?"text-slate-300 hover:bg-slate-950/5":isT?"bg-amber-100 text-amber-900 ring-1 ring-amber-400":"text-slate-700 hover:bg-slate-950/5"}`}>{c.displayDay}</button>);})}</div></>}
    <div className="mt-4 flex gap-3"><button onClick={onClose} className="flex-1 rounded-full border border-slate-950/10 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:-translate-y-0.5">Cancel</button><button onClick={()=>onPick(new Date(y,m,d))} className="flex-1 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5">Confirm</button></div>
  </div>);
}

function BreakdownChatUI({chat,onSend,onClose}:{chat:{goalTitle:string;messages:ChatMsg[]};onSend:(msg:string)=>void;onClose:()=>void}){
  const [input,setInput]=useState("");const endRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[chat.messages]);
  return(<div>
    <div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-[0.26em] text-slate-400">Goal breakdown</p><h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-slate-950">{chat.goalTitle}</h2></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-950/5 text-slate-700 hover:bg-slate-950/10">✕</button></div>
    <div className="mt-4 max-h-80 overflow-y-auto space-y-3 scrollbar-hide">
      {chat.messages.map((msg,i)=>(
        <div key={i} className={`flex ${msg.role==="user"?"justify-end":"justify-start"}`}>
          <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role==="ai"?"bg-slate-950/5 text-slate-800":"bg-slate-950 text-white"}`}>
            <p className="text-sm font-semibold leading-6 whitespace-pre-wrap">{msg.text}</p>
          </div>
        </div>
      ))}
      <div ref={endRef}/>
    </div>
    <div className="mt-4 flex gap-2">
      <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&input.trim()){onSend(input);setInput("");}}} className="flex-1 rounded-full border border-slate-950/10 bg-[#fffaf2] px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500" placeholder="Adjust the plan..."/>
      <button onClick={()=>{if(input.trim()){onSend(input);setInput("");}}} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5">Send</button>
    </div>
    <button onClick={onClose} className="mt-3 w-full rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5">Looks good, finalize!</button>
  </div>);
}

// ─── ICONS ───────────────────────────────────────────────────────────
function TaskIcon({className=""}:IconProps){return<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l2 2 4-5"/><path d="M5 5h14v14H5z"/></svg>;}
function CalendarIcon({className=""}:IconProps){return<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3v4"/><path d="M17 3v4"/><path d="M4 8h16"/><rect x="4" y="5" width="16" height="16" rx="3"/></svg>;}
function PlannerIcon({className=""}:IconProps){return(
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hp-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#7dd3fc"/>
      </linearGradient>
    </defs>
    <path d="M6 6 Q4 2 7.5 3 Q9 4.5 8.5 7 Z" fill="url(#hp-grad)"/>
    <path d="M18 6 Q20 2 16.5 3 Q15 4.5 15.5 7 Z" fill="url(#hp-grad)"/>
    <ellipse cx="12" cy="14" rx="8" ry="7.5" fill="url(#hp-grad)"/>
    <ellipse cx="12" cy="16" rx="5" ry="4" fill="#fef3c7" opacity="0.9"/>
    <circle cx="9.5" cy="12" r="1" fill="#0f172a"/>
    <circle cx="14.5" cy="12" r="1" fill="#0f172a"/>
    <path d="M10.5 15 Q12 16.5 13.5 15" stroke="#0f172a" strokeWidth="0.7" fill="none" strokeLinecap="round"/>
  </svg>
);}
function CommunityIcon({className=""}:IconProps){return<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/></svg>;}
function CompanionIcon({className=""}:IconProps){return<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 13c3.2 0 5 1.8 5 4.2 0 2-1.8 3.3-5 3.3s-5-1.3-5-3.3C7 14.8 8.8 13 12 13z"/><circle cx="6" cy="10" r="2.2"/><circle cx="10" cy="7" r="2.2"/><circle cx="14" cy="7" r="2.2"/><circle cx="18" cy="10" r="2.2"/></svg>;}
function GearIcon({className=""}:IconProps){return<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 .9-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.9 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6.9h.2a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1z"/></svg>;}
function CheckIcon({className=""}:IconProps){return<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;}

// ─── UNIFIED PET CHARACTER ───────────────────────────────────────────
type PetRole = "planner" | "task" | "calendar" | "community" | "shop";

const roleAccent: Record<PetRole, { from: string; to: string; bg: string; ink: string; tagline: string }> = {
  planner:   { from: "#34d399", to: "#7dd3fc", bg: "from-emerald-100 via-teal-50 to-sky-100",   ink: "text-emerald-700", tagline: "Planner Pal" },
  task:      { from: "#2dd4bf", to: "#10b981", bg: "from-teal-100 via-emerald-50 to-amber-100", ink: "text-teal-700",    tagline: "Focus Buddy" },
  calendar:  { from: "#fbbf24", to: "#fb7185", bg: "from-amber-100 via-rose-50 to-amber-50",    ink: "text-amber-700",   tagline: "Time Keeper" },
  community: { from: "#a78bfa", to: "#38bdf8", bg: "from-violet-100 via-sky-50 to-violet-50",   ink: "text-violet-700",  tagline: "Social Friend" },
  shop:      { from: "#fdba74", to: "#fb7185", bg: "from-orange-100 via-rose-50 to-amber-50",   ink: "text-orange-700",  tagline: "Shopkeeper" },
};

function Pet({ size = 80, role = "planner", bodyFrom, bodyTo, accent = "#fef3c7", expression = "smile", staticMode = false }: {
  size?: number; role?: PetRole; bodyFrom?: string; bodyTo?: string; accent?: string; expression?: "smile" | "wow" | "wink" | "calm"; staticMode?: boolean;
}) {
  const a = roleAccent[role];
  const from = bodyFrom ?? a.from;
  const to = bodyTo ?? a.to;
  const id = `pet-grad-${role}-${size}`;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={`${staticMode ? "" : "animate-pet-idle"} drop-shadow-md`}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <path d="M30 30 Q22 14 38 18 Q42 26 40 38 Z" fill={`url(#${id})`} />
      <path d="M90 30 Q98 14 82 18 Q78 26 80 38 Z" fill={`url(#${id})`} />
      <ellipse cx="60" cy="70" rx="40" ry="38" fill={`url(#${id})`} />
      <ellipse cx="60" cy="82" rx="24" ry="20" fill={accent} opacity="0.9" />
      <circle cx="38" cy="72" r="5" fill="#fb7185" opacity="0.45" />
      <circle cx="82" cy="72" r="5" fill="#fb7185" opacity="0.45" />
      {expression === "wink" ? (
        <>
          <circle cx="46" cy="60" r="4" fill="#0f172a" />
          <path d="M76 60 Q82 56 88 60" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : expression === "wow" ? (
        <>
          <circle cx="46" cy="60" r="5" fill="#0f172a" />
          <circle cx="82" cy="60" r="5" fill="#0f172a" />
          <circle cx="48" cy="58" r="1.5" fill="white" />
          <circle cx="84" cy="58" r="1.5" fill="white" />
        </>
      ) : expression === "calm" ? (
        <>
          <path d="M40 60 Q46 56 52 60" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M76 60 Q82 56 88 60" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="46" cy="60" r="4" fill="#0f172a" />
          <circle cx="82" cy="60" r="4" fill="#0f172a" />
          <circle cx="47.5" cy="58.5" r="1.2" fill="white" />
          <circle cx="83.5" cy="58.5" r="1.2" fill="white" />
        </>
      )}
      <path d="M52 74 Q60 80 68 74" stroke="#0f172a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {role === "planner" && (
        <g>
          <circle cx="46" cy="60" r="9" stroke="#0f172a" strokeWidth="2.5" fill="none" />
          <circle cx="82" cy="60" r="9" stroke="#0f172a" strokeWidth="2.5" fill="none" />
          <line x1="55" y1="60" x2="73" y2="60" stroke="#0f172a" strokeWidth="2.5" />
        </g>
      )}
      {role === "task" && (
        <g>
          <path d="M22 56 Q60 22 98 56" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="16" y="54" width="10" height="16" rx="4" fill="#0f172a" />
          <rect x="94" y="54" width="10" height="16" rx="4" fill="#0f172a" />
        </g>
      )}
      {role === "calendar" && (
        <g>
          <rect x="30" y="32" width="14" height="10" rx="3" fill="#0f172a" />
          <circle cx="37" cy="37" r="2.5" fill={to} />
          <line x1="37" y1="37" x2="37" y2="34.5" stroke={to} strokeWidth="1" />
          <line x1="37" y1="37" x2="39" y2="37" stroke={to} strokeWidth="1" />
        </g>
      )}
      {role === "community" && (
        <g>
          <path d="M50 92 L60 86 L70 92 L70 102 L60 96 L50 102 Z" fill="#0f172a" />
          <circle cx="60" cy="94" r="2.5" fill={from} />
        </g>
      )}
      {role === "shop" && (
        <g>
          <path d="M40 30 Q44 14 60 18 Q76 14 80 30 L78 36 L42 36 Z" fill="white" stroke="#0f172a" strokeWidth="2" />
          <rect x="42" y="34" width="36" height="6" fill={to} stroke="#0f172a" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}
