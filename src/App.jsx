// ─────────────────────────────────────────────────────────────────
// TINYLEDGER — Full Supabase Edition
// v2.0 — with Expense Splitting, Balances & Settle Up
//
// This app is configured entirely via environment variables so it
// can be forked and deployed for a different venture without code
// changes. See .env.example / README.md → "Deploying For Your Own
// Venture" for the full setup walkthrough.
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ── 🔧 CONFIG — set these in .env.local (dev) or your host's env vars (prod) ──
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ORG_NAME       = import.meta.env.VITE_ORG_NAME       || "Your Venture Name";
const ORG_TAGLINE    = import.meta.env.VITE_ORG_TAGLINE    || "BUSINESS ACCOUNTS · SUPABASE";
// ────────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error(
    "Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
    "in .env.local (dev) or your hosting provider's environment variables (prod). " +
    "See .env.example."
  );
}

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

const EXPENSE_CATEGORIES = [
  "Seeds & Saplings","Fertilizers & Pesticides","Equipment Purchase",
  "Equipment Repair","Labor / Wages","Utilities",
  "Construction / Building","Land Procurement","Miscellaneous Expense",
];

const INCOME_CATEGORIES = [
  "Harvest Sale","Miscellaneous Income",
];

const fmt = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const TODAY = new Date().toISOString().slice(0, 10);

// ── THEME ────────────────────────────────────────────────────────
const T = {
  bg:        "#F7F3EC",
  surface:   "#FFFFFF",
  border:    "#DDD3BE",
  borderDark:"#C4B49A",
  ink:       "#1E1408",
  inkMid:    "#5A4A30",
  inkLight:  "#9A8668",
  gold:      "#9A6F28",
  goldLight: "#C49A3C",
  green:     "#3E6B3A",
  red:       "#8B2020",
  blue:      "#2A4A8A",
  purple:    "#5A2A8A",
  headerBg:  "#1E1408",
  headerGold:"#C49A3C",
  rowAlt:    "#FBF8F2",
  shadow:    "0 1px 4px rgba(0,0,0,0.07)",
};

const ui = {
  page: {
    minHeight: "100vh", background: T.bg,
    fontFamily: "'Georgia', 'Times New Roman', serif", color: T.ink,
  },
  header: {
    background: T.headerBg, color: T.headerGold,
    padding: "0 28px", height: 56,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    borderBottom: `2px solid ${T.gold}`, position: "sticky", top: 0, zIndex: 100,
  },
  card: {
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 6, padding: "24px 28px", marginBottom: 20,
    boxShadow: T.shadow,
  },
  label: {
    fontSize: 10, letterSpacing: 1.5, color: T.gold,
    fontFamily: "'Georgia', serif", display: "block", marginBottom: 5,
    textTransform: "uppercase",
  },
  input: {
    width: "100%", border: `1px solid ${T.borderDark}`, borderRadius: 4,
    padding: "9px 12px", fontSize: 13, background: "#FDFAF5",
    color: T.ink, boxSizing: "border-box", fontFamily: "Georgia, serif",
    outline: "none",
  },
  btn: (v = "gold") => ({
    border: "none", borderRadius: 4, cursor: "pointer",
    padding: "9px 18px", fontSize: 12, letterSpacing: 0.8,
    fontFamily: "Georgia, serif", fontWeight: "bold",
    background: v === "gold" ? T.gold : v === "green" ? T.green
      : v === "red" ? T.red : v === "blue" ? T.blue
      : v === "purple" ? T.purple : "#4A3A25",
    color: "#FFF",
  }),
  navBtn: (active) => ({
    background: active ? T.gold : "transparent",
    border: "none", color: active ? "#FFF" : T.inkLight,
    padding: "6px 14px", borderRadius: 4, cursor: "pointer",
    fontSize: 11, letterSpacing: 1, fontFamily: "Georgia, serif",
    transition: "all 0.15s",
  }),
  badge: (type) => ({
    display: "inline-block", borderRadius: 3, padding: "2px 8px",
    fontSize: 10, letterSpacing: 1, fontWeight: "bold",
    background: type === "income" ? "#E8F5E4"
      : type === "expense" ? "#FAE8E8"
      : type === "settlement" ? "#EEE8FA"
      : type === "ADD" ? "#E8F5E4" : type === "EDIT" ? "#FFF4D6"
      : type === "DELETE" ? "#FAE8E8" : "#E8F0FA",
    color: type === "income" ? T.green : type === "expense" ? T.red
      : type === "settlement" ? T.purple
      : type === "ADD" ? T.green : type === "EDIT" ? "#7A5500"
      : type === "DELETE" ? T.red : "#2A4A8A",
  }),
};

// ── HELPERS ──────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: 60, color: T.inkLight }}>
      <div style={{ fontSize: 32 }}>🌾</div>
      <div style={{ marginTop: 10, fontSize: 13 }}>Loading…</div>
    </div>
  );
}

function Flash({ msg }) {
  if (!msg) return null;
  const isErr = msg.startsWith("⚠") || msg.startsWith("✗");
  return (
    <div style={{
      background: isErr ? "#8B2020" : T.green, color: "#fff",
      padding: "11px 24px", fontSize: 13, textAlign: "center",
    }}>{msg}</div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div style={{ ...ui.card, textAlign: "center", borderTop: `3px solid ${accent}`, marginBottom: 0 }}>
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: T.inkLight, marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: "bold", color: accent, marginTop: 6 }}>{value}</div>
    </div>
  );
}

// ── LOGIN SCREEN ─────────────────────────────────────────────────
function LoginScreen({ onLogin, loading, error }) {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  return (
    <div style={{ minHeight: "100vh", background: T.headerBg,
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#2A1C0A", border: `2px solid ${T.gold}`,
        borderRadius: 8, padding: "44px 40px", width: 360,
        boxShadow: "0 12px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 42 }}>🌾</div>
          <div style={{ color: T.headerGold, fontSize: 22, fontWeight: "bold", letterSpacing: 2 }}>
            {ORG_NAME.toUpperCase()}
          </div>
          <div style={{ color: T.inkLight, fontSize: 11, marginTop: 4, letterSpacing: 3 }}>
            BUSINESS ACCOUNTS
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ ...ui.label, color: T.goldLight }}>EMAIL</label>
          <input style={{ ...ui.input, background: "#1A1005", color: "#FFF", border: `1px solid ${T.gold}` }}
            type="email" value={email} placeholder="partner@example.com"
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onLogin(email, pass)} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ ...ui.label, color: T.goldLight }}>PASSWORD</label>
          <input style={{ ...ui.input, background: "#1A1005", color: "#FFF", border: `1px solid ${T.gold}`, letterSpacing: 4 }}
            type="password" value={pass} placeholder="••••••••"
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onLogin(email, pass)} />
        </div>
        {error && <div style={{ color: "#FF7070", fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <button style={{ ...ui.btn("gold"), width: "100%", padding: 13, fontSize: 13 }}
          onClick={() => onLogin(email, pass)} disabled={loading}>
          {loading ? "Signing in…" : "SIGN IN →"}
        </button>
        <div style={{ color: "#4A3A25", fontSize: 10, textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
          Your admin creates your account via Supabase Auth.<br />
          All sessions are encrypted and logged.
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────
export default function App() {
  const [session,      setSession]      = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [profiles,     setProfiles]     = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [splits,       setSplits]       = useState([]);
  const [auditLog,     setAuditLog]     = useState([]);
  const [backupLog,    setBackupLog]    = useState([]);
  const [view,         setView]         = useState("dashboard");
  const [loading,      setLoading]      = useState(true);
  const [authLoading,  setAuthLoading]  = useState(false);
  const [authError,    setAuthError]    = useState("");
  const [flash,        setFlash]        = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget,   setEditTarget]   = useState(null);
  const [noteEditTarget, setNoteEditTarget] = useState(null); // settlement being note-edited
  const [noteEditValue,  setNoteEditValue]  = useState("");
  const [filter,       setFilter]       = useState({ type: "all", partner: "all", search: "" });
  const flashTimer = useRef(null);

  const notify = useCallback((msg) => {
    setFlash(msg);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(""), 3500);
  }, []);

  // ── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      sb.from("profiles").select("*").eq("id", session.user.id).single(),
      sb.from("profiles").select("*"),
    ]).then(([{ data: p }, { data: all }]) => {
      setProfile(p);
      setProfiles(all || []);
      setLoading(false);
    });
  }, [session]);

  // ── Data loaders ─────────────────────────────────────────────
  const loadTransactions = useCallback(async () => {
    const { data } = await sb.from("transactions").select("*").order("date", { ascending: false });
    setTransactions(data || []);
  }, []);

  const loadSplits = useCallback(async () => {
    const { data } = await sb.from("splits").select("*");
    setSplits(data || []);
  }, []);

  useEffect(() => {
    if (session) { loadTransactions(); loadSplits(); }
  }, [session, loadTransactions, loadSplits]);

  const loadAudit = useCallback(async () => {
    const [{ data: al }, { data: bl }] = await Promise.all([
      sb.from("audit_log").select("*").order("created_at", { ascending: false }).limit(300),
      sb.from("backup_log").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    setAuditLog(al || []);
    setBackupLog(bl || []);
  }, []);

  useEffect(() => { if (profile?.role === "admin") loadAudit(); }, [profile, loadAudit]);

  // ── Auth handlers ─────────────────────────────────────────────
  async function handleLogin(email, pass) {
    setAuthLoading(true); setAuthError("");
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  }

  async function handleLogout() {
    await sb.auth.signOut();
    setSession(null); setProfile(null);
    setTransactions([]); setAuditLog([]);
  }

  // ── Change Password ───────────────────────────────────────────
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [pwdForm,   setPwdForm]   = useState({ newPass: "", confirmPass: "" });
  const [pwdError,  setPwdError]  = useState("");
  const [pwdLoading,setPwdLoading]= useState(false);
  const [showPwd,   setShowPwd]   = useState(false);

  async function handleChangePassword() {
    setPwdError("");
    if (!pwdForm.newPass || pwdForm.newPass.length < 6) {
      setPwdError("Password must be at least 6 characters."); return;
    }
    if (pwdForm.newPass !== pwdForm.confirmPass) {
      setPwdError("Passwords do not match."); return;
    }
    setPwdLoading(true);
    const { error } = await sb.auth.updateUser({ password: pwdForm.newPass });
    setPwdLoading(false);
    if (error) { setPwdError(error.message); return; }
    setShowChangePwd(false);
    setPwdForm({ newPass: "", confirmPass: "" });
    notify("✓ Password changed successfully.");
  }

  // ── Transaction Form ──────────────────────────────────────────
  const blankForm = {
    type: "expense", amount: "", description: "",
    category: "", partner_id: "", date: TODAY, note: "",
    is_split: false, splitWith: [],
  };
  const [form, setForm] = useState(blankForm);

  // computed per-person split amount
  const splitPeople = form.is_split ? [form.partner_id, ...form.splitWith].filter(Boolean) : [];
  const uniqueSplitPeople = [...new Set(splitPeople)];
  const perPerson = uniqueSplitPeople.length > 1 && form.amount
    ? (parseFloat(form.amount) / uniqueSplitPeople.length).toFixed(2)
    : null;

  function toggleSplitWith(pid) {
    setForm(f => ({
      ...f,
      splitWith: f.splitWith.includes(pid)
        ? f.splitWith.filter(id => id !== pid)
        : [...f.splitWith, pid],
    }));
  }

  function openEdit(t) {
    if (t.type === "settlement") {
      setNoteEditTarget(t);
      setNoteEditValue(t.note || "");
      return;
    }
    setForm({
      type: t.type, amount: t.amount, description: t.description,
      category: t.category, partner_id: t.partner_id,
      date: t.date, note: t.note || "",
      is_split: false, splitWith: [],
    });
    setEditTarget(t);
    setView("add");
  }

  async function handleSaveNote() {
    if (!noteEditTarget) return;
    const { error } = await sb.from("transactions").update({ note: noteEditValue }).eq("id", noteEditTarget.id);
    if (error) { notify("✗ " + error.message); return; }
    notify("✓ Note updated.");
    setNoteEditTarget(null);
    setNoteEditValue("");
    loadTransactions();
  }

  // Settlements never reach this form — they're edited via the lightweight
  // note-only modal (see openEdit / handleSaveNote), since their amount is
  // tied 1:1 to a specific split's owed amount.

  async function handleSubmit() {
    if (!form.amount || !form.description || !form.category || !form.partner_id || !form.date) {
      notify("⚠ Please fill all required fields."); return;
    }
    if (form.is_split && form.splitWith.length === 0) {
      notify("⚠ Select at least one other partner to split with."); return;
    }

    const payload = {
      type: form.type,
      amount: parseFloat(form.amount),
      description: form.description,
      category: form.category,
      partner_id: form.partner_id,
      date: form.date,
      note: form.note,
      is_split: form.is_split,
      split_count: form.is_split ? uniqueSplitPeople.length : null,
      per_person: form.is_split ? parseFloat(perPerson) : null,
      created_by: session.user.id,
    };

    if (editTarget) {
      const { error } = await sb.from("transactions").update(payload).eq("id", editTarget.id);
      if (error) { notify("✗ " + error.message); return; }
      notify("✓ Transaction updated.");
    } else {
      const { data: txn, error } = await sb.from("transactions").insert(payload).select().single();
      if (error) { notify("✗ " + error.message); return; }

      // Create split rows for each debtor (everyone except the payer)
      if (form.is_split && txn) {
        const debtors = uniqueSplitPeople.filter(id => id !== form.partner_id);
        const splitRows = debtors.map(debtor_id => ({
          transaction_id: txn.id,
          debtor_id,
          creditor_id: form.partner_id,
          amount: parseFloat(perPerson),
          settled: false,
        }));
        if (splitRows.length > 0) {
          const { error: splitErr } = await sb.from("splits").insert(splitRows);
          if (splitErr) { notify("✗ Split error: " + splitErr.message); return; }
        }
      }

      notify("✓ Transaction recorded.");
    }

    setForm(blankForm); setEditTarget(null);
    loadTransactions(); loadSplits();
    setView("transactions");
  }

  async function handleDelete(id) {
  const { error } = await sb
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) {
    notify(
      `✗ ${error.message}\n` +
      `Code: ${error.code}\n` +
      `Details: ${error.details || "None"}`
    );
    return;
  }

  notify("✓ Deleted and logged in audit trail.");

  setDeleteTarget(null);

  await loadTransactions();
  await loadSplits();

  if (profile?.role === "admin") {
    await loadAudit();
  }
}

  // ── Settle Up ─────────────────────────────────────────────────
  const [showSettle,  setShowSettle]  = useState(false);
  const [settleForm,  setSettleForm]  = useState({ from_id: "", to_id: "", amount: "", note: "" });
  const [settleLoading, setSettleLoading] = useState(false);

  async function handleSettle() {
    if (!settleForm.from_id || !settleForm.to_id || !settleForm.amount) {
      notify("⚠ Fill all settle up fields."); return;
    }
    if (settleForm.from_id === settleForm.to_id) {
      notify("⚠ Cannot settle with yourself."); return;
    }
    setSettleLoading(true);
    const amount = parseFloat(settleForm.amount);

    // Record as settlement transaction
    const { data: txn, error } = await sb.from("transactions").insert({
      type: "settlement",
      amount,
      description: `Settlement: ${partnerName(settleForm.from_id)} → ${partnerName(settleForm.to_id)}`,
      category: "Loan / Investment",
      partner_id: settleForm.from_id,
      date: TODAY,
      note: settleForm.note || "Direct settlement payment",
      created_by: session.user.id,
    }).select().single();

    if (error) { notify("✗ " + error.message); setSettleLoading(false); return; }

    // Mark matching unsettled splits as settled (oldest first, up to the amount)
    const unsettled = splits
      .filter(s => s.debtor_id === settleForm.from_id
        && s.creditor_id === settleForm.to_id
        && !s.settled)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    let remaining = amount;
    for (const s of unsettled) {
      if (remaining <= 0) break;
      if (s.amount <= remaining) {
        await sb.from("splits").update({ settled: true, settled_by_txn: txn.id }).eq("id", s.id);
        remaining -= s.amount;
      }
    }

    setSettleLoading(false);
    setShowSettle(false);
    setSettleForm({ from_id: "", to_id: "", amount: "", note: "" });
    loadTransactions(); loadSplits();
    notify("✓ Settlement recorded and splits updated.");
  }

  // ── Balance matrix computation ────────────────────────────────
  // netOwed[debtorId][creditorId] = amount owed
  const netOwed = {};
  splits.filter(s => !s.settled).forEach(s => {
    if (!netOwed[s.debtor_id]) netOwed[s.debtor_id] = {};
    netOwed[s.debtor_id][s.creditor_id] = (netOwed[s.debtor_id][s.creditor_id] || 0) + +s.amount;
  });

  // Simplify: net out A→B vs B→A
  const balanceRows = [];
  const seen = new Set();
  profiles.forEach(p1 => {
    profiles.forEach(p2 => {
      if (p1.id === p2.id) return;
      const key = [p1.id, p2.id].sort().join("-");
      if (seen.has(key)) return;
      seen.add(key);
      const p1owesP2 = (netOwed[p1.id]?.[p2.id] || 0);
      const p2owesP1 = (netOwed[p2.id]?.[p1.id] || 0);
      const net = p1owesP2 - p2owesP1;
      if (Math.abs(net) > 0.01) {
        balanceRows.push({
          debtorId:   net > 0 ? p1.id : p2.id,
          creditorId: net > 0 ? p2.id : p1.id,
          amount: Math.abs(net),
        });
      }
    });
  });
  balanceRows.sort((a, b) => b.amount - a.amount);

  // Per-partner net owed/owed-to
  const partnerNetOwed = {};
  profiles.forEach(p => {
    const owes    = splits.filter(s => !s.settled && s.debtor_id   === p.id).reduce((sum, s) => sum + +s.amount, 0);
    const owedTo  = splits.filter(s => !s.settled && s.creditor_id === p.id).reduce((sum, s) => sum + +s.amount, 0);
    partnerNetOwed[p.id] = { owes, owedTo, net: owedTo - owes };
  });

  // ── Derived stats ─────────────────────────────────────────────
  const totalIncome  = transactions.filter(t => t.type === "income").reduce((s, t) => s + +t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + +t.amount, 0);
  const balance      = totalIncome - totalExpense;

  const partnerName = (id) => profiles.find(p => p.id === id)?.full_name || "—";

  const filtered = transactions.filter(t => {
    if (filter.type !== "all" && t.type !== filter.type) return false;
    if (filter.partner !== "all" && t.partner_id !== filter.partner) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!`${t.description} ${t.category} ${partnerName(t.partner_id)}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ── Render gates ──────────────────────────────────────────────
  if (!session) return <LoginScreen onLogin={handleLogin} loading={authLoading} error={authError} />;
  if (loading)  return <div style={ui.page}><Spinner /></div>;

  const isAdmin = profile?.role === "admin";
  const navItems = [
    ["dashboard",    "📊 Dashboard"],
    ["transactions", "📋 Ledger"],
    ["add",          "＋ Entry"],
    ["balances",     "⚖️ Balances"],
    ["partners",     "🧑‍🌾 Partners"],
    ...(isAdmin ? [["audit", "🔐 Audit"], ["backups", "💾 Backups"]] : []),
  ];

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div style={ui.page}>

      {/* HEADER */}
      <div style={ui.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>🌾</span>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 15, letterSpacing: 2 }}>{ORG_NAME.toUpperCase()}</div>
            <div style={{ fontSize: 9, color: T.inkLight, letterSpacing: 3 }}>{ORG_TAGLINE}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {navItems.map(([key, label]) => (
            <button key={key} style={ui.navBtn(view === key)}
              onClick={() => { setView(key); if (key !== "add") { setEditTarget(null); setForm(blankForm); } }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: T.inkLight }}>
            {isAdmin ? "👑" : "🧑‍🌾"} {profile?.full_name}
          </span>
          <button onClick={() => { setShowChangePwd(true); setPwdError(""); setPwdForm({ newPass: "", confirmPass: "" }); }}
            style={{ background: "none", border: `1px solid #3A2A15`, color: T.inkLight,
              borderRadius: 4, padding: "5px 10px", cursor: "pointer", fontSize: 11 }}>
            🔑
          </button>
          <button onClick={handleLogout}
            style={{ background: "none", border: `1px solid #3A2A15`, color: T.inkLight,
              borderRadius: 4, padding: "5px 10px", cursor: "pointer", fontSize: 11 }}>
            Sign out
          </button>
        </div>
      </div>

      <Flash msg={flash} />

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px" }}>

        {/* ── DASHBOARD ── */}
        {view === "dashboard" && (
          <>
            <div style={{ fontSize: 20, fontWeight: "bold", marginBottom: 20 }}>Farm Business Overview</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
              <StatCard icon="📈" label="TOTAL INCOME"   value={fmt(totalIncome)}  accent={T.green} />
              <StatCard icon="📉" label="TOTAL EXPENSES" value={fmt(totalExpense)} accent={T.red} />
              <StatCard icon="⚖️" label="NET BALANCE"    value={fmt(balance)}      accent={balance >= 0 ? T.green : T.red} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
              <div style={ui.card}>
                <div style={{ fontSize: 11, letterSpacing: 2, color: T.gold, marginBottom: 14 }}>RECENT TRANSACTIONS</div>
                {transactions.slice(0, 7).map(t => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.border}` }}>
                    <div>
                      <div style={{ fontSize: 13 }}>
                        {t.description}
                        {t.is_split && <span style={{ ...ui.badge("settlement"), marginLeft: 6, fontSize: 9 }}>SPLIT</span>}
                      </div>
                      <div style={{ fontSize: 10, color: T.inkLight }}>{t.date} · {partnerName(t.partner_id)}</div>
                    </div>
                    <div style={{ fontWeight: "bold", fontSize: 14,
                      color: t.type === "income" ? T.green : t.type === "settlement" ? T.purple : T.red }}>
                      {t.type === "income" ? "+" : t.type === "settlement" ? "⇄" : "−"}{fmt(t.amount)}
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && <div style={{ color: T.inkLight, fontSize: 13 }}>No transactions yet.</div>}
              </div>
              <div style={ui.card}>
                <div style={{ fontSize: 11, letterSpacing: 2, color: T.gold, marginBottom: 14 }}>OUTSTANDING BALANCES</div>
                {balanceRows.length === 0 && (
                  <div style={{ color: T.green, fontSize: 13 }}>✓ All settled up!</div>
                )}
                {balanceRows.slice(0, 6).map((b, i) => (
                  <div key={i} style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span><strong>{partnerName(b.debtorId)}</strong> owes <strong>{partnerName(b.creditorId)}</strong></span>
                      <span style={{ color: T.red, fontWeight: "bold" }}>{fmt(b.amount)}</span>
                    </div>
                  </div>
                ))}
                {balanceRows.length > 0 && (
                  <button style={{ ...ui.btn("purple"), marginTop: 12, width: "100%", padding: 8 }}
                    onClick={() => setView("balances")}>
                    View All & Settle Up →
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── ADD / EDIT ── */}
        {view === "add" && (
          <div style={{ maxWidth: 660 }}>
            <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 20 }}>
              {editTarget ? "✏️ Edit Transaction" : "＋ New Transaction"}
            </div>
            <div style={ui.card}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={ui.label}>TYPE *</label>
                  <select style={ui.input} value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value, category: "" })}>
                    <option value="expense">💸 Expense</option>
                    <option value="income">💰 Income</option>
                  </select>
                </div>
                <div>
                  <label style={ui.label}>AMOUNT (₹) *</label>
                  <input style={ui.input} type="number" min="0" step="0.01" placeholder="0.00"
                    value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={ui.label}>DESCRIPTION *</label>
                  <input style={ui.input} placeholder="What is this transaction for?"
                    value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <label style={ui.label}>CATEGORY *</label>
                  <select style={ui.input} value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}>
                    <option value="">— Select —</option>
                    {(form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={ui.label}>PAID BY *</label>
                  <select style={ui.input} value={form.partner_id}
                    onChange={e => setForm({ ...form, partner_id: e.target.value })}>
                    <option value="">— Select —</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={ui.label}>DATE *</label>
                  <input style={ui.input} type="date" value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label style={ui.label}>NOTES</label>
                  <input style={ui.input} placeholder="Receipt ref, vendor…"
                    value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
                </div>
              </div>

              {/* SPLIT SECTION */}
              {!editTarget && form.type === "expense" && (
                <div style={{ marginTop: 20, padding: 16, background: "#F7F3EC", borderRadius: 6, border: `1px solid ${T.border}` }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                    <input type="checkbox" checked={form.is_split}
                      onChange={e => setForm({ ...form, is_split: e.target.checked, splitWith: [] })}
                      style={{ width: 16, height: 16, cursor: "pointer" }} />
                    <span style={{ fontWeight: "bold", color: T.gold }}>Split this expense among partners</span>
                  </label>

                  {form.is_split && (
                    <div style={{ marginTop: 14 }}>
                      <label style={ui.label}>ALSO INCLUDES (select who else shares this cost)</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                        {profiles.filter(p => p.id !== form.partner_id).map(p => (
                          <label key={p.id} style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: form.splitWith.includes(p.id) ? "#E8F5E4" : T.surface,
                            border: `1px solid ${form.splitWith.includes(p.id) ? T.green : T.border}`,
                            borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontSize: 12,
                          }}>
                            <input type="checkbox" checked={form.splitWith.includes(p.id)}
                              onChange={() => toggleSplitWith(p.id)}
                              style={{ cursor: "pointer" }} />
                            {p.full_name}
                          </label>
                        ))}
                      </div>

                      {perPerson && uniqueSplitPeople.length > 1 && (
                        <div style={{ marginTop: 14, padding: "12px 16px", background: "#FFF8E7",
                          borderRadius: 4, border: `1px solid ${T.goldLight}` }}>
                          <div style={{ fontSize: 11, color: T.gold, letterSpacing: 1, marginBottom: 6 }}>SPLIT PREVIEW</div>
                          <div style={{ fontSize: 13 }}>
                            Total <strong>{fmt(form.amount)}</strong> ÷ {uniqueSplitPeople.length} people = <strong style={{ color: T.green }}>{fmt(perPerson)} each</strong>
                          </div>
                          <div style={{ fontSize: 11, color: T.inkLight, marginTop: 6 }}>
                            {partnerName(form.partner_id)} pays full amount upfront.
                            Others each owe {fmt(perPerson)} to {partnerName(form.partner_id)}:
                          </div>
                          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {uniqueSplitPeople.filter(id => id !== form.partner_id).map(id => (
                              <span key={id} style={{ ...ui.badge("expense"), fontSize: 11 }}>
                                {partnerName(id)} owes {fmt(perPerson)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <button style={ui.btn("green")} onClick={handleSubmit}>
                  {editTarget ? "💾 Update" : "✓ Save Transaction"}
                </button>
                <button style={ui.btn()} onClick={() => { setView("transactions"); setEditTarget(null); setForm(blankForm); }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TRANSACTIONS ── */}
        {view === "transactions" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: "bold" }}>📋 Ledger — All Transactions</div>
              <button style={ui.btn("green")} onClick={() => setView("add")}>＋ New Entry</button>
            </div>
            <div style={{ ...ui.card, display: "flex", gap: 10, flexWrap: "wrap", padding: "14px 20px", alignItems: "center" }}>
              <input style={{ ...ui.input, maxWidth: 220 }} placeholder="🔍 Search…"
                value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} />
              <select style={{ ...ui.input, maxWidth: 160 }} value={filter.type}
                onChange={e => setFilter({ ...filter, type: e.target.value })}>
                <option value="all">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="settlement">Settlement</option>
              </select>
              <select style={{ ...ui.input, maxWidth: 180 }} value={filter.partner}
                onChange={e => setFilter({ ...filter, partner: e.target.value })}>
                <option value="all">All Partners</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              <span style={{ fontSize: 11, color: T.inkLight }}>{filtered.length} records</span>
            </div>
            <div style={ui.card}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                    {["Date","Description","Category","Paid By","Amount","Split","Recorded By","Actions"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: T.gold, fontSize: 10, letterSpacing: 1.5 }}>
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: T.inkLight }}>
                      No transactions found.
                    </td></tr>
                  )}
                  {filtered.map((t, i) => {
                    const txnSplits = splits.filter(s => s.transaction_id === t.id);
                    return (
                      <tr key={t.id} style={{ background: i % 2 === 0 ? T.surface : T.rowAlt, borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: "10px 10px", color: T.inkMid, whiteSpace: "nowrap" }}>{t.date}</td>
                        <td style={{ padding: "10px 10px" }}>
                          <div>{t.description}</div>
                          {t.note && <div style={{ fontSize: 10, color: T.inkLight }}>{t.note}</div>}
                        </td>
                        <td style={{ padding: "10px 10px", color: T.inkMid, fontSize: 12 }}>{t.category}</td>
                        <td style={{ padding: "10px 10px", fontSize: 12 }}>{partnerName(t.partner_id)}</td>
                        <td style={{ padding: "10px 10px", fontWeight: "bold", whiteSpace: "nowrap",
                          color: t.type === "income" ? T.green : t.type === "settlement" ? T.purple : T.red }}>
                          <span style={ui.badge(t.type)}>{t.type.toUpperCase()}</span>
                          <span style={{ marginLeft: 6 }}>{fmt(t.amount)}</span>
                          {t.is_split && <div style={{ fontSize: 10, color: T.inkLight }}>{fmt(t.per_person)} each</div>}
                        </td>
                        <td style={{ padding: "10px 10px", fontSize: 11 }}>
                          {txnSplits.length > 0 ? (
                            <div>
                              {txnSplits.map(s => (
                                <div key={s.id} style={{ color: s.settled ? T.green : T.red, fontSize: 10 }}>
                                  {partnerName(s.debtor_id)} {s.settled ? "✓" : "owes"} {fmt(s.amount)}
                                </div>
                              ))}
                            </div>
                          ) : "—"}
                        </td>
                        <td style={{ padding: "10px 10px", fontSize: 11, color: T.inkLight }}>
                          {partnerName(t.created_by)}
                        </td>
                        <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>
                          {(isAdmin || t.created_by === session.user.id) && (
                            <button onClick={() => openEdit(t)}
                              style={{ ...ui.btn(), padding: "4px 10px", fontSize: 11, marginRight: 4 }}>
                              Edit
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => setDeleteTarget(t)}
                              style={{ ...ui.btn("red"), padding: "4px 10px", fontSize: 11 }}>
                              Del
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── BALANCES ── */}
        {view === "balances" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: "bold" }}>⚖️ Balances & Settlements</div>
              <button style={ui.btn("purple")} onClick={() => { setShowSettle(true); setSettleForm({ from_id: "", to_id: "", amount: "", note: "" }); }}>
                💸 Settle Up
              </button>
            </div>

            {/* Who owes whom */}
            <div style={ui.card}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: T.gold, marginBottom: 16 }}>OUTSTANDING — WHO OWES WHOM</div>
              {balanceRows.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: T.green, fontSize: 15 }}>
                  ✓ All settled up! No outstanding balances.
                </div>
              ) : (
                balanceRows.map((b, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 14 }}>
                      <strong style={{ color: T.red }}>{partnerName(b.debtorId)}</strong>
                      <span style={{ color: T.inkLight, margin: "0 8px" }}>owes</span>
                      <strong style={{ color: T.green }}>{partnerName(b.creditorId)}</strong>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontWeight: "bold", fontSize: 16, color: T.red }}>{fmt(b.amount)}</span>
                      <button style={{ ...ui.btn("purple"), padding: "4px 12px", fontSize: 11 }}
                        onClick={() => {
                          setSettleForm({ from_id: b.debtorId, to_id: b.creditorId, amount: b.amount.toFixed(2), note: "" });
                          setShowSettle(true);
                        }}>
                        Settle →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Per-partner summary */}
            <div style={ui.card}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: T.gold, marginBottom: 16 }}>PER-PARTNER SPLIT SUMMARY</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
                {profiles.map(p => {
                  const pn = partnerNetOwed[p.id] || { owes: 0, owedTo: 0, net: 0 };
                  return (
                    <div key={p.id} style={{ ...ui.card, marginBottom: 0, borderTop: `3px solid ${pn.net >= 0 ? T.green : T.red}` }}>
                      <div style={{ fontWeight: "bold", fontSize: 13 }}>{p.full_name}</div>
                      <div style={{ fontSize: 11, color: T.inkLight, marginBottom: 8 }}>{p.role}</div>
                      <div style={{ fontSize: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ color: T.inkLight }}>Others owe them</span>
                          <span style={{ color: T.green, fontWeight: "bold" }}>{fmt(pn.owedTo)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ color: T.inkLight }}>They owe others</span>
                          <span style={{ color: T.red, fontWeight: "bold" }}>{fmt(pn.owes)}</span>
                        </div>
                        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: T.inkLight, fontSize: 11 }}>Net position</span>
                          <span style={{ fontWeight: "bold", color: pn.net >= 0 ? T.green : T.red }}>{fmt(Math.abs(pn.net))} {pn.net >= 0 ? "↑" : "↓"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Settlement history */}
            <div style={ui.card}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: T.gold, marginBottom: 16 }}>SETTLEMENT HISTORY</div>
              {transactions.filter(t => t.type === "settlement").length === 0 ? (
                <div style={{ color: T.inkLight, fontSize: 13 }}>No settlements recorded yet.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                      {["Date","Description","Amount","Recorded By"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: T.gold, fontSize: 10, letterSpacing: 1.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.filter(t => t.type === "settlement").map((t, i) => (
                      <tr key={t.id} style={{ background: i % 2 === 0 ? T.surface : T.rowAlt, borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: "9px 10px", color: T.inkMid }}>{t.date}</td>
                        <td style={{ padding: "9px 10px" }}>{t.description}</td>
                        <td style={{ padding: "9px 10px", fontWeight: "bold", color: T.purple }}>{fmt(t.amount)}</td>
                        <td style={{ padding: "9px 10px", fontSize: 11, color: T.inkLight }}>{partnerName(t.created_by)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── PARTNERS ── */}
        {view === "partners" && (
          <>
            <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 20 }}>🧑‍🌾 Partner Accounts</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 16 }}>
              {profiles.map(p => {
                const inc   = transactions.filter(t => t.partner_id === p.id && t.type === "income").reduce((s, t) => s + +t.amount, 0);
                const exp   = transactions.filter(t => t.partner_id === p.id && t.type === "expense").reduce((s, t) => s + +t.amount, 0);
                const net   = inc - exp;
                const count = transactions.filter(t => t.partner_id === p.id).length;
                const pn    = partnerNetOwed[p.id] || { owes: 0, owedTo: 0 };
                return (
                  <div key={p.id} style={{ ...ui.card, borderTop: `3px solid ${net >= 0 ? T.green : T.red}`, marginBottom: 0 }}>
                    <div style={{ fontSize: 26, marginBottom: 6 }}>{p.role === "admin" ? "👑" : "🧑‍🌾"}</div>
                    <div style={{ fontWeight: "bold", fontSize: 14 }}>{p.full_name}</div>
                    <div style={{ fontSize: 10, color: T.inkLight, marginBottom: 10 }}>{p.role.toUpperCase()}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <div><div style={{ color: T.inkLight, fontSize: 10 }}>INCOME</div><div style={{ color: T.green, fontWeight: "bold" }}>{fmt(inc)}</div></div>
                      <div style={{ textAlign: "right" }}><div style={{ color: T.inkLight, fontSize: 10 }}>EXPENSES</div><div style={{ color: T.red, fontWeight: "bold" }}>{fmt(exp)}</div></div>
                    </div>
                    <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 10, paddingTop: 10 }}>
                      <div style={{ fontSize: 10, color: T.inkLight }}>NET BALANCE</div>
                      <div style={{ fontSize: 18, fontWeight: "bold", color: net >= 0 ? T.green : T.red }}>{fmt(net)}</div>
                    </div>
                    {(pn.owes > 0 || pn.owedTo > 0) && (
                      <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 8, paddingTop: 8, fontSize: 11 }}>
                        {pn.owedTo > 0 && <div style={{ color: T.green }}>↑ Owed to them: {fmt(pn.owedTo)}</div>}
                        {pn.owes > 0 && <div style={{ color: T.red }}>↓ They owe: {fmt(pn.owes)}</div>}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: T.inkLight, marginTop: 4 }}>{count} transactions</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── AUDIT LOG ── */}
        {view === "audit" && isAdmin && (
          <>
            <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 20 }}>🔐 Audit Log</div>
            <div style={ui.card}>
              <div style={{ fontSize: 11, color: T.inkLight, marginBottom: 14 }}>
                Every ADD, EDIT, DELETE is written by a Postgres trigger — tamper-proof at database level.
                Showing last {auditLog.length} entries.
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                    {["Time","User","Action","Detail"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: T.gold, fontSize: 10, letterSpacing: 1.5 }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLog.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: T.inkLight }}>No audit entries yet.</td></tr>
                  )}
                  {auditLog.map((e, i) => (
                    <tr key={e.id} style={{ background: i % 2 === 0 ? T.surface : T.rowAlt, borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "8px 10px", color: T.inkMid, whiteSpace: "nowrap" }}>{new Date(e.created_at).toLocaleString("en-IN")}</td>
                      <td style={{ padding: "8px 10px", fontWeight: "bold" }}>{e.user_name || "—"}</td>
                      <td style={{ padding: "8px 10px" }}><span style={ui.badge(e.action)}>{e.action}</span></td>
                      <td style={{ padding: "8px 10px", color: T.inkMid }}>
                        {e.new_data?.description || e.old_data?.description || "—"}
                        {(e.new_data?.amount || e.old_data?.amount) &&
                          <span style={{ color: T.inkLight }}> · {fmt(e.new_data?.amount || e.old_data?.amount)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── BACKUPS ── */}
        {view === "backups" && isAdmin && (
          <>
            <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>💾 Backup History</div>
            <div style={{ fontSize: 13, color: T.inkLight, marginBottom: 20 }}>
              Daily automated backups run at 1:00 AM UTC via GitHub Actions → Supabase Storage. Last 30 days retained.
            </div>
            <div style={ui.card}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                    {["Date & Time","Triggered By","Transactions","Audit Rows","Status","Storage Path"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: T.gold, fontSize: 10, letterSpacing: 1.5 }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {backupLog.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: T.inkLight }}>No backups yet.</td></tr>
                  )}
                  {backupLog.map((b, i) => (
                    <tr key={b.id} style={{ background: i % 2 === 0 ? T.surface : T.rowAlt, borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "9px 10px" }}>{new Date(b.created_at).toLocaleString("en-IN")}</td>
                      <td style={{ padding: "9px 10px", color: T.inkMid }}>{b.triggered_by}</td>
                      <td style={{ padding: "9px 10px" }}>{b.row_counts?.transactions ?? "—"}</td>
                      <td style={{ padding: "9px 10px" }}>{b.row_counts?.audit_log ?? "—"}</td>
                      <td style={{ padding: "9px 10px" }}>
                        <span style={ui.badge(b.status === "success" ? "ADD" : "DELETE")}>{b.status.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: "9px 10px", fontSize: 11, color: T.inkLight, fontFamily: "monospace" }}>
                        {b.storage_path || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>

      {/* SETTLE UP MODAL */}
      {showSettle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: T.surface, borderRadius: 6, padding: 36, maxWidth: 420, width: "90%",
            boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 4 }}>💸 Settle Up</div>
            <div style={{ color: T.inkLight, fontSize: 12, marginBottom: 20 }}>
              Record a direct payment between partners. This will be logged as a settlement in the ledger.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={ui.label}>WHO IS PAYING</label>
                <select style={ui.input} value={settleForm.from_id}
                  onChange={e => setSettleForm({ ...settleForm, from_id: e.target.value })}>
                  <option value="">— Select —</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={ui.label}>PAYING TO</label>
                <select style={ui.input} value={settleForm.to_id}
                  onChange={e => setSettleForm({ ...settleForm, to_id: e.target.value })}>
                  <option value="">— Select —</option>
                  {profiles.filter(p => p.id !== settleForm.from_id).map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={ui.label}>AMOUNT (₹)</label>
                <input style={ui.input} type="number" min="0" step="0.01" placeholder="0.00"
                  value={settleForm.amount}
                  onChange={e => setSettleForm({ ...settleForm, amount: e.target.value })} />
              </div>
              <div>
                <label style={ui.label}>NOTE (optional)</label>
                <input style={ui.input} placeholder="Cash / UPI / etc."
                  value={settleForm.note}
                  onChange={e => setSettleForm({ ...settleForm, note: e.target.value })} />
              </div>
            </div>

            {/* Show what will be cleared */}
            {settleForm.from_id && settleForm.to_id && (
              <div style={{ marginTop: 14, padding: 12, background: "#F7F3EC", borderRadius: 4, fontSize: 12 }}>
                {(() => {
                  const outstanding = balanceRows.find(b =>
                    b.debtorId === settleForm.from_id && b.creditorId === settleForm.to_id);
                  return outstanding ? (
                    <div style={{ color: T.inkMid }}>
                      Outstanding balance: <strong style={{ color: T.red }}>{fmt(outstanding.amount)}</strong>
                    </div>
                  ) : (
                    <div style={{ color: T.green }}>✓ No outstanding balance between these two partners.</div>
                  );
                })()}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button style={ui.btn("purple")} onClick={handleSettle} disabled={settleLoading}>
                {settleLoading ? "Recording…" : "✓ Record Settlement"}
              </button>
              <button style={ui.btn()} onClick={() => setShowSettle(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {showChangePwd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: T.surface, borderRadius: 6, padding: 36, maxWidth: 380, width: "90%",
            boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 6 }}>🔑 Change Password</div>
            <div style={{ color: T.inkLight, fontSize: 12, marginBottom: 20 }}>Logged in as {profile?.full_name}</div>
            <div style={{ marginBottom: 14 }}>
              <label style={ui.label}>NEW PASSWORD</label>
              <div style={{ position: "relative" }}>
                <input style={{ ...ui.input, paddingRight: 40 }}
                  type={showPwd ? "text" : "password"} placeholder="Min 6 characters"
                  value={pwdForm.newPass}
                  onChange={e => setPwdForm({ ...pwdForm, newPass: e.target.value })} />
                <button onClick={() => setShowPwd(p => !p)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", fontSize: 15, color: T.inkLight }}>
                  {showPwd ? "🙈" : "👁"}
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={ui.label}>CONFIRM NEW PASSWORD</label>
              <div style={{ position: "relative" }}>
                <input style={{ ...ui.input, paddingRight: 40 }}
                  type={showPwd ? "text" : "password"} placeholder="Repeat new password"
                  value={pwdForm.confirmPass}
                  onChange={e => setPwdForm({ ...pwdForm, confirmPass: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && handleChangePassword()} />
                <button onClick={() => setShowPwd(p => !p)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", fontSize: 15, color: T.inkLight }}>
                  {showPwd ? "🙈" : "👁"}
                </button>
              </div>
            </div>
            {pwdError && <div style={{ color: T.red, fontSize: 12, marginBottom: 12 }}>{pwdError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button style={ui.btn("green")} onClick={handleChangePassword} disabled={pwdLoading}>
                {pwdLoading ? "Saving…" : "✓ Save Password"}
              </button>
              <button style={ui.btn()} onClick={() => setShowChangePwd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* SETTLEMENT NOTE-EDIT MODAL */}
      {noteEditTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: T.surface, borderRadius: 6, padding: 32, maxWidth: 420, width: "90%",
            boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 4 }}>🤝 Edit Settlement Note</div>
            <div style={{ color: T.inkLight, fontSize: 12, marginBottom: 18 }}>
              {noteEditTarget.description} · {fmt(noteEditTarget.amount)}
              <br />
              Amount and parties are fixed to keep this in sync with the split it settled — only the note can change.
            </div>
            <label style={ui.label}>NOTES</label>
            <input style={ui.input} placeholder="Receipt ref, payment method…"
              value={noteEditValue} onChange={e => setNoteEditValue(e.target.value)}
              autoFocus />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button style={ui.btn("green")} onClick={handleSaveNote}>💾 Save Note</button>
              <button style={ui.btn()} onClick={() => { setNoteEditTarget(null); setNoteEditValue(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: T.surface, borderRadius: 6, padding: 36, maxWidth: 380, width: "90%",
            textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 8 }}>Delete this transaction?</div>
            <div style={{ color: T.inkMid, fontSize: 13, marginBottom: 6 }}><strong>{deleteTarget.description}</strong></div>
            <div style={{ color: T.red, fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>{fmt(deleteTarget.amount)}</div>
            <div style={{ color: T.inkLight, fontSize: 12, marginBottom: 24 }}>
              This deletion will be permanently recorded in the audit trail and cannot be undone.
              {deleteTarget.is_split && " All associated split records will also be removed."}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button style={ui.btn("red")} onClick={() => handleDelete(deleteTarget.id)}>Yes, Delete</button>
              <button style={ui.btn()} onClick={() => setDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
