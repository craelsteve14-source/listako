import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
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
  owner: "bg-purple-100 text-purple-700",
  branch_manager: "bg-blue-100 text-blue-700",
  inventory_staff: "bg-yellow-100 text-yellow-700",
  cashier: "bg-green-100 text-green-700",
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
      : "bg-green-600";
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
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 gap-3">
      <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-green-700 text-sm font-medium">Naglo-load...</p>
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
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
          className="w-11 h-14 text-center text-xl font-black border-2 rounded-xl focus:outline-none focus:border-green-500 bg-white"
          style={{ borderColor: d ? "#16a34a" : "#e5e7eb" }}
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
      <div className="bg-green-700 px-4 py-5 flex items-center gap-3">
        <button onClick={onBack} className="text-white text-xl">
          ←
        </button>
        <h2 className="text-white font-bold text-lg">
          {type === "forgot" ? "I-reset ang Password" : "OTP Verification"}
        </h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 max-w-md mx-auto w-full">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4 text-3xl">
          {type === "forgot" ? "🔑" : "📱"}
        </div>
        <h3 className="text-lg font-black text-gray-800 mb-1 text-center">Ilagay ang OTP Code</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          Nag-send kami ng 6-digit code sa{" "}
          <span className="font-semibold text-green-700">{email}</span>
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
          className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl mt-6 disabled:opacity-60 active:scale-95 transition-transform"
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
          className="mt-4 text-sm font-medium disabled:text-gray-400 text-green-700"
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
                <p className="text-xl font-black text-green-700">
                  ₱{plan.price}
                  <span className="text-xs font-medium text-gray-400">/buwan</span>
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 bg-green-50 border border-green-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-green-800 mb-2">💳 Paano Mag-subscribe:</p>
          <p className="text-xs text-green-700">1. Pumili ng plan sa itaas</p>
          <p className="text-xs text-green-700">2. Mag-GCash o Maya sa:</p>
          <p className="text-sm font-black text-green-800 mt-1">📱 {ADMIN_GCASH}</p>
          <p className="text-xs text-green-700 mt-1">3. I-send ang screenshot ng resibo sa:</p>
          <p className="text-xs font-semibold text-green-800">{SUPER_ADMIN_EMAIL}</p>
          <p className="text-xs text-green-700 mt-1">4. Ia-activate ang account sa loob ng 24 oras</p>
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
    approved: "bg-green-100 text-green-700",
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
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold"
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
                      className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg font-medium"
                    >
                      I-approve na
                    </button>
                  )}
                  {biz.status === "suspended" && (
                    <button
                      onClick={() => approve(biz)}
                      className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg font-medium"
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
function LandingScreen({ onShowSignup, onShowLogin }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-700 via-green-600 to-emerald-500 flex flex-col items-center justify-between px-6 py-12">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl mb-6">
          <span className="text-4xl">🏪</span>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight mb-1">ListaKo</h1>
        <p className="text-green-100 text-sm font-medium mb-2 tracking-widest uppercase">
          Business Manager
        </p>
        <p className="text-green-50 text-base mt-4 max-w-xs leading-relaxed">
          Para sa mga may-ari ng tindahan. Subaybayan ang benta, imbentaryo, at kita — kahit
          walang internet.
        </p>
        <div className="mt-4 bg-green-800 bg-opacity-30 rounded-2xl px-4 py-2">
          <p className="text-green-200 text-xs font-medium">
            🎉 7-day na libreng trial para sa bagong users!
          </p>
        </div>
      </div>
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={onShowSignup}
          className="w-full bg-white text-green-700 font-bold py-4 rounded-2xl text-base shadow-lg active:scale-95 transition-transform"
        >
          Gumawa ng Account — Libre!
        </button>
        <button
          onClick={onShowLogin}
          className="w-full bg-green-800 bg-opacity-40 text-white font-semibold py-4 rounded-2xl text-base border border-green-400 border-opacity-40 active:scale-95 transition-transform"
        >
          Mag-login
        </button>
        <p className="text-green-200 text-xs text-center pt-2">
          Libre. Para sa lahat ng tindahan sa Pilipinas. 🇵🇭
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
        .single();
      if (bizError) throw bizError;

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-green-700 px-4 py-5 flex items-center gap-3">
        <button onClick={step === 1 ? onBack : () => setStep(1)} className="text-white text-xl">
          ←
        </button>
        <div>
          <h2 className="text-white font-bold text-lg">Gumawa ng Account</h2>
          <p className="text-green-200 text-xs">Hakbang {step} ng 2 • 7-day free trial!</p>
        </div>
      </div>
      <div className="h-1 bg-green-100">
        <div
          className="h-1 bg-green-600 transition-all duration-300"
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
              className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform"
            >
              Susunod →
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
              className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60 active:scale-95 transition-transform"
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
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleLogin = async () => {
    if (!form.email.trim()) return showToast("Ilagay ang iyong email address.", "error");
    if (!form.password) return showToast("Ilagay ang iyong password.", "error");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (error) throw error;
      onSuccess();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-green-700 px-4 py-5 flex items-center gap-3">
        <button onClick={onBack} className="text-white text-xl">
          ←
        </button>
        <h2 className="text-white font-bold text-lg">Mag-login</h2>
      </div>
      <div className="flex-1 flex flex-col justify-center px-5 py-6 space-y-4 max-w-md mx-auto w-full">
        <div className="text-center mb-2">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🔐</span>
          </div>
          <p className="text-gray-500 text-sm">I-enter ang iyong ListaKo credentials</p>
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
          placeholder="Ang iyong password"
          type="password"
        />
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60 active:scale-95 transition-transform"
        >
          {loading ? "Naglo-login..." : "Mag-login →"}
        </button>
        <button
          onClick={onForgotPassword}
          className="text-center text-sm text-green-700 font-medium py-2"
        >
          Nakalimutan ang password? 🔑
        </button>
        <p className="text-center text-xs text-gray-400">
          Wala pang account? Makipag-ugnayan sa iyong owner.
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-green-700 px-4 py-5 flex items-center gap-3">
        <button onClick={onBack} className="text-white text-xl">
          ←
        </button>
        <h2 className="text-white font-bold text-lg">Nakalimutan ang Password</h2>
      </div>
      <div className="flex-1 flex flex-col justify-center px-5 py-6 max-w-md mx-auto w-full space-y-4">
        <div className="text-center mb-2">
          <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🔑</span>
          </div>
          <h3 className="font-black text-gray-800 text-lg">I-reset ang Password</h3>
          <p className="text-sm text-gray-500 mt-1">
            Magpapadala kami ng OTP code sa iyong email.
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
          className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60 active:scale-95 transition-transform"
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

function StatCard({ icon, label, value, color = "bg-green-50 text-green-700" }) {
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
function OwnerDashboard({ profile, business, isSuperAdmin, onLogout, showToast }) {
  const [tab, setTab] = useState("dashboard");
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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [b, p, s, tx, utang] = await Promise.all([
      supabase.from("branches").select("*").eq("business_id", business.id).order("created_at"),
      supabase.from("products").select("*").eq("business_id", business.id).order("name"),
      supabase
        .from("profiles")
        .select("*")
        .eq("business_id", business.id)
        .neq("role", "owner")
        .order("full_name"),
      supabase
        .from("transactions")
        .select("*")
        .eq("business_id", business.id)
        .eq("status", "completed")
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("utang_records")
        .select("*")
        .eq("business_id", business.id)
        .in("status", ["unpaid", "partial"]),
    ]);
    setBranches(b.data || []);
    setProducts(p.data || []);
    setStaff(s.data || []);
    setRecentTx((tx.data || []).slice(0, 5));
    const revenue = (tx.data || []).reduce((sum, t) => sum + Number(t.total_amount), 0);
    setTodayRevenue(revenue);
    setTodayTxCount((tx.data || []).length);
    const utangAmt = (utang.data || []).reduce(
      (sum, u) => sum + Number(u.balance || u.amount),
      0
    );
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
            className="w-full bg-green-600 text-white font-bold py-3 rounded-xl disabled:opacity-60"
          >
            {saving ? "Sine-save..." : "I-save ang Branch"}
          </button>
        </div>
      </Modal>
    );
  };

  const ProductModal = ({ existing, onClose }) => {
    const [form, setForm] = useState({
      name: existing?.name || "",
      barcode: existing?.barcode || "",
      price: existing?.price || "",
      stock_quantity: existing?.stock_quantity || "",
      low_stock_threshold: existing?.low_stock_threshold || "10",
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
        stock_quantity: Number(form.stock_quantity) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 10,
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
          <Field
            label="Barcode (opsyonal)"
            value={form.barcode}
            onChange={(v) => setForm((f) => ({ ...f, barcode: v }))}
            placeholder="I-type ang barcode"
          />
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
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-xl disabled:opacity-60"
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
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
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
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
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
            className="w-full bg-green-600 text-white font-bold py-3 rounded-xl disabled:opacity-60"
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
    { key: "products", icon: "📦", label: "Produkto" },
    { key: "branches", icon: "🏪", label: "Branch" },
    { key: "staff", icon: "👥", label: "Staff" },
    ...(isSuperAdmin ? [{ key: "admin", icon: "👑", label: "Admin" }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      <TrialBanner business={business} />
      <div className="bg-green-700 px-4 pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-green-200 text-xs font-medium uppercase tracking-widest">
              {isSuperAdmin ? "👑 Super Admin" : "Owner"}
            </p>
            <h1 className="text-white font-black text-xl leading-tight">{business.name}</h1>
          </div>
          <button
            onClick={onLogout}
            className="bg-green-800 bg-opacity-50 text-green-100 text-xs px-3 py-2 rounded-xl font-medium"
          >
            Logout
          </button>
        </div>
        <p className="text-green-300 text-xs">
          Maligayang pagdating, {profile.full_name.split(" ")[0]}! 👋
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {tab === "admin" && isSuperAdmin && <SuperAdminPanel showToast={showToast} />}

            {tab === "dashboard" && (
              <div className="p-4 space-y-4">
                {/* Revenue card */}
                <div className="bg-green-700 rounded-2xl p-4">
                  <p className="text-green-200 text-xs font-semibold uppercase tracking-widest mb-1">
                    Today's Revenue
                  </p>
                  <p className="text-3xl font-black text-white tracking-tight">
                    ₱{todayRevenue.toFixed(2)}
                  </p>
                  <p className="text-green-300 text-xs mt-1">
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
                        onClick={() => setTab("branches")}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium"
                      >
                        Add Branch
                      </button>
                      <button
                        onClick={() => setTab("products")}
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
                          <p className="font-black text-green-700">
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
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">
                            Active
                          </span>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "products" && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                    {products.length} Produkto
                  </h2>
                  <button
                    onClick={() => setShowAddProduct(true)}
                    className="bg-green-600 text-white text-xs px-3 py-2 rounded-xl font-bold"
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
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">
                            {p.barcode ? `Barcode: ${p.barcode}` : "Walang barcode"}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm font-black text-green-700">
                              ₱{Number(p.price).toFixed(2)}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                p.stock_quantity <= p.low_stock_threshold
                                  ? "bg-red-100 text-red-600"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {p.stock_quantity <= p.low_stock_threshold ? "⚠️ " : ""}Stock:{" "}
                              {p.stock_quantity}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-2">
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
                    className="bg-green-600 text-white text-xs px-3 py-2 rounded-xl font-bold"
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
                    className="bg-green-600 text-white text-xs px-3 py-2 rounded-xl font-bold"
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
          </>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-100 flex items-center justify-around px-2 py-2 z-30">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
              tab === item.key ? "bg-green-50 text-green-700" : "text-gray-400"
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span
              className={`text-xs font-medium ${
                tab === item.key ? "text-green-700" : "text-gray-400"
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BARCODE SCANNER
// ═══════════════════════════════════════════════════════════════
function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    let stream = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err) {
        setError("Hindi ma-access ang camera. Siguraduhing binigyan mo ng permiso ang app.");
      }
    };
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleManual = () => {
    if (manualCode.trim()) {
      onDetected(manualCode.trim());
      setManualCode("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
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
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="text-center px-6">
            <p className="text-white text-sm mb-4">{error}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-64 h-40">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-green-400 rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-green-400 rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-green-400 rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-green-400 rounded-br-lg"></div>
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-green-400 opacity-60 animate-pulse"></div>
              </div>
            </div>
            <div className="absolute bottom-32 left-0 right-0 text-center">
              <p className="text-white text-xs opacity-60">Point camera at the barcode</p>
            </div>
          </>
        )}
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
            className="flex-1 bg-white bg-opacity-10 text-white border border-white border-opacity-20 rounded-xl px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-green-400"
          />
          <button
            onClick={handleManual}
            className="bg-green-600 text-white px-4 py-3 rounded-xl font-bold text-sm"
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-green-700 px-5 py-5 text-center">
          <p className="text-green-200 text-xs font-medium uppercase tracking-widest mb-1">
            Official Receipt
          </p>
          <h2 className="text-white font-black text-lg">{business?.name}</h2>
          <p className="text-green-300 text-xs mt-1">{branch?.name || ""}</p>
        </div>
        <div className="px-5 py-4">
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
                ₱{Number(transaction?.total_amount).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Cash Tendered</span>
              <span className="font-medium text-gray-800">
                ₱{Number(transaction?.amount_tendered).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-base font-black">
              <span className="text-gray-800">Change</span>
              <span className="text-green-700">
                ₱{Number(transaction?.change_amount).toFixed(2)}
              </span>
            </div>
          </div>
          <div className="border-t border-dashed border-gray-200 mt-3 mb-3"></div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Cashier: {cashier?.full_name}</p>
            <p className="text-xs text-gray-300 mt-1">Powered by ListaKo</p>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm"
          >
            Close
          </button>
          <button
            onClick={onNewTransaction}
            className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl text-sm"
          >
            New Sale
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CASHIER POS
// ═══════════════════════════════════════════════════════════════
function CashierPOS({ profile, business, branch, onLogout, showToast }) {
  const [posTab, setPosTab] = useState("pos");
  const [cart, setCart] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState(false);
  const [amountTendered, setAmountTendered] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [utangList, setUtangList] = useState([]);
  const [loadingUtang, setLoadingUtang] = useState(false);
  const [voidModal, setVoidModal] = useState(null);
  const [voidReason, setVoidReason] = useState("");

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const change = Math.max(0, Number(amountTendered) - total);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Search products
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("business_id", business.id)
        .ilike("name", `%${searchQuery}%`)
        .limit(8);
      setSearchResults(data || []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, business.id]);

  // Search by barcode
  const handleBarcode = async (code) => {
    setScanning(false);
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("business_id", business.id)
      .eq("barcode", code)
      .maybeSingle();
    if (!data) return showToast("Product not found. Try searching by name.", "error");
    addToCart(data);
    showToast(`${data.name} added to cart!`, "success");
  };

  // Add to cart with stock validation
  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          showToast(`Only ${product.stock_quantity} units of ${product.name} in stock.`, "warning");
          return prev;
        }
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unit_price }
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
          quantity: 1,
          subtotal: Number(product.price),
          stock: product.stock_quantity,
        },
      ];
    });
    setSearchQuery("");
    setSearchResults([]);
  };

  // Update quantity with stock validation
  const updateQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product_id !== productId) return i;
          if (delta > 0 && i.quantity >= i.stock) {
            showToast(`Only ${i.stock} units available.`, "warning");
            return i;
          }
          const newQty = i.quantity + delta;
          return { ...i, quantity: newQty, subtotal: newQty * i.unit_price };
        })
        .filter((i) => i.quantity > 0)
    );
  };

  // Void transaction
  const voidTransaction = async () => {
    if (!voidReason.trim()) return showToast("Please enter a reason for voiding.", "error");
    try {
      await supabase
        .from("transactions")
        .update({
          status: "voided",
          voided_at: new Date().toISOString(),
          voided_by: profile.id,
          void_reason: voidReason.trim(),
        })
        .eq("id", voidModal.id);
      showToast("Transaction voided successfully.", "success");
      setVoidModal(null);
      setVoidReason("");
      loadHistory();
    } catch (err) {
      showToast("Failed to void transaction.", "error");
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

  // Mark utang as paid
  const markUtangPaid = async (utangId, amount) => {
    await supabase
      .from("utang_records")
      .update({
        amount_paid: amount,
        status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", utangId);
    showToast("Utang marked as paid!", "success");
    loadUtang();
  };

  // Process checkout — THIS IS WHERE THE BUG WAS (missing closing brace)
  const processCheckout = async () => {
    if (cart.length === 0) return showToast("Cart is empty.", "error");
    if (paymentMethod === "cash" && (!amountTendered || Number(amountTendered) < total)) {
      return showToast("Amount tendered is less than the total.", "error");
    }
    if (paymentMethod === "utang" && !customerName.trim()) {
      return showToast("Please enter the customer's name for utang.", "error");
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
          total_amount: total,
          payment_method: paymentMethod,
          amount_tendered: paymentMethod === "cash" ? Number(amountTendered) : total,
          change_amount: paymentMethod === "cash" ? change : 0,
          customer_name: customerName.trim() || null,
          customer_phone: customerPhone.trim() || null,
          status: "completed",
        })
        .select()
        .single();
      if (txnError) throw txnError;

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

      // Deduct stock — non-blocking
      for (const item of cart) {
        try {
          const { data: prod } = await supabase
            .from("products")
            .select("stock_quantity")
            .eq("id", item.product_id)
            .single();
          if (prod) {
            await supabase
              .from("products")
              .update({ stock_quantity: Math.max(0, prod.stock_quantity - item.quantity) })
              .eq("id", item.product_id);
          }
        } catch (stockErr) {
          console.warn("Stock deduction skipped:", stockErr);
        }
      }

      // Show receipt
      setReceiptItems(cart.map((i) => ({ ...i })));
      setReceipt(txn);
      setCart([]);
      setAmountTendered("");
      setCustomerName("");
      setCustomerPhone("");
      setCheckoutMode(false);
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
    const { data } = await supabase
      .from("transactions")
      .select("*, transaction_items(*, products(name))")
      .eq("cashier_id", profile.id)
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
    setLoadingHistory(false);
  };

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
      <div className="bg-green-700 px-4 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-green-200 text-xs font-medium uppercase tracking-widest">Cashier</p>
            <h1 className="text-white font-black text-lg leading-tight">{business.name}</h1>
          </div>
          <button
            onClick={onLogout}
            className="bg-green-800 bg-opacity-50 text-green-100 text-xs px-3 py-2 rounded-xl font-medium"
          >
            Logout
          </button>
        </div>
        <p className="text-green-300 text-xs">
          {branch?.name || "No branch"} · {profile.full_name}
        </p>
      </div>

      {/* Tab bar */}
      <div className="bg-green-800 flex px-2 gap-1 flex-shrink-0">
        {[
          { key: "pos", label: "POS" },
          { key: "history", label: "Sales" },
          { key: "utang", label: "Utang" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setPosTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-t-lg transition-colors ${
              posTab === t.key ? "bg-gray-50 text-green-700" : "text-green-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* POS Tab */}
      {posTab === "pos" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="px-4 py-3 bg-white border-b border-gray-100 flex gap-2 flex-shrink-0">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product by name..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 pr-8"
              />
              {searching && (
                <div className="absolute right-3 top-3 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <button
              onClick={() => setScanning(true)}
              className="bg-green-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm"
            >
              📷 Scan
            </button>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="mx-4 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-10 flex-shrink-0">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={`w-full px-4 py-3 text-left flex items-center justify-between border-b border-gray-50 last:border-0 active:bg-green-50 ${
                    p.stock_quantity <= 0 ? "opacity-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{p.name}</p>
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
                  <span className="text-sm font-black text-green-700">
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
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
                      stroke="#16a34a"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <line x1="3" y1="6" x2="21" y2="6" stroke="#16a34a" strokeWidth="1.5" />
                    <path
                      d="M16 10a4 4 0 01-8 0"
                      stroke="#16a34a"
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
                        className="w-7 h-7 rounded-lg bg-green-100 text-green-700 font-bold text-base flex items-center justify-center active:bg-green-200"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-sm font-black text-green-700 w-16 text-right">
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
                onClick={() => setCheckoutMode(true)}
                className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform"
              >
                Proceed to Checkout →
              </button>
            </div>
          )}

          {/* Checkout modal */}
          {checkoutMode && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-40">
              <div className="bg-white w-full rounded-t-3xl p-5 max-h-screen overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-gray-800 text-lg">Checkout</h3>
                  <button onClick={() => setCheckoutMode(false)} className="text-gray-400 text-xl">
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
                  <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between">
                    <span className="font-black text-gray-800">Total</span>
                    <span className="font-black text-green-700 text-lg">₱{total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment method */}
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                  Payment Method
                </p>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setPaymentMethod(m.key)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                        paymentMethod === m.key
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-white text-gray-600 border-gray-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Customer name */}
                {(paymentMethod === "utang" ||
                  paymentMethod === "gcash" ||
                  paymentMethod === "maya") && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                      Customer Name{" "}
                      {paymentMethod === "utang" ? "(Required)" : "(Optional)"}
                    </p>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={
                        paymentMethod === "utang" ? "Enter customer name..." : "Optional..."
                      }
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
                    />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Phone number (optional)..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {paymentMethod === "utang" && (
                      <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                        <p className="text-xs text-orange-700 font-medium">
                          ⚠️ This transaction will be recorded as utang. The customer owes ₱
                          {total.toFixed(2)}.
                        </p>
                      </div>
                    )}
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
                      onChange={(e) => setAmountTendered(e.target.value)}
                      placeholder="Enter amount..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {amountTendered && Number(amountTendered) >= total && (
                      <div className="mt-2 bg-green-50 rounded-xl px-4 py-3 flex justify-between">
                        <span className="font-semibold text-green-700">Change</span>
                        <span className="font-black text-green-700 text-lg">
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
                        onClick={() => setAmountTendered(String(amt))}
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
                    (paymentMethod === "utang" && !customerName.trim())
                  }
                  className="w-full bg-green-600 text-white font-black py-4 rounded-2xl text-lg disabled:opacity-50 active:scale-95 transition-transform"
                >
                  {processing
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
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
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
                <p className="text-xs font-bold text-green-700">
                  ₱
                  {history
                    .filter((t) => t.status === "completed")
                    .reduce((s, t) => s + Number(t.total_amount), 0)
                    .toFixed(2)}{" "}
                  total
                </p>
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
                            : "text-green-700"
                        }`}
                      >
                        ₱{Number(txn.total_amount).toFixed(2)}
                      </p>
                      <div className="flex gap-1 mt-0.5 justify-end">
                        <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium capitalize">
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
                    <button
                      onClick={() => setVoidModal(txn)}
                      className="text-xs text-red-500 font-semibold bg-red-50 px-3 py-1.5 rounded-lg mt-1"
                    >
                      Void Transaction
                    </button>
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
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
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
                    onClick={() => markUtangPaid(u.id, u.amount)}
                    className="text-xs text-green-700 font-semibold bg-green-50 px-3 py-1.5 rounded-lg"
                  >
                    Mark as Fully Paid ✓
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barcode scanner overlay */}
      {scanning && <BarcodeScanner onDetected={handleBarcode} onClose={() => setScanning(false)} />}

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
            setPosTab("pos");
          }}
        />
      )}

      {/* Void Transaction Modal */}
      {voidModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5">
            <h3 className="font-black text-gray-800 text-base mb-1">Void Transaction</h3>
            <p className="text-xs text-gray-500 mb-1">
              {voidModal.receipt_number} · ₱{Number(voidModal.total_amount).toFixed(2)}
            </p>
            <p className="text-xs text-red-500 mb-3">
              ⚠️ This cannot be undone. The sale will be marked as voided.
            </p>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for voiding (required)..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-red-400 mb-3"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setVoidModal(null);
                  setVoidReason("");
                }}
                className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={voidTransaction}
                className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl text-sm"
              >
                Void Transaction
              </button>
            </div>
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              stroke="#16a34a"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <polyline
              points="9 22 9 12 15 12 15 22"
              stroke="#16a34a"
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
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-yellow-800">Inventory Management</p>
          <p className="text-xs text-yellow-600 mt-1">Coming in Phase 4. Stay tuned!</p>
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
        const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
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
        .single();
      setBusiness(biz);

      if (prof.branch_id) {
        const { data: br } = await supabase
          .from("branches")
          .select("*")
          .eq("id", prof.branch_id)
          .single();
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
    await supabase.auth.signOut();
    setScreen("landing");
  };

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
