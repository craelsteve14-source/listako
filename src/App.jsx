import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { useZxing } from "react-zxing";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ═══════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      storageKey: "listako-session",
      storage: window.localStorage,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// SUPER ADMIN CONFIG
// ═══════════════════════════════════════════════════════════════
const SUPER_ADMIN_EMAIL = "craelsteve14@gmail.com";
const ADMIN_GCASH = "09530897696";
const ADMIN_PHONE = "09530897696";

// ═══════════════════════════════════════════════════════════════
// PRICING
// ═══════════════════════════════════════════════════════════════
const PLANS = {
  basic: { label: "Basic", price: 199, branches: 1, staff: 5, desc: "Para sa maliliit na tindahan" },
  pro: { label: "Pro", price: 399, branches: 3, staff: 15, desc: "Para sa lumalaking negosyo" },
  business: { label: "Business", price: 699, branches: 999, staff: 999, desc: "Para sa maraming branches" },
};

// ═══════════════════════════════════════════════════════════════
// ROLE CONFIG
// ═══════════════════════════════════════════════════════════════
const ROLE_COLORS = {
  owner: "bg-gold-100 text-gold-800",
  branch_manager: "bg-blue-100 text-blue-700",
  inventory_staff: "bg-forest-100 text-forest-700",
  cashier: "bg-ivory-300 text-forest-700",
};
const ROLE_LABELS = {
  owner: "Owner",
  branch_manager: "Branch Manager",
  inventory_staff: "Inventory Staff",
  cashier: "Cashier",
};

// ═══════════════════════════════════════════════════════════════
// FILIPINO ERROR MESSAGES
// ═══════════════════════════════════════════════════════════════
const getErrorMessage = (error) => {
  const msg = error?.message?.toLowerCase() || "";
  if (msg.includes("invalid login credentials")) return "Mali ang email o password. Subukan muli.";
  if (msg.includes("email not confirmed")) return "Hindi pa na-confirm ang email. Tingnan ang iyong inbox.";
  if (msg.includes("user already registered")) return "Nairehistro na ang email na ito. Mag-login na lang.";
  if (msg.includes("password should be at least")) return "Ang password ay dapat hindi bababa sa 6 na karakter.";
  if (msg.includes("email rate limit")) return "Masyadong maraming pagtatangka. Maghintay ng ilang minuto.";
  if (msg.includes("token has expired")) return "Nag-expire na ang OTP code. Humingi ng bagong code.";
  if (msg.includes("network")) return "Walang koneksyon sa internet. I-check ang iyong WiFi o data.";
  return error?.message || "May nangyaring mali. Subukan muli.";
};

// ═══════════════════════════════════════════════════════════════
// BARCODE GENERATOR
// ═══════════════════════════════════════════════════════════════
const compressImage = (file, maxWidth = 400, quality = 0.7) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

const generateBarcode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LK-${timestamp}-${random}`;
};

function BarcodeDisplay({ code }) {
  if (!code) return null;
  const bars = [];
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    bars.push(charCode % 4 + 1);
    bars.push((charCode >> 2) % 3 + 1);
  }
  return (
    <div className="flex flex-col items-center py-2">
      <div className="flex items-end h-10 gap-px">
        {bars.map((w, i) => (
          <div key={i} className={`${i % 2 === 0 ? "bg-black" : "bg-transparent"} h-full`} style={{ width: `${w}px` }} />
        ))}
      </div>
      <p className="text-xs font-mono text-gray-600 mt-1 tracking-wider">{code}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AUDIT LOG HELPER
// ═══════════════════════════════════════════════════════════════
const logAudit = async (businessId, userId, userName, action, entityType, entityId, details) => {
  await supabase.from("audit_logs").insert({
    business_id: businessId,
    user_id: userId,
    user_name: userName,
    action,
    entity_type: entityType || null,
    entity_id: entityId || null,
    details: details || null,
  });
};

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════
// TRIAL HELPERS
// ═══════════════════════════════════════════════════════════════
const getTrialDaysLeft = (trialEndsAt) => {
  if (!trialEndsAt) return 0;
  const now = new Date();
  const end = new Date(trialEndsAt);
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

const isTrialExpired = (business) => {
  if (business?.status === "approved" || business?.plan === "business") return false;
  if (!business?.trial_ends_at) return false;
  return new Date() > new Date(business.trial_ends_at);
};

// ═══════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  const bg =
    type === "error"
      ? "bg-red-500"
      : type === "warning"
      ? "bg-yellow-500"
      : "bg-forest-600";
  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${bg} text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs text-center`}
    >
      {message}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SPINNER
// ═══════════════════════════════════════════════════════════════
function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-forest-800 gap-4">
      <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-forest-300 text-sm font-medium tracking-wide">Loading...</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FIELD
// ═══════════════════════════════════════════════════════════════
function Field({ label, value, onChange, placeholder, type = "text", maxLength }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OTP INPUT
// ═══════════════════════════════════════════════════════════════
function OTPInput({ value, onChange }) {
  const digits = 6;
  const vals = value.split("").concat(Array(digits).fill("")).slice(0, digits);
  const refs = Array.from({ length: digits }, () => null);
  const setRef = (i) => (el) => {
    refs[i] = el;
  };
  const handleChange = (i, v) => {
    const clean = v.replace(/\D/g, "").slice(-1);
    const next = vals.map((d, idx) => (idx === i ? clean : d)).join("");
    onChange(next);
    if (clean && i < digits - 1) refs[i + 1]?.focus();
  };
  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !vals[i] && i > 0) refs[i - 1]?.focus();
  };
  return (
    <div className="flex gap-2 justify-center">
      {vals.map((d, i) => (
        <input
          key={i}
          ref={setRef(i)}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-11 h-14 text-center text-xl font-black border-2 rounded-xl focus:outline-none focus:border-forest-500 bg-white"
          style={{ borderColor: d ? "#c9a84c" : "#e5e7eb" }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OTP SCREEN
// ═══════════════════════════════════════════════════════════════
function OTPScreen({ email, type, onBack, onSuccess, showToast }) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setInterval(() => setResendTimer((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  const handleVerify = async () => {
    if (otp.length < 6) return showToast("Ilagay ang 6-digit na OTP code.", "error");
    if (type === "forgot" && newPassword.length < 6)
      return showToast("Ang bagong password ay dapat 6 na karakter man lang.", "error");
    setLoading(true);
    try {
      if (type === "forgot") {
        const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "recovery" });
        if (error) throw error;
        const { error: passError } = await supabase.auth.updateUser({ password: newPassword });
        if (passError) throw passError;
        showToast("Password na-update! Mag-login na.", "success");
        onSuccess("login");
      } else {
        const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
        if (error) throw error;
        onSuccess();
      }
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      if (type === "forgot") await supabase.auth.resetPasswordForEmail(email);
      else await supabase.auth.signInWithOtp({ email });
      setResendTimer(60);
      showToast("Bagong OTP code na-send!", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-forest-700 px-4 py-5 flex items-center gap-3">
        <button onClick={onBack} className="text-white text-xl">
          ←
        </button>
        <h2 className="text-white font-bold text-lg">
          {type === "forgot" ? "I-reset ang Password" : "OTP Verification"}
        </h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 max-w-md mx-auto w-full">
        <div className="w-16 h-16 bg-forest-100 rounded-2xl flex items-center justify-center mb-4 text-3xl">
          {type === "forgot" ? "🔑" : "📱"}
        </div>
        <h3 className="text-lg font-black text-gray-800 mb-1 text-center">Ilagay ang OTP Code</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          Nag-send kami ng 6-digit code sa{" "}
          <span className="font-semibold text-forest-700">{email}</span>
        </p>
        <OTPInput value={otp} onChange={setOtp} />
        {type === "forgot" && (
          <div className="w-full mt-4">
            <Field
              label="Bagong Password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Min. 6 characters"
              type="password"
            />
          </div>
        )}
        <button
          onClick={handleVerify}
          disabled={loading || otp.length < 6}
          className="w-full bg-gold-400 text-forest-900 font-bold py-4 rounded-2xl mt-6 disabled:opacity-60 active:scale-95 transition-transform"
        >
          {loading
            ? "Sine-check..."
            : type === "forgot"
            ? "I-reset ang Password"
            : "I-verify →"}
        </button>
        <button
          onClick={handleResend}
          disabled={resendTimer > 0}
          className="mt-4 text-sm font-medium disabled:text-gray-400 text-forest-700"
        >
          {resendTimer > 0 ? `Mag-resend sa ${resendTimer}s` : "Hindi natanggap? Mag-resend"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PENDING SCREEN
// ═══════════════════════════════════════════════════════════════
function PendingScreen({ business, onLogout }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 bg-yellow-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">
          ⏳
        </div>
        <h1 className="text-2xl font-black text-gray-800">Nasa Review Pa</h1>
        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
          Salamat sa pag-sign up,{" "}
          <span className="font-semibold">{business?.name}</span>! Ang iyong account ay
          kasalukuyang sinusuri ng aming team.
        </p>
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-left space-y-2">
          <p className="text-sm font-bold text-yellow-800">📋 Susunod na Hakbang:</p>
          <p className="text-xs text-yellow-700">• Aabisuhan ka namin sa loob ng 24 oras</p>
          <p className="text-xs text-yellow-700">• Tingnan ang iyong email para sa update</p>
          <p className="text-xs text-yellow-700">• Makipag-ugnayan sa amin kung may katanungan</p>
        </div>
        <div className="mt-4 bg-white border border-gray-100 rounded-2xl p-4 text-left space-y-2 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase">Makipag-ugnayan</p>
          <p className="text-sm text-gray-700">📧 {SUPER_ADMIN_EMAIL}</p>
          <p className="text-sm text-gray-700">📱 {ADMIN_PHONE}</p>
        </div>
        <button
          onClick={onLogout}
          className="mt-6 w-full bg-gray-100 text-gray-600 font-semibold py-3 rounded-2xl text-sm"
        >
          Mag-logout
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REJECTED SCREEN
// ═══════════════════════════════════════════════════════════════
function RejectedScreen({ business, onLogout }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">
          ❌
        </div>
        <h1 className="text-2xl font-black text-gray-800">Hindi Na-approve</h1>
        <p className="text-gray-500 text-sm mt-2">
          Hindi na-approve ang account ng{" "}
          <span className="font-semibold">{business?.name}</span>.
        </p>
        {business?.rejection_reason && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-red-700 mb-1">Dahilan:</p>
            <p className="text-sm text-red-600">{business.rejection_reason}</p>
          </div>
        )}
        <div className="mt-4 bg-white border border-gray-100 rounded-2xl p-4 text-left shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">
            Makipag-ugnayan para sa tulong
          </p>
          <p className="text-sm text-gray-700">📧 {SUPER_ADMIN_EMAIL}</p>
          <p className="text-sm text-gray-700">📱 {ADMIN_PHONE}</p>
        </div>
        <button
          onClick={onLogout}
          className="mt-6 w-full bg-gray-100 text-gray-600 font-semibold py-3 rounded-2xl text-sm"
        >
          Mag-logout
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TRIAL EXPIRED SCREEN
// ═══════════════════════════════════════════════════════════════
function TrialExpiredScreen({ business, onLogout }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">
            ⏰
          </div>
          <h1 className="text-2xl font-black text-gray-800">Na-expire na ang Trial</h1>
          <p className="text-gray-500 text-sm mt-2">
            Ang 7-day na libreng trial ng{" "}
            <span className="font-semibold">{business?.name}</span> ay natapos na.
          </p>
        </div>
        <p className="text-sm font-bold text-gray-700 mb-3 text-center">
          Pumili ng subscription plan:
        </p>
        <div className="space-y-3">
          {Object.entries(PLANS).map(([key, plan]) => (
            <div key={key} className="bg-white border-2 border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-gray-800">{plan.label}</p>
                  <p className="text-xs text-gray-500">{plan.desc}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {plan.branches === 999 ? "Unlimited" : plan.branches} branch •{" "}
                    {plan.staff === 999 ? "Unlimited" : plan.staff} staff
                  </p>
                </div>
                <p className="text-xl font-black text-forest-700">
                  ₱{plan.price}
                  <span className="text-xs font-medium text-gray-400">/buwan</span>
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 bg-forest-50 border border-forest-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-forest-800 mb-2">💳 Paano Mag-subscribe:</p>
          <p className="text-xs text-forest-700">1. Pumili ng plan sa itaas</p>
          <p className="text-xs text-forest-700">2. Mag-GCash o Maya sa:</p>
          <p className="text-sm font-black text-forest-800 mt-1">📱 {ADMIN_GCASH}</p>
          <p className="text-xs text-forest-700 mt-1">3. I-send ang screenshot ng resibo sa:</p>
          <p className="text-xs font-semibold text-forest-800">{SUPER_ADMIN_EMAIL}</p>
          <p className="text-xs text-forest-700 mt-1">4. Ia-activate ang account sa loob ng 24 oras</p>
        </div>
        <button
          onClick={onLogout}
          className="mt-4 w-full bg-gray-100 text-gray-600 font-semibold py-3 rounded-2xl text-sm"
        >
          Mag-logout
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TRIAL BANNER
// ═══════════════════════════════════════════════════════════════
function TrialBanner({ business }) {
  const daysLeft = getTrialDaysLeft(business?.trial_ends_at);
  if (business?.status === "approved" && business?.plan === "business") return null;
  if (business?.status !== "trial" && business?.plan !== "trial") return null;
  const color =
    daysLeft <= 2 ? "bg-red-500" : daysLeft <= 4 ? "bg-yellow-500" : "bg-blue-500";
  return (
    <div className={`${color} text-white text-center text-xs py-2 px-4 font-medium`}>
      {daysLeft <= 0
        ? "⚠️ Na-expire na ang iyong trial!"
        : `⏰ Free Trial: ${daysLeft} araw na lang! Mag-subscribe na para mapatuloy.`}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUPER ADMIN PANEL
// ═══════════════════════════════════════════════════════════════
function SuperAdminPanel({ showToast }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("businesses")
      .select(`*, profiles!businesses_owner_id_fkey(full_name)`)
      .order("created_at", { ascending: false });
    setBusinesses(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  const approve = async (biz) => {
    const { error } = await supabase
      .from("businesses")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        plan: "trial",
      })
      .eq("id", biz.id);
    if (error) return showToast("May error. Subukan muli.", "error");
    showToast(`Na-approve na si ${biz.name}!`, "success");
    fetchBusinesses();
  };

  const reject = async () => {
    if (!rejectReason.trim()) return showToast("Ilagay ang dahilan ng rejection.", "error");
    const { error } = await supabase
      .from("businesses")
      .update({ status: "rejected", rejection_reason: rejectReason.trim() })
      .eq("id", rejectModal.id);
    if (error) return showToast("May error. Subukan muli.", "error");
    showToast(`Na-reject si ${rejectModal.name}.`, "success");
    setRejectModal(null);
    setRejectReason("");
    fetchBusinesses();
  };

  const suspend = async (biz) => {
    if (!window.confirm(`I-suspend ang ${biz.name}?`)) return;
    await supabase.from("businesses").update({ status: "suspended" }).eq("id", biz.id);
    showToast(`Na-suspend si ${biz.name}.`, "success");
    fetchBusinesses();
  };

  const extendTrial = async (biz) => {
    const newEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("businesses")
      .update({ trial_ends_at: newEnd, status: "approved" })
      .eq("id", biz.id);
    showToast(`Na-extend ang trial ni ${biz.name}!`, "success");
    fetchBusinesses();
  };

  const upgradePlan = async (biz, plan) => {
    await supabase
      .from("businesses")
      .update({
        plan,
        status: "approved",
        trial_ends_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", biz.id);
    showToast(`Na-upgrade si ${biz.name} sa ${plan}!`, "success");
    fetchBusinesses();
  };

  const filtered = businesses.filter((b) => (filter === "all" ? true : b.status === filter));

  const STATUS_COLORS = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-forest-100 text-forest-700",
    trial: "bg-blue-100 text-blue-700",
    rejected: "bg-red-100 text-red-700",
    suspended: "bg-gray-100 text-gray-700",
    expired: "bg-orange-100 text-orange-700",
  };

  const FILTERS = ["all", "pending", "approved", "rejected", "suspended"];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-purple-700 px-4 pt-6 pb-4">
        <p className="text-purple-200 text-xs font-medium uppercase tracking-widest">Super Admin</p>
        <h1 className="text-white font-black text-xl">ListaKo Admin Panel</h1>
        <p className="text-purple-300 text-xs mt-1">Maligayang pagdating, Crael! 👑</p>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-4 gap-2">
        {["pending", "approved", "rejected", "suspended"].map((s) => (
          <div
            key={s}
            className="bg-white rounded-xl p-2 text-center shadow-sm border border-gray-100"
          >
            <p className="text-lg font-black text-gray-800">
              {businesses.filter((b) => b.status === s).length}
            </p>
            <p className="text-xs text-gray-400 capitalize">{s}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap ${
              filter === f
                ? "bg-purple-700 text-white"
                : "bg-white text-gray-500 border border-gray-200"
            }`}
          >
            {f === "all" ? "Lahat" : f.charAt(0).toUpperCase() + f.slice(1)} (
            {businesses.filter((b) => (f === "all" ? true : b.status === f)).length})
          </button>
        ))}
      </div>

      {/* Business List */}
      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <p className="text-3xl mb-2">🏪</p>
            <p className="text-gray-500 text-sm">Walang businesses dito.</p>
          </div>
        ) : (
          filtered.map((biz) => {
            const daysLeft = getTrialDaysLeft(biz.trial_ends_at);
            return (
              <div
                key={biz.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 truncate">{biz.name}</p>
                    <p className="text-xs text-gray-500">{biz.address || "Walang address"}</p>
                    <p className="text-xs text-gray-400">{biz.phone || "Walang number"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Nag-sign up: {new Date(biz.created_at).toLocaleDateString("en-PH")}
                    </p>
                    {biz.trial_ends_at && biz.status !== "rejected" && (
                      <p
                        className={`text-xs mt-0.5 font-medium ${
                          daysLeft <= 2 ? "text-red-500" : "text-blue-500"
                        }`}
                      >
                        Trial: {daysLeft > 0 ? `${daysLeft} araw na lang` : "Na-expire na"}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_COLORS[biz.status] || "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {biz.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                      {biz.plan || "trial"}
                    </span>
                  </div>
                </div>
                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {biz.status === "pending" && (
                    <>
                      <button
                        onClick={() => approve(biz)}
                        className="text-xs bg-forest-600 text-white px-3 py-1.5 rounded-lg font-bold"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => setRejectModal(biz)}
                        className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-bold"
                      >
                        ✕ Reject
                      </button>
                    </>
                  )}
                  {(biz.status === "approved" || biz.status === "trial") && (
                    <>
                      <button
                        onClick={() => extendTrial(biz)}
                        className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium"
                      >
                        +7 days
                      </button>
                      <select
                        onChange={(e) => e.target.value && upgradePlan(biz, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Upgrade Plan
                        </option>
                        <option value="basic">Basic ₱199</option>
                        <option value="pro">Pro ₱399</option>
                        <option value="business">Business ₱699</option>
                      </select>
                      <button
                        onClick={() => suspend(biz)}
                        className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-medium"
                      >
                        Suspend
                      </button>
                    </>
                  )}
                  {biz.status === "rejected" && (
                    <button
                      onClick={() => approve(biz)}
                      className="text-xs bg-forest-50 text-forest-600 px-3 py-1.5 rounded-lg font-medium"
                    >
                      I-approve na
                    </button>
                  )}
                  {biz.status === "suspended" && (
                    <button
                      onClick={() => approve(biz)}
                      className="text-xs bg-forest-50 text-forest-600 px-3 py-1.5 rounded-lg font-medium"
                    >
                      I-restore
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-40">
          <div className="bg-white w-full rounded-t-3xl p-5">
            <h3 className="font-bold text-gray-800 mb-1">I-reject si {rejectModal.name}?</h3>
            <p className="text-xs text-gray-500 mb-3">
              Ilagay ang dahilan para malaman ng owner.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Halimbawa: Incomplete information, suspicious account, etc."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm"
              >
                Kanselahin
              </button>
              <button
                onClick={reject}
                className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl text-sm"
              >
                I-reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LANDING SCREEN
// ═══════════════════════════════════════════════════════════════
function LedgerIcon({ className = "w-10 h-10", color = "#c9a84c" }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none">
      <path d="M12 14h18M12 22h14M12 30h10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M30 22l6 6-6 6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ListaKoLogo({ size = "text-4xl", light = false }) {
  return (
    <h1 className={`${size} font-black tracking-tight ${light ? "text-white" : "text-ivory-50"}`}>
      Lista<span className="font-playfair italic text-gold-400">Ko</span>
    </h1>
  );
}

function LandingScreen({ onShowSignup, onShowLogin }) {
  return (
    <div className="min-h-screen bg-forest-800 flex flex-col items-center justify-between px-6 py-12">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-forest-700 rounded-3xl flex items-center justify-center shadow-xl mb-6 border border-forest-600">
          <LedgerIcon className="w-10 h-10" />
        </div>
        <ListaKoLogo size="text-4xl" />
        <p className="text-gold-400 text-xs font-medium mb-2 tracking-[0.25em] uppercase mt-1">
          Business Manager
        </p>
        <p className="text-forest-200 text-sm mt-6 max-w-xs leading-relaxed">
          Track revenue, inventory, and staff — with precision. Built for every Filipino store.
        </p>
        <div className="mt-4 bg-forest-700 bg-opacity-60 rounded-2xl px-5 py-2.5 border border-forest-600">
          <p className="text-gold-400 text-xs font-semibold tracking-wider uppercase">
            Complimentary Access
          </p>
          <p className="text-forest-300 text-xs mt-0.5">
            7 Days · No commitment required
          </p>
        </div>
      </div>
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={onShowSignup}
          className="w-full bg-gold-400 text-forest-900 font-bold py-4 rounded-2xl text-sm tracking-wider uppercase shadow-lg active:scale-95 transition-transform"
        >
          Create Account
        </button>
        <button
          onClick={onShowLogin}
          className="w-full bg-transparent text-ivory-200 font-semibold py-4 rounded-2xl text-sm border border-forest-500 active:scale-95 transition-transform tracking-wider uppercase"
        >
          Sign In
        </button>
        <p className="text-forest-400 text-xs text-center pt-2">
          ListaKo · For every business in the Philippines
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIGN UP SCREEN
// ═══════════════════════════════════════════════════════════════
function SignupScreen({ onBack, onSuccess, showToast }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    business_name: "",
    business_address: "",
    business_phone: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleNext = () => {
    if (!form.full_name.trim()) return showToast("Ilagay ang iyong buong pangalan.", "error");
    if (!form.email.trim()) return showToast("Ilagay ang email address.", "error");
    if (form.password.length < 6)
      return showToast("Ang password ay dapat hindi bababa sa 6 na karakter.", "error");
    if (form.password !== form.confirm_password)
      return showToast("Hindi tugma ang mga password.", "error");
    setStep(2);
  };

  const handleSignup = async () => {
    if (!form.business_name.trim())
      return showToast("Ilagay ang pangalan ng iyong negosyo.", "error");
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
      });
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Hindi na-create ang user.");

      const { data: biz, error: bizError } = await supabase
        .from("businesses")
        .insert({
          name: form.business_name.trim(),
          owner_id: userId,
          address: form.business_address.trim(),
          phone: form.business_phone.trim(),
        })
        .select()
        .maybeSingle();
      if (bizError) throw bizError;
      if (!biz) throw new Error("Hindi na-save ang business. Subukan muli.");
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        business_id: biz.id,
        branch_id: null,
        full_name: form.full_name.trim(),
        role: "owner",
      });
      if (profileError) throw profileError;

      showToast("Account na-gawa! Mag-login ka na.", "success");
      onSuccess();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ivory-100 flex flex-col">
      <div className="bg-forest-800 px-4 py-5 flex items-center gap-3">
        <button onClick={step === 1 ? onBack : () => setStep(1)} className="text-gold-400 text-xl">
          ←
        </button>
        <div>
          <h2 className="text-ivory-50 font-bold text-lg">Create Account</h2>
          <p className="text-forest-300 text-xs">Step {step} of 2 · 7-day complimentary access</p>
        </div>
      </div>
      <div className="h-1 bg-forest-200">
        <div
          className="h-1 bg-gold-400 transition-all duration-300"
          style={{ width: step === 1 ? "50%" : "100%" }}
        />
      </div>
      <div className="flex-1 px-5 py-6 space-y-4 max-w-md mx-auto w-full">
        {step === 1 ? (
          <>
            <p className="text-gray-500 text-sm">Impormasyon ng Account</p>
            <Field
              label="Buong Pangalan"
              value={form.full_name}
              onChange={(v) => set("full_name", v)}
              placeholder="Juan dela Cruz"
            />
            <Field
              label="Email Address"
              value={form.email}
              onChange={(v) => set("email", v)}
              placeholder="juan@email.com"
              type="email"
            />
            <Field
              label="Password"
              value={form.password}
              onChange={(v) => set("password", v)}
              placeholder="Min. 6 characters"
              type="password"
            />
            <Field
              label="Ulitin ang Password"
              value={form.confirm_password}
              onChange={(v) => set("confirm_password", v)}
              placeholder="Ilagay muli"
              type="password"
            />
            <button
              onClick={handleNext}
              className="w-full bg-gold-400 text-forest-900 font-bold py-4 rounded-2xl active:scale-95 transition-transform tracking-wide"
            >
              Next →
            </button>
          </>
        ) : (
          <>
            <p className="text-gray-500 text-sm">Impormasyon ng Negosyo</p>
            <Field
              label="Pangalan ng Tindahan / Negosyo"
              value={form.business_name}
              onChange={(v) => set("business_name", v)}
              placeholder="Halimbawa: Rosa's Grocery"
            />
            <Field
              label="Address ng Negosyo"
              value={form.business_address}
              onChange={(v) => set("business_address", v)}
              placeholder="Iligan City, Lanao del Norte"
            />
            <Field
              label="Numero ng Telepono (opsyonal)"
              value={form.business_phone}
              onChange={(v) => set("business_phone", v)}
              placeholder="09XXXXXXXXX"
              type="tel"
            />
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-700 font-medium">
                ℹ️ Ang iyong account ay irereview ng aming team bago ma-activate. Aabisuhan ka sa
                loob ng 24 oras.
              </p>
            </div>
            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full bg-gold-400 text-forest-900 font-bold py-4 rounded-2xl disabled:opacity-60 active:scale-95 transition-transform tracking-wide"
            >
              {loading ? "Ginagawa ang account..." : "Gumawa ng Account ✓"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════
function LoginScreen({ onBack, onSuccess, onForgotPassword, showToast }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 5 * 60 * 1000;

  const handleLogin = async () => {
    if (lockedUntil && new Date() < lockedUntil) {
      const mins = Math.ceil((lockedUntil - new Date()) / 60000);
      return showToast(`Account locked. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`, "error");
    }
    if (!form.email.trim()) return showToast("Ilagay ang iyong email address.", "error");
    if (!form.password) return showToast("Ilagay ang iyong password.", "error");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (error) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          const lockTime = new Date(Date.now() + LOCKOUT_MS);
          setLockedUntil(lockTime);
          setAttempts(0);
          showToast(`Too many failed attempts. Locked for 5 minutes.`, "error");
          return;
        }
        throw error;
      }
      setAttempts(0);
      setLockedUntil(null);
      onSuccess();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ivory-100 flex flex-col">
      <div className="bg-forest-800 px-4 py-5 flex items-center gap-3">
        <button onClick={onBack} className="text-gold-400 text-xl">
          ←
        </button>
        <h2 className="text-ivory-50 font-bold text-lg">Sign In</h2>
      </div>
      <div className="flex-1 flex flex-col justify-center px-5 py-6 space-y-4 max-w-md mx-auto w-full">
        <div className="text-center mb-2">
          <div className="w-16 h-16 bg-forest-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <LedgerIcon className="w-8 h-8" />
          </div>
          <p className="text-gray-500 text-sm">Enter your ListaKo credentials</p>
        </div>
        <Field
          label="Email Address"
          value={form.email}
          onChange={(v) => set("email", v)}
          placeholder="juan@email.com"
          type="email"
        />
        <Field
          label="Password"
          value={form.password}
          onChange={(v) => set("password", v)}
          placeholder="Your password"
          type="password"
        />
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-gold-400 text-forest-900 font-bold py-4 rounded-2xl disabled:opacity-60 active:scale-95 transition-transform tracking-wide"
        >
          {loading ? "Signing in..." : "Sign In →"}
        </button>
        <button
          onClick={onForgotPassword}
          className="text-center text-sm text-forest-600 font-medium py-2"
        >
          Forgot password?
        </button>
        <p className="text-center text-xs text-gray-400">
          No account yet? Contact your store owner.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FORGOT PASSWORD SCREEN
// ═══════════════════════════════════════════════════════════════
function ForgotPasswordScreen({ onBack, onVerifyOTP, showToast }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) return showToast("Ilagay ang iyong email address.", "error");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      showToast("OTP code na-send sa iyong email!", "success");
      onVerifyOTP(email.trim(), "forgot");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ivory-100 flex flex-col">
      <div className="bg-forest-800 px-4 py-5 flex items-center gap-3">
        <button onClick={onBack} className="text-gold-400 text-xl">
          ←
        </button>
        <h2 className="text-ivory-50 font-bold text-lg">Forgot Password</h2>
      </div>
      <div className="flex-1 flex flex-col justify-center px-5 py-6 max-w-md mx-auto w-full space-y-4">
        <div className="text-center mb-2">
          <div className="w-16 h-16 bg-forest-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <LedgerIcon className="w-8 h-8" />
          </div>
          <h3 className="font-black text-gray-800 text-lg">Reset Password</h3>
          <p className="text-sm text-gray-500 mt-1">
            We'll send an OTP code to your email.
          </p>
        </div>
        <Field
          label="Email Address"
          value={email}
          onChange={setEmail}
          placeholder="juan@email.com"
          type="email"
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="w-full bg-gold-400 text-forest-900 font-bold py-4 rounded-2xl disabled:opacity-60 active:scale-95 transition-transform"
        >
          {loading ? "Nagpapadala..." : "Magpadala ng OTP Code 📧"}
        </button>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-700 font-medium">💡 Tips:</p>
          <p className="text-xs text-blue-600 mt-1">• Tingnan ang iyong email inbox at Spam folder</p>
          <p className="text-xs text-blue-600">• Ang code ay may bisa lamang ng 1 oras</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODAL + CARD + STATCARD
// ═══════════════════════════════════════════════════════════════
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-40">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-base">{title}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">
            ✕
          </button>
        </div>
        <div className="px-5 py-5 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`}>
      {children}
    </div>
  );
}

function StatCard({ icon, label, value, color = "bg-forest-50 text-forest-700" }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-lg font-black text-gray-800">{value}</p>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// OWNER DASHBOARD
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PENDING PRODUCT CARD — Owner reviews and activates
// ═══════════════════════════════════════════════════════════════
function PendingProductCard({ product, onActivate, showToast }) {
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const activate = async () => {
    if (!price || isNaN(Number(price)) || Number(price) <= 0)
      return showToast("Ilagay ang tamang presyo.", "error");
    if (stock === "" || isNaN(Number(stock)))
      return showToast("Ilagay ang stock quantity.", "error");
    setSaving(true);
    const { error } = await supabase
      .from("products")
      .update({
        price: Number(price),
        stock_quantity: Number(stock),
        status: "active",
      })
      .eq("id", product.id);
    setSaving(false);
    if (error) return showToast("Hindi na-save. Subukan muli.", "error");
    showToast(`${product.name} activated!`, "success");
    onActivate();
  };

  const reject = async () => {
    if (!window.confirm(`I-delete ang "${product.name}"?`)) return;
    setRejecting(true);
    await supabase.from("products").delete().eq("id", product.id);
    showToast(`${product.name} deleted.`, "success");
    onActivate();
  };

  return (
    <Card className="p-4 border-l-4 border-yellow-400">
      <div className="mb-3">
        <p className="font-bold text-gray-800 text-sm">{product.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Barcode: <span className="font-mono">{product.barcode || "N/A"}</span>
        </p>
        <span className="inline-block mt-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
          Scanned by Cashier — Pending Review
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Set Price (₱)
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Set Stock
          </label>
          <input
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="0"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={activate}
          disabled={saving}
          className="flex-1 bg-forest-600 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60"
        >
          {saving ? "Saving..." : "✓ Activate Product"}
        </button>
        <button
          onClick={reject}
          disabled={rejecting}
          className="bg-red-50 text-red-500 font-semibold px-4 py-2.5 rounded-xl text-sm"
        >
          ✕
        </button>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// DISCOUNT SETTINGS CARD — Complete 9-setting control panel
// ═══════════════════════════════════════════════════════════════
function DiscountSettingsCard({ business, showToast, onSaved }) {
  const [settings, setSettings] = useState({
    discount_enabled: business.discount_enabled !== false,
    discount_types_allowed: business.discount_types_allowed || "both",
    max_discount_percent: String(business.max_discount_percent || 20),
    max_discount_fixed: String(business.max_discount_fixed || 500),
    discount_min_quantity: String(business.discount_min_quantity || 3),
    discount_min_amount: String(business.discount_min_amount || 200),
    max_discounts_per_cashier_per_day: String(business.max_discounts_per_cashier_per_day || 10),
    manager_approval_threshold: String(business.manager_approval_threshold || 15),
    suki_discount_percent: String(business.suki_discount_percent || 5),
    senior_pwd_discount_percent: String(business.senior_pwd_discount_percent || 20),
    discount_start_time: business.discount_start_time || "00:00",
    discount_end_time: business.discount_end_time || "23:59",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    await supabase.from("businesses").update({
      discount_enabled: settings.discount_enabled,
      discount_types_allowed: settings.discount_types_allowed,
      max_discount_percent: Number(settings.max_discount_percent),
      max_discount_fixed: Number(settings.max_discount_fixed),
      discount_min_quantity: Number(settings.discount_min_quantity),
      discount_min_amount: Number(settings.discount_min_amount),
      max_discounts_per_cashier_per_day: Number(settings.max_discounts_per_cashier_per_day),
      manager_approval_threshold: Number(settings.manager_approval_threshold),
      suki_discount_percent: Number(settings.suki_discount_percent),
      senior_pwd_discount_percent: Number(settings.senior_pwd_discount_percent),
      discount_start_time: settings.discount_start_time,
      discount_end_time: settings.discount_end_time,
    }).eq("id", business.id);
    setSaving(false);
    showToast("Discount settings saved!", "success");
    onSaved();
  };

  return (
    <Card className="p-4">
      <p className="text-sm font-bold text-gray-700 mb-1">🏷️ Discount Control Panel</p>
      <p className="text-xs text-gray-400 mb-4">Full control over how discounts work in your store.</p>

      {/* Setting 1 — Enable/Disable */}
      <div className="flex items-center justify-between mb-4 bg-gray-50 rounded-xl p-3">
        <div>
          <p className="text-sm font-bold text-gray-700">Discounts Enabled</p>
          <p className="text-xs text-gray-400">Turn off to block all discounts immediately</p>
        </div>
        <button
          onClick={() => set("discount_enabled", !settings.discount_enabled)}
          className={`w-12 h-6 rounded-full transition-colors relative ${
            settings.discount_enabled ? "bg-forest-500" : "bg-gray-300"
          }`}
        >
          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
            settings.discount_enabled ? "left-6" : "left-0.5"
          }`} />
        </button>
      </div>

      {settings.discount_enabled && (
        <div className="space-y-4">

          {/* Setting 2 — Allowed Types */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Allowed Discount Types</p>
            <div className="flex gap-2">
              {[
                { key: "both", label: "Both % and ₱" },
                { key: "percent", label: "% Only" },
                { key: "fixed", label: "₱ Only" },
              ].map(t => (
                <button key={t.key} onClick={() => set("discount_types_allowed", t.key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${
                    settings.discount_types_allowed === t.key
                      ? "bg-forest-600 text-white border-forest-600"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Settings 3 & 4 — Max % and Max ₱ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Max % Discount</p>
              <div className="relative">
                <input type="number" value={settings.max_discount_percent}
                  onChange={e => set("max_discount_percent", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 pr-8" />
                <span className="absolute right-3 top-2 text-gray-400 text-sm">%</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Max ₱ Discount</p>
              <div className="relative">
                <input type="number" value={settings.max_discount_fixed}
                  onChange={e => set("max_discount_fixed", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 pl-6" />
                <span className="absolute left-3 top-2 text-gray-400 text-sm">₱</span>
              </div>
            </div>
          </div>

          {/* Settings 5 & 6 — Bundle Rules */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs font-bold text-blue-700 mb-2">📦 Bundle Discount Rules</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Min Quantity</p>
                <input type="number" value={settings.discount_min_quantity}
                  onChange={e => set("discount_min_quantity", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                <p className="text-xs text-gray-400 mt-1">Same item pieces</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Min Total</p>
                <div className="relative">
                  <input type="number" value={settings.discount_min_amount}
                    onChange={e => set("discount_min_amount", e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white pl-6" />
                  <span className="absolute left-3 top-2 text-gray-400 text-sm">₱</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Cart total minimum</p>
              </div>
            </div>
          </div>

          {/* Setting 7 — Max per cashier per day */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Max Discounts Per Cashier Per Day</p>
            <input type="number" value={settings.max_discounts_per_cashier_per_day}
              onChange={e => set("max_discounts_per_cashier_per_day", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500" />
            <p className="text-xs text-gray-400 mt-1">After this limit, cashier cannot give more discounts today</p>
          </div>

          {/* Setting 8 — Manager approval threshold */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Require Manager Approval Above</p>
            <div className="relative">
              <input type="number" value={settings.manager_approval_threshold}
                onChange={e => set("manager_approval_threshold", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 pr-8" />
              <span className="absolute right-3 top-2 text-gray-400 text-sm">%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Discounts above this % need owner approval first</p>
          </div>

          {/* Setting 9a — Suki discount */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Suki / Loyalty Discount</p>
            <div className="relative">
              <input type="number" value={settings.suki_discount_percent}
                onChange={e => set("suki_discount_percent", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 pr-8" />
              <span className="absolute right-3 top-2 text-gray-400 text-sm">%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Auto-applied for registered suki customers</p>
          </div>

          {/* Setting 9b — Senior/PWD discount */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Senior Citizen / PWD Discount</p>
            <div className="relative">
              <input type="number" value={settings.senior_pwd_discount_percent}
                onChange={e => set("senior_pwd_discount_percent", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 pr-8" />
              <span className="absolute right-3 top-2 text-gray-400 text-sm">%</span>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 mt-1">
              <p className="text-xs text-yellow-700 font-medium">⚖️ Required by Philippine Law — RA 9994 (Senior Citizens) and RA 7277 (PWD Act)</p>
            </div>
          </div>

          {/* Setting 10 — Time restrictions */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Discount Allowed Hours</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">Start Time</p>
                <input type="time" value={settings.discount_start_time}
                  onChange={e => set("discount_start_time", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">End Time</p>
                <input type="time" value={settings.discount_end_time}
                  onChange={e => set("discount_end_time", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">Cashier cannot give discounts outside these hours</p>
          </div>

        </div>
      )}

      <button onClick={save} disabled={saving}
        className="w-full bg-forest-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 mt-4">
        {saving ? "Saving..." : "Save All Discount Settings"}
      </button>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// ANALYTICS DASHBOARD (Phase 6)
// ═══════════════════════════════════════════════════════════════
const CHART_COLORS = ["#1e5631", "#d4af37", "#3d7249", "#c9a84c", "#6b9a74", "#a8872a", "#a8c5af", "#866a22", "#d4e2d7", "#6b5520"];

function AnalyticsDashboard({ business, branches, showToast }) {
  const [analyticsTab, setAnalyticsTab] = useState("revenue");
  const [timeFilter, setTimeFilter] = useState("week");
  const [branchFilter, setBranchFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState({ daily: [], weekly: [], monthly: [] });
  const [bestSellers, setBestSellers] = useState([]);
  const [slowMovers, setSlowMovers] = useState([]);
  const [cashierStats, setCashierStats] = useState([]);
  const [branchStats, setBranchStats] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [exportingPDF, setExportingPDF] = useState(false);

  const ANALYTICS_TABS = [
    { key: "revenue", label: "Revenue" },
    { key: "products", label: "Products" },
    { key: "cashiers", label: "Cashiers" },
    { key: "branches", label: "Branches" },
    { key: "shifts", label: "Shifts" },
  ];

  const TIME_FILTERS = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
  ];

  const getDateRange = useCallback((filter) => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);
    if (filter === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (filter === "week") {
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }
    return { start, end };
  }, []);

  const fetchRevenue = useCallback(async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    let query = supabase
      .from("transactions")
      .select("total_amount, created_at, branch_id")
      .eq("business_id", business.id)
      .eq("status", "completed")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at");
    if (branchFilter !== "all") query = query.eq("branch_id", branchFilter);
    const { data: txns } = await query;

    const dailyMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
      dailyMap[key] = 0;
    }
    (txns || []).forEach((tx) => {
      const d = new Date(tx.created_at);
      const key = d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
      if (dailyMap[key] !== undefined) dailyMap[key] += Number(tx.total_amount);
    });
    const daily = Object.entries(dailyMap).map(([name, revenue]) => ({ name, revenue: Math.round(revenue * 100) / 100 }));

    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(now.getDate() - 27);
    fourWeeksAgo.setHours(0, 0, 0, 0);
    let wQuery = supabase
      .from("transactions")
      .select("total_amount, created_at")
      .eq("business_id", business.id)
      .eq("status", "completed")
      .gte("created_at", fourWeeksAgo.toISOString());
    if (branchFilter !== "all") wQuery = wQuery.eq("branch_id", branchFilter);
    const { data: wTxns } = await wQuery;
    const weeklyMap = {};
    for (let w = 3; w >= 0; w--) {
      const wStart = new Date(now);
      wStart.setDate(now.getDate() - (w * 7 + 6));
      const wEnd = new Date(now);
      wEnd.setDate(now.getDate() - w * 7);
      const label = `Week ${4 - w}`;
      weeklyMap[label] = 0;
      (wTxns || []).forEach((tx) => {
        const d = new Date(tx.created_at);
        if (d >= wStart && d <= wEnd) weeklyMap[label] += Number(tx.total_amount);
      });
    }
    const weekly = Object.entries(weeklyMap).map(([name, revenue]) => ({ name, revenue: Math.round(revenue * 100) / 100 }));

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    let mQuery = supabase
      .from("transactions")
      .select("total_amount, created_at")
      .eq("business_id", business.id)
      .eq("status", "completed")
      .gte("created_at", sixMonthsAgo.toISOString());
    if (branchFilter !== "all") mQuery = mQuery.eq("branch_id", branchFilter);
    const { data: mTxns } = await mQuery;
    const monthlyMap = {};
    for (let m = 5; m >= 0; m--) {
      const mDate = new Date(now);
      mDate.setMonth(now.getMonth() - m);
      const label = mDate.toLocaleDateString("en-PH", { month: "short", year: "2-digit" });
      monthlyMap[label] = 0;
    }
    (mTxns || []).forEach((tx) => {
      const d = new Date(tx.created_at);
      const label = d.toLocaleDateString("en-PH", { month: "short", year: "2-digit" });
      if (monthlyMap[label] !== undefined) monthlyMap[label] += Number(tx.total_amount);
    });
    const monthly = Object.entries(monthlyMap).map(([name, revenue]) => ({ name, revenue: Math.round(revenue * 100) / 100 }));

    setRevenueData({ daily, weekly, monthly });
  }, [business.id, branchFilter]);

  const fetchBestSellers = useCallback(async () => {
    const { start } = getDateRange(timeFilter);
    let query = supabase
      .from("transaction_items")
      .select("product_id, product_name, quantity, subtotal, transactions!inner(business_id, status, created_at, branch_id)")
      .eq("transactions.business_id", business.id)
      .eq("transactions.status", "completed")
      .gte("transactions.created_at", start.toISOString());
    if (branchFilter !== "all") query = query.eq("transactions.branch_id", branchFilter);
    const { data } = await query;

    const productMap = {};
    (data || []).forEach((item) => {
      if (!productMap[item.product_id]) {
        productMap[item.product_id] = { name: item.product_name, qty: 0, revenue: 0 };
      }
      productMap[item.product_id].qty += item.quantity;
      productMap[item.product_id].revenue += Number(item.subtotal);
    });
    const sorted = Object.entries(productMap)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
    setBestSellers(sorted);
  }, [business.id, timeFilter, branchFilter, getDateRange]);

  const fetchSlowMovers = useCallback(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let query = supabase
      .from("transaction_items")
      .select("product_id, transactions!inner(business_id, status, created_at)")
      .eq("transactions.business_id", business.id)
      .eq("transactions.status", "completed")
      .gte("transactions.created_at", thirtyDaysAgo.toISOString());
    const { data: recentSales } = await query;
    const soldIds = new Set((recentSales || []).map((i) => i.product_id));

    const { data: allProducts } = await supabase
      .from("products")
      .select("id, name, price, stock_quantity, category")
      .eq("business_id", business.id)
      .eq("status", "active")
      .order("name");
    const slow = (allProducts || []).filter((p) => !soldIds.has(p.id));
    setSlowMovers(slow);
  }, [business.id]);

  const fetchCashierStats = useCallback(async () => {
    const { start } = getDateRange(timeFilter);
    let query = supabase
      .from("transactions")
      .select("cashier_id, total_amount, created_at, profiles!inner(full_name)")
      .eq("business_id", business.id)
      .eq("status", "completed")
      .gte("created_at", start.toISOString());
    if (branchFilter !== "all") query = query.eq("branch_id", branchFilter);
    const { data } = await query;

    const cashierMap = {};
    (data || []).forEach((tx) => {
      const cid = tx.cashier_id;
      if (!cashierMap[cid]) {
        cashierMap[cid] = { name: tx.profiles?.full_name || "Unknown", txCount: 0, revenue: 0 };
      }
      cashierMap[cid].txCount += 1;
      cashierMap[cid].revenue += Number(tx.total_amount);
    });
    const sorted = Object.entries(cashierMap)
      .map(([id, v]) => ({ id, ...v, avg: v.txCount > 0 ? v.revenue / v.txCount : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
    setCashierStats(sorted);
  }, [business.id, timeFilter, branchFilter, getDateRange]);

  const fetchBranchStats = useCallback(async () => {
    const { start } = getDateRange(timeFilter);
    const { data } = await supabase
      .from("transactions")
      .select("branch_id, total_amount")
      .eq("business_id", business.id)
      .eq("status", "completed")
      .gte("created_at", start.toISOString());

    const branchMap = {};
    (branches || []).forEach((b) => { branchMap[b.id] = { name: b.name, revenue: 0, txCount: 0 }; });
    (data || []).forEach((tx) => {
      if (branchMap[tx.branch_id]) {
        branchMap[tx.branch_id].revenue += Number(tx.total_amount);
        branchMap[tx.branch_id].txCount += 1;
      }
    });
    const sorted = Object.values(branchMap).sort((a, b) => b.revenue - a.revenue);
    setBranchStats(sorted);
  }, [business.id, branches, timeFilter, getDateRange]);

  const fetchShifts = useCallback(async () => {
    const { start } = getDateRange(timeFilter);
    let query = supabase
      .from("shifts")
      .select("*, profiles!inner(full_name)")
      .eq("business_id", business.id)
      .gte("started_at", start.toISOString())
      .order("started_at", { ascending: false })
      .limit(50);
    if (branchFilter !== "all") query = query.eq("branch_id", branchFilter);
    const { data } = await query;
    setShifts(data || []);
  }, [business.id, timeFilter, branchFilter, getDateRange]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([
        fetchRevenue(),
        fetchBestSellers(),
        fetchSlowMovers(),
        fetchCashierStats(),
        fetchBranchStats(),
        fetchShifts(),
      ]);
      setLoading(false);
    };
    load();
  }, [fetchRevenue, fetchBestSellers, fetchSlowMovers, fetchCashierStats, fetchBranchStats, fetchShifts]);

  const totalRevenue = useMemo(() => revenueData.daily.reduce((s, d) => s + d.revenue, 0), [revenueData.daily]);

  const exportPDF = () => {
    setExportingPDF(true);
    const printDiv = document.createElement("div");
    printDiv.id = "print-analytics";
    printDiv.style.cssText = "padding:20px;font-family:sans-serif;font-size:12px;color:#000;";

    let html = `<h1 style="font-size:18px;margin-bottom:4px;">${business.name} — Analytics Report</h1>`;
    html += `<p style="font-size:11px;color:#666;margin-bottom:16px;">Generated: ${new Date().toLocaleDateString("en-PH", { dateStyle: "long" })}</p>`;
    html += `<hr style="border-top:1px solid #ccc;margin-bottom:12px;">`;

    html += `<h2 style="font-size:14px;margin-bottom:8px;">7-Day Revenue</h2>`;
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">`;
    html += `<tr style="background:#f0f0f0;"><th style="text-align:left;padding:4px 8px;border:1px solid #ddd;">Day</th><th style="text-align:right;padding:4px 8px;border:1px solid #ddd;">Revenue</th></tr>`;
    revenueData.daily.forEach((d) => {
      html += `<tr><td style="padding:4px 8px;border:1px solid #ddd;">${d.name}</td><td style="text-align:right;padding:4px 8px;border:1px solid #ddd;">₱${d.revenue.toFixed(2)}</td></tr>`;
    });
    html += `<tr style="font-weight:bold;"><td style="padding:4px 8px;border:1px solid #ddd;">Total</td><td style="text-align:right;padding:4px 8px;border:1px solid #ddd;">₱${totalRevenue.toFixed(2)}</td></tr>`;
    html += `</table>`;

    html += `<h2 style="font-size:14px;margin-bottom:8px;">Top 10 Best Sellers</h2>`;
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">`;
    html += `<tr style="background:#f0f0f0;"><th style="text-align:left;padding:4px 8px;border:1px solid #ddd;">#</th><th style="text-align:left;padding:4px 8px;border:1px solid #ddd;">Product</th><th style="text-align:right;padding:4px 8px;border:1px solid #ddd;">Qty</th><th style="text-align:right;padding:4px 8px;border:1px solid #ddd;">Revenue</th></tr>`;
    bestSellers.forEach((p, i) => {
      html += `<tr><td style="padding:4px 8px;border:1px solid #ddd;">${i + 1}</td><td style="padding:4px 8px;border:1px solid #ddd;">${p.name}</td><td style="text-align:right;padding:4px 8px;border:1px solid #ddd;">${p.qty}</td><td style="text-align:right;padding:4px 8px;border:1px solid #ddd;">₱${p.revenue.toFixed(2)}</td></tr>`;
    });
    html += `</table>`;

    html += `<h2 style="font-size:14px;margin-bottom:8px;">Cashier Performance</h2>`;
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">`;
    html += `<tr style="background:#f0f0f0;"><th style="text-align:left;padding:4px 8px;border:1px solid #ddd;">Cashier</th><th style="text-align:right;padding:4px 8px;border:1px solid #ddd;">Transactions</th><th style="text-align:right;padding:4px 8px;border:1px solid #ddd;">Revenue</th><th style="text-align:right;padding:4px 8px;border:1px solid #ddd;">Avg</th></tr>`;
    cashierStats.forEach((c) => {
      html += `<tr><td style="padding:4px 8px;border:1px solid #ddd;">${c.name}</td><td style="text-align:right;padding:4px 8px;border:1px solid #ddd;">${c.txCount}</td><td style="text-align:right;padding:4px 8px;border:1px solid #ddd;">₱${c.revenue.toFixed(2)}</td><td style="text-align:right;padding:4px 8px;border:1px solid #ddd;">₱${c.avg.toFixed(2)}</td></tr>`;
    });
    html += `</table>`;

    printDiv.innerHTML = html;
    document.body.appendChild(printDiv);
    const origTitle = document.title;
    document.title = `${business.name} Analytics Report`;
    const style = document.createElement("style");
    style.textContent = `@media print { body > *:not(#print-analytics) { display: none !important; } #print-analytics { display: block !important; } }`;
    document.head.appendChild(style);
    window.print();
    document.body.removeChild(printDiv);
    document.head.removeChild(style);
    document.title = origTitle;
    setExportingPDF(false);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-forest-800 text-white px-3 py-2 rounded-xl shadow-lg text-xs">
        <p className="font-semibold">{label}</p>
        <p className="text-gold-300 font-black">₱{Number(payload[0].value).toFixed(2)}</p>
      </div>
    );
  };

  if (loading) return <div className="p-8 text-center"><Spinner /><p className="text-gray-400 text-xs mt-2">Loading analytics...</p></div>;

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* Analytics sub-tabs */}
      <div className="flex gap-1 overflow-x-auto hide-scrollbar -mx-1 px-1">
        {ANALYTICS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setAnalyticsTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              analyticsTab === t.key ? "bg-forest-600 text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      {analyticsTab !== "revenue" && (
        <div className="flex gap-2 flex-wrap">
          {TIME_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setTimeFilter(f.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium ${
                timeFilter === f.key ? "bg-gold-400 text-forest-900" : "bg-gray-100 text-gray-500"
              }`}
            >
              {f.label}
            </button>
          ))}
          {branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Branch filter for revenue tab */}
      {analyticsTab === "revenue" && branches.length > 1 && (
        <div className="flex gap-2">
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Export button */}
      <div className="flex justify-end">
        <button
          onClick={exportPDF}
          disabled={exportingPDF}
          className="text-xs bg-forest-700 text-gold-300 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
        >
          {exportingPDF ? "Exporting..." : "Export PDF"}
        </button>
      </div>

      {/* ─── REVENUE TAB ─── */}
      {analyticsTab === "revenue" && (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">7-Day Revenue Total</p>
            <p className="text-2xl font-black text-forest-700">₱{totalRevenue.toFixed(2)}</p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Daily Revenue (7 Days)</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₱${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="revenue" stroke="#1e5631" strokeWidth={2.5} dot={{ r: 4, fill: "#d4af37" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Weekly Comparison</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData.weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₱${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {revenueData.weekly.map((_, i) => (
                      <Cell key={i} fill={i === revenueData.weekly.length - 1 ? "#d4af37" : "#1e5631"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Monthly Comparison</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₱${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" fill="#3d7249" radius={[6, 6, 0, 0]}>
                    {revenueData.monthly.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* ─── PRODUCTS TAB ─── */}
      {analyticsTab === "products" && (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Top 10 Best Sellers</p>
            {bestSellers.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No sales data for this period.</p>
            ) : (
              <div className="space-y-2">
                {bestSellers.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                      i < 3 ? "bg-gold-100 text-gold-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.qty} sold</p>
                    </div>
                    <p className="text-sm font-black text-forest-700">₱{p.revenue.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {bestSellers.length > 0 && (
            <Card className="p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Best Sellers Chart</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bestSellers.slice(0, 5)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={80} />
                    <Tooltip formatter={(v) => [`${v} units`, "Qty Sold"]} />
                    <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
                      {bestSellers.slice(0, 5).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Slow-Moving Products</p>
              {slowMovers.length > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {slowMovers.length}
                </span>
              )}
            </div>
            {slowMovers.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">All products have recent sales.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {slowMovers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-red-50 rounded-xl px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.category} · Stock: {p.stock_quantity}</p>
                    </div>
                    <span className="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                      No sales 30d
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─── CASHIERS TAB ─── */}
      {analyticsTab === "cashiers" && (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Per-Cashier Performance</p>
            {cashierStats.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No cashier data for this period.</p>
            ) : (
              <div className="space-y-3">
                {cashierStats.map((c, i) => (
                  <div key={c.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? "bg-gold-200 text-gold-800" : "bg-gray-200 text-gray-600"
                        }`}>
                          {i + 1}
                        </span>
                        <p className="text-sm font-bold text-gray-800">{c.name}</p>
                      </div>
                      <p className="text-sm font-black text-forest-700">₱{c.revenue.toFixed(2)}</p>
                    </div>
                    <div className="flex gap-4 ml-8">
                      <p className="text-xs text-gray-400">{c.txCount} transactions</p>
                      <p className="text-xs text-gray-400">Avg ₱{c.avg.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {cashierStats.length > 0 && (
            <Card className="p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Revenue by Cashier</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashierStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₱${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                      {cashierStats.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── BRANCHES TAB ─── */}
      {analyticsTab === "branches" && (
        <div className="space-y-4">
          {branchStats.length === 0 ? (
            <Card className="p-4">
              <p className="text-xs text-gray-400 text-center py-4">No branch data available.</p>
            </Card>
          ) : (
            <>
              <Card className="p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Branch Sales Comparison</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₱${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                        {branchStats.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Branch Details</p>
                <div className="space-y-2">
                  {branchStats.map((b, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{b.name}</p>
                        <p className="text-xs text-gray-400">{b.txCount} transactions</p>
                      </div>
                      <p className="text-sm font-black text-forest-700">₱{b.revenue.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ─── SHIFTS TAB ─── */}
      {analyticsTab === "shifts" && (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Shift History</p>
            {shifts.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No shift records for this period.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {shifts.map((s) => (
                  <div key={s.id} className={`rounded-xl p-3 border ${s.status === "open" ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-gray-800">{s.profiles?.full_name}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        s.status === "open" ? "bg-green-200 text-green-700" : "bg-gray-200 text-gray-600"
                      }`}>
                        {s.status === "open" ? "Active" : "Closed"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500 mt-2">
                      <p>Start: {new Date(s.started_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</p>
                      {s.ended_at && <p>End: {new Date(s.ended_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</p>}
                      <p>Starting: ₱{Number(s.starting_cash || 0).toFixed(2)}</p>
                      {s.ending_cash != null && <p>Ending: ₱{Number(s.ending_cash).toFixed(2)}</p>}
                      {s.total_transactions != null && <p>Transactions: {s.total_transactions}</p>}
                      {s.total_sales != null && <p>Sales: ₱{Number(s.total_sales).toFixed(2)}</p>}
                      {s.cash_difference != null && (
                        <p className={Number(s.cash_difference) < 0 ? "text-red-500 font-semibold" : "text-green-600 font-semibold"}>
                          Diff: {Number(s.cash_difference) >= 0 ? "+" : ""}₱{Number(s.cash_difference).toFixed(2)}
                        </p>
                      )}
                    </div>
                    {s.notes && <p className="text-xs text-gray-400 mt-1 italic">{s.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function CustomerModal({ existing, businessId, showToast, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: existing?.name || "",
    phone: existing?.phone || "",
    email: existing?.email || "",
    address: existing?.address || "",
    is_suki: existing?.is_suki || false,
    notes: existing?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return showToast("Enter customer name.", "error");
    setSaving(true);
    const payload = { business_id: businessId, name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, address: form.address.trim() || null, is_suki: form.is_suki, notes: form.notes.trim() || null };
    const { error } = existing
      ? await supabase.from("customers").update(payload).eq("id", existing.id)
      : await supabase.from("customers").insert(payload);
    setSaving(false);
    if (error) return showToast("Failed to save customer.", "error");
    showToast(existing ? "Customer updated!" : "Customer added!", "success");
    onSaved();
  };

  return (
    <Modal title={existing ? "Edit Customer" : "Add Customer"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Name" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} placeholder="Juan dela Cruz" />
        <Field label="Phone" value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} placeholder="09XX XXX XXXX" type="tel" />
        <Field label="Email (optional)" value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} placeholder="email@example.com" type="email" />
        <Field label="Address (optional)" value={form.address} onChange={(v) => setForm(f => ({ ...f, address: v }))} placeholder="Brgy, City" />
        <div className="flex items-center gap-3">
          <button onClick={() => setForm(f => ({ ...f, is_suki: !f.is_suki }))}
            className={`w-12 h-7 rounded-full transition-colors relative ${form.is_suki ? "bg-gold-400" : "bg-gray-300"}`}>
            <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.is_suki ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
          <span className="text-sm font-medium text-gray-700">Mark as Suki</span>
        </div>
        <Field label="Notes (optional)" value={form.notes} onChange={(v) => setForm(f => ({ ...f, notes: v }))} placeholder="Special notes about this customer..." />
        <button onClick={save} disabled={saving}
          className="w-full bg-forest-600 text-white font-bold py-3 rounded-xl disabled:opacity-60">
          {saving ? "Saving..." : existing ? "Update Customer" : "Add Customer"}
        </button>
        {existing && (
          <button onClick={async () => {
            await supabase.from("customers").delete().eq("id", existing.id);
            showToast("Customer removed.", "success");
            onSaved();
          }} className="w-full bg-red-50 text-red-500 font-semibold py-2.5 rounded-xl text-sm">
            Remove Customer
          </button>
        )}
      </div>
    </Modal>
  );
}

function AuditLogViewer({ businessId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let query = supabase.from("audit_logs").select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (actionFilter !== "all") query = query.eq("action", actionFilter);
      const { data } = await query;
      setLogs(data || []);
      setLoading(false);
    };
    load();
  }, [businessId, actionFilter]);

  const ACTION_LABELS = {
    transaction_completed: { label: "Sale", color: "bg-green-100 text-green-700" },
    void_approved: { label: "Void", color: "bg-red-100 text-red-700" },
    stock_update: { label: "Stock", color: "bg-blue-100 text-blue-700" },
    shift_report: { label: "Shift", color: "bg-purple-100 text-purple-700" },
    transfer_approved: { label: "Transfer", color: "bg-yellow-100 text-yellow-700" },
    login: { label: "Login", color: "bg-gray-100 text-gray-700" },
    logout: { label: "Logout", color: "bg-gray-100 text-gray-500" },
  };

  const FILTERS = ["all", "transaction_completed", "void_approved", "stock_update", "login", "logout"];

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Audit Log</h2>
      <div className="flex gap-1 overflow-x-auto hide-scrollbar -mx-1 px-1">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setActionFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              actionFilter === f ? "bg-forest-600 text-white" : "bg-gray-100 text-gray-500"
            }`}>
            {f === "all" ? "All" : ACTION_LABELS[f]?.label || f}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="py-8 text-center"><Spinner /></div>
      ) : logs.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-xs text-gray-400">No activity logs found.</p>
        </Card>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {logs.map((log) => {
            const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: "bg-gray-100 text-gray-600" };
            return (
              <Card key={log.id} className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${actionInfo.color}`}>{actionInfo.label}</span>
                    <p className="text-sm font-semibold text-gray-800">{log.user_name || "System"}</p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(log.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                  </p>
                </div>
                {log.details && (
                  <div className="text-xs text-gray-500 mt-1">
                    {log.details.receipt && <span>Receipt: {log.details.receipt} </span>}
                    {log.details.amount != null && <span>· ₱{Number(log.details.amount).toFixed(2)} </span>}
                    {log.details.method && <span>· {log.details.method} </span>}
                    {log.details.items && <span>· {log.details.items} items</span>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

const downloadCSV = (filename, headers, rows) => {
  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

function SettingsPanel({ business, products, branches, staff, showToast, onLogout, onUpdated }) {
  const [bizForm, setBizForm] = useState({
    name: business.name || "",
    receipt_header: business.receipt_header || "",
    receipt_footer: business.receipt_footer || "",
    gcash_qr: business.gcash_qr || "",
  });
  const [saving, setSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [exportingTx, setExportingTx] = useState(false);

  const saveBusiness = async () => {
    if (!bizForm.name.trim()) return showToast("Business name is required.", "error");
    setSaving(true);
    const { error } = await supabase.from("businesses").update({
      name: bizForm.name.trim(),
      receipt_header: bizForm.receipt_header.trim() || null,
      receipt_footer: bizForm.receipt_footer.trim() || null,
      gcash_qr: bizForm.gcash_qr || null,
    }).eq("id", business.id);
    setSaving(false);
    if (error) return showToast("Failed to save. Try again.", "error");
    showToast("Business settings updated!", "success");
    onUpdated();
  };

  const exportProducts = () => {
    if (products.length === 0) return showToast("No products to export.", "error");
    downloadCSV(
      `listako-products-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Name", "Barcode", "Price", "Wholesale Price", "Stock", "Category", "Low Stock Threshold"],
      products.map((p) => [p.name, p.barcode || "", p.price, p.wholesale_price || "", p.stock_quantity, p.category, p.low_stock_threshold])
    );
    showToast("Products exported!", "success");
  };

  const exportTransactions = async () => {
    setExportingTx(true);
    const { data } = await supabase.from("transactions").select("*, transaction_items(*)")
      .eq("business_id", business.id).eq("status", "completed")
      .order("created_at", { ascending: false }).limit(500);
    setExportingTx(false);
    if (!data || data.length === 0) return showToast("No transactions to export.", "error");
    downloadCSV(
      `listako-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date", "Receipt #", "Total", "Items", "Payment", "Cashier", "Customer"],
      data.map((t) => [
        new Date(t.created_at).toLocaleString("en-PH"),
        t.receipt_number || t.id.slice(0, 8),
        t.total_amount,
        (t.transaction_items || []).length,
        t.payment_method || "cash",
        t.cashier_name || "",
        t.customer_name || "",
      ])
    );
    showToast("Transactions exported!", "success");
  };

  const exportCustomers = async () => {
    const { data } = await supabase.from("customers").select("*").eq("business_id", business.id).order("name");
    if (!data || data.length === 0) return showToast("No customers to export.", "error");
    downloadCSV(
      `listako-customers-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Name", "Phone", "Email", "Address", "Suki", "Visits", "Total Spent"],
      data.map((c) => [c.name, c.phone || "", c.email || "", c.address || "", c.is_suki ? "Yes" : "No", c.visit_count || 0, c.total_spent || 0])
    );
    showToast("Customers exported!", "success");
  };

  const lowStockProducts = products.filter((p) => p.stock_quantity <= (p.low_stock_threshold || 10));

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Settings</h2>

      <Card className="p-4 space-y-3">
        <p className="font-bold text-gray-800 text-sm">Business Profile</p>
        <Field label="Business Name" value={bizForm.name}
          onChange={(v) => setBizForm((f) => ({ ...f, name: v }))} placeholder="My Store" />
        <Field label="Receipt Header (optional)" value={bizForm.receipt_header}
          onChange={(v) => setBizForm((f) => ({ ...f, receipt_header: v }))} placeholder="Thank you for shopping!" />
        <Field label="Receipt Footer (optional)" value={bizForm.receipt_footer}
          onChange={(v) => setBizForm((f) => ({ ...f, receipt_footer: v }))} placeholder="Visit us again!" />
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">GCash QR Code (optional)</label>
          <p className="text-xs text-gray-400 mb-2">Upload your GCash QR — cashiers will show it to customers during GCash payment.</p>
          {bizForm.gcash_qr && (
            <div className="relative mb-2">
              <img src={bizForm.gcash_qr} alt="GCash QR" className="w-40 h-40 object-contain mx-auto rounded-xl border border-blue-200 bg-white p-1" />
              <button type="button" onClick={() => setBizForm((f) => ({ ...f, gcash_qr: "" }))}
                className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold">✕</button>
            </div>
          )}
          <label className="flex items-center justify-center gap-2 bg-blue-50 text-blue-700 font-semibold py-2.5 rounded-xl text-sm cursor-pointer border border-blue-200">
            📱 {bizForm.gcash_qr ? "Change QR" : "Upload GCash QR"}
            <input type="file" accept="image/*" className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const dataUrl = await compressImage(file, 500, 0.85);
                setBizForm((f) => ({ ...f, gcash_qr: dataUrl }));
              }} />
          </label>
        </div>
        <button onClick={saveBusiness} disabled={saving}
          className="w-full bg-forest-600 text-white font-bold py-3 rounded-xl disabled:opacity-60 text-sm">
          {saving ? "Saving..." : "Save Business Info"}
        </button>
      </Card>

      <Card className="p-4 space-y-3">
        <p className="font-bold text-gray-800 text-sm">Export Data (CSV)</p>
        <p className="text-xs text-gray-400">Download your data as spreadsheet files.</p>
        <div className="grid grid-cols-1 gap-2">
          <button onClick={exportProducts}
            className="flex items-center gap-2 bg-blue-50 text-blue-700 font-semibold py-2.5 px-4 rounded-xl text-sm">
            📦 Export Products ({products.length})
          </button>
          <button onClick={exportTransactions} disabled={exportingTx}
            className="flex items-center gap-2 bg-green-50 text-green-700 font-semibold py-2.5 px-4 rounded-xl text-sm disabled:opacity-60">
            {exportingTx ? "Exporting..." : "💰 Export Transactions (Last 500)"}
          </button>
          <button onClick={exportCustomers}
            className="flex items-center gap-2 bg-purple-50 text-purple-700 font-semibold py-2.5 px-4 rounded-xl text-sm">
            👤 Export Customers
          </button>
        </div>
      </Card>

      {lowStockProducts.length > 0 && (
        <Card className="p-4 space-y-2">
          <p className="font-bold text-red-600 text-sm">⚠️ Low Stock Alert ({lowStockProducts.length})</p>
          <div className="space-y-1.5">
            {lowStockProducts.slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-gray-700 truncate flex-1">{p.name}</p>
                <p className="text-xs font-bold text-red-600 ml-2">{p.stock_quantity} left</p>
              </div>
            ))}
            {lowStockProducts.length > 10 && (
              <p className="text-xs text-gray-400 text-center">+{lowStockProducts.length - 10} more items</p>
            )}
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-2">
        <p className="font-bold text-gray-800 text-sm">App Info</p>
        <div className="space-y-1 text-xs text-gray-500">
          <p>ListaKo v1.0 — Filipino-First Business Manager</p>
          <p>Products: {products.length} · Branches: {branches.length} · Staff: {staff.length}</p>
          <p>Plan: {business.plan ? business.plan.charAt(0).toUpperCase() + business.plan.slice(1) : "Trial"}</p>
        </div>
      </Card>

      <button onClick={() => setShowHelp(true)}
        className="w-full bg-gold-100 text-gold-800 font-bold py-3 rounded-xl text-sm">
        📖 How to Use ListaKo
      </button>

      <button onClick={onLogout}
        className="w-full bg-red-50 text-red-500 font-semibold py-3 rounded-xl text-sm">
        Logout
      </button>

      {showHelp && (
        <Modal title="Paano Gamitin ang ListaKo" onClose={() => setShowHelp(false)}>
          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <p className="font-bold text-forest-700 mb-1">📊 Dashboard</p>
              <p className="text-xs text-gray-500">Tingnan ang revenue, transactions, at low stock alerts ngayong araw.</p>
            </div>
            <div>
              <p className="font-bold text-forest-700 mb-1">📈 Analytics</p>
              <p className="text-xs text-gray-500">I-view ang charts para sa revenue trends, best sellers, at cashier performance.</p>
            </div>
            <div>
              <p className="font-bold text-forest-700 mb-1">📦 Produkto</p>
              <p className="text-xs text-gray-500">Mag-add, edit, at manage ng products. Pwedeng mag-generate ng barcode at mag-set ng wholesale pricing.</p>
            </div>
            <div>
              <p className="font-bold text-forest-700 mb-1">🏪 Branch</p>
              <p className="text-xs text-gray-500">Mag-manage ng iba't ibang branches ng iyong negosyo.</p>
            </div>
            <div>
              <p className="font-bold text-forest-700 mb-1">👥 Staff</p>
              <p className="text-xs text-gray-500">Mag-add ng cashiers, inventory staff, at branch managers. I-assign sila sa mga branches.</p>
            </div>
            <div>
              <p className="font-bold text-forest-700 mb-1">⏳ Pending</p>
              <p className="text-xs text-gray-500">I-approve ang mga void requests, product transfers, at bagong products.</p>
            </div>
            <div>
              <p className="font-bold text-forest-700 mb-1">👤 Suki</p>
              <p className="text-xs text-gray-500">I-track ang iyong loyal customers at ang kanilang purchase history.</p>
            </div>
            <div>
              <p className="font-bold text-forest-700 mb-1">📋 Logs</p>
              <p className="text-xs text-gray-500">I-review ang audit trail ng lahat ng actions sa system.</p>
            </div>
            <div>
              <p className="font-bold text-forest-700 mb-1">⚙️ Settings</p>
              <p className="text-xs text-gray-500">I-edit ang business info, receipt headers, at mag-export ng data.</p>
            </div>
            <div className="bg-gold-50 rounded-xl p-3">
              <p className="font-bold text-gold-700 text-xs mb-1">💡 Tips</p>
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                <li>Mag-scan ng barcode gamit ang camera ng cashier</li>
                <li>I-set ang wholesale pricing para sa bulk buyers</li>
                <li>Gamitin ang "Utang" feature para sa credit na customers</li>
                <li>Ma-install ang ListaKo bilang app sa phone — i-tap ang "Add to Home Screen"</li>
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function OwnerDashboard({ profile, business, isSuperAdmin, onLogout, showToast }) {
  const [tab, setTab] = useState(() => {
    return localStorage.getItem("owner_tab") || "dashboard";
  });

  const setTabPersisted = (newTab) => {
    localStorage.setItem("owner_tab", newTab);
    setTab(newTab);
  };
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayTxCount, setTodayTxCount] = useState(0);
  const [utangTotal, setUtangTotal] = useState(0);
  const [recentTx, setRecentTx] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [b, p, s, tx, utang, pending, notifs, xfers, cust] = await Promise.all([
      supabase.from("branches").select("*").eq("business_id", business.id).order("created_at"),
      supabase.from("products").select("*").eq("business_id", business.id).eq("status", "active").order("name"),
      supabase.from("profiles").select("*").eq("business_id", business.id).neq("role", "owner").order("full_name"),
      supabase.from("transactions").select("*").eq("business_id", business.id).eq("status", "completed").gte("created_at", today.toISOString()).order("created_at", { ascending: false }),
      supabase.from("utang_records").select("*").eq("business_id", business.id).in("status", ["unpaid", "partial"]),
      supabase.from("products").select("*").eq("business_id", business.id).eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("notifications").select("*").eq("business_id", business.id).eq("is_read", false).is("recipient_id", null).order("created_at", { ascending: false }).limit(20),
      supabase.from("product_transfers").select("*, products(name, stock_quantity), from_branch:branches!product_transfers_from_branch_id_fkey(name), to_branch:branches!product_transfers_to_branch_id_fkey(name), requester:profiles!product_transfers_requested_by_fkey(full_name)")
        .eq("business_id", business.id).eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("customers").select("*").eq("business_id", business.id).order("name"),
    ]);
    setBranches(b.data || []);
    setProducts(p.data || []);
    setStaff(s.data || []);
    setRecentTx((tx.data || []).slice(0, 5));
    setPendingProducts(pending.data || []);
    setNotifications(notifs.data || []);
    setPendingTransfers(xfers.data || []);
    setCustomers(cust.data || []);
    const revenue = (tx.data || []).reduce((sum, t) => sum + Number(t.total_amount), 0);
    setTodayRevenue(revenue);
    setTodayTxCount((tx.data || []).length);
    const utangAmt = (utang.data || []).reduce((sum, u) => sum + Number(u.balance || u.amount), 0);
    setUtangTotal(utangAmt);
    setLoading(false);
  }, [business.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const AddBranchModal = () => {
    const [form, setForm] = useState({ name: "", address: "" });
    const [saving, setSaving] = useState(false);
    const save = async () => {
      if (!form.name.trim()) return showToast("Ilagay ang pangalan ng branch.", "error");
      const plan = PLANS[business.plan] || PLANS.basic;
      if (branches.length >= plan.branches) {
        return showToast(`Naabot na ang limit ng ${plan.label} plan (${plan.branches} branch). Mag-upgrade para makapag-add pa.`, "error");
      }
      setSaving(true);
      const { error } = await supabase
        .from("branches")
        .insert({ business_id: business.id, name: form.name.trim(), address: form.address.trim() });
      setSaving(false);
      if (error) return showToast("Hindi na-save. Subukan muli.", "error");
      showToast("Branch na-add!", "success");
      setShowAddBranch(false);
      fetchAll();
    };
    return (
      <Modal title="Magdagdag ng Branch" onClose={() => setShowAddBranch(false)}>
        <div className="space-y-4">
          <Field
            label="Pangalan ng Branch"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="Iligan City Branch"
          />
          <Field
            label="Address"
            value={form.address}
            onChange={(v) => setForm((f) => ({ ...f, address: v }))}
            placeholder="Lungsod, Probinsya"
          />
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-forest-600 text-white font-bold py-3 rounded-xl disabled:opacity-60"
          >
            {saving ? "Sine-save..." : "I-save ang Branch"}
          </button>
        </div>
      </Modal>
    );
  };

  const PRODUCT_CATEGORIES = ["Beverages", "Snacks", "Household", "Personal Care", "Frozen", "Dairy", "Canned Goods", "Others"];

  const ProductModal = ({ existing, onClose }) => {
    const [form, setForm] = useState({
      name: existing?.name || "",
      barcode: existing?.barcode || "",
      price: existing?.price || "",
      wholesale_price: existing?.wholesale_price || "",
      wholesale_min_qty: existing?.wholesale_min_qty || "12",
      stock_quantity: existing?.stock_quantity || "",
      low_stock_threshold: existing?.low_stock_threshold || "10",
      category: existing?.category || "Others",
      image_url: existing?.image_url || "",
    });
    const [saving, setSaving] = useState(false);
    const save = async () => {
      if (!form.name.trim()) return showToast("Ilagay ang pangalan ng produkto.", "error");
      if (!form.price || isNaN(Number(form.price)))
        return showToast("Ilagay ang tamang presyo.", "error");
      setSaving(true);
      const payload = {
        business_id: business.id,
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        price: Number(form.price),
        wholesale_price: form.wholesale_price ? Number(form.wholesale_price) : null,
        wholesale_min_qty: Number(form.wholesale_min_qty) || 1,
        stock_quantity: Number(form.stock_quantity) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 10,
        category: form.category,
        image_url: form.image_url.trim() || null,
      };
      const { error } = existing
        ? await supabase.from("products").update(payload).eq("id", existing.id)
        : await supabase.from("products").insert(payload);
      setSaving(false);
      if (error) return showToast("Hindi na-save. Subukan muli.", "error");
      showToast(existing ? "Produkto na-update!" : "Produkto na-add!", "success");
      onClose();
      fetchAll();
    };
    return (
      <Modal
        title={existing ? "I-edit ang Produkto" : "Magdagdag ng Produkto"}
        onClose={onClose}
      >
        <div className="space-y-4">
          <Field
            label="Pangalan ng Produkto"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="Coca-Cola 1.5L"
          />
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Barcode (opsyonal)</label>
            <div className="flex gap-2">
              <input
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                placeholder="I-type ang barcode"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
              />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, barcode: generateBarcode() }))}
                className="px-3 py-2 bg-gold-500 text-forest-900 text-xs font-bold rounded-xl whitespace-nowrap"
              >
                Generate
              </button>
            </div>
            {form.barcode && <BarcodeDisplay code={form.barcode} />}
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Category</label>
            <select value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 bg-white">
              {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Presyo (₱)"
              value={form.price}
              onChange={(v) => setForm((f) => ({ ...f, price: v }))}
              placeholder="0.00"
              type="number"
            />
            <Field
              label="Stock"
              value={form.stock_quantity}
              onChange={(v) => setForm((f) => ({ ...f, stock_quantity: v }))}
              placeholder="0"
              type="number"
            />
          </div>
          <Field
            label="Low Stock Alert"
            value={form.low_stock_threshold}
            onChange={(v) => setForm((f) => ({ ...f, low_stock_threshold: v }))}
            placeholder="10"
            type="number"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Wholesale Price (₱)"
              value={form.wholesale_price}
              onChange={(v) => setForm((f) => ({ ...f, wholesale_price: v }))}
              placeholder="0.00"
              type="number"
            />
            <Field
              label="Min Qty (Wholesale)"
              value={form.wholesale_min_qty}
              onChange={(v) => setForm((f) => ({ ...f, wholesale_min_qty: v }))}
              placeholder="12"
              type="number"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Product Image (optional)</label>
            {form.image_url && (
              <div className="relative mb-2">
                <img src={form.image_url} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                <button type="button" onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                  className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold">✕</button>
              </div>
            )}
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 bg-forest-50 text-forest-700 font-semibold py-2.5 rounded-xl text-sm cursor-pointer border border-forest-200">
                📷 Take Photo
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const dataUrl = await compressImage(file);
                    setForm((f) => ({ ...f, image_url: dataUrl }));
                  }} />
              </label>
              <label className="flex-1 flex items-center justify-center gap-2 bg-gray-50 text-gray-600 font-semibold py-2.5 rounded-xl text-sm cursor-pointer border border-gray-200">
                🖼️ Gallery
                <input type="file" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const dataUrl = await compressImage(file);
                    setForm((f) => ({ ...f, image_url: dataUrl }));
                  }} />
              </label>
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-forest-600 text-white font-bold py-3 rounded-xl disabled:opacity-60"
          >
            {saving ? "Sine-save..." : existing ? "I-update" : "I-save ang Produkto"}
          </button>
        </div>
      </Modal>
    );
  };

  const AddStaffModal = () => {
    const [form, setForm] = useState({ full_name: "", email: "", role: "cashier", branch_id: "" });
    const [saving, setSaving] = useState(false);
    const save = async () => {
      if (!form.full_name.trim()) return showToast("Ilagay ang pangalan ng staff.", "error");
      if (!form.email.trim()) return showToast("Ilagay ang email ng staff.", "error");
      if (!form.branch_id) return showToast("Pumili ng branch.", "error");
      const plan = PLANS[business.plan] || PLANS.basic;
      if (staff.length >= plan.staff) {
        return showToast(`Naabot na ang limit ng ${plan.label} plan (${plan.staff} staff). Mag-upgrade para makapag-add pa.`, "error");
      }
      setSaving(true);
      try {
        const tempPassword = "ListaKo" + Math.random().toString(36).slice(2, 8) + "!";
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: tempPassword,
        });
        if (authError) throw authError;
        const userId = authData.user?.id;
        if (!userId) throw new Error("Hindi na-create ang user.");
        const { error: profileError } = await supabase.from("profiles").insert({
          id: userId,
          business_id: business.id,
          branch_id: form.branch_id,
          full_name: form.full_name.trim(),
          role: form.role,
        });
        if (profileError) throw profileError;
        showToast(`Na-invite! Temp password: ${tempPassword}`, "success");
        setShowAddStaff(false);
        fetchAll();
      } catch (err) {
        showToast(getErrorMessage(err), "error");
      } finally {
        setSaving(false);
      }
    };
    return (
      <Modal title="Mag-invite ng Staff" onClose={() => setShowAddStaff(false)}>
        <div className="space-y-4">
          <Field
            label="Buong Pangalan"
            value={form.full_name}
            onChange={(v) => setForm((f) => ({ ...f, full_name: v }))}
            placeholder="Maria Santos"
          />
          <Field
            label="Email ng Staff"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            placeholder="maria@email.com"
            type="email"
          />
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Role
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-forest-500"
            >
              <option value="cashier">Cashier</option>
              <option value="inventory_staff">Inventory Staff</option>
              <option value="branch_manager">Branch Manager</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Branch
            </label>
            <select
              value={form.branch_id}
              onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-forest-500"
            >
              <option value="">— Pumili ng Branch —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          {branches.length === 0 && (
            <p className="text-xs text-yellow-600 bg-yellow-50 rounded-lg px-3 py-2">
              ⚠️ Gumawa muna ng branch.
            </p>
          )}
          <button
            onClick={save}
            disabled={saving || branches.length === 0}
            className="w-full bg-forest-600 text-white font-bold py-3 rounded-xl disabled:opacity-60"
          >
            {saving ? "Sine-send..." : "Mag-invite ng Staff"}
          </button>
        </div>
      </Modal>
    );
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("Tanggalin ang produktong ito?")) return;
    await supabase.from("products").delete().eq("id", id);
    showToast("Produkto natanggal.", "success");
    fetchAll();
  };

  const deleteBranch = async (id) => {
    if (!window.confirm("Tanggalin ang branch na ito?")) return;
    await supabase.from("branches").delete().eq("id", id);
    showToast("Branch natanggal.", "success");
    fetchAll();
  };

  const removeStaff = async (id) => {
    if (!window.confirm("Alisin ang staff na ito?")) return;
    await supabase.from("profiles").delete().eq("id", id);
    showToast("Staff naalis na.", "success");
    fetchAll();
  };

  const TABS = [
    { key: "dashboard", icon: "📊", label: "Dashboard" },
    { key: "analytics", icon: "📈", label: "Analytics" },
    { key: "products", icon: "📦", label: "Produkto" },
    { key: "branches", icon: "🏪", label: "Branch" },
    { key: "staff", icon: "👥", label: "Staff" },
    { key: "pending", icon: (pendingProducts.length + pendingTransfers.length) > 0 ? "🔴" : "⏳", label: "Pending" },
    { key: "customers", icon: "👤", label: "Suki" },
    { key: "logs", icon: "📋", label: "Logs" },
    { key: "settings", icon: "⚙️", label: "Settings" },
    ...(isSuperAdmin ? [{ key: "admin", icon: "👑", label: "Admin" }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      <TrialBanner business={business} />
      <div className="bg-forest-800 px-4 pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-gold-400 text-xs font-medium uppercase tracking-widest">
              {isSuperAdmin ? "Super Admin" : "Administrator"}
            </p>
            <h1 className="text-ivory-50 font-black text-xl leading-tight">{business.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative bg-forest-800 bg-opacity-50 text-forest-200 px-3 py-2 rounded-xl"
            >
              🔔
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>
            <button
              onClick={onLogout}
              className="bg-forest-700 text-gold-400 text-xs px-3 py-2 rounded-xl font-medium border border-forest-600"
            >
              Logout
            </button>
          </div>
        </div>
        <p className="text-forest-300 text-xs">
          Welcome, {profile.full_name.split(" ")[0]}
        </p>
      </div>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="bg-white border-b border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-bold text-gray-800">
              🔔 Notifications {notifications.length > 0 && `(${notifications.length})`}
            </p>
            {notifications.length > 0 && (
              <button
                onClick={async () => {
                  await supabase
                    .from("notifications")
                    .update({ is_read: true })
                    .eq("business_id", business.id)
                    .eq("is_read", false)
                    .is("recipient_id", null); // Only owner notifications
                  fetchAll();
                }}
                className="text-xs text-forest-700 font-semibold"
              >
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 pb-4 text-center">
              <p className="text-sm text-gray-400">No new notifications</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
              {notifications.map((n) => (
                <div key={n.id} className={`px-4 py-3 ${
                  n.type === "void_request" ? "bg-yellow-50" :
                  n.type === "discount_approval_request" ? "bg-blue-50" :
                  "bg-red-50"
                }`}>
                  <p className={`text-xs font-bold ${
                    n.type === "void_request" ? "text-yellow-700" :
                    n.type === "discount_approval_request" ? "text-blue-700" :
                    "text-red-700"
                  }`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleTimeString("en-PH", {
                      hour: "numeric", minute: "2-digit", hour12: true,
                    })}
                  </p>
                  {/* Void request approval buttons */}
                  {n.type === "void_request" && n.transaction_id && !n.action_taken && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={async () => {
                          // Get the transaction to find cashier_id
                          const { data: txn } = await supabase
                            .from("transactions")
                            .select("cashier_id, receipt_number, total_amount")
                            .eq("id", n.transaction_id)
                            .maybeSingle();

                          // Approve void
                          await supabase.from("transactions").update({
                            status: "voided",
                            voided_at: new Date().toISOString(),
                            voided_by: profile.id,
                            void_reason: "Approved by owner",
                          }).eq("id", n.transaction_id);

                          await supabase.from("notifications").update({
                            action_taken: "approved",
                            is_read: true,
                          }).eq("id", n.id);

                          // Notify CASHIER — void approved
                          await supabase.from("notifications").insert({
                            business_id: business.id,
                            recipient_id: txn?.cashier_id || null,
                            type: "void_approved",
                            title: "✅ Void Request Approved",
                            message: `Your void request for ${txn?.receipt_number} (₱${Number(txn?.total_amount).toFixed(2)}) has been approved by the owner.`,
                            is_read: false,
                          });
                          showToast("Void approved! Transaction has been voided.", "success");
                          fetchAll();
                        }}
                        className="flex-1 bg-forest-600 text-white font-bold py-2 rounded-xl text-xs"
                      >
                        ✓ Approve Void
                      </button>
                      <button
                        onClick={async () => {
                          // Get the transaction to find cashier_id
                          const { data: txn } = await supabase
                            .from("transactions")
                            .select("cashier_id, receipt_number, total_amount")
                            .eq("id", n.transaction_id)
                            .maybeSingle();

                          // Decline void — restore to completed
                          await supabase.from("transactions").update({
                            status: "completed",
                            void_requested_at: null,
                            void_requested_by: null,
                            void_request_reason: null,
                          }).eq("id", n.transaction_id);

                          await supabase.from("notifications").update({
                            action_taken: "declined",
                            is_read: true,
                          }).eq("id", n.id);

                          // Notify CASHIER — void declined
                          await supabase.from("notifications").insert({
                            business_id: business.id,
                            recipient_id: txn?.cashier_id || null,
                            type: "void_declined",
                            title: "❌ Void Request Declined",
                            message: `Your void request for ${txn?.receipt_number} (₱${Number(txn?.total_amount).toFixed(2)}) was declined by the owner. The transaction remains active.`,
                            is_read: false,
                          });
                          showToast("Void request declined.", "success");
                          fetchAll();
                        }}
                        className="flex-1 bg-red-500 text-white font-bold py-2 rounded-xl text-xs"
                      >
                        ✕ Decline
                      </button>
                    </div>
                  )}
                  {n.action_taken && (
                    <p className={`text-xs font-bold mt-1 ${n.action_taken === "approved" ? "text-forest-600" : "text-red-500"}`}>
                      {n.action_taken === "approved" ? "✓ You approved this void" : "✕ You declined this void"}
                    </p>
                  )}

                  {/* Discount approval request buttons */}
                  {n.type === "discount_approval_request" && !n.action_taken && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={async () => {
                          // Extract discount value from message
                          const discountMatch = n.message.match(/requesting a (\d+)%/);
                          const approvedPercent = discountMatch ? Number(discountMatch[1]) : 20;

                          // Save approval to cashier's profile in DATABASE
                          if (n.sender_id) {
                            await supabase.from("profiles").update({
                              approved_discount_percent: approvedPercent,
                              approved_discount_at: new Date().toISOString(),
                            }).eq("id", n.sender_id);
                          }

                          await supabase.from("notifications").update({
                            action_taken: "approved",
                            is_read: true,
                          }).eq("id", n.id);

                          // Send to CASHIER
                          await supabase.from("notifications").insert({
                            business_id: business.id,
                            recipient_id: n.sender_id,
                            type: "discount_approved",
                            title: "✅ High Discount Approved",
                            message: `Your ${approvedPercent}% discount request has been approved by the owner. Tap "Confirm Payment" now to complete the transaction.`,
                            is_read: false,
                          });
                          showToast("Discount approved! Cashier can now process the payment.", "success");
                          fetchAll();
                        }}
                        className="flex-1 bg-forest-600 text-white font-bold py-2 rounded-xl text-xs"
                      >
                        ✓ Approve Discount
                      </button>
                      <button
                        onClick={async () => {
                          // Clear any existing approval for this cashier
                          if (n.sender_id) {
                            await supabase.from("profiles").update({
                              approved_discount_percent: 0,
                              approved_discount_at: null,
                            }).eq("id", n.sender_id);
                          }

                          await supabase.from("notifications").update({
                            action_taken: "declined",
                            is_read: true,
                          }).eq("id", n.id);

                          // Send to CASHIER using sender_id
                          await supabase.from("notifications").insert({
                            business_id: business.id,
                            recipient_id: n.sender_id,
                            type: "discount_declined",
                            title: "❌ High Discount Declined",
                            message: "Your high discount request was declined by the owner. Please apply a lower discount.",
                            is_read: false,
                          });
                          // Clear any approved discount from localStorage
                          localStorage.removeItem("cashier_approved_discount");
                          showToast("Discount request declined.", "success");
                          fetchAll();
                        }}
                        className="flex-1 bg-red-500 text-white font-bold py-2 rounded-xl text-xs"
                      >
                        ✕ Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {tab === "admin" && isSuperAdmin && <SuperAdminPanel showToast={showToast} />}

            {tab === "dashboard" && (
              <div className="p-4 space-y-4">
                {/* Revenue card */}
                <div className="bg-forest-700 rounded-2xl p-4">
                  <p className="text-gold-300 text-xs font-semibold uppercase tracking-widest mb-1">
                    Today's Revenue
                  </p>
                  <p className="text-3xl font-black text-white tracking-tight">
                    ₱{todayRevenue.toFixed(2)}
                  </p>
                  <p className="text-forest-300 text-xs mt-1">
                    {todayTxCount} transaction{todayTxCount !== 1 ? "s" : ""} completed today
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    icon="📦"
                    label="Products"
                    value={products.length}
                    color="bg-blue-50 text-blue-700"
                  />
                  <StatCard
                    icon="🏪"
                    label="Branches"
                    value={branches.length}
                    color="bg-purple-50 text-purple-700"
                  />
                  <StatCard
                    icon="👥"
                    label="Staff"
                    value={staff.length}
                    color="bg-yellow-50 text-yellow-700"
                  />
                  <StatCard
                    icon="💸"
                    label="Utang Balance"
                    value={`₱${utangTotal.toFixed(0)}`}
                    color="bg-red-50 text-red-600"
                  />
                </div>

                {branches.length === 0 && (
                  <Card className="p-4 border-l-4 border-yellow-400">
                    <p className="text-sm font-semibold text-gray-700">Start Setup 🚀</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Create a branch, add products, and invite staff to get started.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setTabPersisted("branches")}
                        className="text-xs bg-forest-600 text-white px-3 py-1.5 rounded-lg font-medium"
                      >
                        Add Branch
                      </button>
                      <button
                        onClick={() => setTabPersisted("products")}
                        className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-medium"
                      >
                        Add Products
                      </button>
                    </div>
                  </Card>
                )}

                {recentTx.length > 0 && (
                  <div>
                    <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-2">
                      Recent Transactions
                    </h2>
                    <div className="space-y-2">
                      {recentTx.map((tx) => (
                        <Card key={tx.id} className="p-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-mono text-gray-400">{tx.receipt_number}</p>
                            <p className="text-xs text-gray-500 mt-0.5 capitalize">
                              {tx.payment_method}
                              {tx.customer_name ? ` · ${tx.customer_name}` : ""} ·{" "}
                              {new Date(tx.created_at).toLocaleTimeString("en-PH", {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </p>
                          </div>
                          <p className="font-black text-forest-700">
                            ₱{Number(tx.total_amount).toFixed(2)}
                          </p>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {branches.length > 0 && (
                  <div>
                    <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-2">
                      Branches
                    </h2>
                    <div className="space-y-2">
                      {branches.map((b) => (
                        <Card key={b.id} className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{b.name}</p>
                            <p className="text-xs text-gray-400">{b.address || "No address"}</p>
                          </div>
                          <span className="text-xs bg-forest-100 text-forest-700 px-2 py-1 rounded-lg font-medium">
                            Active
                          </span>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                {/* Discount Settings Card */}
                <DiscountSettingsCard business={business} showToast={showToast} onSaved={fetchAll} />
              </div>
            )}

            {tab === "analytics" && (
              <AnalyticsDashboard business={business} branches={branches} showToast={showToast} />
            )}

            {tab === "products" && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                    {products.length} Produkto
                  </h2>
                  <button
                    onClick={() => setShowAddProduct(true)}
                    className="bg-forest-600 text-white text-xs px-3 py-2 rounded-xl font-bold"
                  >
                    + Magdagdag
                  </button>
                </div>
                {products.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-3xl mb-2">📦</p>
                    <p className="font-semibold text-gray-600 text-sm">Wala pang produkto</p>
                  </Card>
                ) : (
                  products.map((p) => (
                    <Card key={p.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        {p.image_url && (
                          <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-200" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">
                            {p.barcode ? `Barcode: ${p.barcode}` : "Walang barcode"}
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-sm font-black text-forest-700">
                              ₱{Number(p.price).toFixed(2)}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                p.stock_quantity <= 0
                                  ? "bg-red-100 text-red-600"
                                  : p.stock_quantity <= (p.low_stock_threshold || 10)
                                  ? "bg-yellow-100 text-yellow-600"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {p.stock_quantity <= (p.low_stock_threshold || 10) ? "⚠️ " : ""}Stock:{" "}
                              {p.stock_quantity}
                            </span>
                            {p.category && p.category !== "Others" && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">
                                {p.category}
                              </span>
                            )}
                            {p.no_discount && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-600">
                                No Discount
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 ml-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditProduct(p)}
                              className="text-xs bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg font-medium"
                            >
                              I-edit
                            </button>
                            <button
                              onClick={() => deleteProduct(p.id)}
                              className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg font-medium"
                            >
                              Burahin
                            </button>
                          </div>
                          <button
                            onClick={async () => {
                              await supabase.from("products").update({
                                no_discount: !p.no_discount
                              }).eq("id", p.id);
                              showToast(p.no_discount ? "Discount enabled for this product." : "Discount disabled for this product.", "success");
                              fetchAll();
                            }}
                            className={`text-xs px-2 py-1.5 rounded-lg font-medium ${
                              p.no_discount
                                ? "bg-orange-100 text-orange-600"
                                : "bg-gray-50 text-gray-400"
                            }`}
                          >
                            {p.no_discount ? "🚫 No Discount" : "Allow Discount"}
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {tab === "branches" && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                    {branches.length} Branch
                  </h2>
                  <button
                    onClick={() => setShowAddBranch(true)}
                    className="bg-forest-600 text-white text-xs px-3 py-2 rounded-xl font-bold"
                  >
                    + Magdagdag
                  </button>
                </div>
                {branches.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-3xl mb-2">🏪</p>
                    <p className="font-semibold text-gray-600 text-sm">Wala pang branch</p>
                  </Card>
                ) : (
                  branches.map((b) => (
                    <Card key={b.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-gray-800">{b.name}</p>
                          <p className="text-xs text-gray-400">{b.address || "Walang address"}</p>
                          <p className="text-xs text-gray-400">
                            {staff.filter((s) => s.branch_id === b.id).length} staff
                          </p>
                        </div>
                        <button
                          onClick={() => deleteBranch(b.id)}
                          className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg font-medium ml-2"
                        >
                          Burahin
                        </button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {tab === "staff" && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                    {staff.length} Staff
                  </h2>
                  <button
                    onClick={() => setShowAddStaff(true)}
                    className="bg-forest-600 text-white text-xs px-3 py-2 rounded-xl font-bold"
                  >
                    + Mag-invite
                  </button>
                </div>
                {staff.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-3xl mb-2">👥</p>
                    <p className="font-semibold text-gray-600 text-sm">Wala pang staff</p>
                  </Card>
                ) : (
                  staff.map((s) => {
                    const branchName =
                      branches.find((b) => b.id === s.branch_id)?.name || "Walang branch";
                    return (
                      <Card key={s.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{s.full_name}</p>
                            <p className="text-xs text-gray-400">{branchName}</p>
                            <span
                              className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1.5 ${
                                ROLE_COLORS[s.role]
                              }`}
                            >
                              {ROLE_LABELS[s.role]}
                            </span>
                          </div>
                          <button
                            onClick={() => removeStaff(s.id)}
                            className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg font-medium ml-2"
                          >
                            Alisin
                          </button>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {/* Pending Products Tab */}
            {tab === "pending" && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                    {pendingProducts.length} Pending Product{pendingProducts.length !== 1 ? "s" : ""}
                  </h2>
                </div>

                {pendingProducts.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="font-semibold text-gray-600 text-sm">No pending products</p>
                    <p className="text-xs text-gray-400 mt-1">All scanned products have been reviewed</p>
                  </Card>
                ) : (
                  <>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3">
                      <p className="text-xs text-yellow-800 font-semibold">⚠️ Products below were scanned by your cashier but need your review.</p>
                      <p className="text-xs text-yellow-700 mt-1">Set the correct price and stock, then tap Activate.</p>
                    </div>
                    {pendingProducts.map((p) => (
                      <PendingProductCard
                        key={p.id}
                        product={p}
                        onActivate={fetchAll}
                        showToast={showToast}
                      />
                    ))}
                  </>
                )}

                {/* Transfer Requests */}
                <div className="mt-6">
                  <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3">
                    {pendingTransfers.length} Transfer Request{pendingTransfers.length !== 1 ? "s" : ""}
                  </h2>
                  {pendingTransfers.length === 0 ? (
                    <Card className="p-6 text-center">
                      <p className="text-2xl mb-1">📦</p>
                      <p className="text-xs text-gray-400">No pending transfer requests</p>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {pendingTransfers.map((t) => (
                        <Card key={t.id} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-bold text-gray-800">{t.products?.name}</p>
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">Pending</span>
                          </div>
                          <p className="text-xs text-gray-500 mb-1">
                            {t.quantity} units · {t.from_branch?.name} → {t.to_branch?.name}
                          </p>
                          <p className="text-xs text-gray-400 mb-1">
                            Requested by {t.requester?.full_name} · {new Date(t.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                          </p>
                          {t.notes && <p className="text-xs text-gray-400 italic mb-2">{t.notes}</p>}
                          <p className="text-xs text-gray-400 mb-3">Available stock: {t.products?.stock_quantity || 0}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                const { error } = await supabase.from("product_transfers").update({ status: "completed", approved_by: profile.id, completed_at: new Date().toISOString() }).eq("id", t.id);
                                if (error) return showToast("Failed to approve.", "error");
                                await supabase.from("products").update({ stock_quantity: Math.max(0, (t.products?.stock_quantity || 0) - t.quantity) }).eq("id", t.product_id);
                                showToast("Transfer approved and completed!", "success");
                                fetchAll();
                              }}
                              className="flex-1 bg-forest-600 text-white font-bold py-2.5 rounded-xl text-xs"
                            >
                              Approve & Transfer
                            </button>
                            <button
                              onClick={async () => {
                                await supabase.from("product_transfers").update({ status: "rejected", approved_by: profile.id }).eq("id", t.id);
                                showToast("Transfer rejected.", "warning");
                                fetchAll();
                              }}
                              className="flex-1 bg-red-100 text-red-600 font-bold py-2.5 rounded-xl text-xs"
                            >
                              Reject
                            </button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "customers" && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                    {customers.length} Customer{customers.length !== 1 ? "s" : ""}
                  </h2>
                  <button onClick={() => setShowAddCustomer(true)}
                    className="bg-forest-600 text-white text-xs px-3 py-2 rounded-xl font-bold">+ Add Suki</button>
                </div>
                <input type="text" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search customers..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500" />
                {customers.filter(c => !customerSearch.trim() || c.name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-3xl mb-2">👤</p>
                    <p className="font-semibold text-gray-600 text-sm">No customers yet</p>
                    <p className="text-xs text-gray-400 mt-1">Add your suki customers to track their purchases.</p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {customers.filter(c => !customerSearch.trim() || c.name.toLowerCase().includes(customerSearch.toLowerCase())).map((c) => (
                      <Card key={c.id} className="p-4" onClick={() => setEditCustomer(c)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-800 text-sm">{c.name}</p>
                              {c.is_suki && <span className="text-xs bg-gold-100 text-gold-700 px-2 py-0.5 rounded-full font-bold">Suki</span>}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {c.phone || "No phone"} · {c.visit_count} visit{c.visit_count !== 1 ? "s" : ""} · ₱{Number(c.total_spent || 0).toFixed(0)} spent
                            </p>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setEditCustomer(c); }}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-1.5 rounded-lg font-medium">Edit</button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "logs" && (
              <AuditLogViewer businessId={business.id} />
            )}

            {tab === "settings" && (
              <SettingsPanel
                business={business}
                products={products}
                branches={branches}
                staff={staff}
                showToast={showToast}
                onLogout={onLogout}
                onUpdated={fetchAll}
              />
            )}
          </>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-100 flex items-center justify-around px-2 py-2 z-30">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTabPersisted(item.key)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
              tab === item.key ? "bg-forest-50 text-forest-700" : "text-gray-400"
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span
              className={`text-xs font-medium ${
                tab === item.key ? "text-forest-700" : "text-gray-400"
              }`}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {showAddBranch && <AddBranchModal />}
      {showAddProduct && <ProductModal onClose={() => setShowAddProduct(false)} />}
      {editProduct && <ProductModal existing={editProduct} onClose={() => setEditProduct(null)} />}
      {showAddStaff && <AddStaffModal />}

      {/* Customer Modal */}
      {(showAddCustomer || editCustomer) && (
        <CustomerModal
          existing={editCustomer}
          businessId={business.id}
          showToast={showToast}
          onClose={() => { setShowAddCustomer(false); setEditCustomer(null); }}
          onSaved={() => { setShowAddCustomer(false); setEditCustomer(null); fetchAll(); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BARCODE SCANNER
// ═══════════════════════════════════════════════════════════════
function BarcodeScanner({ onDetected, onClose }) {
  const [manualCode, setManualCode] = useState("");
  const [lastScan, setLastScan] = useState("");
  const [scanSuccess, setScanSuccess] = useState(false);

  const { ref } = useZxing({
    onDecodeResult(result) {
      const text = result.getText();
      // Prevent duplicate scans within 2 seconds
      if (text && text !== lastScan) {
        setLastScan(text);
        setScanSuccess(true);
        setTimeout(() => setScanSuccess(false), 1500);
        onDetected(text);
      }
    },
    onError() {
      // Silent — errors happen constantly while scanning, that's normal
    },
    constraints: {
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    timeBetweenDecodingAttempts: 300,
  });

  const handleManual = () => {
    if (manualCode.trim()) {
      onDetected(manualCode.trim());
      setManualCode("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 bg-black bg-opacity-80">
        <button
          onClick={onClose}
          className="text-white text-sm font-medium px-3 py-2 bg-white bg-opacity-10 rounded-xl"
        >
          ✕ Close
        </button>
        <p className="text-white text-sm font-semibold">Scan Barcode</p>
        <div className="w-16"></div>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <video
          ref={ref}
          className="w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Targeting overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-72 h-44">
            {/* Corner brackets */}
            <div className={`absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 rounded-tl-lg transition-colors ${scanSuccess ? "border-forest-300" : "border-gold-400"}`}></div>
            <div className={`absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 rounded-tr-lg transition-colors ${scanSuccess ? "border-forest-300" : "border-gold-400"}`}></div>
            <div className={`absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 rounded-bl-lg transition-colors ${scanSuccess ? "border-forest-300" : "border-gold-400"}`}></div>
            <div className={`absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 rounded-br-lg transition-colors ${scanSuccess ? "border-forest-300" : "border-gold-400"}`}></div>

            {/* Scanning line */}
            <div className={`absolute top-1/2 left-0 right-0 h-0.5 animate-pulse transition-colors ${scanSuccess ? "bg-gold-300" : "bg-gold-400"} opacity-80`}></div>

            {/* Success flash */}
            {scanSuccess && (
              <div className="absolute inset-0 bg-gold-400 bg-opacity-20 rounded-lg flex items-center justify-center">
                <p className="text-forest-300 font-black text-lg">✓ Scanned!</p>
              </div>
            )}
          </div>
        </div>

        {/* Instruction */}
        <div className="absolute bottom-8 left-0 right-0 text-center px-4">
          <p className="text-white text-xs opacity-70">
            {scanSuccess ? "✓ Barcode detected!" : "Point camera at the barcode"}
          </p>
          {lastScan ? (
            <p className="text-gold-400 text-xs font-mono mt-1 opacity-80">{lastScan}</p>
          ) : null}
        </div>
      </div>
      <div className="bg-black bg-opacity-90 px-4 py-4">
        <p className="text-gray-400 text-xs text-center mb-3 font-medium uppercase tracking-wide">
          Or type barcode manually
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManual()}
            placeholder="Enter barcode number..."
            className="flex-1 bg-white bg-opacity-10 text-white border border-white border-opacity-20 rounded-xl px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-gold-400"
          />
          <button
            onClick={handleManual}
            className="bg-forest-600 text-white px-4 py-3 rounded-xl font-bold text-sm"
          >
            Search
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RECEIPT VIEW
// ═══════════════════════════════════════════════════════════════
function ReceiptView({ transaction, items, business, branch, cashier, onClose, onNewTransaction }) {
  const formatDate = (d) =>
    new Date(d).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const paymentLabel = {
    cash: "Cash", gcash: "GCash", maya: "Maya", card: "Card", utang: "Utang",
  }[transaction?.payment_method] || "Cash";

  const buildReceiptText = () => {
    const lines = [];
    if (business?.receipt_header) lines.push(business.receipt_header);
    lines.push(business?.name || "Store");
    if (branch?.name) lines.push(branch.name);
    lines.push("─".repeat(28));
    lines.push(`${transaction?.receipt_number}  ${formatDate(transaction?.created_at || new Date())}`);
    lines.push("─".repeat(28));
    items.forEach((item) => {
      lines.push(`${item.product_name}`);
      lines.push(`  ₱${Number(item.unit_price).toFixed(2)} × ${item.quantity}  =  ₱${Number(item.subtotal).toFixed(2)}`);
    });
    lines.push("─".repeat(28));
    lines.push(`Subtotal: ₱${Number(transaction?.original_amount || transaction?.total_amount).toFixed(2)}`);
    if (Number(transaction?.discount_amount) > 0) {
      const discLabel = transaction?.discount_type === "percent"
        ? `${transaction?.discount_value}%` : `₱${transaction?.discount_value} off`;
      lines.push(`Discount (${discLabel}): -₱${Number(transaction?.discount_amount).toFixed(2)}`);
    }
    lines.push(`Total: ₱${Number(transaction?.total_amount).toFixed(2)}`);
    lines.push(`Payment: ${paymentLabel}`);
    if (transaction?.payment_method === "cash") {
      lines.push(`Cash Tendered: ₱${Number(transaction?.amount_tendered).toFixed(2)}`);
      lines.push(`Change: ₱${Number(transaction?.change_amount).toFixed(2)}`);
    }
    if (transaction?.reference_number) {
      lines.push(`Ref #: ${transaction.reference_number}`);
    }
    if (transaction?.customer_name) {
      lines.push(`Customer: ${transaction.customer_name}`);
    }
    lines.push("─".repeat(28));
    lines.push(`Cashier: ${cashier?.full_name}`);
    if (business?.receipt_footer) lines.push(business.receipt_footer);
    lines.push("Powered by ListaKo");
    return lines.join("\n");
  };

  const handleShare = async () => {
    const text = buildReceiptText();
    if (navigator.share) {
      try {
        await navigator.share({ title: `Receipt ${transaction?.receipt_number}`, text });
      } catch (e) {
        if (e.name !== "AbortError") {
          await navigator.clipboard?.writeText(text);
        }
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      alert("Receipt copied to clipboard!");
    }
  };

  const handlePrint = () => {
    let printDiv = document.getElementById("print-receipt");
    if (!printDiv) {
      printDiv = document.createElement("div");
      printDiv.id = "print-receipt";
      printDiv.style.display = "none";
      document.body.appendChild(printDiv);
    }
    const discountHtml = Number(transaction?.discount_amount) > 0
      ? `<div class="receipt-row"><span>Discount</span><span>-₱${Number(transaction?.discount_amount).toFixed(2)}</span></div>` : "";
    const cashHtml = transaction?.payment_method === "cash"
      ? `<div class="receipt-row"><span>Cash</span><span>₱${Number(transaction?.amount_tendered).toFixed(2)}</span></div>
         <div class="receipt-row receipt-total"><span>Change</span><span>₱${Number(transaction?.change_amount).toFixed(2)}</span></div>` : "";
    const refHtml = transaction?.reference_number
      ? `<div class="receipt-row"><span>Ref #</span><span>${transaction.reference_number}</span></div>` : "";
    printDiv.innerHTML = `
      <div class="receipt-header">
        ${business?.receipt_header ? `<p>${business.receipt_header}</p>` : ""}
        <h2>${business?.name || "Store"}</h2>
        <p>${branch?.name || ""}</p>
        <p>${transaction?.receipt_number} | ${formatDate(transaction?.created_at || new Date())}</p>
      </div>
      <div class="receipt-divider"></div>
      ${items.map(i => `<div class="receipt-item"><div class="receipt-row"><span class="item-name">${i.product_name}</span><span>₱${Number(i.subtotal).toFixed(2)}</span></div><div class="item-detail">₱${Number(i.unit_price).toFixed(2)} × ${i.quantity}</div></div>`).join("")}
      <div class="receipt-divider"></div>
      <div class="receipt-row"><span>Subtotal</span><span>₱${Number(transaction?.original_amount || transaction?.total_amount).toFixed(2)}</span></div>
      ${discountHtml}
      <div class="receipt-row receipt-total"><span>TOTAL</span><span>₱${Number(transaction?.total_amount).toFixed(2)}</span></div>
      <div class="receipt-row"><span>Payment</span><span>${paymentLabel}</span></div>
      ${cashHtml}
      ${refHtml}
      <div class="receipt-divider"></div>
      <div class="receipt-footer">
        <p>Cashier: ${cashier?.full_name || ""}</p>
        ${business?.receipt_footer ? `<p>${business.receipt_footer}</p>` : ""}
        <p>Powered by ListaKo</p>
      </div>
    `;
    printDiv.style.display = "block";
    window.print();
    printDiv.style.display = "none";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="bg-forest-800 px-5 py-5 text-center flex-shrink-0">
          {business?.receipt_header && (
            <p className="text-forest-300 text-xs mb-1">{business.receipt_header}</p>
          )}
          <p className="text-gold-400 text-xs font-medium uppercase tracking-widest mb-1">
            Official Receipt
          </p>
          <h2 className="text-ivory-50 font-black text-lg">{business?.name}</h2>
          <p className="text-forest-300 text-xs mt-1">{branch?.name || ""}</p>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">
          <div className="flex justify-between text-xs text-gray-400 mb-3">
            <span>{transaction?.receipt_number}</span>
            <span>{formatDate(transaction?.created_at || new Date())}</span>
          </div>
          <div className="border-t border-dashed border-gray-200 mb-3"></div>
          <div className="space-y-2 mb-3">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{item.product_name}</p>
                  <p className="text-xs text-gray-400">
                    ₱{Number(item.unit_price).toFixed(2)} × {item.quantity}
                  </p>
                </div>
                <p className="font-semibold text-gray-800 ml-2">
                  ₱{Number(item.subtotal).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-gray-200 mb-3"></div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-800">
                ₱{Number(transaction?.original_amount || transaction?.total_amount).toFixed(2)}
              </span>
            </div>
            {Number(transaction?.discount_amount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-forest-600 font-medium">
                  Discount ({transaction?.discount_type === "percent"
                    ? `${transaction?.discount_value}%`
                    : `₱${transaction?.discount_value} off`})
                </span>
                <span className="font-bold text-forest-600">
                  -₱{Number(transaction?.discount_amount).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="font-medium text-gray-800">
                ₱{Number(transaction?.total_amount).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Payment</span>
              <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                transaction?.payment_method === "gcash" ? "bg-blue-50 text-blue-600"
                : transaction?.payment_method === "maya" ? "bg-forest-50 text-forest-600"
                : transaction?.payment_method === "card" ? "bg-purple-50 text-purple-600"
                : transaction?.payment_method === "utang" ? "bg-orange-50 text-orange-600"
                : "bg-gray-50 text-gray-600"
              }`}>
                {paymentLabel}
              </span>
            </div>
            {transaction?.payment_method === "cash" && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cash Tendered</span>
                  <span className="font-medium text-gray-800">
                    ₱{Number(transaction?.amount_tendered).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-black">
                  <span className="text-gray-800">Change</span>
                  <span className="text-forest-700">
                    ₱{Number(transaction?.change_amount).toFixed(2)}
                  </span>
                </div>
              </>
            )}
            {transaction?.reference_number && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ref #</span>
                <span className="font-mono font-semibold text-gray-800">
                  {transaction.reference_number}
                </span>
              </div>
            )}
            {transaction?.customer_name && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Customer</span>
                <span className="font-medium text-gray-800">{transaction.customer_name}</span>
              </div>
            )}
          </div>
          <div className="border-t border-dashed border-gray-200 mt-3 mb-3"></div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Cashier: {cashier?.full_name}</p>
            {business?.receipt_footer && (
              <p className="text-xs text-gray-400 mt-1">{business.receipt_footer}</p>
            )}
            <p className="text-xs text-gray-300 mt-1">Powered by ListaKo</p>
          </div>
        </div>
        <div className="px-5 pb-5 flex-shrink-0">
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleShare}
              className="flex-1 bg-blue-50 text-blue-600 font-semibold py-2.5 rounded-xl text-xs border border-blue-100 active:bg-blue-100"
            >
              Share Receipt
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 bg-purple-50 text-purple-600 font-semibold py-2.5 rounded-xl text-xs border border-purple-100 active:bg-purple-100"
            >
              Print Receipt
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm"
            >
              Close
            </button>
            <button
              onClick={onNewTransaction}
              className="flex-1 bg-forest-600 text-white font-bold py-3 rounded-xl text-sm"
            >
              New Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CASHIER POS
// ═══════════════════════════════════════════════════════════════
function CashierPOS({ profile, business, branch, onLogout, showToast }) {
  const [posTab, setPosTab] = useState(() => {
    return localStorage.getItem("cashier_tab") || "pos";
  });

  const setPosTabPersisted = (newTab) => {
    localStorage.setItem("cashier_tab", newTab);
    setPosTab(newTab);
  };

  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem("cashier_cart");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const setCartPersisted = (updater) => {
    setCart(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem("cashier_cart", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const [checkoutMode, setCheckoutMode] = useState(() => {
    return localStorage.getItem("cashier_checkout") === "true";
  });

  const setCheckoutModePersisted = (val) => {
    localStorage.setItem("cashier_checkout", String(val));
    setCheckoutMode(val);
  };

  const [paymentMethod, setPaymentMethod] = useState(() => {
    return localStorage.getItem("cashier_payment") || "cash";
  });

  const setPaymentMethodPersisted = (val) => {
    localStorage.setItem("cashier_payment", val);
    setPaymentMethod(val);
  };

  const [amountTendered, setAmountTendered] = useState(() => {
    return localStorage.getItem("cashier_amount") || "";
  });

  const setAmountTenderedPersisted = (val) => {
    localStorage.setItem("cashier_amount", val);
    setAmountTendered(val);
  };

  const [customerName, setCustomerName] = useState(() => {
    return localStorage.getItem("cashier_customer_name") || "";
  });

  const setCustomerNamePersisted = (val) => {
    localStorage.setItem("cashier_customer_name", val);
    setCustomerName(val);
  };

  const [customerPhone, setCustomerPhone] = useState(() => {
    return localStorage.getItem("cashier_customer_phone") || "";
  });

  const setCustomerPhonePersisted = (val) => {
    localStorage.setItem("cashier_customer_phone", val);
    setCustomerPhone(val);
  };

  const [gcashRef, setGcashRef] = useState(() => {
    return localStorage.getItem("cashier_gcash_ref") || "";
  });

  const setGcashRefPersisted = (val) => {
    localStorage.setItem("cashier_gcash_ref", val);
    setGcashRef(val);
  };

  const [discountType, setDiscountType] = useState(() => {
    return localStorage.getItem("cashier_discount_type") || "percent";
  });

  const setDiscountTypePersisted = (val) => {
    localStorage.setItem("cashier_discount_type", val);
    setDiscountType(val);
  };

  const [discountValue, setDiscountValue] = useState(() => {
    return localStorage.getItem("cashier_discount_value") || "";
  });

  const setDiscountValuePersisted = (val) => {
    localStorage.setItem("cashier_discount_value", val);
    setDiscountValue(val);
  };

  const [discountReason, setDiscountReason] = useState(() => {
    return localStorage.getItem("cashier_discount_reason") || "";
  });

  const setDiscountReasonPersisted = (val) => {
    localStorage.setItem("cashier_discount_reason", val);
    setDiscountReason(val);
  };

  const [customerType, setCustomerType] = useState(() => {
    return localStorage.getItem("cashier_customer_type") || "regular";
  });

  const setCustomerTypePersisted = (val) => {
    localStorage.setItem("cashier_customer_type", val);
    setCustomerType(val);
  };
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [utangList, setUtangList] = useState([]);
  const [loadingUtang, setLoadingUtang] = useState(false);
  const [voidModal, setVoidModal] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [utangPayModal, setUtangPayModal] = useState(null);
  const [utangPayAmount, setUtangPayAmount] = useState("");
  const [reconcileModal, setReconcileModal] = useState(false);
  const [cashCounted, setCashCounted] = useState("");
  const [returnModal, setReturnModal] = useState(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnItems, setReturnItems] = useState([]);
  const [cashierNotifs, setCashierNotifs] = useState([]);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinSetupValue, setPinSetupValue] = useState("");
  const [pinSetupConfirm, setPinSetupConfirm] = useState("");
  const [currentShift, setCurrentShift] = useState(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftStartCash, setShiftStartCash] = useState("");
  const [shiftEndCash, setShiftEndCash] = useState("");
  const [shiftNotes, setShiftNotes] = useState("");
  const [shiftLoading, setShiftLoading] = useState(false);

  useEffect(() => {
    const loadShift = async () => {
      const { data } = await supabase
        .from("shifts")
        .select("*")
        .eq("cashier_id", profile.id)
        .eq("status", "open")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setCurrentShift(data || null);
    };
    loadShift();
  }, [profile.id]);

  const openShift = async () => {
    if (!shiftStartCash || isNaN(Number(shiftStartCash))) return;
    setShiftLoading(true);
    const { data, error } = await supabase
      .from("shifts")
      .insert({
        business_id: business.id,
        branch_id: branch?.id || null,
        cashier_id: profile.id,
        starting_cash: Number(shiftStartCash),
      })
      .select()
      .maybeSingle();
    setShiftLoading(false);
    if (error) return showToast("Hindi ma-open ang shift.", "error");
    setCurrentShift(data);
    setShowShiftModal(false);
    setShiftStartCash("");
    showToast("Shift started!", "success");
  };

  const closeShift = async () => {
    if (!currentShift) return;
    if (!shiftEndCash || isNaN(Number(shiftEndCash))) return showToast("Enter the ending cash amount.", "error");
    setShiftLoading(true);
    const today = new Date(currentShift.started_at);
    const { data: shiftTxns } = await supabase
      .from("transactions")
      .select("total_amount, payment_method")
      .eq("business_id", business.id)
      .eq("cashier_id", profile.id)
      .eq("status", "completed")
      .gte("created_at", currentShift.started_at);
    const totalSales = (shiftTxns || []).reduce((s, t) => s + Number(t.total_amount), 0);
    const totalTx = (shiftTxns || []).length;
    const expectedCash = Number(currentShift.starting_cash) + (shiftTxns || []).filter(t => t.payment_method === "cash").reduce((s, t) => s + Number(t.total_amount), 0);
    const cashDiff = Number(shiftEndCash) - expectedCash;
    const { error } = await supabase
      .from("shifts")
      .update({
        ended_at: new Date().toISOString(),
        ending_cash: Number(shiftEndCash),
        total_sales: totalSales,
        total_transactions: totalTx,
        cash_difference: cashDiff,
        notes: shiftNotes.trim() || null,
        status: "closed",
      })
      .eq("id", currentShift.id);
    setShiftLoading(false);
    if (error) return showToast("Hindi ma-close ang shift.", "error");
    if (Math.abs(cashDiff) > 0) {
      await supabase.from("notifications").insert({
        business_id: business.id,
        type: "shift_report",
        title: cashDiff < 0 ? "⚠️ Shift Cash Shortage" : "💰 Shift Closed",
        message: `${profile.full_name} closed shift. Sales: ₱${totalSales.toFixed(2)}, ${totalTx} txns. Cash ${cashDiff >= 0 ? "over" : "short"} by ₱${Math.abs(cashDiff).toFixed(2)}.`,
        is_read: false,
      });
    }
    setCurrentShift(null);
    setShowShiftModal(false);
    setShiftEndCash("");
    setShiftNotes("");
    showToast(`Shift closed! Sales: ₱${totalSales.toFixed(2)}`, "success");
  };

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = discountValue
    ? discountType === "percent"
      ? Math.min((subtotal * Number(discountValue)) / 100, subtotal)
      : Math.min(Number(discountValue), subtotal)
    : 0;
  const total = Math.max(0, subtotal - discountAmount);
  const change = Math.max(0, Number(amountTendered) - total);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Check if transaction was made today (same day void only)
  const isToday = (dateString) => {
    const txDate = new Date(dateString);
    const now = new Date();
    return (
      txDate.getFullYear() === now.getFullYear() &&
      txDate.getMonth() === now.getMonth() &&
      txDate.getDate() === now.getDate()
    );
  };

  const CATEGORIES = ["All", "Beverages", "Snacks", "Household", "Personal Care", "Frozen", "Dairy", "Canned Goods", "Others"];

  // Search products with category filter
  useEffect(() => {
    if (!searchQuery.trim() && categoryFilter === "All") {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      let query = supabase
        .from("products")
        .select("*")
        .eq("business_id", business.id)
        .eq("status", "active");
      if (searchQuery.trim()) {
        query = query.ilike("name", `%${searchQuery}%`);
      }
      if (categoryFilter !== "All") {
        query = query.eq("category", categoryFilter);
      }
      const { data } = await query.order("name").limit(20);
      setSearchResults(data || []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, categoryFilter, business.id]);

  // State for new product found modal
  const [newProductModal, setNewProductModal] = useState(null);

  // Search by barcode — with Open Food Facts auto-lookup
  const handleBarcode = async (code) => {
    setScanning(false);

    // Step 1 — Check local database first
    const { data: localProduct } = await supabase
      .from("products")
      .select("*")
      .eq("business_id", business.id)
      .eq("barcode", code)
      .eq("status", "active")
      .maybeSingle();

    if (localProduct) {
      addToCart(localProduct);
      showToast(`${localProduct.name} added to cart!`, "success");
      return;
    }

    // Step 2 — Not in local DB, check Open Food Facts
    showToast("Product not in database. Looking up online...", "warning");
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${code}.json`
      );
      const json = await res.json();

      if (json.status === 1 && json.product) {
        const p = json.product;
        const productName =
          p.product_name_en ||
          p.product_name ||
          p.abbreviated_product_name ||
          "Unknown Product";
        const brand = p.brands || "";
        const fullName = brand ? `${productName} (${brand})` : productName;

        // Show modal — cashier sees it, cannot edit price
        setNewProductModal({
          barcode: code,
          name: fullName.trim(),
          image: p.image_front_small_url || null,
        });
      } else {
        // Step 3 — Not found online either, show modal with barcode only
        setNewProductModal({
          barcode: code,
          name: "",
          image: null,
          notFound: true,
        });
      }
    } catch (err) {
      // Network error — show modal with barcode only
      setNewProductModal({
        barcode: code,
        name: "",
        image: null,
        notFound: true,
      });
    }
  };

  // Add to cart with stock validation
  const getEffectivePrice = (product, qty) => {
    if (product.wholesale_price && product.wholesale_min_qty && qty >= product.wholesale_min_qty) {
      return Number(product.wholesale_price);
    }
    return Number(product.price);
  };

  const addToCart = (product) => {
    setCartPersisted((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          showToast(`Only ${product.stock_quantity} units of ${product.name} in stock.`, "warning");
          return prev;
        }
        const newQty = existing.quantity + 1;
        const price = getEffectivePrice(product, newQty);
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: newQty, unit_price: price, subtotal: newQty * price, is_wholesale: product.wholesale_price && newQty >= (product.wholesale_min_qty || 1) }
            : i
        );
      }
      if (product.stock_quantity <= 0) {
        showToast(`${product.name} is out of stock.`, "error");
        return prev;
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          unit_price: Number(product.price),
          retail_price: Number(product.price),
          quantity: 1,
          subtotal: Number(product.price),
          stock: product.stock_quantity,
          wholesale_price: product.wholesale_price ? Number(product.wholesale_price) : null,
          wholesale_min_qty: product.wholesale_min_qty || 1,
        },
      ];
    });
    setSearchQuery("");
    setSearchResults([]);
  };

  // Update quantity with stock validation
  const updateQty = (productId, delta) => {
    setCartPersisted((prev) =>
      prev
        .map((i) => {
          if (i.product_id !== productId) return i;
          if (delta > 0 && i.quantity >= i.stock) {
            showToast(`Only ${i.stock} units available.`, "warning");
            return i;
          }
          const newQty = i.quantity + delta;
          const retailPrice = i.retail_price || i.unit_price;
          const isWholesale = i.wholesale_price && newQty >= (i.wholesale_min_qty || 1);
          const effectivePrice = isWholesale ? i.wholesale_price : retailPrice;
          return { ...i, quantity: newQty, unit_price: effectivePrice, subtotal: newQty * effectivePrice, is_wholesale: !!isWholesale };
        })
        .filter((i) => i.quantity > 0)
    );
  };

  // Void transaction
  const voidTransaction = async () => {
    if (!voidReason.trim()) return showToast("Please enter a reason for the void request.", "error");
    if (!isToday(voidModal.created_at)) {
      return showToast("Only today's transactions can be voided. Contact your owner.", "error");
    }
    try {
      // Step 1 — Mark transaction as pending_void
      await supabase
        .from("transactions")
        .update({
          status: "pending_void",
          void_requested_at: new Date().toISOString(),
          void_requested_by: profile.id,
          void_request_reason: voidReason.trim(),
        })
        .eq("id", voidModal.id);

      // Step 2 — Send notification to owner with transaction_id for approval
      await supabase.from("notifications").insert({
        business_id: business.id,
        type: "void_request",
        title: "⚠️ Void Approval Needed",
        message: `${profile.full_name} wants to void ${voidModal.receipt_number} (₱${Number(voidModal.total_amount).toFixed(2)}). Reason: ${voidReason.trim()}`,
        transaction_id: voidModal.id,
        is_read: false,
        action_taken: null,
      });

      showToast("Void request sent to owner for approval.", "success");
      setVoidModal(null);
      setVoidReason("");
      loadHistory();
    } catch (err) {
      showToast("Failed to send void request.", "error");
    }
  };

  // Load utang records
  const loadUtang = async () => {
    setLoadingUtang(true);
    const { data } = await supabase
      .from("utang_records")
      .select("*")
      .eq("business_id", business.id)
      .in("status", ["unpaid", "partial"])
      .order("created_at", { ascending: false });
    setUtangList(data || []);
    setLoadingUtang(false);
  };

  // Mark utang as paid — requires amount confirmation
  const markUtangPaid = async () => {
    const amount = Number(utangPayAmount);
    const balance = Number(utangPayModal.amount) - Number(utangPayModal.amount_paid);
    if (!utangPayAmount || isNaN(amount) || amount <= 0) {
      return showToast("Please enter the amount received.", "error");
    }
    if (amount > balance) {
      return showToast(`Amount cannot exceed balance of ₱${balance.toFixed(2)}.`, "error");
    }
    const isFullyPaid = amount >= balance;
    await supabase
      .from("utang_records")
      .update({
        amount_paid: Number(utangPayModal.amount_paid) + amount,
        status: isFullyPaid ? "paid" : "partial",
        updated_at: new Date().toISOString(),
      })
      .eq("id", utangPayModal.id);
    showToast(
      isFullyPaid
        ? `${utangPayModal.customer_name} fully paid! ✓`
        : `₱${amount.toFixed(2)} recorded. Remaining: ₱${(balance - amount).toFixed(2)}`,
      "success"
    );
    setUtangPayModal(null);
    setUtangPayAmount("");
    loadUtang();
  };

  // Cash reconciliation submit
  const submitReconciliation = async () => {
    const counted = Number(cashCounted);
    if (!cashCounted || isNaN(counted)) {
      return showToast("Please enter the cash amount counted.", "error");
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: txns } = await supabase
      .from("transactions")
      .select("total_amount, payment_method")
      .eq("business_id", business.id)
      .eq("status", "completed")
      .eq("payment_method", "cash")
      .gte("created_at", today.toISOString());
    const expectedCash = (txns || []).reduce((s, t) => s + Number(t.total_amount), 0);
    const difference = counted - expectedCash;
    const status = difference === 0 ? "exact" : difference > 0 ? "over" : "short";
    await supabase.from("daily_reports").insert({
      business_id: business.id,
      branch_id: branch?.id || null,
      cashier_id: profile.id,
      report_date: new Date().toISOString().split("T")[0],
      expected_cash: expectedCash,
      counted_cash: counted,
      difference: difference,
      status: status,
    });
    showToast(
      status === "exact"
        ? "Cash reconciled perfectly! ✓"
        : status === "over"
        ? `Cash is over by ₱${Math.abs(difference).toFixed(2)}`
        : `Cash is short by ₱${Math.abs(difference).toFixed(2)} ⚠️`,
      status === "short" ? "error" : "success"
    );
    setReconcileModal(false);
    setCashCounted("");
  };

  const verifyPin = async (pin) => {
    if (pin === profile.pin_code) {
      setPinVerified(true);
      setShowPinModal(false);
      setPinInput("");
      return true;
    }
    showToast("Incorrect PIN. Try again.", "error");
    setPinInput("");
    return false;
  };

  const setupPin = async () => {
    if (pinSetupValue.length !== 4 || !/^\d{4}$/.test(pinSetupValue)) return showToast("PIN must be exactly 4 digits.", "error");
    if (pinSetupValue !== pinSetupConfirm) return showToast("PINs don't match.", "error");
    const { error } = await supabase.from("profiles").update({ pin_code: pinSetupValue }).eq("id", profile.id);
    if (error) return showToast("Failed to save PIN.", "error");
    profile.pin_code = pinSetupValue;
    setShowPinSetup(false);
    setPinSetupValue("");
    setPinSetupConfirm("");
    showToast("PIN set successfully!", "success");
  };

  const processCheckout = async () => {
    if (cart.length === 0) return showToast("Cart is empty.", "error");
    if (profile.pin_code && !pinVerified) {
      setShowPinModal(true);
      return;
    }
    if (paymentMethod === "cash" && (!amountTendered || Number(amountTendered) < total)) {
      return showToast("Amount tendered is less than the total.", "error");
    }
    if (paymentMethod === "utang" && !customerName.trim()) {
      return showToast("Please enter the customer's name for utang.", "error");
    }
    if ((paymentMethod === "gcash" || paymentMethod === "maya") && !gcashRef.trim()) {
      return showToast(`Please enter the ${paymentMethod === "gcash" ? "GCash" : "Maya"} reference number.`, "error");
    }
    // Discount validations — all 9 rules
    if (discountAmount > 0) {
      // Senior/PWD bypass — legally required discounts skip most rules
      const isSeniorPWD = customerType === "senior" || customerType === "pwd";

      // Check for no_discount products in cart
      const { data: cartProducts } = await supabase
        .from("products")
        .select("id, name, no_discount")
        .in("id", cart.map(i => i.product_id));
      const excludedProduct = cartProducts?.find(p => p.no_discount);
      if (excludedProduct) {
        return showToast(`"${excludedProduct.name}" is excluded from discounts by the owner.`, "error");
      }

      // Rule 1 — Discounts enabled (Senior/PWD always allowed)
      if (!isSeniorPWD && business.discount_enabled === false) {
        return showToast("Discounts are currently disabled by the owner.", "error");
      }
      // Rule 2 — Allowed types (Senior/PWD always percent)
      if (!isSeniorPWD && business.discount_types_allowed === "percent" && discountType === "fixed") {
        return showToast("Only percentage discounts are allowed.", "error");
      }
      if (!isSeniorPWD && business.discount_types_allowed === "fixed" && discountType === "percent") {
        return showToast("Only fixed amount discounts are allowed.", "error");
      }
      // Rule 3 & 4 — Max limits (Senior/PWD bypass)
      if (!isSeniorPWD && discountType === "percent" && Number(discountValue) > (business.max_discount_percent || 20)) {
        return showToast(`Maximum discount allowed is ${business.max_discount_percent || 20}%.`, "error");
      }
      if (!isSeniorPWD && discountType === "fixed" && Number(discountValue) > (business.max_discount_fixed || 500)) {
        return showToast(`Maximum discount allowed is ₱${business.max_discount_fixed || 500}.`, "error");
      }
      // Rule 5 & 6 — Bundle rules (Senior/PWD bypass)
      if (!isSeniorPWD) {
        const minQty = business.discount_min_quantity || 3;
        const hasBundle = cart.some(item => item.quantity >= minQty);
        if (!hasBundle) {
          return showToast(`Discount requires at least ${minQty} pieces of the same item.`, "error");
        }
        const minAmount = business.discount_min_amount || 200;
        if (subtotal < minAmount) {
          return showToast(`Minimum purchase of ₱${minAmount} required for discount.`, "error");
        }
      }
      // Rule 7 — Reason required (always)
      if (!discountReason.trim()) {
        return showToast("Please enter a reason for the discount.", "error");
      }
      // Rule 8 — Time restriction (Senior/PWD bypass)
      if (!isSeniorPWD) {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const startTime = business.discount_start_time || "00:00";
        const endTime = business.discount_end_time || "23:59";
        if (currentTime < startTime || currentTime > endTime) {
          return showToast(`Discounts only allowed between ${startTime} and ${endTime}.`, "error");
        }
      }
      // Rule 9 — Manager approval for high discounts
      // EXCEPTION: Senior/PWD discounts are legally required — never need approval
      if (!isSeniorPWD && discountType === "percent" && Number(discountValue) > (business.manager_approval_threshold || 15)) {
        // Check if owner already approved in database
        const { data: cashierProfile } = await supabase
          .from("profiles")
          .select("approved_discount_percent, approved_discount_at")
          .eq("id", profile.id)
          .maybeSingle();

        const isApproved = cashierProfile?.approved_discount_percent >= Number(discountValue) &&
          cashierProfile?.approved_discount_at &&
          (new Date() - new Date(cashierProfile.approved_discount_at)) < 30 * 60 * 1000; // 30 min window

        if (isApproved) {
          // Clear the approval after use
          await supabase.from("profiles").update({
            approved_discount_percent: 0,
            approved_discount_at: null,
          }).eq("id", profile.id);
          // Continue to process checkout
        } else {
          // Check for existing pending request
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("business_id", business.id)
            .eq("type", "discount_approval_request")
            .is("action_taken", null)
            .maybeSingle();

          if (existing) {
            return showToast("Already waiting for owner approval. Please wait.", "warning");
          }

          // Send new approval request
          await supabase.from("notifications").insert({
            business_id: business.id,
            type: "discount_approval_request",
            title: "🏷️ High Discount Approval Needed",
            message: `${profile.full_name} is requesting a ${discountValue}% discount (above your ${business.manager_approval_threshold || 15}% threshold). Cart total: ₱${subtotal.toFixed(2)}. Reason: ${discountReason.trim()}`,
            is_read: false,
            recipient_id: null,
            sender_id: profile.id,
            transaction_id: null,
          });
          return showToast(`Discount above ${business.manager_approval_threshold || 15}% requires owner approval. Request sent! ✓`, "warning");
        }
      }
    }
    setProcessing(true);
    try {
      // Create transaction
      const { data: txn, error: txnError } = await supabase
        .from("transactions")
        .insert({
          business_id: business.id,
          branch_id: branch?.id || null,
          cashier_id: profile.id,
          original_amount: subtotal,
          discount_type: discountAmount > 0 ? discountType : null,
          discount_value: discountAmount > 0 ? Number(discountValue) : 0,
          discount_amount: discountAmount,
          discount_reason: discountAmount > 0 ? discountReason.trim() : null,
          total_amount: total,
          payment_method: paymentMethod,
          amount_tendered: paymentMethod === "cash" ? Number(amountTendered) : total,
          change_amount: paymentMethod === "cash" ? change : 0,
          customer_name: customerName.trim() || null,
          customer_phone: customerPhone.trim() || null,
          reference_number: (paymentMethod === "gcash" || paymentMethod === "maya") ? gcashRef.trim() : null,
          status: "completed",
        })
        .select()
        .maybeSingle();
      if (txnError) throw txnError;
      if (!txn) throw new Error("Hindi na-save ang transaction. Subukan muli.");

      // Create transaction items
      const items = cart.map((item) => ({
        transaction_id: txn.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));
      const { error: itemsError } = await supabase.from("transaction_items").insert(items);
      if (itemsError) throw itemsError;

      // If utang — create utang record
      if (paymentMethod === "utang") {
        await supabase.from("utang_records").insert({
          business_id: business.id,
          branch_id: branch?.id || null,
          transaction_id: txn.id,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || null,
          amount: total,
          amount_paid: 0,
          status: "unpaid",
        });
      }

      // If discount applied — notify owner and save to discount log
      if (discountAmount > 0) {
        await supabase.from("notifications").insert({
          business_id: business.id,
          type: "discount",
          title: "🏷️ Discount Applied",
          message: `${profile.full_name} gave a ${discountType === "percent" ? `${discountValue}%` : `₱${Number(discountValue).toFixed(2)}`} discount on ${txn.receipt_number}. Amount: ₱${discountAmount.toFixed(2)} off. Reason: ${discountReason.trim()}`,
          is_read: false,
          recipient_id: null,
        });
        // Save to discount history log
        await supabase.from("discount_logs").insert({
          business_id: business.id,
          branch_id: branch?.id || null,
          transaction_id: txn.id,
          cashier_id: profile.id,
          discount_type: discountType,
          discount_value: Number(discountValue),
          discount_amount: discountAmount,
          discount_reason: discountReason.trim(),
          customer_type: customerType || "regular",
        });
      }

      // Deduct stock, log history, check low stock
      for (const item of cart) {
        try {
          const { data: prod } = await supabase
            .from("products")
            .select("stock_quantity, low_stock_threshold, name")
            .eq("id", item.product_id)
            .maybeSingle();
          if (prod) {
            const newQty = Math.max(0, prod.stock_quantity - item.quantity);
            await supabase
              .from("products")
              .update({ stock_quantity: newQty })
              .eq("id", item.product_id);
            await supabase.from("stock_history").insert({
              business_id: business.id,
              product_id: item.product_id,
              changed_by: profile.id,
              change_type: "sale",
              quantity_before: prod.stock_quantity,
              quantity_after: newQty,
              quantity_change: -item.quantity,
              notes: `Sale: ${txn.receipt_number}`,
            });
            if (newQty <= (prod.low_stock_threshold || 10) && prod.stock_quantity > (prod.low_stock_threshold || 10)) {
              await supabase.from("notifications").insert({
                business_id: business.id,
                type: "low_stock",
                title: "Low Stock Alert",
                message: `${prod.name} is down to ${newQty} units (threshold: ${prod.low_stock_threshold || 10}).`,
                product_id: item.product_id,
                is_read: false,
              });
            }
          }
        } catch (stockErr) {
          console.warn("Stock deduction skipped:", stockErr);
        }
      }

      logAudit(business.id, profile.id, profile.full_name, "transaction_completed", "transaction", txn.id, { receipt: txn.receipt_number, amount: total, method: paymentMethod, items: cart.length });
      setPinVerified(false);

      setReceiptItems(cart.map((i) => ({ ...i })));
      setReceipt(txn);
      setCartPersisted([]);
      setAmountTenderedPersisted("");
      setCustomerNamePersisted("");
      setCustomerPhonePersisted("");
      setGcashRefPersisted("");
      setDiscountValuePersisted("");
      setDiscountReasonPersisted("");
      setDiscountTypePersisted("percent");
      setCustomerTypePersisted("regular");
      setCheckoutModePersisted(false);
      // Clear all cashier localStorage keys
      [
        "cashier_cart", "cashier_checkout", "cashier_payment",
        "cashier_amount", "cashier_customer_name", "cashier_customer_phone",
        "cashier_gcash_ref", "cashier_discount_type", "cashier_discount_value",
        "cashier_discount_reason", "cashier_customer_type", "cashier_approved_discount"
      ].forEach(k => localStorage.removeItem(k));
    } catch (err) {
      showToast("Transaction failed: " + (err?.message || "Unknown error"), "error");
      console.error("Checkout error:", err);
    } finally {
      setProcessing(false);
    }
  };

  // Load transaction history
  const loadHistory = async () => {
    setLoadingHistory(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [txData, cashierNotifs] = await Promise.all([
      supabase
        .from("transactions")
        .select("*, transaction_items(*, products(name))")
        .eq("cashier_id", profile.id)
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", profile.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false }),
    ]);
    setHistory(txData.data || []);
    setCashierNotifs(cashierNotifs.data || []);
    setLoadingHistory(false);
  };

  // Load cashier notifications — runs on all tabs every 10 seconds
  const loadCashierNotifs = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", profile.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false });
    setCashierNotifs(data || []);
  }, [profile.id]);

  // Poll for notifications every 10 seconds regardless of tab
  useEffect(() => {
    loadCashierNotifs();
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", profile.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false });
      const notifs = data || [];
      setCashierNotifs(notifs);
      // Auto-close checkout and clear discount if declined
      const declined = notifs.find(n => n.type === "discount_declined");
      if (declined) {
        setDiscountValuePersisted("");
        setDiscountReasonPersisted("");
        setDiscountTypePersisted("percent");
        setCustomerTypePersisted("regular");
        setCheckoutModePersisted(false);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [loadCashierNotifs]);

  useEffect(() => {
    if (posTab === "history") loadHistory();
    if (posTab === "utang") loadUtang();
  }, [posTab]);

  const PAYMENT_METHODS = [
    { key: "cash", label: "Cash" },
    { key: "gcash", label: "GCash" },
    { key: "maya", label: "Maya" },
    { key: "card", label: "Card" },
    { key: "utang", label: "Utang" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-forest-800 px-4 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-gold-400 text-xs font-medium uppercase tracking-widest">Cashier</p>
            <h1 className="text-ivory-50 font-black text-lg leading-tight">{business.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => profile.pin_code ? setShowPinSetup(true) : setShowPinSetup(true)}
              className="text-xs px-2 py-2 rounded-xl font-medium border bg-forest-700 text-forest-200 border-forest-600"
              title={profile.pin_code ? "Change PIN" : "Set PIN"}
            >
              {profile.pin_code ? "🔒" : "🔓"}
            </button>
            <button
              onClick={() => setShowShiftModal(true)}
              className={`text-xs px-3 py-2 rounded-xl font-medium border ${
                currentShift
                  ? "bg-green-700 text-green-100 border-green-600"
                  : "bg-forest-700 text-gold-400 border-forest-600"
              }`}
            >
              {currentShift ? "On Shift" : "Start Shift"}
            </button>
            <button
              onClick={onLogout}
              className="bg-forest-700 text-gold-400 text-xs px-3 py-2 rounded-xl font-medium border border-forest-600"
            >
              Logout
            </button>
          </div>
        </div>
        <p className="text-forest-300 text-xs">
          {branch?.name || "No branch"} · {profile.full_name}
          {currentShift && (
            <span className="text-green-400 ml-1">
              · Shift since {new Date(currentShift.started_at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true })}
            </span>
          )}
        </p>
      </div>

      {/* Tab bar */}
      <div className="bg-forest-900 flex px-2 gap-1 flex-shrink-0">
        {[
          { key: "pos", label: "POS" },
          { key: "history", label: "Sales" },
          { key: "utang", label: "Utang" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setPosTabPersisted(t.key)}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-t-lg transition-colors ${
              posTab === t.key ? "bg-ivory-100 text-forest-700" : "text-forest-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* POS Tab */}
      {posTab === "pos" && (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Cashier notifications — shown on POS tab too */}
          {cashierNotifs.length > 0 && (
            <div className="px-4 pt-3 space-y-2 flex-shrink-0">
              {cashierNotifs.map((n) => (
                <div key={n.id} className={`rounded-2xl p-3 border ${
                  n.type === "void_approved" || n.type === "discount_approved"
                    ? "bg-forest-50 border-forest-200"
                    : "bg-red-50 border-red-200"
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className={`text-xs font-bold ${
                        n.type === "void_approved" || n.type === "discount_approved"
                          ? "text-forest-700" : "text-red-700"
                      }`}>{n.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                      {/* Auto-clear discount if declined */}
                      {n.type === "discount_declined" && (
                        <button
                          onClick={() => {
                            setDiscountValuePersisted("");
                            setDiscountReasonPersisted("");
                            setDiscountTypePersisted("percent");
                            setCustomerTypePersisted("regular");
                          }}
                          className="mt-2 text-xs bg-red-100 text-red-700 font-semibold px-3 py-1.5 rounded-lg"
                        >
                          Clear Discount & Try Again
                        </button>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
                        // Auto-clear discount if this was a decline
                        if (n.type === "discount_declined") {
                          setDiscountValuePersisted("");
                          setDiscountReasonPersisted("");
                          setDiscountTypePersisted("percent");
                          setCustomerTypePersisted("regular");
                        }
                        loadCashierNotifs();
                      }}
                      className="text-gray-400 text-sm ml-2 flex-shrink-0"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Search bar */}
          <div className="px-4 py-3 bg-white border-b border-gray-100 flex gap-2 flex-shrink-0">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product by name..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 pr-8"
              />
              {searching && (
                <div className="absolute right-3 top-3 w-4 h-4 border-2 border-forest-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <button
              onClick={() => setScanning(true)}
              className="bg-forest-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm"
            >
              📷 Scan
            </button>
          </div>

          {/* Category filter chips */}
          <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto flex-shrink-0 hide-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  categoryFilter === cat
                    ? "bg-forest-600 text-white border-forest-600"
                    : "bg-white text-gray-500 border-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="mx-4 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-10 flex-shrink-0">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={`w-full px-4 py-3 text-left flex items-center justify-between border-b border-gray-50 last:border-0 active:bg-forest-50 ${
                    p.stock_quantity <= 0 ? "opacity-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {p.image_url && (
                      <img src={p.image_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                      <p
                        className={`text-xs mt-0.5 ${
                          p.stock_quantity <= 0
                            ? "text-red-400 font-semibold"
                            : p.stock_quantity <= p.low_stock_threshold
                            ? "text-yellow-500"
                            : "text-gray-400"
                        }`}
                      >
                        {p.stock_quantity <= 0 ? "Out of stock" : `Stock: ${p.stock_quantity}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-forest-700 flex-shrink-0">
                    ₱{Number(p.price).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Cart */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 bg-forest-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
                      stroke="#1e5631"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <line x1="3" y1="6" x2="21" y2="6" stroke="#1e5631" strokeWidth="1.5" />
                    <path
                      d="M16 10a4 4 0 01-8 0"
                      stroke="#1e5631"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="font-semibold text-gray-500 text-sm">Cart is empty</p>
                <p className="text-xs text-gray-400 mt-1">
                  Scan a barcode or search a product to start
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.product_id}
                    className="bg-white rounded-xl p-3 flex items-center gap-3 border border-gray-100 shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        ₱{item.unit_price.toFixed(2)} each
                        {item.is_wholesale && <span className="ml-1 text-gold-600 font-bold">(Wholesale)</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.product_id, -1)}
                        className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 font-bold text-base flex items-center justify-center active:bg-gray-200"
                      >
                        −
                      </button>
                      <span className="text-sm font-black text-gray-800 w-5 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.product_id, 1)}
                        className="w-7 h-7 rounded-lg bg-forest-100 text-forest-700 font-bold text-base flex items-center justify-center active:bg-forest-200"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-sm font-black text-forest-700 w-16 text-right">
                      ₱{item.subtotal.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout bar */}
          {cart.length > 0 && !checkoutMode && (
            <div className="px-4 py-3 bg-white border-t border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">
                  {itemCount} item{itemCount !== 1 ? "s" : ""}
                </p>
                <p className="text-xl font-black text-gray-800">₱{total.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setCheckoutModePersisted(true)}
                className="w-full bg-gold-400 text-forest-900 font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform"
              >
                Proceed to Checkout →
              </button>
            </div>
          )}

          {/* Checkout modal */}
          {checkoutMode && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-40">
              <div className={`bg-white w-full rounded-t-3xl p-5 overflow-y-auto pb-6 transition-all duration-300 ${
                paymentMethod === "gcash" || paymentMethod === "maya"
                  ? "max-h-[82vh]"
                  : paymentMethod === "utang"
                  ? "max-h-[75vh]"
                  : "max-h-[55vh]"
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-gray-800 text-lg">Checkout</h3>
                  <button onClick={() => setCheckoutModePersisted(false)} className="text-gray-400 text-xl">
                    ✕
                  </button>
                </div>

                {/* Order summary */}
                <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                    Order Summary
                  </p>
                  {cart.map((item) => (
                    <div key={item.product_id} className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">
                        {item.product_name} × {item.quantity}
                      </span>
                      <span className="font-semibold text-gray-800">
                        ₱{item.subtotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 mt-2 pt-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-medium text-gray-800">₱{subtotal.toFixed(2)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-forest-600 font-medium">
                          🏷️ Discount ({discountType === "percent" ? `${discountValue}%` : `₱${discountValue} off`})
                        </span>
                        <span className="font-bold text-forest-600">-₱{discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between mt-1">
                      <span className="font-black text-gray-800">Total</span>
                      <span className="font-black text-forest-700 text-lg">₱{total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Discount Section */}
                {business.discount_enabled !== false && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                      🏷️ Apply Discount
                    </p>
                    {discountAmount > 0 && (
                      <button
                        onClick={() => { setDiscountValuePersisted(""); setDiscountReasonPersisted(""); setCustomerTypePersisted("regular"); }}
                        className="text-xs text-red-500 font-semibold"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Customer Type — auto-applies discount */}
                  <p className="text-xs text-gray-400 mb-1">Customer Type</p>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {[
                      { key: "regular", label: "Regular" },
                      { key: "suki", label: `Suki (${business.suki_discount_percent || 5}%)` },
                      { key: "senior", label: `Senior (${business.senior_pwd_discount_percent || 20}%)` },
                      { key: "pwd", label: `PWD (${business.senior_pwd_discount_percent || 20}%)` },
                    ].map(t => (
                      <button key={t.key}
                        onClick={() => {
                          setCustomerTypePersisted(t.key);
                          if (t.key === "suki") {
                            setDiscountTypePersisted("percent");
                            setDiscountValuePersisted(String(business.suki_discount_percent || 5));
                            setDiscountReasonPersisted("Suki/Loyalty discount");
                          } else if (t.key === "senior") {
                            setDiscountTypePersisted("percent");
                            setDiscountValuePersisted(String(business.senior_pwd_discount_percent || 20));
                            setDiscountReasonPersisted("Senior Citizen discount (RA 9994)");
                          } else if (t.key === "pwd") {
                            setDiscountTypePersisted("percent");
                            setDiscountValuePersisted(String(business.senior_pwd_discount_percent || 20));
                            setDiscountReasonPersisted("PWD discount (RA 7277)");
                          } else {
                            setDiscountValuePersisted("");
                            setDiscountReasonPersisted("");
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                          customerType === t.key
                            ? "bg-forest-600 text-white border-forest-600"
                            : "bg-white text-gray-600 border-gray-200"
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Manual discount input */}
                  {customerType === "regular" && (
                    <>
                      <div className="flex gap-2 mb-2">
                        {(business.discount_types_allowed === "both" || business.discount_types_allowed === "percent" || !business.discount_types_allowed) && (
                          <button onClick={() => { setDiscountTypePersisted("percent"); setDiscountValuePersisted(""); }}
                            className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${
                              discountType === "percent" ? "bg-forest-600 text-white border-forest-600" : "bg-white text-gray-600 border-gray-200"
                            }`}>% Percent</button>
                        )}
                        {(business.discount_types_allowed === "both" || business.discount_types_allowed === "fixed" || !business.discount_types_allowed) && (
                          <button onClick={() => { setDiscountTypePersisted("fixed"); setDiscountValuePersisted(""); }}
                            className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${
                              discountType === "fixed" ? "bg-forest-600 text-white border-forest-600" : "bg-white text-gray-600 border-gray-200"
                            }`}>₱ Fixed</button>
                        )}
                      </div>
                      <input type="number" value={discountValue}
                        onChange={e => setDiscountValuePersisted(e.target.value)}
                        placeholder={discountType === "percent"
                          ? `Max ${business.max_discount_percent || 20}%`
                          : `Max ₱${business.max_discount_fixed || 500}`}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 mb-2" />
                    </>
                  )}

                  {discountValue && Number(discountValue) > 0 && (
                    <input type="text" value={discountReason}
                      onChange={e => setDiscountReasonPersisted(e.target.value)}
                      placeholder="Reason for discount (required)..."
                      className="w-full border border-orange-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50 mb-2" />
                  )}

                  {discountAmount > 0 && (
                    <div className="bg-forest-50 border border-forest-200 rounded-xl px-3 py-2">
                      <p className="text-xs text-forest-700 font-semibold">
                        ✓ Discount of ₱{discountAmount.toFixed(2)} applied — New total: ₱{total.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
                )}

                {/* Payment method */}
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                  Payment Method
                </p>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setPaymentMethodPersisted(m.key)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                        paymentMethod === m.key
                          ? "bg-forest-600 text-white border-forest-600"
                          : "bg-white text-gray-600 border-gray-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* GCash / Maya Reference Number — REQUIRED — shown first so it's always visible */}
                {(paymentMethod === "gcash" || paymentMethod === "maya") && (
                  <div className="border-2 border-red-300 rounded-2xl p-3 bg-red-50">
                    {paymentMethod === "gcash" && business.gcash_qr && (
                      <div className="mb-3 text-center">
                        <p className="text-xs font-bold text-blue-700 mb-1">📱 Show this QR to customer</p>
                        <img src={business.gcash_qr} alt="GCash QR" className="w-48 h-48 object-contain mx-auto rounded-xl border border-blue-200 bg-white p-1" />
                      </div>
                    )}
                    <p className="text-xs font-black text-red-600 uppercase mb-1">
                      ⚠️ {paymentMethod === "gcash" ? "GCash" : "Maya"} Reference No. — REQUIRED
                    </p>
                    <input
                      type="text"
                      value={gcashRef}
                      onChange={(e) => setGcashRefPersisted(e.target.value)}
                      placeholder="e.g. 1234567890"
                      className="w-full border-2 border-red-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white font-mono font-bold"
                    />
                    <p className="text-xs text-red-500 mt-1">Check your {paymentMethod === "gcash" ? "GCash" : "Maya"} SMS for the reference number.</p>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerNamePersisted(e.target.value)}
                      placeholder="Customer name (optional)..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 bg-white mt-2"
                    />
                  </div>
                )}

                {/* Utang customer name */}
                {paymentMethod === "utang" && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                      Customer Name (Required)
                    </p>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerNamePersisted(e.target.value)}
                      placeholder="Enter customer name..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 mb-2"
                    />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhonePersisted(e.target.value)}
                      placeholder="Phone number (optional)..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
                    />
                    <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                      <p className="text-xs text-orange-700 font-medium">
                        ⚠️ This transaction will be recorded as utang. The customer owes ₱{total.toFixed(2)}.
                      </p>
                    </div>
                  </div>
                )}

                {/* Cash tendered */}
                {paymentMethod === "cash" && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                      Cash Tendered
                    </p>
                    <input
                      type="number"
                      value={amountTendered}
                      onChange={(e) => setAmountTenderedPersisted(e.target.value)}
                      placeholder="Enter amount..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-forest-500"
                    />
                    {amountTendered && Number(amountTendered) >= total && (
                      <div className="mt-2 bg-forest-50 rounded-xl px-4 py-3 flex justify-between">
                        <span className="font-semibold text-forest-700">Change</span>
                        <span className="font-black text-forest-700 text-lg">
                          ₱{change.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick cash buttons */}
                {paymentMethod === "cash" && (
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {[
                      Math.ceil(total / 50) * 50,
                      Math.ceil(total / 100) * 100,
                      Math.ceil(total / 500) * 500,
                      1000,
                    ].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setAmountTenderedPersisted(String(amt))}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium"
                      >
                        ₱{amt}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={processCheckout}
                  disabled={
                    processing ||
                    (paymentMethod === "cash" &&
                      (!amountTendered || Number(amountTendered) < total)) ||
                    (paymentMethod === "utang" && !customerName.trim()) ||
                    ((paymentMethod === "gcash" || paymentMethod === "maya") && !gcashRef.trim()) ||
                    cashierNotifs.some(n => n.type === "discount_declined")
                  }
                  className="w-full bg-forest-600 text-white font-black py-4 rounded-2xl text-lg disabled:opacity-50 active:scale-95 transition-transform mb-4"
                >
                  {cashierNotifs.some(n => n.type === "discount_declined")
                    ? "❌ Discount Declined — Clear it first"
                    : processing
                    ? "Processing..."
                    : paymentMethod === "utang"
                    ? `Record Utang · ₱${total.toFixed(2)}`
                    : `Confirm Payment · ₱${total.toFixed(2)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {posTab === "history" && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Cashier notifications — void decisions from owner */}
          {cashierNotifs.length > 0 && (
            <div className="mb-3 space-y-2">
              {cashierNotifs.map((n) => (
                <div key={n.id} className={`rounded-2xl p-3 border ${
                  n.type === "void_approved" || n.type === "discount_approved"
                    ? "bg-forest-50 border-forest-200"
                    : "bg-red-50 border-red-200"
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className={`text-xs font-bold ${
                        n.type === "void_approved" || n.type === "discount_approved"
                          ? "text-forest-700"
                          : "text-red-700"
                      }`}>{n.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
                        loadHistory();
                      }}
                      className="text-gray-400 text-sm ml-2 flex-shrink-0"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-semibold text-gray-500 text-sm">No transactions today</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                  Today's Transactions
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-forest-700">
                    ₱
                    {history
                      .filter((t) => t.status === "completed")
                      .reduce((s, t) => s + Number(t.total_amount), 0)
                      .toFixed(2)}{" "}
                    total
                  </p>
                  <button
                    onClick={() => setReconcileModal(true)}
                    className="text-xs bg-blue-50 text-blue-600 font-semibold px-3 py-1.5 rounded-lg border border-blue-100"
                  >
                    💰 Count Cash
                  </button>
                </div>
              </div>
              {history.map((txn) => (
                <div
                  key={txn.id}
                  className={`bg-white rounded-xl p-4 border shadow-sm ${
                    txn.status === "voided" ? "border-red-200 opacity-60" : "border-gray-100"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-mono text-gray-400">{txn.receipt_number}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(txn.created_at).toLocaleTimeString("en-PH", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                        {txn.customer_name ? ` · ${txn.customer_name}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-black ${
                          txn.status === "voided"
                            ? "text-red-400 line-through"
                            : "text-forest-700"
                        }`}
                      >
                        ₱{Number(txn.total_amount).toFixed(2)}
                      </p>
                      <div className="flex gap-1 mt-0.5 justify-end">
                        <span className="text-xs bg-forest-50 text-forest-600 px-2 py-0.5 rounded-full font-medium capitalize">
                          {txn.payment_method}
                        </span>
                        {txn.status === "voided" && (
                          <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">
                            Voided
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {txn.transaction_items && txn.transaction_items.length > 0 && (
                    <div className="text-xs text-gray-400 space-y-0.5 mb-2">
                      {txn.transaction_items.map((item, i) => (
                        <p key={i}>
                          {item.products?.name || "Product"} × {item.quantity}
                        </p>
                      ))}
                    </div>
                  )}
                  {txn.status === "completed" && (
                    <div className="flex gap-2 mt-1">
                      {isToday(txn.created_at) && (
                        <button
                          onClick={() => setVoidModal(txn)}
                          className="text-xs text-red-500 font-semibold bg-red-50 px-3 py-1.5 rounded-lg"
                        >
                          Request Void
                        </button>
                      )}
                      <button
                        onClick={() => setReturnModal(txn)}
                        className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-lg"
                      >
                        Return/Refund
                      </button>
                    </div>
                  )}
                  {txn.status === "pending_void" && (
                    <div className="mt-1 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
                      <p className="text-xs text-yellow-700 font-semibold">⏳ Waiting for owner approval</p>
                      <p className="text-xs text-yellow-600 mt-0.5">Reason: {txn.void_request_reason}</p>
                    </div>
                  )}
                  {txn.status === "voided" && txn.void_reason && (
                    <p className="text-xs text-red-400 mt-1">Reason: {txn.void_reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Utang Tab */}
      {posTab === "utang" && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loadingUtang ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : utangList.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-2xl mb-2">✅</p>
              <p className="font-semibold text-gray-500 text-sm">No outstanding utang</p>
              <p className="text-xs text-gray-400 mt-1">All customers are paid up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                  Outstanding Utang
                </p>
                <p className="text-xs font-bold text-red-600">
                  ₱{utangList.reduce((s, u) => s + Number(u.amount - u.amount_paid), 0).toFixed(2)}{" "}
                  total
                </p>
              </div>
              {utangList.map((u) => (
                <div
                  key={u.id}
                  className="bg-white rounded-xl p-4 border border-orange-100 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{u.customer_name}</p>
                      {u.customer_phone && (
                        <p className="text-xs text-gray-400">{u.customer_phone}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(u.created_at).toLocaleDateString("en-PH")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-red-600">
                        ₱{Number(u.amount - u.amount_paid).toFixed(2)}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.status === "partial"
                            ? "bg-yellow-50 text-yellow-600"
                            : "bg-red-50 text-red-500"
                        }`}
                      >
                        {u.status === "partial" ? "Partial" : "Unpaid"}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mb-2">
                    Original: ₱{Number(u.amount).toFixed(2)} · Paid: ₱
                    {Number(u.amount_paid).toFixed(2)}
                  </div>
                  <button
                    onClick={() => {
                      setUtangPayModal(u);
                      setUtangPayAmount("");
                    }}
                    className="text-xs text-forest-700 font-semibold bg-forest-50 px-3 py-1.5 rounded-lg"
                  >
                    💵 Record Payment
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barcode scanner overlay */}
      {scanning && <BarcodeScanner onDetected={handleBarcode} onClose={() => setScanning(false)} />}

      {/* New Product Found Modal */}
      {newProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-800 text-base">
                {newProductModal.notFound ? "Unknown Product" : "New Product Found! 🎉"}
              </h3>
              <button onClick={() => setNewProductModal(null)} className="text-gray-400 text-xl">✕</button>
            </div>
            {newProductModal.notFound ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-4">
                <p className="text-sm font-semibold text-yellow-800">Product not recognized</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Barcode <span className="font-mono font-bold">{newProductModal.barcode}</span> was not found online. Your owner will be notified to add this product manually.
                </p>
              </div>
            ) : (
              <div className="flex gap-3 mb-4">
                {newProductModal.image && (
                  <img src={newProductModal.image} alt={newProductModal.name}
                    className="w-16 h-16 object-contain rounded-xl border border-gray-100" />
                )}
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm">{newProductModal.name}</p>
                  <p className="text-xs font-mono text-gray-400 mt-0.5">{newProductModal.barcode}</p>
                  <div className="mt-2 bg-blue-50 rounded-xl px-3 py-2">
                    <p className="text-xs text-blue-700 font-medium">
                      ℹ️ This product will be sent to your owner for price approval before it can be sold.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={async () => {
                // Check for duplicate barcode first
                const { data: existing } = await supabase
                  .from("products")
                  .select("id, status")
                  .eq("business_id", business.id)
                  .eq("barcode", newProductModal.barcode)
                  .maybeSingle();

                if (existing) {
                  if (existing.status === "pending") {
                    showToast("This product is already waiting for owner review.", "warning");
                  } else {
                    showToast("This product already exists in your database.", "warning");
                  }
                  setNewProductModal(null);
                  return;
                }

                const { error } = await supabase.from("products").insert({
                  business_id: business.id,
                  name: newProductModal.name || `Unknown (${newProductModal.barcode})`,
                  barcode: newProductModal.barcode,
                  price: 0,
                  stock_quantity: 0,
                  low_stock_threshold: 10,
                  status: "pending",
                });
                if (error) {
                  showToast("Hindi na-save. Subukan muli.", "error");
                } else {
                  showToast("Sent to owner for review! ✓", "success");
                }
                setNewProductModal(null);
              }}
              className="w-full bg-forest-600 text-white font-bold py-3 rounded-2xl text-sm"
            >
              Send to Owner for Review
            </button>
            <button onClick={() => setNewProductModal(null)}
              className="w-full bg-gray-100 text-gray-600 font-semibold py-3 rounded-2xl text-sm mt-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Receipt overlay */}
      {receipt && (
        <ReceiptView
          transaction={receipt}
          items={receiptItems}
          business={business}
          branch={branch}
          cashier={profile}
          onClose={() => setReceipt(null)}
          onNewTransaction={() => {
            setReceipt(null);
            setPosTabPersisted("pos");
          }}
        />
      )}

      {/* Void Request Modal */}
      {voidModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5">
            <h3 className="font-black text-gray-800 text-base mb-1">Request Void Approval</h3>
            <p className="text-xs text-gray-500 mb-1">
              {voidModal.receipt_number} · ₱{Number(voidModal.total_amount).toFixed(2)}
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 mb-3">
              <p className="text-xs text-yellow-700 font-medium">
                ⚠️ This will send a void request to your owner. The transaction will only be voided after owner approval.
              </p>
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
              Reason for Void Request
            </p>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Explain why this transaction needs to be voided..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-3"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setVoidModal(null); setVoidReason(""); }}
                className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={voidTransaction}
                disabled={!voidReason.trim()}
                className="flex-1 bg-yellow-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
              >
                Send Request to Owner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Utang Payment Confirmation Modal */}
      {utangPayModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5">
            <h3 className="font-black text-gray-800 text-base mb-1">Record Payment</h3>
            <p className="text-xs text-gray-500 mb-1">
              Customer: <span className="font-bold text-gray-800">{utangPayModal.customer_name}</span>
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Outstanding balance:{" "}
              <span className="font-black text-red-600">
                ₱{(Number(utangPayModal.amount) - Number(utangPayModal.amount_paid)).toFixed(2)}
              </span>
            </p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
              Amount Received from Customer
            </p>
            <input
              type="number"
              value={utangPayAmount}
              onChange={(e) => setUtangPayAmount(e.target.value)}
              placeholder="Enter exact amount received..."
              className="w-full border-2 border-forest-300 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-forest-500 mb-2"
            />
            <div className="flex gap-2 mb-3 flex-wrap">
              {[
                Number(utangPayModal.amount) - Number(utangPayModal.amount_paid),
                50, 100, 200, 500,
              ].slice(0, 4).map((amt) => (
                <button
                  key={amt}
                  onClick={() => setUtangPayAmount(String(amt))}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium"
                >
                  ₱{amt}
                </button>
              ))}
            </div>
            {utangPayAmount && Number(utangPayAmount) > 0 && (
              <div className={`rounded-xl px-4 py-2 mb-3 ${
                Number(utangPayAmount) >= (Number(utangPayModal.amount) - Number(utangPayModal.amount_paid))
                  ? "bg-forest-50 border border-forest-200"
                  : "bg-yellow-50 border border-yellow-200"
              }`}>
                <p className={`text-xs font-semibold ${
                  Number(utangPayAmount) >= (Number(utangPayModal.amount) - Number(utangPayModal.amount_paid))
                    ? "text-forest-700"
                    : "text-yellow-700"
                }`}>
                  {Number(utangPayAmount) >= (Number(utangPayModal.amount) - Number(utangPayModal.amount_paid))
                    ? "✓ This will fully settle the utang"
                    : `Partial payment — ₱${((Number(utangPayModal.amount) - Number(utangPayModal.amount_paid)) - Number(utangPayAmount)).toFixed(2)} will remain`}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setUtangPayModal(null); setUtangPayAmount(""); }}
                className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={markUtangPaid}
                disabled={!utangPayAmount || Number(utangPayAmount) <= 0}
                className="flex-1 bg-forest-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
              >
                Confirm Payment ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Verification Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-6 w-72 text-center">
            <div className="w-14 h-14 bg-forest-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">🔒</span>
            </div>
            <h3 className="font-black text-gray-800 text-base mb-1">Enter PIN</h3>
            <p className="text-xs text-gray-500 mb-4">Enter your 4-digit PIN to confirm this transaction.</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="● ● ● ●"
              className="w-full border-2 border-forest-300 rounded-xl px-4 py-3 text-2xl font-bold text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-forest-500 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowPinModal(false); setPinInput(""); }}
                className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm">Cancel</button>
              <button onClick={async () => { if (await verifyPin(pinInput)) processCheckout(); }}
                disabled={pinInput.length !== 4}
                className="flex-1 bg-forest-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">Verify</button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Setup Modal */}
      {showPinSetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-6 w-72 text-center">
            <h3 className="font-black text-gray-800 text-base mb-1">Set Your PIN</h3>
            <p className="text-xs text-gray-500 mb-4">Create a 4-digit PIN for transaction security.</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 text-left">New PIN</p>
            <input type="password" inputMode="numeric" maxLength={4} value={pinSetupValue}
              onChange={(e) => setPinSetupValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="● ● ● ●"
              className="w-full border-2 border-forest-300 rounded-xl px-4 py-3 text-xl font-bold text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-forest-500 mb-3" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 text-left">Confirm PIN</p>
            <input type="password" inputMode="numeric" maxLength={4} value={pinSetupConfirm}
              onChange={(e) => setPinSetupConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="● ● ● ●"
              className="w-full border-2 border-forest-300 rounded-xl px-4 py-3 text-xl font-bold text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-forest-500 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => { setShowPinSetup(false); setPinSetupValue(""); setPinSetupConfirm(""); }}
                className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm">Cancel</button>
              <button onClick={setupPin} disabled={pinSetupValue.length !== 4 || pinSetupConfirm.length !== 4}
                className="flex-1 bg-forest-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">Save PIN</button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5">
            {currentShift ? (
              <>
                <h3 className="font-black text-gray-800 text-base mb-1">Close Shift</h3>
                <p className="text-xs text-gray-500 mb-1">
                  Started: {new Date(currentShift.started_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  Starting cash: ₱{Number(currentShift.starting_cash).toFixed(2)}
                </p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                  Total Cash in Drawer
                </p>
                <input
                  type="number"
                  value={shiftEndCash}
                  onChange={(e) => setShiftEndCash(e.target.value)}
                  placeholder="Enter total cash counted..."
                  className="w-full border-2 border-forest-300 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-forest-500 mb-3"
                />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                  Notes (optional)
                </p>
                <textarea
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="Any notes about this shift..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-forest-400 mb-3"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowShiftModal(false); setShiftEndCash(""); setShiftNotes(""); }}
                    className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={closeShift}
                    disabled={shiftLoading || !shiftEndCash}
                    className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
                  >
                    {shiftLoading ? "Closing..." : "Close Shift"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-black text-gray-800 text-base mb-1">Start New Shift</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Count your starting cash before beginning your shift.
                </p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                  Starting Cash in Drawer
                </p>
                <input
                  type="number"
                  value={shiftStartCash}
                  onChange={(e) => setShiftStartCash(e.target.value)}
                  placeholder="Enter starting cash amount..."
                  className="w-full border-2 border-forest-300 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-forest-500 mb-3"
                />
                <div className="flex gap-2 mb-4 flex-wrap">
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setShiftStartCash(String(amt))}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium"
                    >
                      ₱{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowShiftModal(false); setShiftStartCash(""); }}
                    className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={openShift}
                    disabled={shiftLoading || !shiftStartCash}
                    className="flex-1 bg-forest-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
                  >
                    {shiftLoading ? "Starting..." : "Start Shift"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Return/Refund Modal */}
      {returnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-gray-800 text-base">Return / Refund</h3>
              <button onClick={() => { setReturnModal(null); setReturnReason(""); setReturnItems([]); }} className="text-gray-400 text-xl">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-1">
              {returnModal.receipt_number} · ₱{Number(returnModal.total_amount).toFixed(2)}
            </p>
            <p className="text-xs text-gray-400 mb-3">
              {new Date(returnModal.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
            </p>
            {returnModal.transaction_items && (
              <div className="space-y-2 mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Select items to return</p>
                {returnModal.transaction_items.map((item, i) => {
                  const selected = returnItems.find(r => r.idx === i);
                  return (
                    <div key={i} className={`rounded-xl p-3 border cursor-pointer transition-colors ${selected ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200"}`}
                      onClick={() => {
                        setReturnItems(prev => {
                          const exists = prev.find(r => r.idx === i);
                          if (exists) return prev.filter(r => r.idx !== i);
                          return [...prev, { idx: i, product_name: item.products?.name || item.product_name, quantity: item.quantity, unit_price: item.unit_price, subtotal: item.subtotal, product_id: item.product_id }];
                        });
                      }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs ${selected ? "bg-blue-500 border-blue-500 text-white" : "border-gray-300"}`}>
                            {selected && "✓"}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{item.products?.name || item.product_name}</p>
                            <p className="text-xs text-gray-400">×{item.quantity} @ ₱{Number(item.unit_price).toFixed(2)}</p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-gray-700">₱{Number(item.subtotal).toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Reason for Return</p>
            <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Why is the customer returning these items?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3" />
            {returnItems.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-3">
                <p className="text-xs text-blue-700 font-semibold">
                  Refund amount: ₱{returnItems.reduce((s, r) => s + Number(r.subtotal), 0).toFixed(2)} for {returnItems.length} item{returnItems.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setReturnModal(null); setReturnReason(""); setReturnItems([]); }}
                className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm">Cancel</button>
              <button
                disabled={returnItems.length === 0 || !returnReason.trim()}
                onClick={async () => {
                  const refundAmount = returnItems.reduce((s, r) => s + Number(r.subtotal), 0);
                  const { error } = await supabase.from("returns").insert({
                    business_id: business.id,
                    branch_id: branch?.id || null,
                    transaction_id: returnModal.id,
                    cashier_id: profile.id,
                    reason: returnReason.trim(),
                    refund_amount: refundAmount,
                    refund_method: returnModal.payment_method,
                    items: returnItems.map(r => ({ product_name: r.product_name, quantity: r.quantity, unit_price: r.unit_price, subtotal: r.subtotal })),
                  });
                  if (error) return showToast("Failed to process return.", "error");
                  for (const item of returnItems) {
                    if (item.product_id) {
                      await supabase.rpc("increment_stock", { p_id: item.product_id, qty: item.quantity }).catch(() => {
                        supabase.from("products").select("stock_quantity").eq("id", item.product_id).maybeSingle().then(({ data }) => {
                          if (data) supabase.from("products").update({ stock_quantity: data.stock_quantity + item.quantity }).eq("id", item.product_id);
                        });
                      });
                    }
                  }
                  logAudit(business.id, profile.id, profile.full_name, "return_processed", "transaction", returnModal.id, { refund: refundAmount, items: returnItems.length, reason: returnReason.trim() });
                  await supabase.from("notifications").insert({
                    business_id: business.id,
                    type: "return",
                    title: "🔄 Return Processed",
                    message: `${profile.full_name} processed a return of ₱${refundAmount.toFixed(2)} on ${returnModal.receipt_number}. Reason: ${returnReason.trim()}`,
                    is_read: false,
                  });
                  showToast(`Return processed! Refund: ₱${refundAmount.toFixed(2)}`, "success");
                  setReturnModal(null);
                  setReturnReason("");
                  setReturnItems([]);
                  loadHistory();
                }}
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                Process Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Reconciliation Modal */}
      {reconcileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5">
            <h3 className="font-black text-gray-800 text-base mb-1">💰 Cash Count</h3>
            <p className="text-xs text-gray-500 mb-4">
              Count all cash in the drawer and enter the total below.
            </p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
              Total Cash in Drawer
            </p>
            <input
              type="number"
              value={cashCounted}
              onChange={(e) => setCashCounted(e.target.value)}
              placeholder="Enter total cash counted..."
              className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
              <p className="text-xs text-blue-700 font-medium">
                ℹ️ This will compare your cash count against today's cash transactions. Any difference will be reported to your owner immediately.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setReconcileModal(false); setCashCounted(""); }}
                className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitReconciliation}
                disabled={!cashCounted || Number(cashCounted) < 0}
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
              >
                Submit Count
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INVENTORY STAFF PANEL
// ═══════════════════════════════════════════════════════════════
function InventoryStaffPanel({ profile, business, branch, onLogout, showToast }) {
  const CATEGORIES = ["All", "Beverages", "Snacks", "Household", "Personal Care", "Frozen", "Dairy", "Canned Goods", "Others"];
  const [invTab, setInvTab] = useState("products");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [editModal, setEditModal] = useState(null);
  const [editQty, setEditQty] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [restockModal, setRestockModal] = useState(false);
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockSearch, setRestockSearch] = useState("");
  const [restockQty, setRestockQty] = useState("");
  const [restockSupplier, setRestockSupplier] = useState("");
  const [restockNotes, setRestockNotes] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState({});
  const [batchQty, setBatchQty] = useState({});
  const [savingBatch, setSavingBatch] = useState(false);
  const [historyModal, setHistoryModal] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("products")
      .select("*")
      .eq("business_id", business.id)
      .eq("status", "active");
    if (categoryFilter !== "All") query = query.eq("category", categoryFilter);
    if (searchQuery.trim()) query = query.ilike("name", `%${searchQuery}%`);
    const { data } = await query.order("name");
    setProducts(data || []);
    setLoading(false);
  }, [business.id, categoryFilter, searchQuery]);

  const loadNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("business_id", business.id)
      .in("type", ["low_stock"])
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data || []);
  }, [business.id]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadNotifications(); const iv = setInterval(loadNotifications, 15000); return () => clearInterval(iv); }, [loadNotifications]);

  const updateStock = async () => {
    const newQty = Number(editQty);
    if (isNaN(newQty) || newQty < 0) return showToast("Enter a valid quantity.", "error");
    const oldQty = editModal.stock_quantity;
    await supabase.from("products").update({ stock_quantity: newQty }).eq("id", editModal.id);
    await supabase.from("stock_history").insert({
      business_id: business.id,
      product_id: editModal.id,
      changed_by: profile.id,
      change_type: "manual_edit",
      quantity_before: oldQty,
      quantity_after: newQty,
      quantity_change: newQty - oldQty,
      notes: editNotes.trim() || "Manual stock update",
    });
    showToast(`${editModal.name} stock updated to ${newQty}.`, "success");
    setEditModal(null);
    setEditQty("");
    setEditNotes("");
    loadProducts();
  };

  const submitRestock = async () => {
    if (!restockProduct) return showToast("Select a product first.", "error");
    const qty = Number(restockQty);
    if (isNaN(qty) || qty <= 0) return showToast("Enter a valid quantity.", "error");
    const oldQty = restockProduct.stock_quantity;
    const newQty = oldQty + qty;
    await supabase.from("products").update({ stock_quantity: newQty }).eq("id", restockProduct.id);
    await supabase.from("stock_history").insert({
      business_id: business.id,
      product_id: restockProduct.id,
      changed_by: profile.id,
      change_type: "restock",
      quantity_before: oldQty,
      quantity_after: newQty,
      quantity_change: qty,
      notes: restockSupplier.trim() ? `Supplier: ${restockSupplier.trim()}. ${restockNotes.trim()}` : restockNotes.trim() || "Delivery received",
    });
    showToast(`${restockProduct.name}: +${qty} units restocked (now ${newQty}).`, "success");
    setRestockModal(false);
    setRestockProduct(null);
    setRestockSearch("");
    setRestockQty("");
    setRestockSupplier("");
    setRestockNotes("");
    loadProducts();
  };

  const saveBatchUpdate = async () => {
    const selectedIds = Object.keys(batchSelected).filter(id => batchSelected[id]);
    if (selectedIds.length === 0) return showToast("No products selected.", "error");
    setSavingBatch(true);
    let updated = 0;
    for (const id of selectedIds) {
      const newQty = Number(batchQty[id]);
      if (isNaN(newQty) || newQty < 0) continue;
      const prod = products.find(p => p.id === id);
      if (!prod || prod.stock_quantity === newQty) continue;
      await supabase.from("products").update({ stock_quantity: newQty }).eq("id", id);
      await supabase.from("stock_history").insert({
        business_id: business.id,
        product_id: id,
        changed_by: profile.id,
        change_type: "batch_update",
        quantity_before: prod.stock_quantity,
        quantity_after: newQty,
        quantity_change: newQty - prod.stock_quantity,
        notes: "Batch stock update",
      });
      updated++;
    }
    showToast(`${updated} product${updated !== 1 ? "s" : ""} updated.`, "success");
    setBatchMode(false);
    setBatchSelected({});
    setBatchQty({});
    setSavingBatch(false);
    loadProducts();
  };

  const loadStockHistory = async (product) => {
    setHistoryModal(product);
    setLoadingHistory(true);
    const { data } = await supabase
      .from("stock_history")
      .select("*")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setStockHistory(data || []);
    setLoadingHistory(false);
  };

  const stockColor = (p) =>
    p.stock_quantity <= 0 ? "text-red-600 bg-red-50" :
    p.stock_quantity <= (p.low_stock_threshold || 10) ? "text-yellow-600 bg-yellow-50" :
    "text-forest-600 bg-forest-50";

  const stockBorder = (p) =>
    p.stock_quantity <= 0 ? "border-red-200" :
    p.stock_quantity <= (p.low_stock_threshold || 10) ? "border-yellow-200" :
    "border-gray-100";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      <div className="bg-forest-800 px-4 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-gold-400 text-xs font-medium uppercase tracking-widest">Inventory</p>
            <h1 className="text-ivory-50 font-black text-lg leading-tight">{business.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {notifications.length}
              </span>
            )}
            <button onClick={onLogout} className="bg-forest-700 text-gold-400 text-xs px-3 py-2 rounded-xl font-medium border border-forest-600">
              Logout
            </button>
          </div>
        </div>
        <p className="text-forest-300 text-xs">{branch?.name || "No branch"} · {profile.full_name}</p>
      </div>

      <div className="bg-forest-900 flex px-2 gap-1 flex-shrink-0">
        {[
          { key: "products", label: "Products" },
          { key: "alerts", label: `Alerts${notifications.length > 0 ? ` (${notifications.length})` : ""}` },
          { key: "restock", label: "Restock" },
        ].map((t) => (
          <button key={t.key} onClick={() => setInvTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-t-lg transition-colors ${
              invTab === t.key ? "bg-ivory-100 text-forest-700" : "text-forest-400"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {invTab === "products" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100 flex-shrink-0">
            <input type="text" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 mb-2" />
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setCategoryFilter(cat)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    categoryFilter === cat ? "bg-forest-600 text-white border-forest-600" : "bg-white text-gray-500 border-gray-200"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-2 flex items-center justify-between flex-shrink-0">
            <p className="text-xs text-gray-400">{products.length} product{products.length !== 1 ? "s" : ""}</p>
            <button onClick={() => { setBatchMode(!batchMode); setBatchSelected({}); setBatchQty({}); }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                batchMode ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
              }`}>
              {batchMode ? "Cancel Batch" : "Batch Update"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin"></div></div>
            ) : products.length === 0 ? (
              <div className="text-center py-12"><p className="font-semibold text-gray-500 text-sm">No products found</p></div>
            ) : (
              <div className="space-y-2">
                {products.map((p) => (
                  <div key={p.id} className={`bg-white rounded-xl p-3 border shadow-sm ${stockBorder(p)}`}>
                    <div className="flex items-center gap-3">
                      {batchMode && (
                        <input type="checkbox" checked={!!batchSelected[p.id]}
                          onChange={(e) => {
                            setBatchSelected(prev => ({ ...prev, [p.id]: e.target.checked }));
                            if (e.target.checked && !batchQty[p.id]) setBatchQty(prev => ({ ...prev, [p.id]: String(p.stock_quantity) }));
                          }}
                          className="w-5 h-5 rounded accent-forest-600 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">₱{Number(p.price).toFixed(2)}</span>
                          {p.category && p.category !== "Others" && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{p.category}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {batchMode && batchSelected[p.id] ? (
                          <input type="number" value={batchQty[p.id] || ""}
                            onChange={(e) => setBatchQty(prev => ({ ...prev, [p.id]: e.target.value }))}
                            className="w-16 border border-forest-300 rounded-lg px-2 py-1.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-forest-500" />
                        ) : (
                          <span className={`text-sm font-black px-2.5 py-1 rounded-lg ${stockColor(p)}`}>
                            {p.stock_quantity}
                          </span>
                        )}
                        {!batchMode && (
                          <div className="flex flex-col gap-1">
                            <button onClick={() => { setEditModal(p); setEditQty(String(p.stock_quantity)); }}
                              className="text-xs bg-blue-50 text-blue-600 font-semibold px-2 py-1 rounded-lg">
                              Edit
                            </button>
                            <button onClick={() => loadStockHistory(p)}
                              className="text-xs bg-gray-50 text-gray-500 font-medium px-2 py-1 rounded-lg">
                              Log
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {batchMode && Object.values(batchSelected).some(v => v) && (
            <div className="px-4 py-3 bg-white border-t border-gray-100 flex-shrink-0">
              <button onClick={saveBatchUpdate} disabled={savingBatch}
                className="w-full bg-forest-600 text-white font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50 active:scale-95 transition-transform">
                {savingBatch ? "Saving..." : `Save All (${Object.values(batchSelected).filter(v => v).length} products)`}
              </button>
            </div>
          )}
        </div>
      )}

      {invTab === "alerts" && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-2xl mb-2">✅</p>
              <p className="font-semibold text-gray-500 text-sm">No alerts</p>
              <p className="text-xs text-gray-400 mt-1">All stock levels are healthy!</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Low Stock Alerts</p>
              {notifications.map((n) => (
                <div key={n.id} className="bg-white rounded-xl p-3 border border-red-200 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-bold text-red-700">{n.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</p>
                    </div>
                    <button onClick={async () => {
                      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
                      loadNotifications();
                    }} className="text-gray-400 text-sm ml-2">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {invTab === "restock" && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="text-center mb-4">
            <button onClick={() => setRestockModal(true)}
              className="bg-forest-600 text-white font-bold px-6 py-3 rounded-2xl text-sm active:scale-95 transition-transform">
              + Receive Delivery
            </button>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Low / Out of Stock</p>
          {products.filter(p => p.stock_quantity <= (p.low_stock_threshold || 10)).length === 0 ? (
            <div className="text-center py-8"><p className="text-xs text-gray-400">All products are well-stocked!</p></div>
          ) : (
            <div className="space-y-2">
              {products.filter(p => p.stock_quantity <= (p.low_stock_threshold || 10)).sort((a, b) => a.stock_quantity - b.stock_quantity).map((p) => (
                <div key={p.id} className={`bg-white rounded-xl p-3 border shadow-sm ${stockBorder(p)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Threshold: {p.low_stock_threshold || 10}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-black px-2.5 py-1 rounded-lg ${stockColor(p)}`}>{p.stock_quantity}</span>
                      <button onClick={() => { setRestockModal(true); setRestockProduct(p); setRestockSearch(p.name); }}
                        className="text-xs bg-forest-50 text-forest-600 font-semibold px-3 py-1.5 rounded-lg">
                        Restock
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5">
            <h3 className="font-black text-gray-800 text-base mb-1">Edit Stock</h3>
            <p className="text-sm text-gray-600 mb-1">{editModal.name}</p>
            <p className="text-xs text-gray-400 mb-3">Current stock: {editModal.stock_quantity}</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">New Quantity</p>
            <input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2" />
            <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Reason for change (optional)..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => { setEditModal(null); setEditQty(""); setEditNotes(""); }}
                className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm">Cancel</button>
              <button onClick={updateStock}
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm">Update Stock</button>
            </div>
          </div>
        </div>
      )}

      {restockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-800 text-base">Receive Delivery</h3>
              <button onClick={() => { setRestockModal(false); setRestockProduct(null); setRestockSearch(""); setRestockQty(""); setRestockSupplier(""); setRestockNotes(""); }}
                className="text-gray-400 text-xl">✕</button>
            </div>
            {!restockProduct ? (
              <>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Search Product</p>
                <input type="text" value={restockSearch} onChange={(e) => setRestockSearch(e.target.value)}
                  placeholder="Type product name..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 mb-2" />
                {restockSearch.trim() && (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {products.filter(p => p.name.toLowerCase().includes(restockSearch.toLowerCase())).map(p => (
                      <button key={p.id} onClick={() => { setRestockProduct(p); setRestockSearch(p.name); }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-forest-50 active:bg-forest-100 flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-800">{p.name}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${stockColor(p)}`}>{p.stock_quantity}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="bg-forest-50 border border-forest-200 rounded-xl p-3 mb-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{restockProduct.name}</p>
                      <p className="text-xs text-gray-500">Current stock: {restockProduct.stock_quantity}</p>
                    </div>
                    <button onClick={() => { setRestockProduct(null); setRestockSearch(""); }}
                      className="text-xs text-red-500 font-semibold">Change</button>
                  </div>
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Quantity Received</p>
                <input type="number" value={restockQty} onChange={(e) => setRestockQty(e.target.value)}
                  placeholder="How many units received?"
                  className="w-full border-2 border-forest-300 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-forest-500 mb-3" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Supplier (Optional)</p>
                <input type="text" value={restockSupplier} onChange={(e) => setRestockSupplier(e.target.value)}
                  placeholder="Supplier name..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 mb-2" />
                <input type="text" value={restockNotes} onChange={(e) => setRestockNotes(e.target.value)}
                  placeholder="Notes (optional)..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 mb-4" />
                {restockQty && Number(restockQty) > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-3">
                    <p className="text-xs text-blue-700 font-semibold">
                      New stock will be: {restockProduct.stock_quantity} + {restockQty} = {restockProduct.stock_quantity + Number(restockQty)}
                    </p>
                  </div>
                )}
                <button onClick={submitRestock} disabled={!restockQty || Number(restockQty) <= 0}
                  className="w-full bg-forest-600 text-white font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50 active:scale-95 transition-transform">
                  Confirm Restock
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {historyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-black text-gray-800 text-base">Stock History</h3>
                <p className="text-xs text-gray-500">{historyModal.name}</p>
              </div>
              <button onClick={() => { setHistoryModal(null); setStockHistory([]); }} className="text-gray-400 text-xl">✕</button>
            </div>
            {loadingHistory ? (
              <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin"></div></div>
            ) : stockHistory.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8">No stock changes recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {stockHistory.map((h) => (
                  <div key={h.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          h.change_type === "sale" ? "bg-red-50 text-red-600"
                          : h.change_type === "restock" ? "bg-forest-50 text-forest-600"
                          : h.change_type === "void" ? "bg-yellow-50 text-yellow-600"
                          : "bg-blue-50 text-blue-600"
                        }`}>
                          {h.change_type === "sale" ? "Sale" : h.change_type === "restock" ? "Restock" : h.change_type === "void" ? "Void" : h.change_type === "batch_update" ? "Batch" : "Edit"}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{h.notes || "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black ${h.quantity_change >= 0 ? "text-forest-600" : "text-red-600"}`}>
                          {h.quantity_change >= 0 ? "+" : ""}{h.quantity_change}
                        </p>
                        <p className="text-xs text-gray-400">{h.quantity_before} → {h.quantity_after}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(h.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BRANCH MANAGER DASHBOARD (Phase 7)
// ═══════════════════════════════════════════════════════════════
function BranchManagerDashboard({ profile, business, branch, onLogout, showToast }) {
  const [bmTab, setBmTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [branchRevenue, setBranchRevenue] = useState(0);
  const [branchTxCount, setBranchTxCount] = useState(0);
  const [branchProducts, setBranchProducts] = useState([]);
  const [branchStaff, setBranchStaff] = useState([]);
  const [staffPerformance, setStaffPerformance] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferProduct, setTransferProduct] = useState(null);
  const [transferQty, setTransferQty] = useState("");
  const [transferToBranch, setTransferToBranch] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferSearch, setTransferSearch] = useState("");
  const [transferSearchResults, setTransferSearchResults] = useState([]);
  const [transferSaving, setTransferSaving] = useState(false);
  const [timeFilter, setTimeFilter] = useState("today");

  const getDateRange = useCallback((filter) => {
    const now = new Date();
    const start = new Date(now);
    if (filter === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (filter === "week") {
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }
    return start;
  }, []);

  const fetchAll = useCallback(async () => {
    if (!branch?.id) return;
    setLoading(true);
    const start = getDateRange(timeFilter);

    const [txRes, prodRes, staffRes, transferRes, branchRes] = await Promise.all([
      supabase.from("transactions").select("*, profiles!inner(full_name)")
        .eq("business_id", business.id).eq("branch_id", branch.id)
        .eq("status", "completed").gte("created_at", start.toISOString())
        .order("created_at", { ascending: false }),
      supabase.from("products").select("*")
        .eq("business_id", business.id).eq("status", "active").order("name"),
      supabase.from("profiles").select("*")
        .eq("business_id", business.id).eq("branch_id", branch.id)
        .neq("role", "owner").order("full_name"),
      supabase.from("product_transfers").select("*, products(name), from_branch:branches!product_transfers_from_branch_id_fkey(name), to_branch:branches!product_transfers_to_branch_id_fkey(name), requester:profiles!product_transfers_requested_by_fkey(full_name)")
        .eq("business_id", business.id)
        .or(`from_branch_id.eq.${branch.id},to_branch_id.eq.${branch.id}`)
        .order("created_at", { ascending: false }).limit(20),
      supabase.from("branches").select("*").eq("business_id", business.id).neq("id", branch.id),
    ]);

    const txns = txRes.data || [];
    setRecentTx(txns.slice(0, 10));
    setBranchRevenue(txns.reduce((s, t) => s + Number(t.total_amount), 0));
    setBranchTxCount(txns.length);
    setBranchProducts(prodRes.data || []);
    setBranchStaff(staffRes.data || []);
    setTransfers(transferRes.data || []);
    setAllBranches(branchRes.data || []);

    const perfMap = {};
    txns.forEach((tx) => {
      if (!perfMap[tx.cashier_id]) perfMap[tx.cashier_id] = { name: tx.profiles?.full_name || "Unknown", txCount: 0, revenue: 0 };
      perfMap[tx.cashier_id].txCount += 1;
      perfMap[tx.cashier_id].revenue += Number(tx.total_amount);
    });
    setStaffPerformance(Object.entries(perfMap).map(([id, v]) => ({ id, ...v, avg: v.txCount > 0 ? v.revenue / v.txCount : 0 })).sort((a, b) => b.revenue - a.revenue));

    setLoading(false);
  }, [business.id, branch?.id, timeFilter, getDateRange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!transferSearch.trim()) { setTransferSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("products").select("id, name, stock_quantity")
        .eq("business_id", business.id).eq("status", "active")
        .ilike("name", `%${transferSearch}%`).limit(10);
      setTransferSearchResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [transferSearch, business.id]);

  const submitTransfer = async () => {
    if (!transferProduct || !transferQty || !transferToBranch) return;
    if (Number(transferQty) <= 0) return showToast("Quantity must be greater than 0.", "error");
    if (Number(transferQty) > transferProduct.stock_quantity) return showToast("Not enough stock to transfer.", "error");
    setTransferSaving(true);
    const { error } = await supabase.from("product_transfers").insert({
      business_id: business.id,
      product_id: transferProduct.id,
      from_branch_id: branch.id,
      to_branch_id: transferToBranch,
      quantity: Number(transferQty),
      requested_by: profile.id,
      notes: transferNotes.trim() || null,
    });
    setTransferSaving(false);
    if (error) return showToast("Transfer request failed.", "error");
    await supabase.from("notifications").insert({
      business_id: business.id,
      type: "transfer_request",
      title: "📦 Product Transfer Request",
      message: `${profile.full_name} requests to transfer ${transferQty}x ${transferProduct.name} from ${branch.name} to another branch.`,
      is_read: false,
    });
    showToast("Transfer request sent to owner!", "success");
    setShowTransferModal(false);
    setTransferProduct(null);
    setTransferQty("");
    setTransferToBranch("");
    setTransferNotes("");
    setTransferSearch("");
    fetchAll();
  };

  const BM_TABS = [
    { key: "overview", icon: "📊", label: "Overview" },
    { key: "staff", icon: "👥", label: "Staff" },
    { key: "transfers", icon: "🔄", label: "Transfers" },
  ];

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Spinner /></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      <div className="bg-forest-800 px-4 pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-gold-400 text-xs font-medium uppercase tracking-widest">Branch Manager</p>
            <h1 className="text-ivory-50 font-black text-xl leading-tight">{branch?.name || business.name}</h1>
          </div>
          <button onClick={onLogout} className="bg-forest-700 text-gold-400 text-xs px-3 py-2 rounded-xl font-medium border border-forest-600">
            Logout
          </button>
        </div>
        <p className="text-forest-300 text-xs">{profile.full_name} · {business.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        <div className="p-4 flex gap-2 mb-1">
          {[{ key: "today", label: "Today" }, { key: "week", label: "This Week" }, { key: "month", label: "This Month" }].map((f) => (
            <button key={f.key} onClick={() => setTimeFilter(f.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium ${timeFilter === f.key ? "bg-gold-400 text-forest-900" : "bg-gray-100 text-gray-500"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {bmTab === "overview" && (
          <div className="p-4 pt-0 space-y-4">
            <div className="bg-forest-700 rounded-2xl p-4">
              <p className="text-gold-300 text-xs font-semibold uppercase tracking-widest mb-1">Branch Revenue</p>
              <p className="text-3xl font-black text-white tracking-tight">₱{branchRevenue.toFixed(2)}</p>
              <p className="text-forest-300 text-xs mt-1">{branchTxCount} transaction{branchTxCount !== 1 ? "s" : ""}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatCard icon="📦" label="Products" value={branchProducts.length} color="bg-blue-50 text-blue-700" />
              <StatCard icon="👥" label="Staff" value={branchStaff.length} color="bg-purple-50 text-purple-700" />
              <StatCard icon="🔄" label="Transfers" value={transfers.filter(t => t.status === "pending").length} color="bg-yellow-50 text-yellow-700" />
            </div>

            {recentTx.length > 0 && (
              <div>
                <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-2">Recent Transactions</h2>
                <div className="space-y-2">
                  {recentTx.slice(0, 5).map((tx) => (
                    <Card key={tx.id} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-mono text-gray-400">{tx.receipt_number}</p>
                        <p className="text-xs text-gray-500 mt-0.5 capitalize">
                          {tx.profiles?.full_name} · {tx.payment_method} · {new Date(tx.created_at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true })}
                        </p>
                      </div>
                      <p className="font-black text-forest-700">₱{Number(tx.total_amount).toFixed(2)}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-2">Low Stock Alerts</h2>
              {branchProducts.filter(p => p.stock_quantity <= p.low_stock_threshold).length === 0 ? (
                <Card className="p-3"><p className="text-xs text-gray-400 text-center">No low stock items.</p></Card>
              ) : (
                <div className="space-y-2">
                  {branchProducts.filter(p => p.stock_quantity <= p.low_stock_threshold).map((p) => (
                    <Card key={p.id} className="p-3 flex items-center justify-between border-l-4 border-red-400">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.category}</p>
                      </div>
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">{p.stock_quantity} left</span>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {bmTab === "staff" && (
          <div className="p-4 pt-0 space-y-4">
            <Card className="p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Staff Performance</p>
              {staffPerformance.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No staff data for this period.</p>
              ) : (
                <div className="space-y-3">
                  {staffPerformance.map((s, i) => (
                    <div key={s.id} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-gold-200 text-gold-800" : "bg-gray-200 text-gray-600"}`}>
                            {i + 1}
                          </span>
                          <p className="text-sm font-bold text-gray-800">{s.name}</p>
                        </div>
                        <p className="text-sm font-black text-forest-700">₱{s.revenue.toFixed(2)}</p>
                      </div>
                      <div className="flex gap-4 ml-8">
                        <p className="text-xs text-gray-400">{s.txCount} transactions</p>
                        <p className="text-xs text-gray-400">Avg ₱{s.avg.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Branch Staff</p>
              {branchStaff.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No staff assigned to this branch.</p>
              ) : (
                <div className="space-y-2">
                  {branchStaff.map((s) => (
                    <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{s.full_name}</p>
                        <p className="text-xs text-gray-400">{s.email}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${ROLE_COLORS[s.role]}`}>
                        {ROLE_LABELS[s.role]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {bmTab === "transfers" && (
          <div className="p-4 pt-0 space-y-4">
            <button onClick={() => setShowTransferModal(true)}
              className="w-full bg-forest-600 text-white font-bold py-3 rounded-xl text-sm">
              Request Product Transfer
            </button>

            <Card className="p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Transfer History</p>
              {transfers.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No transfers yet.</p>
              ) : (
                <div className="space-y-2">
                  {transfers.map((t) => (
                    <div key={t.id} className={`rounded-xl p-3 border ${
                      t.status === "pending" ? "bg-yellow-50 border-yellow-200" :
                      t.status === "completed" ? "bg-green-50 border-green-200" :
                      t.status === "rejected" ? "bg-red-50 border-red-200" :
                      "bg-blue-50 border-blue-200"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-gray-800">{t.products?.name}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${
                          t.status === "pending" ? "bg-yellow-200 text-yellow-700" :
                          t.status === "completed" ? "bg-green-200 text-green-700" :
                          t.status === "rejected" ? "bg-red-200 text-red-700" :
                          "bg-blue-200 text-blue-700"
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {t.quantity} units · {t.from_branch?.name} → {t.to_branch?.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {t.requester?.full_name} · {new Date(t.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                      </p>
                      {t.notes && <p className="text-xs text-gray-400 italic mt-1">{t.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-100 flex items-center justify-around px-2 py-2 z-30">
        {BM_TABS.map((item) => (
          <button key={item.key} onClick={() => setBmTab(item.key)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${bmTab === item.key ? "bg-forest-50 text-forest-700" : "text-gray-400"}`}>
            <span className="text-xl">{item.icon}</span>
            <span className={`text-xs font-medium ${bmTab === item.key ? "text-forest-700" : "text-gray-400"}`}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Transfer Request Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-800 text-base">Request Product Transfer</h3>
              <button onClick={() => { setShowTransferModal(false); setTransferProduct(null); setTransferSearch(""); }} className="text-gray-400 text-xl">✕</button>
            </div>

            {!transferProduct ? (
              <>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Search Product</p>
                <input type="text" value={transferSearch} onChange={(e) => setTransferSearch(e.target.value)}
                  placeholder="Search product name..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 mb-2" />
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {transferSearchResults.map((p) => (
                    <button key={p.id} onClick={() => { setTransferProduct(p); setTransferSearch(""); setTransferSearchResults([]); }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 flex justify-between items-center">
                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">Stock: {p.stock_quantity}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="bg-forest-50 border border-forest-200 rounded-xl p-3 mb-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{transferProduct.name}</p>
                      <p className="text-xs text-gray-500">Available: {transferProduct.stock_quantity}</p>
                    </div>
                    <button onClick={() => setTransferProduct(null)} className="text-xs text-red-500 font-semibold">Change</button>
                  </div>
                </div>

                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Transfer To</p>
                <select value={transferToBranch} onChange={(e) => setTransferToBranch(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 bg-white mb-3">
                  <option value="">Select destination branch...</option>
                  {allBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>

                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Quantity</p>
                <input type="number" value={transferQty} onChange={(e) => setTransferQty(e.target.value)}
                  placeholder="How many units to transfer?"
                  className="w-full border-2 border-forest-300 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-forest-500 mb-3" />

                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Notes (Optional)</p>
                <input type="text" value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Reason for transfer..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 mb-4" />

                <button onClick={submitTransfer} disabled={transferSaving || !transferToBranch || !transferQty}
                  className="w-full bg-forest-600 text-white font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50">
                  {transferSaving ? "Sending..." : "Send Transfer Request"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STAFF DASHBOARD
// ═══════════════════════════════════════════════════════════════
function StaffDashboard({ profile, business, branch, onLogout, showToast }) {
  if (profile.role === "cashier") {
    return (
      <CashierPOS
        profile={profile}
        business={business}
        branch={branch}
        onLogout={onLogout}
        showToast={showToast}
      />
    );
  }

  if (profile.role === "branch_manager") {
    return (
      <BranchManagerDashboard
        profile={profile}
        business={business}
        branch={branch}
        onLogout={onLogout}
        showToast={showToast}
      />
    );
  }

  if (profile.role === "inventory_staff") {
    return (
      <InventoryStaffPanel
        profile={profile}
        business={business}
        branch={branch}
        onLogout={onLogout}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 bg-forest-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              stroke="#1e5631"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <polyline
              points="9 22 9 12 15 12 15 22"
              stroke="#1e5631"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-black text-gray-800">{business.name}</h1>
        <p className="text-gray-500 text-sm mt-1">{branch?.name || "No branch"}</p>
        <span
          className={`inline-block mt-2 text-xs px-3 py-1 rounded-full font-semibold ${
            ROLE_COLORS[profile.role]
          }`}
        >
          {ROLE_LABELS[profile.role]}
        </span>
        <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-5 text-left space-y-3 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Information</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Name</span>
            <span className="font-semibold text-gray-800">{profile.full_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Branch</span>
            <span className="font-semibold text-gray-800">{branch?.name || "—"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Role</span>
            <span className="font-semibold text-gray-800">{ROLE_LABELS[profile.role]}</span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="mt-6 w-full bg-gray-100 text-gray-600 font-semibold py-3 rounded-2xl text-sm"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════
function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;

  useEffect(() => {
    if (isStandalone) { setInstalled(true); return; }
    const dismissed = localStorage.getItem("install_dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => { setInstalled(true); setShowBanner(false); });

    if (isIOS && !isStandalone) {
      setTimeout(() => setShowBanner(true), 3000);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
      setShowBanner(false);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const dismiss = () => {
    localStorage.setItem("install_dismissed", String(Date.now()));
    setShowBanner(false);
  };

  if (installed || !showBanner) return null;

  return (
    <>
      <div className="fixed bottom-16 left-2 right-2 max-w-lg mx-auto bg-forest-800 text-white rounded-2xl p-4 shadow-2xl z-[90] border border-forest-600">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-forest-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">📲</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">I-install ang ListaKo</p>
            <p className="text-forest-300 text-xs mt-0.5">
              {isIOS
                ? "Mag-add sa Home Screen para mas mabilis mag-open — parang real app!"
                : "I-download sa iyong phone para mas mabilis at offline-ready!"}
            </p>
          </div>
          <button onClick={dismiss} className="text-forest-400 text-lg leading-none mt-0.5">✕</button>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleInstall}
            className="flex-1 bg-gold-400 text-forest-900 font-bold py-2.5 rounded-xl text-sm">
            {isIOS ? "Paano I-install" : "I-install Ngayon"}
          </button>
          <button onClick={dismiss}
            className="px-4 py-2.5 text-forest-300 text-sm font-medium rounded-xl border border-forest-600">
            Mamaya na
          </button>
        </div>
      </div>

      {showIOSGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-end justify-center z-[100]">
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 pb-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-800 text-lg">I-install ang ListaKo</h3>
              <button onClick={() => setShowIOSGuide(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">1</span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">I-tap ang Share button</p>
                  <p className="text-xs text-gray-500 mt-0.5">Ang icon na may arrow pataas (⬆️) sa ibaba ng Safari</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">2</span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Hanapin ang "Add to Home Screen"</p>
                  <p className="text-xs text-gray-500 mt-0.5">I-scroll pababa sa menu at i-tap ang "Add to Home Screen"</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">3</span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">I-tap ang "Add"</p>
                  <p className="text-xs text-gray-500 mt-0.5">Ma-add ang ListaKo icon sa iyong Home Screen — parang downloaded app!</p>
                </div>
              </div>
            </div>
            <button onClick={() => setShowIOSGuide(false)}
              className="w-full bg-forest-600 text-white font-bold py-3 rounded-xl mt-6 text-sm">
              OK, Gets ko na!
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 text-xs font-bold z-[100]">
      Offline — Some features may not work. Data will sync when reconnected.
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("landing");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpType, setOtpType] = useState("login");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [business, setBusiness] = useState(null);
  const [branch, setBranch] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [appLoading, setAppLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => setToast({ message, type });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadUserData(session.user.id);
      else setAppLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadUserData(session.user.id);
      else {
        setProfile(null);
        setBusiness(null);
        setBranch(null);
        setIsSuperAdmin(false);
        setScreen("landing");
        setAppLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId) => {
    setAppLoading(true);
    try {
      let prof = null;
      for (let i = 0; i < 3; i++) {
        const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
        if (data) {
          prof = data;
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!prof) {
        showToast("Hindi mahanap ang profile. Subukan muli.", "error");
        setAppLoading(false);
        return;
      }
      setProfile(prof);

      const { data: biz } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", prof.business_id)
        .maybeSingle();
      setBusiness(biz);

      if (prof.branch_id) {
        const { data: br } = await supabase
          .from("branches")
          .select("*")
          .eq("id", prof.branch_id)
          .maybeSingle();
        setBranch(br);
      }

      // Check super admin — use maybeSingle() to avoid errors
      const { data: sa } = await supabase
        .from("super_admins")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      setIsSuperAdmin(!!sa);
    } catch (err) {
      showToast("May error sa pag-load. Subukan muli.", "error");
    } finally {
      setAppLoading(false);
    }
  };

  const handleLogout = async () => {
    if (session && profile && business) {
      logAudit(business.id, profile.id, profile.full_name, "logout", "session", null, null);
    }
    await supabase.auth.signOut();
    setScreen("landing");
  };

  useEffect(() => {
    if (!session) return;
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        showToast("Session expired due to inactivity. Please log in again.", "warning");
        handleLogout();
      }, SESSION_TIMEOUT_MS);
    };
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [session]);

  const goToOTP = (email, type) => {
    setOtpEmail(email);
    setOtpType(type);
    setScreen("otp");
  };

  if (appLoading) return <Spinner />;

  // Logged in
  if (session && profile && business) {
    if (!isSuperAdmin) {
      if (business.status === "pending")
        return (
          <>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <PendingScreen business={business} onLogout={handleLogout} />
          </>
        );
      if (business.status === "rejected")
        return (
          <>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <RejectedScreen business={business} onLogout={handleLogout} />
          </>
        );
      if (business.status === "suspended")
        return (
          <>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <RejectedScreen
              business={{
                ...business,
                rejection_reason:
                  "Ang iyong account ay naka-suspend. Makipag-ugnayan sa aming team.",
              }}
              onLogout={handleLogout}
            />
          </>
        );
      if (isTrialExpired(business))
        return (
          <>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <TrialExpiredScreen business={business} onLogout={handleLogout} />
          </>
        );
    }

    return (
      <>
        <OfflineBanner />
        <InstallPrompt />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        {profile.role === "owner" ? (
          <OwnerDashboard
            profile={profile}
            business={business}
            isSuperAdmin={isSuperAdmin}
            onLogout={handleLogout}
            showToast={showToast}
          />
        ) : (
          <StaffDashboard
            profile={profile}
            business={business}
            branch={branch}
            onLogout={handleLogout}
            showToast={showToast}
          />
        )}
      </>
    );
  }

  // Not logged in
  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {screen === "landing" && (
        <LandingScreen
          onShowSignup={() => setScreen("signup")}
          onShowLogin={() => setScreen("login")}
        />
      )}
      {screen === "signup" && (
        <SignupScreen
          onBack={() => setScreen("landing")}
          onSuccess={() => setScreen("login")}
          showToast={showToast}
        />
      )}
      {screen === "login" && (
        <LoginScreen
          onBack={() => setScreen("landing")}
          onSuccess={() => {}}
          onForgotPassword={() => setScreen("forgot")}
          showToast={showToast}
        />
      )}
      {screen === "forgot" && (
        <ForgotPasswordScreen
          onBack={() => setScreen("login")}
          onVerifyOTP={goToOTP}
          showToast={showToast}
        />
      )}
      {screen === "otp" && (
        <OTPScreen
          email={otpEmail}
          type={otpType}
          onBack={() => setScreen(otpType === "forgot" ? "forgot" : "login")}
          onSuccess={(next) => setScreen(next || "login")}
          showToast={showToast}
        />
      )}
    </>
  );
}
