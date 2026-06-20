import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase Client ───────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Role badge colors ─────────────────────────────────────────────────────────
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

// ─── Toast Notification ────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
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
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Landing / Sign In Screen ──────────────────────────────────────────────────
function LandingScreen({ onShowSignup, onShowLogin }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-700 via-green-600 to-emerald-500 flex flex-col items-center justify-between px-6 py-12">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {/* Logo */}
        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl mb-6">
          <span className="text-4xl">🛒</span>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight mb-1">ListaKo</h1>
        <p className="text-green-100 text-sm font-medium mb-2 tracking-widest uppercase">Business Manager</p>
        <p className="text-green-50 text-base mt-4 max-w-xs leading-relaxed">
          Para sa mga may-ari ng tindahan. Subaybayan ang benta, imbentaryo, at kita — kahit walang internet.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={onShowSignup}
          className="w-full bg-white text-green-700 font-bold py-4 rounded-2xl text-base shadow-lg active:scale-95 transition-transform"
        >
          Gumawa ng Account
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

// ─── Sign Up Screen (Owner only — staff are invited) ──────────────────────────
function SignupScreen({ onBack, onSuccess, showToast }) {
  const [step, setStep] = useState(1); // 1 = account info, 2 = business info
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
    if (form.password.length < 6) return showToast("Ang password ay dapat 6 na characters man lang.", "error");
    if (form.password !== form.confirm_password) return showToast("Hindi tugma ang passwords.", "error");
    setStep(2);
  };

  const handleSignup = async () => {
    if (!form.business_name.trim()) return showToast("Ilagay ang pangalan ng iyong negosyo.", "error");
    setLoading(true);
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
      });
      if (authError) throw authError;
      const userId = authData.user.id;

      // 2. Create business record
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

      // 3. Create owner profile
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
      showToast(err.message || "May error. Subukan muli.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-green-700 px-4 py-5 flex items-center gap-3">
        <button onClick={step === 1 ? onBack : () => setStep(1)} className="text-white text-xl">←</button>
        <div>
          <h2 className="text-white font-bold text-lg">Gumawa ng Account</h2>
          <p className="text-green-200 text-xs">Hakbang {step} ng 2</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-green-100">
        <div className={`h-1 bg-green-600 transition-all duration-300`} style={{ width: step === 1 ? "50%" : "100%" }} />
      </div>

      <div className="flex-1 px-5 py-6 space-y-4 max-w-md mx-auto w-full">
        {step === 1 ? (
          <>
            <p className="text-gray-500 text-sm mb-2">Impormasyon ng Account</p>
            <Field label="Buong Pangalan" value={form.full_name} onChange={(v) => set("full_name", v)} placeholder="Juan dela Cruz" />
            <Field label="Email Address" value={form.email} onChange={(v) => set("email", v)} placeholder="juan@email.com" type="email" />
            <Field label="Password" value={form.password} onChange={(v) => set("password", v)} placeholder="Min. 6 characters" type="password" />
            <Field label="Ulitin ang Password" value={form.confirm_password} onChange={(v) => set("confirm_password", v)} placeholder="Ilagay muli" type="password" />
            <button onClick={handleNext} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl mt-2 active:scale-95 transition-transform">
              Susunod →
            </button>
          </>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-2">Impormasyon ng Negosyo</p>
            <Field label="Pangalan ng Tindahan / Negosyo" value={form.business_name} onChange={(v) => set("business_name", v)} placeholder="Halimbawa: Rosa's Grocery" />
            <Field label="Address ng Negosyo" value={form.business_address} onChange={(v) => set("business_address", v)} placeholder="Iligan City, Lanao del Norte" />
            <Field label="Numero ng Telepono (opsyonal)" value={form.business_phone} onChange={(v) => set("business_phone", v)} placeholder="09XXXXXXXXX" type="tel" />
            <button onClick={handleSignup} disabled={loading} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl mt-2 active:scale-95 transition-transform disabled:opacity-60">
              {loading ? "Ginagawa ang account..." : "Gumawa ng Account ✓"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onBack, onSuccess, showToast }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleLogin = async () => {
    if (!form.email.trim() || !form.password) return showToast("Kumpletuhin ang email at password.", "error");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (error) throw error;
      onSuccess();
    } catch (err) {
      showToast("Mali ang email o password. Subukan muli.", "error");
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
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🔐</span>
          </div>
          <p className="text-gray-500 text-sm">I-enter ang iyong ListaKo credentials</p>
        </div>
        <Field label="Email Address" value={form.email} onChange={(v) => set("email", v)} placeholder="juan@email.com" type="email" />
        <Field label="Password" value={form.password} onChange={(v) => set("password", v)} placeholder="Ang iyong password" type="password" />
        <button onClick={handleLogin} disabled={loading} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform disabled:opacity-60">
          {loading ? "Naglo-login..." : "Mag-login →"}
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">
          Wala pang account? Makipag-ugnayan sa iyong owner.
        </p>
      </div>
    </div>
  );
}

// ─── Reusable Field ────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
      />
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-40 px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-base">{title}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl font-light">✕</button>
        </div>
        <div className="px-5 py-5 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ─── Section Card ──────────────────────────────────────────────────────────────
function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`}>{children}</div>;
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
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

// ─── OWNER DASHBOARD ───────────────────────────────────────────────────────────
function OwnerDashboard({ profile, business, onLogout, showToast }) {
  const [tab, setTab] = useState("dashboard"); // dashboard | products | branches | staff
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [stats, setStats] = useState({ revenue: 0, products: 0, branches: 0, staff: 0 });
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [b, p, s] = await Promise.all([
      supabase.from("branches").select("*").eq("business_id", business.id).order("created_at"),
      supabase.from("products").select("*").eq("business_id", business.id).order("name"),
      supabase.from("profiles").select("*").eq("business_id", business.id).neq("role", "owner").order("full_name"),
    ]);
    setBranches(b.data || []);
    setProducts(p.data || []);
    setStaff(s.data || []);
    setStats({
      revenue: 0,
      products: (p.data || []).length,
      branches: (b.data || []).length,
      staff: (s.data || []).length,
    });
    setLoading(false);
  };

  // ── Add Branch ──
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
          <Field label="Pangalan ng Branch" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} placeholder="Halimbawa: Iligan City Branch" />
          <Field label="Address" value={form.address} onChange={(v) => setForm(f => ({ ...f, address: v }))} placeholder="Lungsod, Probinsya" />
          <button onClick={save} disabled={saving} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl disabled:opacity-60">
            {saving ? "Sine-save..." : "I-save ang Branch"}
          </button>
        </div>
      </Modal>
    );
  };

  // ── Add / Edit Product ──
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
      if (!form.price || isNaN(Number(form.price))) return showToast("Ilagay ang tamang presyo.", "error");
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
      <Modal title={existing ? "I-edit ang Produkto" : "Magdagdag ng Produkto"} onClose={onClose}>
        <div className="space-y-4">
          <Field label="Pangalan ng Produkto" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} placeholder="Halimbawa: Coca-Cola 1.5L" />
          <Field label="Barcode (opsyonal)" value={form.barcode} onChange={(v) => setForm(f => ({ ...f, barcode: v }))} placeholder="I-scan o i-type ang barcode" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Presyo (₱)" value={form.price} onChange={(v) => setForm(f => ({ ...f, price: v }))} placeholder="0.00" type="number" />
            <Field label="Stock" value={form.stock_quantity} onChange={(v) => setForm(f => ({ ...f, stock_quantity: v }))} placeholder="0" type="number" />
          </div>
          <Field label="Low Stock Alert (bilang)" value={form.low_stock_threshold} onChange={(v) => setForm(f => ({ ...f, low_stock_threshold: v }))} placeholder="10" type="number" />
          <button onClick={save} disabled={saving} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl disabled:opacity-60">
            {saving ? "Sine-save..." : existing ? "I-update ang Produkto" : "I-save ang Produkto"}
          </button>
        </div>
      </Modal>
    );
  };

  // ── Invite Staff ──
  const AddStaffModal = () => {
    const [form, setForm] = useState({ full_name: "", email: "", role: "cashier", branch_id: "" });
    const [saving, setSaving] = useState(false);
    const save = async () => {
      if (!form.full_name.trim()) return showToast("Ilagay ang pangalan ng staff.", "error");
      if (!form.email.trim()) return showToast("Ilagay ang email ng staff.", "error");
      if (!form.branch_id) return showToast("Pumili ng branch para sa staff.", "error");
      setSaving(true);
      try {
        // Create auth user via admin invite (uses Supabase magic link)
        const tempPassword = "ListaKo" + Math.random().toString(36).slice(2, 8) + "!";
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: tempPassword,
          options: { data: { invited_by: business.id } }
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

        showToast(`Staff na-invite! Ipadala ang password: ${tempPassword}`, "success");
        setShowAddStaff(false);
        fetchAll();
      } catch (err) {
        showToast(err.message || "May error. Subukan muli.", "error");
      } finally {
        setSaving(false);
      }
    };

    return (
      <Modal title="Mag-invite ng Staff" onClose={() => setShowAddStaff(false)}>
        <div className="space-y-4">
          <Field label="Buong Pangalan" value={form.full_name} onChange={(v) => setForm(f => ({ ...f, full_name: v }))} placeholder="Maria Santos" />
          <Field label="Email ng Staff" value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} placeholder="maria@email.com" type="email" />
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Role</label>
            <select value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="cashier">Cashier</option>
              <option value="inventory_staff">Inventory Staff</option>
              <option value="branch_manager">Branch Manager</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Branch</label>
            <select value={form.branch_id} onChange={(e) => setForm(f => ({ ...f, branch_id: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">— Pumili ng Branch —</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          {branches.length === 0 && (
            <p className="text-xs text-yellow-600 bg-yellow-50 rounded-lg px-3 py-2">⚠️ Gumawa muna ng branch bago mag-invite ng staff.</p>
          )}
          <button onClick={save} disabled={saving || branches.length === 0} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl disabled:opacity-60">
            {saving ? "Sine-send..." : "Mag-invite ng Staff"}
          </button>
        </div>
      </Modal>
    );
  };

  // ── Delete product ──
  const deleteProduct = async (id) => {
    if (!window.confirm("Tanggalin ang produktong ito?")) return;
    await supabase.from("products").delete().eq("id", id);
    showToast("Produkto natanggal.", "success");
    fetchAll();
  };

  // ── Delete branch ──
  const deleteBranch = async (id) => {
    if (!window.confirm("Tanggalin ang branch na ito? Matatanggal din ang lahat ng datos nito.")) return;
    await supabase.from("branches").delete().eq("id", id);
    showToast("Branch natanggal.", "success");
    fetchAll();
  };

  // ── Remove staff ──
  const removeStaff = async (id) => {
    if (!window.confirm("Alisin ang staff na ito sa iyong negosyo?")) return;
    await supabase.from("profiles").delete().eq("id", id);
    showToast("Staff naalis na.", "success");
    fetchAll();
  };

  const TAB_ITEMS = [
    { key: "dashboard", icon: "📊", label: "Dashboard" },
    { key: "products", icon: "📦", label: "Produkto" },
    { key: "branches", icon: "🏪", label: "Branch" },
    { key: "staff", icon: "👥", label: "Staff" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-green-200 text-xs font-medium uppercase tracking-widest">Owner</p>
            <h1 className="text-white font-black text-xl leading-tight">{business.name}</h1>
          </div>
          <button onClick={onLogout} className="bg-green-800 bg-opacity-50 text-green-100 text-xs px-3 py-2 rounded-xl font-medium">
            Logout
          </button>
        </div>
        <p className="text-green-300 text-xs">Maligayang pagdating, {profile.full_name.split(" ")[0]}! 👋</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {tab === "dashboard" && (
              <div className="p-4 space-y-4">
                <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Pangkalahatang Buod</h2>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon="₱" label="Kita Ngayon" value="₱0.00" color="bg-green-50 text-green-700" />
                  <StatCard icon="📦" label="Mga Produkto" value={stats.products} color="bg-blue-50 text-blue-700" />
                  <StatCard icon="🏪" label="Mga Branch" value={stats.branches} color="bg-purple-50 text-purple-700" />
                  <StatCard icon="👥" label="Mga Staff" value={stats.staff} color="bg-yellow-50 text-yellow-700" />
                </div>

                {/* Quick notice if setup is incomplete */}
                {stats.branches === 0 && (
                  <Card className="p-4 border-l-4 border-yellow-400">
                    <p className="text-sm font-semibold text-gray-700">Simulan ang Setup 🚀</p>
                    <p className="text-xs text-gray-500 mt-1">Gumawa ng branch, magdagdag ng produkto, at mag-invite ng staff para magsimula.</p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setTab("branches")} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium">Gumawa ng Branch</button>
                      <button onClick={() => setTab("products")} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-medium">Magdagdag ng Produkto</button>
                    </div>
                  </Card>
                )}

                {/* Branch summary */}
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
                    <p className="text-xs text-gray-400 mt-1">I-click ang "Magdagdag" para magsimula.</p>
                  </Card>
                ) : (
                  products.map(p => (
                    <Card key={p.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{p.barcode ? `Barcode: ${p.barcode}` : "Walang barcode"}</p>
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
                  ))
                )}
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
                    <p className="text-xs text-gray-400 mt-1">Gumawa ng branch para makapag-assign ng staff.</p>
                  </Card>
                ) : (
                  branches.map(b => (
                    <Card key={b.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-gray-800">{b.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{b.address || "Walang address"}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {staff.filter(s => s.branch_id === b.id).length} staff
                          </p>
                        </div>
                        <button onClick={() => deleteBranch(b.id)} className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg font-medium ml-2">Burahin</button>
                      </div>
                    </Card>
                  ))
                )}
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
                    <p className="text-xs text-gray-400 mt-1">Mag-invite ng cashier, inventory staff, o branch manager.</p>
                  </Card>
                ) : (
                  staff.map(s => {
                    const branchName = branches.find(b => b.id === s.branch_id)?.name || "Walang branch";
                    return (
                      <Card key={s.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{s.full_name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{branchName}</p>
                            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1.5 ${ROLE_COLORS[s.role]}`}>
                              {ROLE_LABELS[s.role]}
                            </span>
                          </div>
                          <button onClick={() => removeStaff(s.id)} className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg font-medium ml-2">Alisin</button>
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

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-100 flex items-center justify-around px-2 py-2 z-30">
        {TAB_ITEMS.map(item => (
          <button key={item.key} onClick={() => setTab(item.key)} className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${tab === item.key ? "bg-green-50 text-green-700" : "text-gray-400"}`}>
            <span className="text-xl">{item.icon}</span>
            <span className={`text-xs font-medium ${tab === item.key ? "text-green-700" : "text-gray-400"}`}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Modals */}
      {showAddBranch && <AddBranchModal />}
      {showAddProduct && <ProductModal onClose={() => setShowAddProduct(false)} />}
      {editProduct && <ProductModal existing={editProduct} onClose={() => setEditProduct(null)} />}
      {showAddStaff && <AddStaffModal />}
    </div>
  );
}

// ─── STAFF DASHBOARD (Cashier / Inventory / Branch Manager) ───────────────────
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
          <p className="text-xs text-yellow-600 mt-1">Darating sa Phase 2. Abangan ang update!</p>
        </div>

        <button onClick={onLogout} className="mt-6 w-full bg-gray-100 text-gray-600 font-semibold py-3 rounded-2xl text-sm">
          Mag-logout
        </button>
      </div>
    </div>
  );
}

// ─── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("landing"); // landing | login | signup
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [business, setBusiness] = useState(null);
  const [branch, setBranch] = useState(null);
  const [appLoading, setAppLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => setToast({ message, type });

  // ── Auth state listener ──
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
        setScreen("landing"); setAppLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId) => {
    setAppLoading(true);
    try {
      // Load profile
      const { data: prof, error: profError } = await supabase
        .from("profiles").select("*").eq("id", userId).single();
      if (profError || !prof) throw new Error("Profile not found");
      setProfile(prof);

      // Load business
      const { data: biz } = await supabase
        .from("businesses").select("*").eq("id", prof.business_id).single();
      setBusiness(biz);

      // Load branch if staff
      if (prof.branch_id) {
        const { data: br } = await supabase
          .from("branches").select("*").eq("id", prof.branch_id).single();
        setBranch(br);
      }
    } catch (err) {
      console.error("Error loading user data:", err);
      showToast("May error sa pag-load ng account. Mag-login muli.", "error");
      await supabase.auth.signOut();
    } finally {
      setAppLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setScreen("landing");
  };

  // ── Loading ──
  if (appLoading) return <Spinner />;

  // ── Logged in ──
  if (session && profile && business) {
    if (profile.role === "owner") {
      return (
        <>
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          <OwnerDashboard profile={profile} business={business} onLogout={handleLogout} showToast={showToast} />
        </>
      );
    }
    return (
      <>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <StaffDashboard profile={profile} business={business} branch={branch} onLogout={handleLogout} />
      </>
    );
  }

  // ── Not logged in ──
  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {screen === "landing" && (
        <LandingScreen onShowSignup={() => setScreen("signup")} onShowLogin={() => setScreen("login")} />
      )}
      {screen === "signup" && (
        <SignupScreen onBack={() => setScreen("landing")} onSuccess={() => setScreen("login")} showToast={showToast} />
      )}
      {screen === "login" && (
        <LoginScreen onBack={() => setScreen("landing")} onSuccess={() => {}} showToast={showToast} />
      )}
    </>
  );
}
