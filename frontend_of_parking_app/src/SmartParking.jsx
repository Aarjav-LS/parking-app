import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, Grid3x3, Bell, Megaphone, MessageSquare, User, Settings,
  LogOut, Search, Moon, Sun, Menu, X, ChevronDown, ChevronRight, Car, Bike,
  Zap, Bike as Scooter, CheckCircle2, XCircle, AlertTriangle, Clock,
  TrendingUp, TrendingDown, Plus, Edit2, Trash2, Download, Filter, MapPin,
  Users as UsersIcon, BarChart3, FileText, Pin, Send, Eye, EyeOff, ArrowLeft,
  ChevronLeft, Activity, Calendar, MoreVertical, ShieldCheck, ParkingCircle,
  Building2, CircleAlert, PlayCircle, Sparkles, ClipboardList, RefreshCw
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import logoImg from "../../images/logo.png";
import { getSpots, getStatus, runDetection, getSettings, getAnalytics, getUsers, getVehicleLogs, API_BASE } from "./api.js";

/* ---------------------------------- data ---------------------------------- */

const CREDENTIALS = {
  user: { email: "user@college.edu", password: "user123", label: "user" },
  admin: { email: "admin@college.edu", password: "admin123", label: "admin" },
};

const ROWS = ["A", "B"];
const TYPES = ["Standard", "EV", "Accessible"];

function spotsToSlots(spots, status) {
  if (!spots || spots.length === 0) return [];
  const sorted = [...spots].sort((a, b) => {
    const ay = a.points.reduce((s, p) => s + p[1], 0) / a.points.length;
    const by = b.points.reduce((s, p) => s + p[1], 0) / b.points.length;
    if (ay !== by) return ay - by;
    const ax = a.points.reduce((s, p) => s + p[0], 0) / a.points.length;
    const bx = b.points.reduce((s, p) => s + p[0], 0) / b.points.length;
    return ax - bx;
  });
  const allY = sorted.flatMap(s => s.points.map(p => p[1]));
  const maxY = Math.max(...allY);
  const rowThreshold = maxY <= 1.0 ? 0.15 : 100;
  const rowGroups = [];
  let currentGroup = [sorted[0]];
  let currentAvgY = sorted[0].points.reduce((s, p) => s + p[1], 0) / sorted[0].points.length;
  for (let i = 1; i < sorted.length; i++) {
    const avgY = sorted[i].points.reduce((s, p) => s + p[1], 0) / sorted[i].points.length;
    if (avgY - currentAvgY < rowThreshold) {
      currentGroup.push(sorted[i]);
      currentAvgY = (currentAvgY * (currentGroup.length - 1) + avgY) / currentGroup.length;
    } else {
      rowGroups.push(currentGroup);
      currentGroup = [sorted[i]];
      currentAvgY = avgY;
    }
  }
  rowGroups.push(currentGroup);
  const slots = [];
  rowGroups.forEach((group, rowIdx) => {
    group.sort((a, b) => {
      const ax = a.points.reduce((s, p) => s + p[0], 0) / a.points.length;
      const bx = b.points.reduce((s, p) => s + p[0], 0) / b.points.length;
      return ax - bx;
    });
    const row = ROWS[rowIdx] || String.fromCharCode(65 + rowIdx);
    group.forEach((spot, colIdx) => {
      const colNum = colIdx + 1;
      const backendStatus = status[spot.id] || "available";
      const statusMap = { occupied: "occupied", available: "available", reserved: "reserved", unavailable: "unavailable" };
      slots.push({
        id: `${row}${colNum}`,
        row,
        num: colNum,
        status: statusMap[backendStatus] || "available",
        type: colNum % 5 === 0 ? "EV" : colNum % 7 === 0 ? "Accessible" : "Standard",
        floor: rowIdx + 1,
        spotId: spot.id,
        points: spot.points,
      });
    });
  });
  return slots;
}

function useBackendData() {
  const [spots, setSpots] = useState([]);
  const [status, setStatus] = useState({});
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function fetchAll() {
      try {
        const [spotsData, statusData] = await Promise.all([getSpots(), getStatus()]);
        if (!active) return;
        setSpots(spotsData);
        setStatus(statusData);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    setSlots(spotsToSlots(spots, status));
  }, [spots, status]);

  return { spots, status, slots, loading, error, setStatus, setSlots };
}

const seedVehicles = [
  { id: "V-1042", vehicle: "BA 2 PA 3312", owner: "Aarav Shrestha", type: "Car", entry: "08:12 AM", exit: "—", duration: "3h 20m", slot: "A3", status: "Parked" },
  { id: "V-1041", vehicle: "BA 4 CHA 9081", owner: "Priya Gurung", type: "Bike", entry: "07:55 AM", exit: "11:02 AM", duration: "3h 07m", slot: "C6", status: "Exited" },
  { id: "V-1040", vehicle: "BA 1 KHA 5521", owner: "Rohit Karki", type: "EV", entry: "09:20 AM", exit: "—", duration: "1h 50m", slot: "B5", status: "Parked" },
  { id: "V-1039", vehicle: "BA 9 PA 1187", owner: "Sneha Rai", type: "Scooter", entry: "08:40 AM", exit: "09:55 AM", duration: "1h 15m", slot: "D2", status: "Exited" },
  { id: "V-1038", vehicle: "BA 3 CHA 7742", owner: "Bikash Thapa", type: "Car", entry: "06:58 AM", exit: "—", duration: "4h 30m", slot: "A7", status: "Parked" },
  { id: "V-1037", vehicle: "BA 7 KHA 3390", owner: "Manisha Adhikari", type: "Bicycle", entry: "10:05 AM", exit: "—", duration: "0h 40m", slot: "F1", status: "Parked" },
];

const seedUsers = [
  { id: "U-201", name: "Aarav Shrestha", collegeId: "BCT-078-201", phone: "98XXXXXX12", vehicle: "BA 2 PA 3312", type: "Car", status: "Active" },
  { id: "U-202", name: "Priya Gurung", collegeId: "BCT-078-114", phone: "98XXXXXX45", vehicle: "BA 4 CHA 9081", type: "Bike", status: "Active" },
  { id: "U-203", name: "Rohit Karki", collegeId: "BEI-079-032", phone: "98XXXXXX76", vehicle: "BA 1 KHA 5521", type: "EV", status: "Active" },
  { id: "U-204", name: "Sneha Rai", collegeId: "BCE-077-098", phone: "98XXXXXX09", vehicle: "BA 9 PA 1187", type: "Scooter", status: "Disabled" },
];

const seedNotices = [
  { id: 1, title: "Row D closed for resurfacing", body: "Row D will be unavailable Aug 10–12 for surface repair work.", pinned: true, emergency: false, date: "Aug 5, 2026" },
  { id: 2, title: "VIP zone reserved for convocation", body: "Slots B1–B5 are reserved for guest vehicles on Aug 15.", pinned: true, emergency: false, date: "Aug 4, 2026" },
  { id: 3, title: "Emergency: fire lane must stay clear", body: "Row A entrance is a fire access lane — do not park temporarily even for pickup.", pinned: false, emergency: true, date: "Aug 2, 2026" },
];

const seedFeedback = [
  { id: 1, user: "Aarav Shrestha", category: "Slot issue", subject: "Faded slot marking on A3", description: "The paint on slot A3 is worn out and hard to see at night.", status: "Pending", date: "Aug 5" },
  { id: 2, user: "Priya Gurung", category: "App bug", subject: "Grid not updating live", description: "Slot C6 stayed occupied on screen after I left.", status: "In Review", date: "Aug 4" },
  { id: 3, user: "Manisha Adhikari", category: "Suggestion", subject: "More bicycle racks needed", description: "Row F fills up by 9 AM most days.", status: "Resolved", date: "Aug 1" },
];

function seedNotifications(slots) {
  const occupied = slots.filter((s) => s.status === "occupied").slice(0, 3);
  const available = slots.filter((s) => s.status === "available").slice(0, 2);
  const notifs = [];
  occupied.forEach((s, i) => {
    notifs.push({ id: Date.now() + i, text: `Slot ${s.id} marked occupied — vehicle entered`, time: "Just now", read: false, kind: "occupied" });
  });
  available.forEach((s, i) => {
    notifs.push({ id: Date.now() + i + 100, text: `Slot ${s.id} is now available`, time: "Just now", read: false, kind: "available" });
  });
  return notifs;
}

const pieColors = { Available: "#22C55E", Occupied: "#EF4444", Reserved: "#2563EB", Unavailable: "#6B7280" };
const weeklyOccupancy = [
  { day: "Mon", occ: 62 }, { day: "Tue", occ: 71 }, { day: "Wed", occ: 58 },
  { day: "Thu", occ: 80 }, { day: "Fri", occ: 88 }, { day: "Sat", occ: 40 }, { day: "Sun", occ: 22 },
];
const timelineData = [
  { t: "6a", occ: 10 }, { t: "8a", occ: 55 }, { t: "10a", occ: 78 }, { t: "12p", occ: 90 },
  { t: "2p", occ: 84 }, { t: "4p", occ: 70 }, { t: "6p", occ: 42 }, { t: "8p", occ: 18 },
];
const heatmapDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const heatmapHours = ["8a", "10a", "12p", "2p", "4p"];
const heatmapData = [
  [30, 60, 85, 78, 55], [35, 65, 90, 80, 60], [25, 50, 70, 68, 45],
  [40, 72, 95, 88, 65], [45, 80, 98, 92, 70],
];

/* --------------------------------- helpers -------------------------------- */

function cx(...a) { return a.filter(Boolean).join(" "); }

const STATUS_META = {
  available: { label: "Available", dot: "bg-green-600", bg: "bg-green-50 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", border: "border-green-200 dark:border-green-800", tile: "bg-green-600" },
  occupied: { label: "Occupied", dot: "bg-red-600", bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800", tile: "bg-red-600" },
  reserved: { label: "Reserved", dot: "bg-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", border: "border-yellow-200 dark:border-yellow-800", tile: "bg-yellow-500" },
  unavailable: { label: "Unavailable", dot: "bg-gray-400", bg: "bg-gray-100 dark:bg-slate-800", text: "text-gray-600 dark:text-gray-400", border: "border-gray-200 dark:border-slate-700", tile: "bg-gray-400" },
};

const VEHICLE_ICON = { Car, Bike, Scooter, EV: Zap, Bicycle: Bike, Other: Car };

function useSlotCounts(slots) {
  return useMemo(() => {
    const c = { available: 0, occupied: 0, reserved: 0, unavailable: 0 };
    slots.forEach((s) => { if (c[s.status] !== undefined) c[s.status] += 1; });
    return { ...c, total: slots.length };
  }, [slots]);
}

/* --------------------------------- atoms ---------------------------------- */

function Logo({ dark, size = "md" }) {
  const imgSize = size === "md" ? "w-36 h-36" : "w-28 h-28";
  return (
    <div className="flex items-center">
      <img src={logoImg} alt="SmartPark" className={cx("rounded-xl object-contain", imgSize)} />
    </div>
  );
}

function Badge({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300",
    green: "bg-green-50 text-green-500 dark:bg-green-900/30 dark:text-green-400",
    red: "bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  };
  return <span className={cx("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", tones[tone])}>{children}</span>;
}

function StatusBadge({ status }) {
  const map = {
    Pending: "amber", "In Review": "blue", Resolved: "green", Closed: "gray",
    Active: "green", Disabled: "gray", Parked: "blue", Exited: "gray",
  };
  return <Badge tone={map[status] || "gray"}>{status}</Badge>;
}

function IconBtn({ icon: Icon, onClick, label, active }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cx(
        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 border",
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
      )}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

function ThemeToggle({ dark, setDark }) {
  return (
    <button
      onClick={() => setDark(!dark)}
      aria-label="Toggle theme"
      className="relative inline-flex h-7 w-12 items-center rounded-full bg-gray-200 dark:bg-slate-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
    >
      <span className="sr-only">Toggle theme</span>
      <span
        className={cx(
          "inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200",
          dark ? "translate-x-6" : "translate-x-1"
        )}
      >
        {dark ? (
          <svg className="h-3.5 w-3.5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )}
      </span>
    </button>
  );
}

function StatCard({ label, value, icon: Icon, tone, trend }) {
  const tones = {
    blue: "bg-[#1E40AF]",
    green: "bg-[#22C55E]",
    red: "bg-[#FCA5A5]",
    gray: "bg-[#64748B]",
    reserved: "bg-[#93C5FD]",
  };
  const isLightBg = tone === "red" || tone === "reserved";
  const textPrimary = isLightBg ? "text-gray-900" : "text-white";
  const textSecondary = isLightBg ? "text-gray-700" : "text-white/80";
  const textMuted = isLightBg ? "text-gray-800" : "text-white/80";
  const subtext = label.toLowerCase();
  return (
    <div className={cx("rounded-2xl p-5 shadow-sm transition-all duration-300", tones[tone] || tones.blue)}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className={cx("text-xs font-medium uppercase tracking-wider", textMuted)}>{label}</span>
          <span className={cx("text-4xl font-bold mt-1 leading-none", textPrimary)}>{value}</span>
          <span className={cx("text-sm mt-1.5", textSecondary)}>{subtext}</span>
        </div>
        <Icon className="w-12 h-12 text-white" />
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      {Object.entries(STATUS_META).map(([k, m]) => (
        <div key={k} className="flex items-center gap-1.5">
          <span className={cx("w-2.5 h-2.5 rounded-full", m.dot)} />
          <span className="text-gray-600 dark:text-gray-400">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={cx("bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-h-[85vh] overflow-y-auto", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-all duration-200";

/* ------------------------------- slot grid --------------------------------- */

function SlotGrid({ slots, onSlotClick, selectable }) {
  const grouped = useMemo(() => {
    const g = {};
    ROWS.forEach((r) => (g[r] = slots.filter((s) => s.row === r)));
    return g;
  }, [slots]);

  return (
    <div className="space-y-4">
      {ROWS.map((row) => (
        <div key={row} className="flex items-center gap-3">
          <div className="w-7 shrink-0 text-sm font-semibold text-gray-500 dark:text-gray-400">{row}</div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 flex-1">
            {grouped[row].map((slot) => {
              const meta = STATUS_META[slot.status];
              return (
                <button
                  key={slot.id}
                  onClick={() => onSlotClick && onSlotClick(slot)}
                  className={cx(
                    "aspect-square rounded-xl border flex flex-col items-center justify-center text-xs font-medium transition-all duration-200",
                    meta.bg, meta.text, meta.border,
                    selectable && "hover:scale-105 hover:shadow-md cursor-pointer"
                  )}
                  title={`${slot.id} · ${meta.label}`}
                >
                  <span className="font-semibold">{slot.id}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- top bar ---------------------------------- */

function TopBar({ dark, setDark, onLogout, title, role }) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 py-4 bg-white/80 dark:bg-slate-900 backdrop-blur-md border-b border-gray-100 dark:border-slate-800">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input placeholder="Search…" className="pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-700 dark:text-gray-200 w-56 focus:outline-none focus:ring-2 focus:ring-blue-600/30" />
        </div>
        <ThemeToggle dark={dark} setDark={setDark} />
        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-medium text-sm">
          {role === "admin" ? "AD" : "AS"}
        </div>
        <IconBtn icon={LogOut} onClick={onLogout} label="Logout" />
      </div>
    </div>
  );
}

/* --------------------------------- sidebar ---------------------------------- */

function Sidebar({ items, active, setActive, collapsed, setCollapsed, dark }) {
  return (
    <div className={cx(
      "hidden lg:flex flex-col shrink-0 bg-white dark:bg-blue-950 border-r border-gray-100 dark:border-blue-900 transition-all duration-300",
      collapsed ? "w-20" : "w-64"
    )}>
      <div className="h-16 flex items-center px-5 border-b border-gray-100 dark:border-blue-900">
        {collapsed ? <Logo dark={dark} size="sm" /> : <Logo dark={dark} />}
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => setActive(item.key)}
            className={cx(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200",
              active === item.key
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 dark:text-blue-100 hover:bg-gray-50 dark:hover:bg-blue-900"
            )}
          >
            <item.icon className="w-4.5 h-4.5 w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="m-3 h-10 rounded-xl border border-gray-200 dark:border-blue-800 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-blue-900"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </div>
  );
}

function MobileBottomNav({ items, active, setActive }) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-blue-950 border-t border-gray-100 dark:border-blue-900 flex items-center justify-around px-1 py-2">
      {items.slice(0, 5).map((item) => (
        <button
          key={item.key}
          onClick={() => setActive(item.key)}
          className={cx("flex flex-col items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium",
            active === item.key ? "text-blue-600" : "text-gray-400")}
        >
          <item.icon className="w-5 h-5" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ================================ LANDING ================================= */

function LandingPage({ slots, goto }) {
  const counts = useSlotCounts(slots);
  const stats = [
    { label: "Total slots", value: counts.total, icon: Grid3x3, tone: "blue" },
    { label: "Available", value: counts.available, icon: CheckCircle2, tone: "green" },
    { label: "Occupied", value: counts.occupied, icon: XCircle, tone: "red" },
    { label: "Unavailable", value: counts.unavailable, icon: AlertTriangle, tone: "gray" },
  ];
  const [showGrid, setShowGrid] = useState(false);

  const features = [
    { icon: Activity, title: "Live slot status", body: "Real-time counts and grid updates the moment a vehicle enters or exits." },
    { icon: ShieldCheck, title: "Admin-verified holds", body: "Emergency and VIP reservations are set only by campus admins — never a free-for-all." },
    { icon: BarChart3, title: "Usage insights", body: "Peak-hour and occupancy analytics help the college plan capacity ahead of time." },
    { icon: Megaphone, title: "Campus notices", body: "Closures, resurfacing, and VIP zones are posted straight to your dashboard." },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setShowGrid(true)} className="hidden sm:inline-flex text-sm font-medium text-gray-600 dark:text-gray-300 px-3 py-2 hover:text-blue-600">
              Continue as visitor
            </button>
            <button onClick={() => goto("login", "user")} className="text-sm font-medium text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors duration-200">
              User login
            </button>
            <button onClick={() => goto("login", "admin")} className="text-sm font-medium text-white px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors duration-200 shadow-sm">
              Admin login
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 pt-16 pb-12 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium mb-5">
            <Sparkles className="w-3.5 h-3.5" /> Live on campus now
          </span>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900 dark:text-white leading-tight">
            Find campus parking <span className="text-blue-600">before you drive in.</span>
          </h1>
          <p className="mt-5 text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
            See real-time slot availability across the college lot, get notified when a spot opens up, and skip the loop around the block.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => setShowGrid(true)} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors duration-200 shadow-sm">
              <PlayCircle className="w-4.5 h-4.5" /> View live parking
            </button>
            <button onClick={() => goto("register")} className="px-5 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors duration-200">
              Register as a user
            </button>
          </div>
          <div className="mt-10 grid grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="rounded-3xl bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-900 border border-gray-100 dark:border-slate-800 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Live campus lot</p>
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
              </span>
            </div>
            <SlotGrid slots={slots.slice(0, 30)} />
            <div className="mt-6"><Legend /></div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-8">Built for how the college actually parks</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <div key={f.title} className="p-5 rounded-2xl border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow duration-300 bg-white dark:bg-slate-900">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1.5">{f.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <p className="text-sm text-gray-400">© 2026 College Smart Parking. All rights reserved.</p>
          <div className="flex gap-5 text-sm text-gray-500 dark:text-gray-400">
            <button onClick={() => goto("login", "user")} className="hover:text-blue-600">User login</button>
            <button onClick={() => goto("login", "admin")} className="hover:text-blue-600">Admin login</button>
          </div>
        </div>
      </footer>

      {showGrid && (
        <Modal title="Live parking — visitor view" onClose={() => setShowGrid(false)} wide>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {stats.map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900 text-center">
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
          <SlotGrid slots={slots} />
          <div className="mt-6"><Legend /></div>
        </Modal>
      )}
    </div>
  );
}

/* ================================= LOGIN =================================== */

function LoginPage({ goto, defaultRole, onLogin }) {
  const [role, setRole] = useState(defaultRole || "user");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const cred = CREDENTIALS[role];
    if (email === cred.email && password === cred.password) {
      onLogin && onLogin(role);
      goto(role === "admin" ? "admin" : "user");
    } else {
      setError("Invalid email or password. Please try again.");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white dark:bg-slate-950">
      <div className="hidden lg:flex flex-col justify-between bg-blue-600 p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-10 -left-10 w-72 h-72 rounded-full bg-white" />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-white" />
        </div>
        <div className="relative">
          <Logo dark />
        </div>
        <div className="relative">
          <ParkingCircle className="w-20 h-20 text-white/90 mb-6" />
          <h2 className="text-3xl font-semibold text-white leading-tight">Every slot,<br />accounted for.</h2>
          <p className="text-blue-100 mt-4 max-w-sm">Sign in to see live availability, get real-time alerts, and manage your parking profile.</p>
        </div>
        <p className="relative text-blue-100 text-sm">© 2026 College Smart Parking</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <button onClick={() => goto("landing")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-8">
            <ArrowLeft className="w-4 h-4" /> Back to visitor
          </button>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Sign in to continue to your dashboard.</p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex mb-6 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
            {["user", "admin"].map((r) => (
              <button
                key={r}
                onClick={() => { setRole(r); setError(""); }}
                className={cx(
                  "flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors duration-200",
                  role === r ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-gray-500 dark:text-gray-400"
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <Field label={role === "admin" ? "Admin ID" : "Email or college ID"}>
              <input
                required
                className={inputCls}
                placeholder={role === "admin" ? "admin@college.edu" : "name@college.edu"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input
                  required
                  type={showPw ? "text" : "password"}
                  className={cx(inputCls, "pr-10")}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <div className="flex items-center justify-between mb-6 text-sm">
              <label className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <input type="checkbox" className="rounded border-gray-300" /> Remember me
              </label>
              <button type="button" className="text-blue-600 font-medium hover:underline">Forgot password?</button>
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors duration-200 shadow-sm">
              Sign in as {role}
            </button>
          </form>

          <div className="mt-6 p-3 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs text-gray-500 dark:text-gray-400">
            <p className="font-semibold mb-1">Demo credentials:</p>
            <p>User: user@college.edu / user123</p>
            <p>Admin: admin@college.edu / admin123</p>
          </div>

          {role === "user" && (
            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              New here? <button onClick={() => goto("register")} className="text-blue-600 font-medium hover:underline">Create an account</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== REGISTRATION =============================== */

function RegisterPage({ goto }) {
  const [vehicleType, setVehicleType] = useState("Car");
  const [form, setForm] = useState({ name: "", collegeId: "", phone: "", vehicle: "", email: "" });
  const [submitted, setSubmitted] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await registerUser({ ...form, type: vehicleType });
      setSubmitted(true);
      setTimeout(() => goto("login", "user"), 1500);
    } catch (err) {
      console.error(err);
    }
  };
  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm p-8">
        <button onClick={() => goto("login", "user")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </button>
        <Logo size="sm" />
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mt-5 mb-1">Create your account</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Register with your college ID and vehicle details.</p>

        {submitted && (
          <div className="mb-4 p-3 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400">
            Registration successful! Redirecting to login…
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Full name"><input required className={inputCls} placeholder="Aarav Shrestha" value={form.name} onChange={(e) => update("name", e.target.value)} /></Field>
            <Field label="College ID"><input required className={inputCls} placeholder="BCT-078-201" value={form.collegeId} onChange={(e) => update("collegeId", e.target.value)} /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Phone number"><input required className={inputCls} placeholder="98XXXXXXXX" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
            <Field label="Vehicle number"><input required className={inputCls} placeholder="BA 2 PA 3312" value={form.vehicle} onChange={(e) => update("vehicle", e.target.value)} /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Vehicle type">
              <select className={inputCls} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                {["Car", "Bike", "Scooter", "Bicycle", "EV", "Other"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Email"><input required className={inputCls} placeholder="name@college.edu" value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
          </div>
          <Field label="Description (optional)">
            <textarea className={cx(inputCls, "min-h-[80px] resize-none")} placeholder="Any notes about your vehicle" />
          </Field>
          <button type="submit" className="w-full mt-2 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors duration-200 shadow-sm">
            Create account
          </button>
        </form>
      </div>
    </div>
  );
}

/* =============================== USER DASHBOARD ============================= */

const USER_NAV = [
  { key: "overview", label: "Dashboard", icon: LayoutDashboard },
  { key: "layout", label: "Parking layout", icon: Grid3x3 },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "notices", label: "Notice board", icon: Megaphone },
  { key: "feedback", label: "Feedback", icon: MessageSquare },
  { key: "profile", label: "Profile", icon: User },
  { key: "settings", label: "Settings", icon: Settings },
];

function UserDashboard({ slots, notifications, setNotifications, notices, feedback, setFeedback, dark, setDark, goto }) {
  const [section, setSection] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [floorFilter, setFloorFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");

  const counts = useSlotCounts(slots);

  const filteredSlots = useMemo(() => slots.filter((s) =>
    (floorFilter === "all" || s.floor === Number(floorFilter)) &&
    (typeFilter === "all" || s.type === typeFilter) &&
    (query === "" || s.id.toLowerCase().includes(query.toLowerCase()))
  ), [slots, floorFilter, typeFilter, query]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const [userAnalytics, setUserAnalytics] = useState(null);
  const [userAnalyticsLoading, setUserAnalyticsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchAnalytics() {
      try {
        const data = await getAnalytics();
        if (active) setUserAnalytics(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setUserAnalyticsLoading(false);
      }
    }
    fetchAnalytics();
    return () => { active = false; };
  }, []);

  const titleMap = {
    overview: "Dashboard", layout: "Parking layout", notifications: "Notifications",
    notices: "Notice board", feedback: "Feedback & complaints", profile: "Profile", settings: "Settings",
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-slate-950">
      <Sidebar items={USER_NAV} active={section} setActive={setSection} collapsed={collapsed} setCollapsed={setCollapsed} dark={dark} />
      <div className="flex-1 min-w-0 pb-16 lg:pb-0">
        <TopBar dark={dark} setDark={setDark} onLogout={() => goto("landing")} title={titleMap[section]} role="user" />
        <div className="p-6 max-w-6xl mx-auto">

          {section === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard label="Total slots" value={counts.total} icon={Grid3x3} tone="blue" />
                <StatCard label="Available" value={counts.available} icon={CheckCircle2} tone="green" trend={4} />
                <StatCard label="Occupied" value={counts.occupied} icon={XCircle} tone="red" trend={-2} />
                <StatCard label="Unavailable" value={counts.unavailable} icon={AlertTriangle} tone="gray" />
                <StatCard label="Reserved" value={counts.reserved} icon={ShieldCheck} tone="blue" />
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-medium text-gray-900 dark:text-white">Live layout preview</h3>
                  <button onClick={() => setSection("layout")} className="text-sm text-blue-600 font-medium hover:underline">View full layout</button>
                </div>
                <SlotGrid slots={slots.slice(0, 30)} />
                <div className="mt-5"><Legend /></div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Recent notifications</h3>
                <div className="space-y-3">
                  {notifications.slice(0, 3).map((n) => (
                    <div key={n.id} className="flex items-start gap-3 text-sm">
                      <span className={cx("w-2 h-2 rounded-full mt-1.5 shrink-0", n.read ? "bg-gray-300" : "bg-blue-600")} />
                      <div>
                        <p className="text-gray-700 dark:text-gray-300">{n.text}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Occupancy indicator</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Current occupancy</span>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{counts.total > 0 ? Math.round((counts.occupied / counts.total) * 100) : 0}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 dark:bg-slate-700">
                    <div className="h-3 rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${counts.total > 0 ? (counts.occupied / counts.total) * 100 : 0}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-xl bg-gray-50 dark:bg-slate-900">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{counts.occupied}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Occupied</p>
                    </div>
                    <div className="p-2 rounded-xl bg-gray-50 dark:bg-slate-900">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{counts.available}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Available</p>
                    </div>
                    <div className="p-2 rounded-xl bg-gray-50 dark:bg-slate-900">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{counts.total}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Hourly occupancy heatmap</h3>
                  {userAnalyticsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                      <span className="text-sm text-gray-500">Loading analytics…</span>
                    </div>
                  ) : userAnalytics && userAnalytics.heatmap ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={userAnalytics.hourly || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                          <Tooltip formatter={(value) => [`${value}%`, 'Occupancy']} />
                          <Bar dataKey="occupancy" barSize={24} radius={[4, 4, 0, 0]}>
                            {(userAnalytics.hourly || []).map((item) => {
                              const fill = item.occupancy > 75 ? '#EF4444' : item.occupancy > 40 ? '#F59E0B' : '#22C55E';
                              return <Cell key={item.hour} fill={fill} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8 text-sm text-gray-400">No analytics data available yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {section === "layout" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-sm">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search slot, e.g. A3" className="pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-600/30" />
                </div>
                <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-sm">
                  <option value="all">All floors</option>
                  <option value="1">Floor 1</option>
                  <option value="2">Floor 2</option>
                </select>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-sm">
                  <option value="all">All types</option>
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
                <SlotGrid slots={filteredSlots} onSlotClick={setSelectedSlot} selectable />
                <div className="mt-6"><Legend /></div>
              </div>
            </div>
          )}

          {section === "notifications" && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">{unreadCount} unread</p>
                <div className="flex gap-3">
                  <button onClick={() => setNotifications(notifications.map((n) => ({ ...n, read: true })))} className="text-sm text-blue-600 font-medium hover:underline">Mark all read</button>
                  <button onClick={() => setNotifications([])} className="text-sm text-gray-500 font-medium hover:underline">Clear all</button>
                </div>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {notifications.length === 0 && <p className="p-8 text-center text-sm text-gray-400">No notifications.</p>}
                {notifications.map((n) => {
                  const iconMap = { occupied: XCircle, available: CheckCircle2, notice: Megaphone, reserved: ShieldCheck };
                  const Icon = iconMap[n.kind] || Bell;
                  return (
                    <div key={n.id} className={cx("flex items-start gap-3 p-5", !n.read && "bg-blue-50/50 dark:bg-blue-900/10")}>
                      <div className={cx("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", STATUS_META[n.kind]?.bg || "bg-gray-100 dark:bg-slate-700", STATUS_META[n.kind]?.text || "text-gray-500")}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-800 dark:text-gray-200">{n.text}</p>
                        <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                      </div>
                      <button onClick={() => setNotifications(notifications.filter((x) => x.id !== n.id))} className="text-gray-300 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {section === "notices" && (
            <div className="space-y-4">
              {notices.map((n) => (
                <div key={n.id} className={cx("bg-white dark:bg-slate-800 rounded-2xl border p-5 shadow-sm", n.emergency ? "border-red-200 dark:border-red-800" : "border-gray-100 dark:border-slate-700")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {n.pinned && <Pin className="w-4 h-4 text-blue-600" />}
                      {n.emergency && <Badge tone="red">Emergency</Badge>}
                      <h3 className="font-medium text-gray-900 dark:text-white">{n.title}</h3>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{n.date}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{n.body}</p>
                </div>
              ))}
            </div>
          )}

          {section === "feedback" && (
            <FeedbackSection feedback={feedback} setFeedback={setFeedback} userView />
          )}

          {section === "profile" && <ProfileSection />}
          {section === "settings" && <SettingsSection />}
        </div>
      </div>

      {selectedSlot && (
        <Modal title={`Slot ${selectedSlot.id}`} onClose={() => setSelectedSlot(null)}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Status</span><Badge tone={{ available: "green", occupied: "red", reserved: "blue", unavailable: "gray" }[selectedSlot.status]}>{STATUS_META[selectedSlot.status].label}</Badge></div>
            <div className="flex justify-between"><span className="text-gray-500">Floor</span><span className="text-gray-800 dark:text-gray-200">{selectedSlot.floor}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-gray-800 dark:text-gray-200">{selectedSlot.type}</span></div>
            <p className="text-xs text-gray-400 pt-2 border-t border-gray-100 dark:border-slate-700">Slot booking isn't available to users — reserved and emergency holds are set by campus admins only.</p>
          </div>
        </Modal>
      )}
      <MobileBottomNav items={USER_NAV} active={section} setActive={setSection} />
    </div>
  );
}

function FeedbackSection({ feedback, setFeedback, userView, onReply }) {
  const [form, setForm] = useState({ category: "Slot issue", subject: "", description: "" });
  return (
    <div className="space-y-6">
      {userView && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.subject) return;
            setFeedback([{ id: Date.now(), user: "Aarav Shrestha", ...form, status: "Pending", date: "Today" }, ...feedback]);
            setForm({ category: "Slot issue", subject: "", description: "" });
          }}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm"
        >
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">Submit feedback</h3>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Category">
              <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {["Slot issue", "App bug", "Suggestion", "Other"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Subject">
              <input required className={inputCls} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Short summary" />
            </Field>
          </div>
          <Field label="Description">
            <textarea className={cx(inputCls, "min-h-[90px] resize-none")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue" />
          </Field>
          <Field label="Attachment (optional)">
            <input type="file" className="text-sm text-gray-500 dark:text-gray-400" />
          </Field>
          <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors duration-200 shadow-sm">
            Submit feedback
          </button>
        </form>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-slate-700">
          <h3 className="font-medium text-gray-900 dark:text-white">{userView ? "Your submissions" : "All feedback"}</h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {feedback.map((f) => (
            <div key={f.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  {!userView && <p className="text-xs text-gray-400 mb-0.5">{f.user}</p>}
                  <p className="font-medium text-sm text-gray-900 dark:text-white">{f.subject}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{f.category} · {f.date}</p>
                </div>
                <StatusBadge status={f.status} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{f.description}</p>
              {!userView && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {["Pending", "In Review", "Resolved", "Closed"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setFeedback(feedback.map((x) => x.id === f.id ? { ...x, status: s } : x))}
                      className={cx("text-xs px-2.5 py-1 rounded-lg border", f.status === s ? "border-blue-600 text-blue-600" : "border-gray-200 dark:border-slate-700 text-gray-500")}
                    >
                      {s}
                    </button>
                  ))}
                  <button onClick={() => setFeedback(feedback.filter((x) => x.id !== f.id))} className="ml-auto text-xs text-red-500 flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileSection() {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: "Aarav Shrestha",
    collegeId: "BCT-078-201",
    phone: "98XXXXXX12",
    vehicle: "BA 2 PA 3312",
    type: "Car",
    model: "Hyundai i20",
  });

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = (e) => {
    e.preventDefault();
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm text-center">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-medium mb-4">
          {form.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <p className="font-medium text-gray-900 dark:text-white">{form.name}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{form.collegeId}</p>
        <Badge tone="green">Active</Badge>
        <div className="mt-4">
          <button
            onClick={() => setEditing(!editing)}
            className={cx(
              "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
              editing
                ? "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            <Edit2 className="w-4 h-4" /> {editing ? "Cancel" : "Edit profile"}
          </button>
        </div>
        {saved && (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400 font-medium">Profile updated successfully.</p>
        )}
      </div>
      <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">Personal & vehicle details</h3>
        <form onSubmit={handleSave}>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Full name">
              <input
                className={inputCls}
                value={form.name}
                disabled={!editing}
                onChange={(e) => update("name", e.target.value)}
              />
            </Field>
            <Field label="College ID">
              <input
                className={inputCls}
                value={form.collegeId}
                disabled={!editing}
                onChange={(e) => update("collegeId", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Phone">
              <input
                className={inputCls}
                value={form.phone}
                disabled={!editing}
                onChange={(e) => update("phone", e.target.value)}
              />
            </Field>
            <Field label="Vehicle number">
              <input
                className={inputCls}
                value={form.vehicle}
                disabled={!editing}
                onChange={(e) => update("vehicle", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Vehicle type">
              <select
                className={inputCls}
                value={form.type}
                disabled={!editing}
                onChange={(e) => update("type", e.target.value)}
              >
                {["Car","Bike","Scooter","Bicycle","EV","Other"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Vehicle model">
              <input
                className={inputCls}
                value={form.model}
                disabled={!editing}
                onChange={(e) => update("model", e.target.value)}
              />
            </Field>
          </div>
          <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Notification preferences</p>
            {["Slot availability alerts", "Notice board updates", "Feedback status updates"].map((p) => (
              <label key={p} className="flex items-center justify-between py-2 text-sm text-gray-600 dark:text-gray-400">
                {p}
                <input type="checkbox" defaultChecked className="rounded border-gray-300" />
              </label>
            ))}
          </div>
          {editing && (
            <button type="submit" className="mt-4 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors duration-200">
              Save changes
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function SettingsSection() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm max-w-lg space-y-1">
      <h3 className="font-medium text-gray-900 dark:text-white mb-3">Preferences</h3>
      {["Email notifications", "Push notifications", "Two-factor authentication"].map((s) => (
        <label key={s} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-700 last:border-0 text-sm text-gray-600 dark:text-gray-400">
          {s}
          <input type="checkbox" className="rounded border-gray-300" />
        </label>
      ))}
    </div>
  );
}

/* ================================ ADMIN DASHBOARD ============================ */

const ADMIN_NAV = [
  { key: "overview", label: "Dashboard", icon: LayoutDashboard },
  { key: "layout", label: "Parking layout", icon: Grid3x3 },
  { key: "users", label: "Users", icon: UsersIcon },
  { key: "vehicles", label: "Vehicle logs", icon: Car },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "reports", label: "Reports", icon: FileText },
  { key: "notices", label: "Notifications", icon: Bell },
  { key: "feedback", label: "Feedback", icon: MessageSquare },
  { key: "settings", label: "Settings", icon: Settings },
];

function AdminDashboard({ slots, setSlots, users, setUsers, notices, setNotices, feedback, setFeedback, dark, setDark, goto, status, setStatus, activityLog, setActivityLog, detectLoading, onRunDetection, vehicles, setVehicles }) {
  const [section, setSection] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [editSlot, setEditSlot] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchAnalytics() {
      try {
        const data = await getAnalytics();
        if (active) {
          setAnalytics(data);
          setAnalyticsLoading(false);
        }
      } catch (err) {
        if (active) setAnalyticsLoading(false);
      }
    }
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [status]);

  const counts = useSlotCounts(slots);
  const occupancyPct = counts.total > 0 ? Math.round((counts.occupied / counts.total) * 100) : 0;
  const availableCount = counts.available;
  const occupiedCount = counts.occupied;

  const titleMap = {
    overview: "Dashboard", layout: "Parking layout", users: "User management", vehicles: "Vehicle logs",
    analytics: "Analytics", reports: "Reports", notices: "Notification management", feedback: "Feedback management", settings: "Settings",
  };

  const pieData = analytics ? analytics.slotDistribution : [
    { name: "Available", value: counts.available }, { name: "Occupied", value: counts.occupied },
    { name: "Reserved", value: counts.reserved }, { name: "Unavailable", value: counts.unavailable },
  ];
  const rowBarData = analytics ? analytics.rowOccupancy : ROWS.map((r) => ({ row: r, occupied: slots.filter((s) => s.row === r && s.status === "occupied").length }));

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-slate-950">
      <Sidebar items={ADMIN_NAV} active={section} setActive={setSection} collapsed={collapsed} setCollapsed={setCollapsed} dark={dark} />
      <div className="flex-1 min-w-0 pb-16 lg:pb-0">
        <TopBar dark={dark} setDark={setDark} onLogout={() => goto("landing")} title={titleMap[section]} role="admin" />
        <div className="p-6 max-w-6xl mx-auto">

          {section === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total slots" value={counts.total} icon={Grid3x3} tone="blue" />
                <StatCard label="Available" value={counts.available} icon={CheckCircle2} tone="green" />
                <StatCard label="Occupied" value={counts.occupied} icon={XCircle} tone="red" />
                <StatCard label="Occupancy" value={`${occupancyPct}%`} icon={Activity} tone="gray" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Reserved" value={counts.reserved} icon={ShieldCheck} tone="blue" />
                <StatCard label="Unavailable" value={counts.unavailable} icon={AlertTriangle} tone="gray" />
                <StatCard label="Active vehicles" value={occupiedCount} icon={Car} tone="blue" />
                <StatCard label="Last update" value="Live" icon={RefreshCw} tone="green" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onRunDetection}
                  disabled={detectLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors duration-200 shadow-sm disabled:opacity-50"
                >
                  {detectLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                  {detectLoading ? "Detecting…" : "Run Detection"}
                </button>
                <button
                  onClick={() => setSection("layout")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors duration-200"
                >
                  <Grid3x3 className="w-4 h-4" /> View Layout
                </button>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-white">Live activity</h3>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
                  </span>
                </div>
                {activityLog.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">No recent activity. Run detection to see live updates.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {activityLog.slice(0, 10).map((a) => (
                      <div key={a.id} className="flex items-start gap-2 text-sm">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${a.kind === "occupied" ? "bg-red-500" : a.kind === "available" ? "bg-green-500" : "bg-blue-500"}`} />
                        <span className="text-gray-600 dark:text-gray-300">{a.text}</span>
                        <span className="text-xs text-gray-400 shrink-0">{a.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Live layout</h3>
                  <SlotGrid slots={slots.slice(0, 30)} />
                  <div className="mt-5"><Legend /></div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">Peak hours</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Busiest window today</p>
                  <p className="text-3xl font-semibold text-blue-600">11 AM – 1 PM</p>
                  <div className="mt-6 space-y-3">
                    {[{ l: "Morning (7–10a)", v: 62 }, { l: "Midday (11a–2p)", v: 91 }, { l: "Evening (3–6p)", v: 70 }].map((x) => (
                      <div key={x.l}>
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1"><span>{x.l}</span><span>{x.v}%</span></div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-700"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${x.v}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === "layout" && (
            <AdminLayoutSection slots={slots} setSlots={setSlots} editSlot={editSlot} setEditSlot={setEditSlot} />
          )}

          {section === "users" && <UsersSection users={users} setUsers={setUsers} />}

          {section === "vehicles" && <VehicleLogsSection vehicles={vehicles} />}

          {section === "analytics" && (
            <div className="space-y-6">
              {analyticsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                  <span className="text-gray-500">Loading analytics...</span>
                </div>
              ) : (
                <>
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-4">Slot state distribution</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                            {pieData.map((d) => <Cell key={d.name} fill={pieColors[d.name] || "#6B7280"} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-3"><Legend /></div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-4">Occupied slots by row</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={rowBarData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis dataKey="row" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="occupied" fill="#2563EB" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-4">Occupancy timeline (today)</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={analytics ? analytics.timeline : []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} domain={[0, 'auto']} />
                        <Tooltip />
                        <Line type="monotone" dataKey="occupied" stroke="#2563EB" strokeWidth={2.5} dot={false} name="Occupied" />
                        <Line type="monotone" dataKey="available" stroke="#22C55E" strokeWidth={2.5} dot={false} name="Available" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-4">Weekly occupancy</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={analytics ? analytics.weekly : []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="occ" fill="#22C55E" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-4">Usage density heatmap</h3>
                      {analytics && analytics.heatmap ? (
                        <div className="grid" style={{ gridTemplateColumns: `40px repeat(${analytics.heatmap.hours.length}, 1fr)` }}>
                          <div />
                          {analytics.heatmap.hours.map((h) => <div key={h} className="text-xs text-gray-400 text-center pb-1">{h}</div>)}
                          {analytics.heatmap.days.map((d, r) => (
                            <React.Fragment key={d}>
                              <div className="text-xs text-gray-400 flex items-center">{d}</div>
                              {analytics.heatmap.data[r].map((v, c) => (
                                <div key={c} className="aspect-square rounded-md m-0.5" style={{ backgroundColor: `rgba(37,99,235,${Math.min(1, Math.max(0.15, v / 100))})` }} title={`${v}%`} />
                              ))}
                            </React.Fragment>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">No heatmap data available.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {section === "reports" && <ReportsSection />}

          {section === "notices" && <NoticesSection notices={notices} setNotices={setNotices} />}

          {section === "feedback" && <FeedbackSection feedback={feedback} setFeedback={setFeedback} userView={false} />}

          {section === "settings" && <SettingsSection />}
        </div>
      </div>
      <MobileBottomNav items={ADMIN_NAV} active={section} setActive={setSection} />
    </div>
  );
}

function AdminLayoutSection({ slots, setSlots, editSlot, setEditSlot }) {
  const counts = useSlotCounts(slots);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Available" value={counts.available} icon={CheckCircle2} tone="green" />
        <StatCard label="Occupied" value={counts.occupied} icon={XCircle} tone="red" />
        <StatCard label="Reserved" value={counts.reserved} icon={ShieldCheck} tone="blue" />
        <StatCard label="Unavailable" value={counts.unavailable} icon={AlertTriangle} tone="gray" />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Click any slot to override its status.</p>
          <button
            onClick={() => {
              const nextRow = ROWS[ROWS.length - 1];
              const rowSlots = slots.filter((s) => s.row === nextRow);
              const num = rowSlots.length + 1;
              setSlots([...slots, { id: `${nextRow}${num}`, row: nextRow, num, status: "available", type: "Standard", floor: 2 }]);
            }}
            className="inline-flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors duration-200"
          >
            <Plus className="w-4 h-4" /> Add slot
          </button>
        </div>
        <SlotGrid slots={slots} onSlotClick={setEditSlot} selectable />
        <div className="mt-6"><Legend /></div>
      </div>

      {editSlot && (
        <Modal title={`Manage slot ${editSlot.id}`} onClose={() => setEditSlot(null)}>
          <div className="space-y-4">
            <Field label="Status">
              <select
                className={inputCls}
                defaultValue={editSlot.status}
                onChange={(e) => setSlots(slots.map((s) => s.id === editSlot.id ? { ...s, status: e.target.value } : s))}
              >
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved / emergency</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900"><p className="text-gray-400 text-xs">Floor</p><p className="text-gray-800 dark:text-gray-200 font-medium">{editSlot.floor}</p></div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900"><p className="text-gray-400 text-xs">Type</p><p className="text-gray-800 dark:text-gray-200 font-medium">{editSlot.type}</p></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditSlot(null)} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors duration-200">Save</button>
              <button
                onClick={() => { setSlots(slots.filter((s) => s.id !== editSlot.id)); setEditSlot(null); }}
                className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function UsersSection({ users, setUsers }) {
  const [query, setQuery] = useState("");
  const filtered = users.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()) || u.collegeId.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users…" className="pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-600/30" />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-slate-700">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">College ID</th>
              <th className="px-5 py-3 font-medium">Vehicle</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filtered.map((u) => {
              const Icon = VEHICLE_ICON[u.type] || Car;
              return (
                <tr key={u.id}>
                  <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{u.name}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{u.collegeId}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400"><span className="inline-flex items-center gap-1.5"><Icon className="w-4 h-4" />{u.vehicle}</span></td>
                  <td className="px-5 py-3"><StatusBadge status={u.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setUsers(users.map((x) => x.id === u.id ? { ...x, status: x.status === "Active" ? "Disabled" : "Active" } : x))}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400"
                        title="Toggle status"
                      ><ShieldCheck className="w-4 h-4" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400" title="Edit"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setUsers(users.filter((x) => x.id !== u.id))} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VehicleLogsSection({ vehicles }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const data = vehicles || seedVehicles;
  const filtered = data.filter((v) =>
    (filter === "all" || v.status === filter) &&
    (v.vehicle.toLowerCase().includes(query.toLowerCase()) || v.owner.toLowerCase().includes(query.toLowerCase()))
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search vehicle or owner…" className="pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-600/30" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
          <option value="all">All statuses</option>
          <option value="Parked">Parked</option>
          <option value="Exited">Exited</option>
        </select>
        <button className="inline-flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors duration-200">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-slate-700">
              <th className="px-5 py-3 font-medium">Vehicle #</th>
              <th className="px-5 py-3 font-medium">Owner</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Entry</th>
              <th className="px-5 py-3 font-medium">Exit</th>
              <th className="px-5 py-3 font-medium">Duration</th>
              <th className="px-5 py-3 font-medium">Slot</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filtered.map((v) => {
              const Icon = VEHICLE_ICON[v.type] || Car;
              return (
                <tr key={v.id}>
                  <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{v.vehicle}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{v.owner}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400"><span className="inline-flex items-center gap-1.5"><Icon className="w-4 h-4" />{v.type}</span></td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{v.entry}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{v.exit}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{v.duration}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{v.slot}</td>
                  <td className="px-5 py-3"><StatusBadge status={v.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 text-sm text-gray-500 dark:text-gray-400">
        <button className="w-8 h-8 rounded-lg border border-gray-200 dark:border-slate-700 flex items-center justify-center">1</button>
        <button className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center">2</button>
        <button className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center">3</button>
      </div>
    </div>
  );
}

function ReportsSection() {
  const reports = [
    { title: "Daily usage report", desc: "Slot usage & turnover for the last 24 hours." },
    { title: "Weekly usage report", desc: "Occupancy trends across the past 7 days." },
    { title: "Monthly usage report", desc: "Full-month occupancy and peak analysis." },
    { title: "Yearly summary", desc: "Annual usage patterns and growth." },
  ];
  return (
    <div className="grid sm:grid-cols-2 gap-5">
      {reports.map((r) => (
        <div key={r.title} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center mb-4">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-1">{r.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{r.desc}</p>
          <div className="flex gap-2">
            {["CSV", "PDF", "Excel"].map((f) => (
              <button key={f} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> {f}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NoticesSection({ notices, setNotices }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", emergency: false });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors duration-200">
          <Plus className="w-4 h-4" /> New notice
        </button>
      </div>
      {notices.map((n) => (
        <div key={n.id} className={cx("bg-white dark:bg-slate-800 rounded-2xl border p-5 shadow-sm", n.emergency ? "border-red-200 dark:border-red-800" : "border-gray-100 dark:border-slate-700")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {n.pinned && <Pin className="w-4 h-4 text-blue-600" />}
              {n.emergency && <Badge tone="red">Emergency</Badge>}
              <h3 className="font-medium text-gray-900 dark:text-white">{n.title}</h3>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{n.date}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-3">{n.body}</p>
          <div className="flex gap-2">
            <button onClick={() => setNotices(notices.map((x) => x.id === n.id ? { ...x, pinned: !x.pinned } : x))} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 flex items-center gap-1">
              <Pin className="w-3.5 h-3.5" /> {n.pinned ? "Unpin" : "Pin"}
            </button>
            <button className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 flex items-center gap-1">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={() => setNotices(notices.filter((x) => x.id !== n.id))} className="text-xs px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-500 flex items-center gap-1 ml-auto">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      ))}

      {modalOpen && (
        <Modal title="Create notice" onClose={() => setModalOpen(false)}>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!form.title) return;
            setNotices([{ id: Date.now(), pinned: false, date: "Today", ...form }, ...notices]);
            setForm({ title: "", body: "", emergency: false });
            setModalOpen(false);
          }}>
            <Field label="Title"><input required className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Body"><textarea className={cx(inputCls, "min-h-[90px] resize-none")} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-5">
              <input type="checkbox" checked={form.emergency} onChange={(e) => setForm({ ...form, emergency: e.target.checked })} className="rounded border-gray-300" />
              Mark as emergency alert
            </label>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors duration-200">Publish notice</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* =================================== APP =================================== */

export default function App() {
  const [view, setView] = useState("landing");
  const [role, setRole] = useState("user");
  const [dark, setDark] = useState(false);
  const [authRole, setAuthRole] = useState(null);

  const { spots, status, slots, loading, error, setStatus, setSlots } = useBackendData();
  const [notifications, setNotifications] = useState([]);
  const [notices, setNotices] = useState(seedNotices);
  const [feedback, setFeedback] = useState(seedFeedback);
  const [users, setUsers] = useState(seedUsers);
  const [vehicles, setVehicles] = useState(seedVehicles);
  const [activityLog, setActivityLog] = useState([]);
  const [detectLoading, setDetectLoading] = useState(false);
  const prevStatusRef = useRef({});

  useEffect(() => {
    if (slots.length > 0 && notifications.length === 0) {
      setNotifications(seedNotifications(slots));
    }
  }, [slots.length]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    if (Object.keys(prev).length === 0) {
      prevStatusRef.current = status && typeof status === 'object' ? { ...status } : {};
      return;
    }
    if (!status || typeof status !== 'object') {
      prevStatusRef.current = {};
      return;
    }
    const newActivity = [];
    Object.entries(status).forEach(([spotId, spotStatus]) => {
      const prevStatus = prev[spotId];
      if (prevStatus && prevStatus !== spotStatus) {
        const slot = slots.find((s) => s.spotId === spotId);
        if (slot) {
          newActivity.push({
            id: Date.now() + Math.random(),
            text: `Slot ${slot.id} marked ${spotStatus}`,
            time: "Just now",
            read: false,
            kind: spotStatus,
          });
        }
      }
    });
    if (newActivity.length > 0) {
      setActivityLog((prev) => [...newActivity.map((n) => ({ ...n, timestamp: Date.now() })), ...prev]);
      setNotifications((prev) => [...newActivity, ...prev]);
    }
    prevStatusRef.current = { ...status };
  }, [status, slots]);

  useEffect(() => {
    let active = true;
    async function fetchUsers() {
      try {
        const data = await getUsers();
        if (active && Array.isArray(data)) setUsers(data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchUsers();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchVehicles() {
      try {
        const data = await getVehicleLogs();
        if (active && Array.isArray(data)) setVehicles(data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchVehicles();
    return () => { active = false; };
  }, []);

  const handleRunDetection = async () => {
    setDetectLoading(true);
    try {
      const result = await runDetection();
      setStatus(result);
    } catch (err) {
      console.error("Detection failed:", err);
    } finally {
      setDetectLoading(false);
    }
  };

  const handleLogin = (selectedRole) => {
    setAuthRole(selectedRole);
    setRole(selectedRole);
  };

  function goto(v, r) {
    if (r) setRole(r);
    setView(v);
    window.scrollTo(0, 0);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Connecting to parking system…</p>
        </div>
      </div>
    );
  }

  if (view !== "login" && view !== "landing" && view !== "register" && !authRole) {
    setView("login");
  }

  return (
    <div className={dark ? "dark" : ""}>
      <div className="font-sans">
        {view === "landing" && <LandingPage slots={slots} goto={goto} />}
        {view === "login" && <LoginPage goto={goto} defaultRole={role} onLogin={handleLogin} />}
        {view === "register" && <RegisterPage goto={goto} />}
        {view === "user" && authRole === "user" && (
          <UserDashboard
            slots={slots} notifications={notifications} setNotifications={setNotifications}
            notices={notices} feedback={feedback} setFeedback={setFeedback}
            dark={dark} setDark={setDark} goto={goto}
          />
        )}
        {view === "admin" && authRole === "admin" && (
          <AdminDashboard
            slots={slots} setSlots={setSlots} users={users} setUsers={setUsers}
            notices={notices} setNotices={setNotices} feedback={feedback} setFeedback={setFeedback}
            dark={dark} setDark={setDark} goto={goto}
            status={status} setStatus={setStatus}
            activityLog={activityLog} setActivityLog={setActivityLog}
            detectLoading={detectLoading} onRunDetection={handleRunDetection}
            vehicles={vehicles} setVehicles={setVehicles}
          />
        )}
      </div>
    </div>
  );
}
