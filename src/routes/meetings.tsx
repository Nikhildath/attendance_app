import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { format, isToday, isTomorrow, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { Video, Phone, Calendar, Clock, Users, Plus, X, ChevronLeft, ChevronRight, Trash2, Play, CheckCircle, Ban } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { socketService } from "@/lib/socket-service";
import { SOCKET_URL } from "@/lib/config";
import { cn } from "@/lib/utils";
import { VideoCall } from "@/components/common/VideoCall";
import { IncomingCallScreen } from "@/components/common/IncomingCallScreen";
import { registerPushNotifications } from "@/lib/push-notifications";

export const Route = createFileRoute("/meetings")({
  head: () => ({
    meta: [
      { title: "Meetings — Attendly" },
      { name: "description", content: "Schedule and join video meetings." },
    ],
  }),
  component: MeetingsPage,
});

type Meeting = {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  scheduled_at: string;
  duration_minutes: number;
  branch_id: string | null;
  is_all_branches: boolean;
  status: "scheduled" | "ongoing" | "completed" | "cancelled";
  room_name: string;
  created_at: string;
  creator?: { name: string };
  participants?: { user_id: string; status: string; profile?: { name: string } }[];
};

type Profile = {
  id: string;
  name: string;
  role: string;
  branch_id: string | null;
  avatar_url?: string | null;
};

function MeetingsPage() {
  const { profile, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: Route.id });
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past" | "calendar">("upcoming");
  const [showSchedule, setShowSchedule] = useState(false);
  const [activeCall, setActiveCall] = useState<{ roomId: string; isDirect: boolean; calleeName?: string } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ callerName: string; callerId: string; roomId: string } | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [canStartCall, setCanStartCall] = useState(false);

  // Schedule form
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formDuration, setFormDuration] = useState(30);
  const [formBranch, setFormBranch] = useState("all");
  const [formParticipants, setFormParticipants] = useState<string[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    supabase.from("branches").select("id, name").then(({ data }) => data && setBranches(data));

    if (!socketService.isConnected()) {
      socketService.connect(SOCKET_URL, "", profile?.id).catch(() => {});
    }

    if (profile?.id) {
      registerPushNotifications(profile.id);
    }
  }, [profile?.id]);

  useEffect(() => {
    setCanStartCall(!!(profile && (isAdmin || isManager || profile.role === "Employee")));
  }, [profile, isAdmin, isManager]);

  // Listen for incoming calls
  useEffect(() => {
    const unsub = socketService.onIncomingCall((data) => {
      setIncomingCall({ callerName: data.name, callerId: data.from, roomId: data.roomId });
    });
    return unsub;
  }, []);

  // Listen for call ended (caller hung up before we answered, or callee declined)
  useEffect(() => {
    const unsub = socketService.onCallEnded((data) => {
      setIncomingCall((prev) => (prev && data.from === prev.callerId ? null : prev));
      setActiveCall((prev) => (prev && data.from !== profile?.id ? null : prev));
    });
    return unsub;
  }, [profile?.id]);

  // Check if opened from push notification (call=incoming param)
  useEffect(() => {
    const params = search as Record<string, unknown>;
    if (params.call === "incoming" && params.room && params.from && params.name && profile) {
      setIncomingCall({
        callerName: decodeURIComponent(params.name as string),
        callerId: params.from as string,
        roomId: params.room as string,
      });
      navigate({ to: "/meetings", replace: true });
    }
  }, [search, profile]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: meetingsData }, { data: profilesData }] = await Promise.all([
      supabase
        .from("meetings")
        .select("*, creator:created_by(name), participants:meeting_participants(user_id, status, profile:user_id(name))")
        .order("scheduled_at", { ascending: false }),
      supabase.from("profiles").select("id, name, role, branch_id, avatar_url"),
    ]);
    if (meetingsData) setMeetings(meetingsData as Meeting[]);
    if (profilesData) setProfiles(profilesData as Profile[]);
    setLoading(false);
  };

  const upcomingMeetings = meetings.filter((m) => m.status === "scheduled" || m.status === "ongoing").sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const pastMeetings = meetings.filter((m) => m.status === "completed" || m.status === "cancelled");

  const scheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !formTitle || !formDate || !formTime) return;

    const scheduledAt = new Date(`${formDate}T${formTime}`);
    const roomName = crypto.randomUUID();

    const { data: meeting, error } = await supabase
      .from("meetings")
      .insert([{
        title: formTitle,
        description: formDesc || null,
        created_by: profile.id,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: formDuration,
        branch_id: formBranch !== "all" ? formBranch : null,
        is_all_branches: formBranch === "all",
        room_name: roomName,
      }])
      .select()
      .single();

    if (error) {
      alert("Failed to schedule meeting: " + error.message);
      return;
    }

    if (meeting && formParticipants.length > 0) {
      await supabase.from("meeting_participants").insert(
        formParticipants.map((uid) => ({ meeting_id: meeting.id, user_id: uid }))
      );
    } else if (meeting && formBranch === "all") {
      await supabase.from("meeting_participants").insert(
        profiles.map((p) => ({ meeting_id: meeting.id, user_id: p.id }))
      );
    } else if (meeting && formBranch !== "all") {
      const branchProfiles = profiles.filter((p) => p.branch_id === formBranch);
      await supabase.from("meeting_participants").insert(
        branchProfiles.map((p) => ({ meeting_id: meeting.id, user_id: p.id }))
      );
    }

    setShowSchedule(false);
    resetForm();
    loadData();
  };

  const resetForm = () => {
    setFormTitle("");
    setFormDesc("");
    setFormDate("");
    setFormTime("");
    setFormDuration(30);
    setFormBranch("all");
    setFormParticipants([]);
  };

  const updateMeetingStatus = async (id: string, status: string) => {
    await supabase.from("meetings").update({ status }).eq("id", id);
    loadData();
  };

  const deleteMeeting = async (id: string) => {
    if (!confirm("Delete this meeting?")) return;
    await supabase.from("meetings").delete().eq("id", id);
    loadData();
  };

  const startCall = (meeting: Meeting) => {
    setActiveCall({ roomId: meeting.room_name, isDirect: false });
  };

  const startDirectCall = (targetProfile: Profile) => {
    const roomName = crypto.randomUUID();
    socketService.initiateDirectCall(targetProfile.id, profile!.name, roomName);
    setActiveCall({ roomId: roomName, isDirect: true, calleeName: targetProfile.name });
  };

  const handleAcceptIncoming = (roomId: string) => {
    setIncomingCall(null);
    setActiveCall({ roomId, isDirect: true });
  };

  const handleRejectIncoming = () => {
    setIncomingCall(null);
  };

  const handleIgnoreIncoming = () => {
    setIncomingCall(null);
  };

  const calendarDays = eachDayOfInterval({
    start: startOfMonth(calendarMonth),
    end: endOfMonth(calendarMonth),
  });

  const meetingsOnDay = (day: Date) =>
    meetings.filter((m) => isSameDay(new Date(m.scheduled_at), day) && m.status !== "cancelled");

  return (
    <div>
      <PageHeader
        title="Meetings"
        subtitle="Schedule, manage and join video meetings"
        actions={
          <button onClick={() => setShowSchedule(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all">
            <Plus size={18} />
            Schedule Meeting
          </button>
        }
      />

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 rounded-2xl border bg-card p-1 w-fit shadow-sm">
        {(["upcoming", "past", "calendar"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-5 py-2 rounded-xl text-sm font-bold transition-all", tab === t ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground")}>
            {t === "upcoming" ? "Upcoming" : t === "past" ? "Past" : "Calendar"}
          </button>
        ))}
      </div>

      {tab === "upcoming" && (
        <div className="space-y-4">
          {upcomingMeetings.length === 0 && !loading && (
            <div className="text-center py-20">
              <Video size={48} className="mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">No upcoming meetings</p>
              <button onClick={() => setShowSchedule(true)} className="mt-4 text-sm text-primary font-bold hover:underline">Schedule one now</button>
            </div>
          )}
          {upcomingMeetings.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              profiles={profiles}
              onJoin={() => startCall(m)}
              onStart={() => updateMeetingStatus(m.id, "ongoing")}
              onComplete={() => updateMeetingStatus(m.id, "completed")}
              onCancel={() => updateMeetingStatus(m.id, "cancelled")}
              onDelete={() => deleteMeeting(m.id)}
              canManage={isAdmin || isManager || m.created_by === profile?.id}
            />
          ))}
        </div>
      )}

      {tab === "past" && (
        <div className="space-y-4">
          {pastMeetings.length === 0 && !loading && (
            <div className="text-center py-20">
              <Calendar size={48} className="mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">No past meetings</p>
            </div>
          )}
          {pastMeetings.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              profiles={profiles}
              past
              onDelete={() => deleteMeeting(m.id)}
              canManage={isAdmin || isManager || m.created_by === profile?.id}
            />
          ))}
        </div>
      )}

      {tab === "calendar" && (
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className="p-2 hover:bg-muted rounded-xl"><ChevronLeft size={20} /></button>
            <h3 className="font-bold text-lg">{format(calendarMonth, "MMMM yyyy")}</h3>
            <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="p-2 hover:bg-muted rounded-xl"><ChevronRight size={20} /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider border-b">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-3">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: calendarDays[0]?.getDay() || 0 }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] border-b border-r p-1" />
            ))}
            {calendarDays.map((day) => {
              const dayMeetings = meetingsOnDay(day);
              return (
                <div key={day.toISOString()} className={cn("min-h-[100px] border-b border-r p-1.5 transition-colors", isToday(day) && "bg-primary/5")}>
                  <div className={cn("text-xs font-bold mb-1", isToday(day) ? "text-primary" : "text-muted-foreground")}>{format(day, "d")}</div>
                  {dayMeetings.slice(0, 3).map((m) => (
                    <div key={m.id} className={cn("text-[10px] px-1.5 py-0.5 rounded mb-0.5 truncate font-medium", m.status === "ongoing" ? "bg-green-500/20 text-green-600" : m.status === "completed" ? "bg-blue-500/20 text-blue-600" : "bg-primary/10 text-primary")}>
                      {m.title}
                    </div>
                  ))}
                  {dayMeetings.length > 3 && <div className="text-[10px] text-muted-foreground font-medium px-1">+{dayMeetings.length - 3} more</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Call Section */}
      {canStartCall && (
        <div className="mt-8">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Phone size={16} />
            Direct Call
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.filter((p) => p.id !== profile?.id).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                    {p.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{p.role}</div>
                  </div>
                </div>
                <button onClick={() => startDirectCall(p)} className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all active:scale-90">
                  <Phone size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {showSchedule && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setShowSchedule(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full lg:max-w-lg rounded-t-3xl lg:rounded-3xl border bg-card p-6 shadow-2xl max-h-[90dvh] overflow-y-auto animate-in slide-in-from-bottom-8 lg:slide-in-from-bottom-0 lg:zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black">Schedule Meeting</h2>
              <button onClick={() => setShowSchedule(false)} className="p-2 hover:bg-muted rounded-xl"><X size={20} /></button>
            </div>
            <form onSubmit={scheduleMeeting} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Title</label>
                <input required value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Weekly sync" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Description</label>
                <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Meeting agenda..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Date</label>
                  <input required type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Time</label>
                  <input required type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Duration</label>
                <select value={formDuration} onChange={(e) => setFormDuration(Number(e.target.value))} className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                  {[15, 30, 45, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>{m} minutes</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Branch</label>
                <select value={formBranch} onChange={(e) => { setFormBranch(e.target.value); setFormParticipants([]); }} className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="all">All Branches</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Invite Specific People (optional)</label>
                <div className="max-h-32 overflow-y-auto space-y-1.5 rounded-xl border p-2">
                  {profiles.filter((p) => formBranch === "all" || p.branch_id === formBranch).map((p) => (
                    <label key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer text-sm">
                      <input type="checkbox" checked={formParticipants.includes(p.id)} onChange={() => setFormParticipants((prev) => prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id])} className="rounded" />
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground text-xs ml-auto">{p.role}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all">
                Schedule Meeting
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Incoming Call Screen */}
      {incomingCall && profile && (
        <IncomingCallScreen
          callerName={incomingCall.callerName}
          callerId={incomingCall.callerId}
          roomId={incomingCall.roomId}
          onAccept={handleAcceptIncoming}
          onReject={handleRejectIncoming}
          onIgnore={handleIgnoreIncoming}
        />
      )}

      {/* Video Call Overlay */}
      {activeCall && profile && (
        <VideoCall
          roomId={activeCall.roomId}
          userId={profile.id}
          userName={profile.name}
          isDirect={activeCall.isDirect}
          calleeName={activeCall.calleeName}
          onEnd={() => setActiveCall(null)}
        />
      )}
    </div>
  );
}

function MeetingCard({
  meeting,
  profiles,
  onJoin,
  onStart,
  onComplete,
  onCancel,
  onDelete,
  canManage,
  past,
}: {
  meeting: Meeting;
  profiles: Profile[];
  onJoin?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  canManage?: boolean;
  past?: boolean;
}) {
  const meetingDate = new Date(meeting.scheduled_at);
  const isNow = meeting.status === "ongoing";
  const participantCount = profiles.length;

  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md", isNow && "ring-2 ring-green-500/30")}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shrink-0", isNow ? "bg-green-500/20 text-green-600" : past ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
            {isNow ? <Play size={22} /> : <Calendar size={22} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base truncate">{meeting.title}</h3>
              <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", meeting.status === "ongoing" ? "bg-green-500/20 text-green-600" : meeting.status === "completed" ? "bg-blue-500/20 text-blue-600" : meeting.status === "cancelled" ? "bg-red-500/20 text-red-600" : "bg-primary/10 text-primary")}>
                {meeting.status}
              </span>
            </div>
            {meeting.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{meeting.description}</p>}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                {isToday(meetingDate) ? "Today" : isTomorrow(meetingDate) ? "Tomorrow" : format(meetingDate, "MMM d, yyyy")}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} />
                {format(meetingDate, "h:mm a")} · {meeting.duration_minutes}m
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={14} />
                {participantCount} participants
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isNow && onJoin && (
            <button onClick={onJoin} className="flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-green-600 active:scale-95 transition-all shadow-lg shadow-green-500/30">
              <Video size={16} />
              Join
            </button>
          )}
          {!past && meeting.status === "scheduled" && (
            <>
              {onStart && canManage && (
                <button onClick={onStart} className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all active:scale-90" title="Start now">
                  <Play size={16} />
                </button>
              )}
              {onCancel && canManage && (
                <button onClick={onCancel} className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white transition-all active:scale-90" title="Cancel">
                  <Ban size={16} />
                </button>
              )}
            </>
          )}
          {past && meeting.status === "ongoing" && onComplete && canManage && (
            <button onClick={onComplete} className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white transition-all active:scale-90" title="Mark complete">
              <CheckCircle size={16} />
            </button>
          )}
          {canManage && (
            <button onClick={onDelete} className="p-2.5 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white transition-all active:scale-90" title="Delete">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
