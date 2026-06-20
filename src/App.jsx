import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase Client ───────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Super Admin Config ────────────────────────────────────────────────────────
const SUPER_ADMIN_EMAIL = "craelsteve14@gmail.com";
const ADMIN_GCASH = "09530897696";
const ADMIN_PHONE = "09530897696";

// ─── Pricing ──────────────────────────────────────────────────────────────────
const PLANS = {
  basic:    { label: "Basic",    price: 199, branches: 1,  staff: 5,   desc: "Para sa maliliit na tindahan" },
  pro:      { label: "Pro",      price: 399, branches: 3,  staff: 15,  desc: "Para sa lumalaking negosyo" },
  business: { label: "Business", price: 699, branches: 999,staff: 999, desc: "Para sa maraming branches" },
};

// ─── Role Config ───────────────────────────────────────────────────────────────
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

// ─── Filipino Error Messages ───────────────────────────────────────────────────
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

// ─── Trial Helper ──────────────────────────────────────────────────────────────
const getTrialDaysLeft = (trialEndsAt) => {
  if (!trialEndsAt) return 0;
  const now = new Date();
  const end = new Date(trialEndsAt);
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

const isTrialExpired = (business) => {
  if (business?.status === 'approved' || business?.plan === 'business') return false;
  if (!business?.trial_ends_at) return false;
  return new Date() > new Date(business.trial_ends_at);
};

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  const bg = type === "error" ? "bg-red-500" : type === "warning" ? "bg-yellow-500" : "bg-green-600";
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${bg} text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs text-center`}>
      {message}
    </div>
  );
}

// ─── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 gap-3">
      <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-green-700 text-sm font-medium">Naglo-load...</p>
    </div>
  );
}

// ─── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = "text", maxLength }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
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

// ─── OTP Input ─────────────────────────────────────────────────────────────────
function OTPInput({ value, onChange }) {
  const digits = 6;
  const vals = value.split("").concat(Array(digits).fill("")).slice(0, digits);
  const refs = Array.from({ length: digits }, () => null);
  const setRef = (i) => (el) => { refs[i] = el; };
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
        <input key={i} ref={setRef(i)} type="tel" inputMode="numeric" maxLength={1} value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-11 h-14 text-center text-xl font-black border-2 rounded-xl focus:outline-none focus:border-green-500 bg-white"
          style={{ borderColor: d ? "#16a34a" : "#e5e7eb" }}
        />
      ))}
    </div>
  );
}

// ─── OTP Screen ────────────────────────────────────────────────────────────────
function OTPScreen({ email, type, onBack, onSuccess, showToast }) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setInterval(() => setResendTimer(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  const handleVerify = async () => {
    if (otp.length < 6) return showToast("Ilagay ang 6-digit na OTP code.", "error");
    if (type === "forgot" && newPassword.length < 6) return showToast("Ang bagong password ay dapat 6 na karakter man lang.", "error");
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
        <button onClick={onBack} className="text-white text-xl">←</button>
        <h2 className="text-white font-bold text-lg">{type === "forgot" ? "I-reset ang Password" : "OTP Verification"}</h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 max-w-md mx-auto w-full">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4 text-3xl">
          {type === "forgot" ? "🔑" : "📧"}
        </div>
        <h3 className="text-lg font-black text-gray-800 mb-1 text-center">Ilagay ang OTP Code</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          Nag-send kami ng 6-digit code sa <span className="font-semibold text-green-700">{email}</span>
        </p>
        <OTPInput value={otp} onChange={setOtp} />
        {type === "forgot" && (
          <div className="w-full mt-4">
            <Field label="Bagong Password" value={newPassword} onChange={setNewPassword} placeholder="Min. 6 characters" type="password" />
          </div>
        )}
        <button onClick={handleVerify} disabled={loading || otp.length < 6}
          className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl mt-6 disabled:opacity-60 active:scale-95 transition-transform">
          {loading ? "Sine-check..." : type === "forgot" ? "I-reset ang Password" : "I-verify →"}
        </button>
        <button onClick={handleResend} disabled={resendTimer > 0} className="mt-4 text-sm font-medium disabled:text-gray-400 text-green-700">
          {resendTimer > 0 ? `Mag-resend sa ${resendTimer}s` : "Hindi natanggap? Mag-resend"}
        </button>
      </div>
    </div>
  );
}

// ─── Pending Approval Screen ───────────────────────────────────────────────────
function PendingScreen({ business, onLogout }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 bg-yellow-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">⏳</div>
        <h1 className="text-2xl font-black text-gray-800">Nasa Review Pa</h1>
        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
          Salamat sa pag-sign up, <span className="font-semibold">{business?.name}</span>! Ang iyong account ay kasalukuyang sinusuri ng aming team.
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
        <button onClick={onLogout} className="mt-6 w-full bg-gray-100 text-gray-600 font-semibold py-3 rounded-2xl text-sm">
          Mag-logout
        </button>
      </div>
    </div>
  );
}

// ─── Rejected Screen ───────────────────────────────────────────────────────────
function RejectedScreen({ business, onLogout }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">❌</div>
        <h1 className="text-2xl font-black text-gray-800">Hindi Na-approve</h1>
        <p className="text-gray-500 text-sm mt-2">Hindi na-approve ang account ng <span className="font-semibold">{business?.name}</span>.</p>
        {business?.rejection_reason && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-red-700 mb-1">Dahilan:</p>
            <p className="text-sm text-red-600">{business.rejection_reason}</p>
          </div>
        )}
        <div className="mt-4 bg-white border border-gray-100 rounded-2xl p-4 text-left shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Makipag-ugnayan para sa tulong</p>
          <p className="text-sm text-gray-700">📧 {SUPER_ADMIN_EMAIL}</p>
          <p className="text-sm text-gray-700">📱 {ADMIN_PHONE}</p>
        </div>
        <button onClick={onLogout} className="mt-6 w-full bg-gray-100 text-gray-600 font-semibold py-3 rounded-2xl text-sm">
          Mag-logout
        </button>
      </div>
    </div>
  );
}

// ─── Trial Expired Screen ──────────────────────────────────────────────────────
function TrialExpiredScreen({ business, onLogout }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">⏰</div>
          <h1 className="text-2xl font-black text-gray-800">Na-expire na ang Trial</h1>
          <p className="text-gray-500 text-sm mt-2">
            Ang 7-day na libreng trial ng <span className="font-semibold">{business?.name}</span> ay natapos na.
          </p>
        </div>

        <p className="text-sm font-bold text-gray-700 mb-3 text-center">Pumili ng subscription plan:</p>

        <div className="space-y-3">
          {Object.entries(PLANS).map(([key, plan]) => (
            <div key={key} className="bg-white border-2 border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-gray-800">{plan.label}</p>
                  <p className="text-xs text-gray-500">{plan.desc}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {plan.branches === 999 ? "Unlimited" : plan.branches} branch • {plan.staff === 999 ? "Unlimited" : plan.staff} staff
                  </p>
                </div>
                <p className="text-xl font-black text-green-700">₱{plan.price}<span className="text-xs font-medium text-gray-400">/buwan</span></p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 bg-green-50 border border-green-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-green-800 mb-2">💸 Paano Mag-subscribe:</p>
          <p className="text-xs text-green-700">1. Pumili ng plan sa itaas</p>
          <p className="text-xs text-green-700">2. Mag-GCash o Maya sa:</p>
          <p className="text-sm font-black text-green-800 mt-1">📱 {ADMIN_GCASH}</p>
          <p className="text-xs text-green-700 mt-1">3. I-send ang screenshot ng resibo sa:</p>
          <p className="text-xs font-semibold text-green-800">{SUPER_ADMIN_EMAIL}</p>
          <p className="text-xs text-green-700 mt-1">4. Ia-activate ang account sa loob ng 24 oras</p>
        </div>

        <button onClick={onLogout} className="mt-4 w-full bg-gray-100 text-gray-600 font-semibold py-3 rounded-2xl text-sm">
          Mag-logout
        </button>
      </div>
    </div>
  );
}

// ─── Trial Banner ──────────────────────────────────────────────────────────────
function TrialBanner({ business }) {
  const daysLeft = getTrialDaysLeft(business?.trial_ends_at);
  if (business?.status === 'approved' && business?.plan === 'business') return null;
  if (business?.status !== 'trial' && business?.plan !== 'trial') return null;
  const color = daysLeft <= 2 ? "bg-red-500" : daysLeft <= 4 ? "bg-yellow-500" : "bg-blue-500";
  return (
    <div className={`${color} text-white text-center text-xs py-2 px-4 font-medium`}>
      {daysLeft <= 0
        ? "⚠️ Na-expire na ang iyong trial!"
        : `🎁 Free Trial: ${daysLeft} araw na lang! Mag-subscribe na para mapatuloy.`}
    </div>
  );
}

// ─── Super Admin Panel ─────────────────────────────────────────────────────────
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

  useEffect(() => { fetchBusinesses(); }, [fetchBusinesses]);

  const approve = async (biz) => {
    const { error } = await supabase.from("businesses").update({
      status: "approved",
      approved_at: new Date().toISOString(),
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      plan: "trial",
    }).eq("id", biz.id);
    if (error) return showToast("May error. Subukan muli.", "error");
    showToast(`Na-approve na si ${biz.name}!`, "success");
    fetchBusinesses();
  };

  const reject = async () => {
    if (!rejectReason.trim()) return showToast("Ilagay ang dahilan ng rejection.", "error");
    const { error } = await supabase.from("businesses").update({
      status: "rejected",
      rejection_reason: rejectReason.trim(),
    }).eq("id", rejectModal.id);
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
    await supabase.from("businesses").update({ trial_ends_at: newEnd, status: "approved" }).eq("id", biz.id);
    showToast(`Na-extend ang trial ni ${biz.name}!`, "success");
    fetchBusinesses();
  };

  const upgradePlan = async (biz, plan) => {
    await supabase.from("businesses").update({
      plan,
      status: "approved",
      trial_ends_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }).eq("id", biz.id);
    showToast(`Na-upgrade si ${biz.name} sa ${plan}!`, "success");
    fetchBusinesses();
  };

  const filtered = businesses.filter(b => filter === "all" ? true : b.status === filter);

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
        {["pending","approved","rejected","suspended"].map(s => (
          <div key={s} className="bg-white rounded-xl p-2 text-center shadow-sm border border-gray-100">
            <p className="text-lg font-black text-gray-800">{businesses.filter(b => b.status === s).length}</p>
            <p className="text-xs text-gray-400 capitalize">{s}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap ${filter === f ? "bg-purple-700 text-white" : "bg-white text-gray-500 border border-gray-200"}`}>
            {f === "all" ? "Lahat" : f.charAt(0).toUpperCase() + f.slice(1)} ({businesses.filter(b => f === "all" ? true : b.status === f).length})
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
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-500 text-sm">Walang businesses dito.</p>
          </div>
        ) : filtered.map(biz => {
          const daysLeft = getTrialDaysLeft(biz.trial_ends_at);
          return (
            <div key={biz.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate">{biz.name}</p>
                  <p className="text-xs text-gray-500">{biz.address || "Walang address"}</p>
                  <p className="text-xs text-gray-400">{biz.phone || "Walang number"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Nag-sign up: {new Date(biz.created_at).toLocaleDateString("en-PH")}
                  </p>
                  {biz.trial_ends_at && biz.status !== 'rejected' && (
                    <p className={`text-xs mt-0.5 font-medium ${daysLeft <= 2 ? "text-red-500" : "text-blue-500"}`}>
                      Trial: {daysLeft > 0 ? `${daysLeft} araw na lang` : "Na-expire na"}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 ml-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[biz.status] || "bg-gray-100 text-gray-500"}`}>
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
                    <button onClick={() => approve(biz)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold">
                      ✅ Approve
                    </button>
                    <button onClick={() => setRejectModal(biz)} className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-bold">
                      ❌ Reject
                    </button>
                  </>
                )}
                {(biz.status === "approved" || biz.status === "trial") && (
                  <>
                    <button onClick={() => extendTrial(biz)} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium">
                      +7 days
                    </button>
                    <select onChange={e => e.target.value && upgradePlan(biz, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
                      defaultValue="">
                      <option value="" disabled>Upgrade Plan</option>
                      <option value="basic">Basic ₱199</option>
                      <option value="pro">Pro ₱399</option>
                      <option value="business">Business ₱699</option>
                    </select>
                    <button onClick={() => suspend(biz)} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-medium">
                      Suspend
                    </button>
                  </>
                )}
                {biz.status === "rejected" && (
                  <button onClick={() => approve(biz)} className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg font-medium">
                    I-approve na
                  </button>
                )}
                {biz.status === "suspended" && (
                  <button onClick={() => approve(biz)} className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg font-medium">
                    I-restore
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-40">
          <div className="bg-white w-full rounded-t-3xl p-5">
            <h3 className="font-bold text-gray-800 mb-1">I-reject si {rejectModal.name}?</h3>
            <p className="text-xs text-gray-500 mb-3">Ilagay ang dahilan para malaman ng owner.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Halimbawa: Incomplete information, suspicious account, etc."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm">
                Kanselahin
              </button>
              <button onClick={reject} className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl text-sm">
                I-reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Landing Screen ────────────────────────────────────────────────────────────
function LandingScreen({ onShowSignup, onShowLogin }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-700 via-green-600 to-emerald-500 flex flex-col items-center justify-between px-6 py-12">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl mb-6">
          <span className="text-4xl">🛒</span>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight mb-1">ListaKo</h1>
        <p className="text-green-100 text-sm font-medium mb-2 tracking-widest uppercase">Business Manager</p>
        <p className="text-green-50 text-base mt-4 max-w-xs leading-relaxed">
          Para sa mga may-ari ng tindahan. Subaybayan ang benta, imbentaryo, at kita — kahit walang internet.
        </p>
        <div className="mt-4 bg-green-800 bg-opacity-30 rounded-2xl px-4 py-2">
          <p className="text-green-200 text-xs font-medium">🎁 7-day na libreng trial para sa bagong users!</p>
        </div>
      </div>
      <div className="w-full max-w-sm space-y-3">
        <button onClick={onShowSignup} className="w-full bg-white text-green-700 font-bold py-4 rounded-2xl text-base shadow-lg active:scale-95 transition-transform">
          Gumawa ng Account — Libre!
        </button>
        <button onClick={onShowLogin} className="w-full bg-green-800 bg-opacity-40 text-white font-semibold py-4 rounded-2xl text-base border border-green-400 border-opacity-40 active:scale-95 transition-transform">
          Mag-login
        </button>
        <p className="text-green-200 text-xs text-center pt-2">Libre. Para sa lahat ng tindahan sa Pilipinas. 🇵🇭</p>
      </div>
    </div>
  );
}

// ─── Sign Up Screen ────────────────────────────────────────────────────────────
function SignupScreen({ onBack, onSuccess, showToast }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", confirm_password: "",
    business_name: "", business_address: "", business_phone: "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleNext = () => {
    if (!form.full_name.trim()) return showToast("Ilagay ang iyong buong pangalan.", "error");
    if (!form.email.trim()) return showToast("Ilagay ang email address.", "error");
    if (form.password.length < 6) return showToast("Ang password ay dapat hindi bababa sa 6 na karakter.", "error");
    if (form.password !== form.confirm_password) return showToast("Hindi tugma ang mga password.", "error");
    setStep(2);
  };

  const handleSignup = async () => {
    if (!form.business_name.trim()) return showToast("Ilagay ang pangalan ng iyong negosyo.", "error");
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
      });
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Hindi na-create ang user.");

      // Create business (trigger sets status to pending + trial)
      const { data: biz, error: bizError } = await supabase
        .from("businesses")
        .insert({
          name: form.business_name.trim(),
          owner_id: userId,
          address: form.business_address.trim(),
          phone: form.business_phone.trim(),
        })
        .select().single();
      if (bizError) throw bizError;

      // Create owner profile
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
        <button onClick={step === 1 ? onBack : () => setStep(1)} className="text-white text-xl">←</button>
        <div>
          <h2 className="text-white font-bold text-lg">Gumawa ng Account</h2>
          <p className="text-green-200 text-xs">Hakbang {step} ng 2 • 7-day free trial!</p>
        </div>
      </div>
      <div className="h-1 bg-green-100">
        <div className="h-1 bg-green-600 transition-all duration-300" style={{ width: step === 1 ? "50%" : "100%" }} />
      </div>
      <div className="flex-1 px-5 py-6 space-y-4 max-w-md mx-auto w-full">
        {step === 1 ? (
          <>
            <p className="text-gray-500 text-sm">Impormasyon ng Account</p>
            <Field label="Buong Pangalan" value={form.full_name} onChange={v => set("full_name", v)} placeholder="Juan dela Cruz" />
            <Field label="Email Address" value={form.email} onChange={v => set("email", v)} placeholder="juan@email.com" type="email" />
            <Field label="Password" value={form.password} onChange={v => set("password", v)} placeholder="Min. 6 characters" type="password" />
            <Field label="Ulitin ang Password" value={form.confirm_password} onChange={v => set("confirm_password", v)} placeholder="Ilagay muli" type="password" />
            <button onClick={handleNext} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform">
              Susunod →
            </button>
          </>
        ) : (
          <>
            <p className="text-gray-500 text-sm">Impormasyon ng Negosyo</p>
            <Field label="Pangalan ng Tindahan / Negosyo" value={form.business_name} onChange={v => set("business_name", v)} placeholder="Halimbawa: Rosa's Grocery" />
            <Field label="Address ng Negosyo" value={form.business_address} onChange={v => set("business_address", v)} placeholder="Iligan City, Lanao del Norte" />
            <Field label="Numero ng Telepono (opsyonal)" value={form.business_phone} onChange={v => set("business_phone", v)} placeholder="09XXXXXXXXX" type="tel" />
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-700 font-medium">ℹ️ Ang iyong account ay irereview ng aming team bago ma-activate. Aabisuhan ka sa loob ng 24 oras.</p>
            </div>
            <button onClick={handleSignup} disabled={loading} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60 active:scale-95 transition-transform">
              {loading ? "Ginagawa ang account..." : "Gumawa ng Account ✓"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onBack, onSuccess, onForgotPassword, showToast }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleLogin = async () => {
    if (!form.email.trim()) return showToast("Ilagay ang iyong email address.", "error");
    if (!form.password) return showToast("Ilagay ang iyong password.", "error");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(), password: form.password,
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
        <button onClick={onBack} className="text-white text-xl">←</button>
        <h2 className="text-white font-bold text-lg">Mag-login</h2>
      </div>
      <div className="flex-1 flex flex-col justify-center px-5 py-6 space-y-4 max-w-md mx-auto w-full">
        <div className="text-center mb-2">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🔐</span>
          </div>
          <p className="text-gray-500 text-sm">I-enter ang iyong ListaKo credentials</p>
        </div>
        <Field label="Email Address" value={form.email} onChange={v => set("email", v)} placeholder="juan@email.com" type="email" />
        <Field label="Password" value={form.password} onChange={v => set("password", v)} placeholder="Ang iyong password" type="password" />
        <button onClick={handleLogin} disabled={loading} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60 active:scale-95 transition-transform">
          {loading ? "Naglo-login..." : "Mag-login →"}
        </button>
        <button onClick={onForgotPassword} className="text-center text-sm text-green-700 font-medium py-2">
          Nakalimutan ang password? 🔑
        </button>
        <p className="text-center text-xs text-gray-400">Wala pang account? Makipag-ugnayan sa iyong owner.</p>
      </div>
    </div>
  );
}

// ─── Forgot Password Screen ────────────────────────────────────────────────────
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
        <button onClick={onBack} className="text-white text-xl">←</button>
        <h2 className="text-white font-bold text-lg">Nakalimutan ang Password</h2>
      </div>
      <div className="flex-1 flex flex-col justify-center px-5 py-6 max-w-md mx-auto w-full space-y-4">
        <div className="text-center mb-2">
          <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🔑</span>
          </div>
          <h3 className="font-black text-gray-800 text-lg">I-reset ang Password</h3>
          <p className="text-sm text-gray-500 mt-1">Magpapadala kami ng OTP code sa iyong email.</p>
        </div>
        <Field label="Email Address" value={email} onChange={setEmail} placeholder="juan@email.com" type="email" />
        <button onClick={handleSend} disabled={loading} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60 active:scale-95 transition-transform">
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

// ─── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-40">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-base">{title}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>
        <div className="px-5 py-5 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`}>{children}</div>;
}

function StatCard({ icon, label, value, color = "bg-green-50 text-green-700" }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-lg font-black text-gray-800">{value}</p>
      </div>
    </Card>
  );
}

// ─── Owner Dashboard ───────────────────────────────────────────────────────────
function OwnerDashboard({ profile, business, isSuperAdmin, onLogout, showToast, onShowAdmin }) {
  const [tab, setTab] = useState("dashboard");
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [b, p, s] = await Promise.all([
      supabase.from("branches").select("*").eq("business_id", business.id).order("created_at"),
      supabase.from("products").select("*").eq("business_id", business.id).order("name"),
      supabase.from("profiles").select("*").eq("business_id", business.id).neq("role", "owner").order("full_name"),
    ]);
    setBranches(b.data || []);
    setProducts(p.data || []);
    setStaff(s.data || []);
    setLoading(false);
  }, [business.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const AddBranchModal = () => {
    const [form, setForm] = useState({ name: "", address: "" });
    const [saving, setSaving] = useState(false);
    const save = async () => {
      if (!form.name.trim()) return showToast("Ilagay ang pangalan ng branch.", "error");
      setSaving(true);
      const { error } = await supabase.from("branches").insert({ business_id: business.id, name: form.name.trim(), address: form.address.trim() });
      setSaving(false);
      if (error) return showToast("Hindi na-save. Subukan muli.", "error");
      showToast("Branch na-add!", "success");
      setShowAddBranch(false);
      fetchAll();
    };
    return (
      <Modal title="Magdagdag ng Branch" onClose={() => setShowAddBranch(false)}>
        <div className="space-y-4">
          <Field label="Pangalan ng Branch" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Iligan City Branch" />
          <Field label="Address" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="Lungsod, Probinsya" />
          <button onClick={save} disabled={saving} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl disabled:opacity-60">
            {saving ? "Sine-save..." : "I-save ang Branch"}
          </button>
        </div>
      </Modal>
    );
  };

  const ProductModal = ({ existing, onClose }) => {
    const [form, setForm] = useState({
      name: existing?.name || "", barcode: existing?.barcode || "",
      price: existing?.price || "", stock_quantity: existing?.stock_quantity || "",
      low_stock_threshold: existing?.low_stock_threshold || "10",
    });
    const [saving, setSaving] = useState(false);
    const save = async () => {
      if (!form.name.trim()) return showToast("Ilagay ang pangalan ng produkto.", "error");
      if (!form.price || isNaN(Number(form.price))) return showToast("Ilagay ang tamang presyo.", "error");
      setSaving(true);
      const payload = {
        business_id: business.id, name: form.name.trim(),
        barcode: form.barcode.trim() || null, price: Number(form.price),
        stock_quantity: Number(form.stock_quantity) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 10,
      };
      const { error } = existing
        ? await supabase.from("products").update(payload).eq("id", existing.id)
        : await supabase.from("products").insert(payload);
      setSaving(false);
      if (error) return showToast("Hindi na-save. Subukan muli.", "error");
      showToast(existing ? "Produkto na-update!" : "Produkto na-add!", "success");
      onClose(); fetchAll();
    };
    return (
      <Modal title={existing ? "I-edit ang Produkto" : "Magdagdag ng Produkto"} onClose={onClose}>
        <div className="space-y-4">
          <Field label="Pangalan ng Produkto" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Coca-Cola 1.5L" />
          <Field label="Barcode (opsyonal)" value={form.barcode} onChange={v => setForm(f => ({ ...f, barcode: v }))} placeholder="I-type ang barcode" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Presyo (₱)" value={form.price} onChange={v => setForm(f => ({ ...f, price: v }))} placeholder="0.00" type="number" />
            <Field label="Stock" value={form.stock_quantity} onChange={v => setForm(f => ({ ...f, stock_quantity: v }))} placeholder="0" type="number" />
          </div>
          <Field label="Low Stock Alert" value={form.low_stock_threshold} onChange={v => setForm(f => ({ ...f, low_stock_threshold: v }))} placeholder="10" type="number" />
          <button onClick={save} disabled={saving} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl disabled:opacity-60">
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
          email: form.email.trim(), password: tempPassword,
        });
        if (authError) throw authError;
        const userId = authData.user?.id;
        if (!userId) throw new Error("Hindi na-create ang user.");
        const { error: profileError } = await supabase.from("profiles").insert({
          id: userId, business_id: business.id, branch_id: form.branch_id,
          full_name: form.full_name.trim(), role: form.role,
        });
        if (profileError) throw profileError;
        showToast(`Na-invite! Temp password: ${tempPassword}`, "success");
        setShowAddStaff(false); fetchAll();
      } catch (err) {
        showToast(getErrorMessage(err), "error");
      } finally {
        setSaving(false);
      }
    };
    return (
      <Modal title="Mag-invite ng Staff" onClose={() => setShowAddStaff(false)}>
        <div className="space-y-4">
          <Field label="Buong Pangalan" value={form.full_name} onChange={v => setForm(f => ({ ...f, full_name: v }))} placeholder="Maria Santos" />
          <Field label="Email ng Staff" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="maria@email.com" type="email" />
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="cashier">Cashier</option>
              <option value="inventory_staff">Inventory Staff</option>
              <option value="branch_manager">Branch Manager</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Branch</label>
            <select value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">— Pumili ng Branch —</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          {branches.length === 0 && <p className="text-xs text-yellow-600 bg-yellow-50 rounded-lg px-3 py-2">⚠️ Gumawa muna ng branch.</p>}
          <button onClick={save} disabled={saving || branches.length === 0} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl disabled:opacity-60">
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
          <button onClick={onLogout} className="bg-green-800 bg-opacity-50 text-green-100 text-xs px-3 py-2 rounded-xl font-medium">
            Logout
          </button>
        </div>
        <p className="text-green-300 text-xs">Maligayang pagdating, {profile.full_name.split(" ")[0]}! 👋</p>
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
                <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Pangkalahatang Buod</h2>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon="₱" label="Kita Ngayon" value="₱0.00" color="bg-green-50 text-green-700" />
                  <StatCard icon="📦" label="Mga Produkto" value={products.length} color="bg-blue-50 text-blue-700" />
                  <StatCard icon="🏪" label="Mga Branch" value={branches.length} color="bg-purple-50 text-purple-700" />
                  <StatCard icon="👥" label="Mga Staff" value={staff.length} color="bg-yellow-50 text-yellow-700" />
                </div>
                {branches.length === 0 && (
                  <Card className="p-4 border-l-4 border-yellow-400">
                    <p className="text-sm font-semibold text-gray-700">Simulan ang Setup 🚀</p>
                    <p className="text-xs text-gray-500 mt-1">Gumawa ng branch, magdagdag ng produkto, at mag-invite ng staff.</p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setTab("branches")} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium">Gumawa ng Branch</button>
                      <button onClick={() => setTab("products")} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-medium">Magdagdag ng Produkto</button>
                    </div>
                  </Card>
                )}
                {branches.length > 0 && (
                  <div>
                    <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3">Mga Branch</h2>
                    <div className="space-y-2">
                      {branches.map(b => (
                        <Card key={b.id} className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{b.name}</p>
                            <p className="text-xs text-gray-400">{b.address || "Walang address"}</p>
                          </div>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">Active</span>
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
                  <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">{products.length} Produkto</h2>
                  <button onClick={() => setShowAddProduct(true)} className="bg-green-600 text-white text-xs px-3 py-2 rounded-xl font-bold">+ Magdagdag</button>
                </div>
                {products.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-3xl mb-2">📦</p>
                    <p className="font-semibold text-gray-600 text-sm">Wala pang produkto</p>
                  </Card>
                ) : products.map(p => (
                  <Card key={p.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.barcode ? `Barcode: ${p.barcode}` : "Walang barcode"}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-sm font-black text-green-700">₱{Number(p.price).toFixed(2)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.stock_quantity <= p.low_stock_threshold ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"}`}>
                            {p.stock_quantity <= p.low_stock_threshold ? "⚠️ " : ""}Stock: {p.stock_quantity}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-2">
                        <button onClick={() => setEditProduct(p)} className="text-xs bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg font-medium">I-edit</button>
                        <button onClick={() => deleteProduct(p.id)} className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg font-medium">Burahin</button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {tab === "branches" && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">{branches.length} Branch</h2>
                  <button onClick={() => setShowAddBranch(true)} className="bg-green-600 text-white text-xs px-3 py-2 rounded-xl font-bold">+ Magdagdag</button>
                </div>
                {branches.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-3xl mb-2">🏪</p>
                    <p className="font-semibold text-gray-600 text-sm">Wala pang branch</p>
                  </Card>
                ) : branches.map(b => (
                  <Card key={b.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-gray-800">{b.name}</p>
                        <p className="text-xs text-gray-400">{b.address || "Walang address"}</p>
                        <p className="text-xs text-gray-400">{staff.filter(s => s.branch_id === b.id).length} staff</p>
                      </div>
                      <button onClick={() => deleteBranch(b.id)} className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg font-medium ml-2">Burahin</button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {tab === "staff" && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">{staff.length} Staff</h2>
                  <button onClick={() => setShowAddStaff(true)} className="bg-green-600 text-white text-xs px-3 py-2 rounded-xl font-bold">+ Mag-invite</button>
                </div>
                {staff.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-3xl mb-2">👥</p>
                    <p className="font-semibold text-gray-600 text-sm">Wala pang staff</p>
                  </Card>
                ) : staff.map(s => {
                  const branchName = branches.find(b => b.id === s.branch_id)?.name || "Walang branch";
                  return (
                    <Card key={s.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{s.full_name}</p>
                          <p className="text-xs text-gray-400">{branchName}</p>
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1.5 ${ROLE_COLORS[s.role]}`}>
                            {ROLE_LABELS[s.role]}
                          </span>
                        </div>
                        <button onClick={() => removeStaff(s.id)} className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg font-medium ml-2">Alisin</button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-100 flex items-center justify-around px-2 py-2 z-30">
        {TABS.map(item => (
          <button key={item.key} onClick={() => setTab(item.key)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${tab === item.key ? "bg-green-50 text-green-700" : "text-gray-400"}`}>
            <span className="text-xl">{item.icon}</span>
            <span className={`text-xs font-medium ${tab === item.key ? "text-green-700" : "text-gray-400"}`}>{item.label}</span>
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

// ─── Staff Dashboard ───────────────────────────────────────────────────────────
function StaffDashboard({ profile, business, branch, onLogout }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl">
          {profile.role === "cashier" ? "🧾" : profile.role === "inventory_staff" ? "📦" : "🏪"}
        </div>
        <h1 className="text-2xl font-black text-gray-800">{business.name}</h1>
        <p className="text-gray-500 text-sm mt-1">{branch?.name || "Walang branch"}</p>
        <span className={`inline-block mt-2 text-xs px-3 py-1 rounded-full font-semibold ${ROLE_COLORS[profile.role]}`}>
          {ROLE_LABELS[profile.role]}
        </span>
        <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-5 text-left space-y-3 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Impormasyon</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Pangalan</span>
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
          <p className="text-sm font-semibold text-yellow-800">🚧 POS at Inventory</p>
          <p className="text-xs text-yellow-600 mt-1">Darating sa Phase 2. Abangan!</p>
        </div>
        <button onClick={onLogout} className="mt-6 w-full bg-gray-100 text-gray-600 font-semibold py-3 rounded-2xl text-sm">Mag-logout</button>
      </div>
    </div>
  );
}

// ─── ROOT APP ──────────────────────────────────────────────────────────────────
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadUserData(session.user.id);
      else {
        setProfile(null); setBusiness(null); setBranch(null);
        setIsSuperAdmin(false); setScreen("landing"); setAppLoading(false);
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
        if (data) { prof = data; break; }
        await new Promise(r => setTimeout(r, 1000));
      }
      if (!prof) { showToast("Hindi mahanap ang profile. Subukan muli.", "error"); setAppLoading(false); return; }
      setProfile(prof);

      const { data: biz } = await supabase.from("businesses").select("*").eq("id", prof.business_id).single();
      setBusiness(biz);

      if (prof.branch_id) {
        const { data: br } = await supabase.from("branches").select("*").eq("id", prof.branch_id).single();
        setBranch(br);
      }

      // Check if super admin
      const { data: sa } = await supabase.from("super_admins").select("id").eq("user_id", userId).single();
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
    setOtpEmail(email); setOtpType(type); setScreen("otp");
  };

  if (appLoading) return <Spinner />;

  // ── Logged in ──
  if (session && profile && business) {
    // Super admin always gets full access
    if (!isSuperAdmin) {
      if (business.status === "pending") return (
        <>
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          <PendingScreen business={business} onLogout={handleLogout} />
        </>
      );
      if (business.status === "rejected") return (
        <>
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          <RejectedScreen business={business} onLogout={handleLogout} />
        </>
      );
      if (business.status === "suspended") return (
        <>
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          <RejectedScreen business={{ ...business, rejection_reason: "Ang iyong account ay naka-suspend. Makipag-ugnayan sa aming team." }} onLogout={handleLogout} />
        </>
      );
      if (isTrialExpired(business)) return (
        <>
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          <TrialExpiredScreen business={business} onLogout={handleLogout} />
        </>
      );
    }

    return (
      <>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        {profile.role === "owner"
          ? <OwnerDashboard profile={profile} business={business} isSuperAdmin={isSuperAdmin} onLogout={handleLogout} showToast={showToast} />
          : <StaffDashboard profile={profile} business={business} branch={branch} onLogout={handleLogout} />
        }
      </>
    );
  }

  // ── Not logged in ──
  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {screen === "landing" && <LandingScreen onShowSignup={() => setScreen("signup")} onShowLogin={() => setScreen("login")} />}
      {screen === "signup" && <SignupScreen onBack={() => setScreen("landing")} onSuccess={() => setScreen("login")} showToast={showToast} />}
      {screen === "login" && <LoginScreen onBack={() => setScreen("landing")} onSuccess={() => {}} onForgotPassword={() => setScreen("forgot")} showToast={showToast} />}
      {screen === "forgot" && <ForgotPasswordScreen onBack={() => setScreen("login")} onVerifyOTP={goToOTP} showToast={showToast} />}
      {screen === "otp" && (
        <OTPScreen email={otpEmail} type={otpType}
          onBack={() => setScreen(otpType === "forgot" ? "forgot" : "login")}
          onSuccess={(next) => setScreen(next || "login")}
          showToast={showToast}
        />
      )}
    </>
  );
}
