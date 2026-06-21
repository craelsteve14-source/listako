# ListaKo — Claude Code Context File
**READ THIS FIRST before doing anything.**
Last Updated: June 21, 2026

---

## WHO YOU ARE WORKING WITH
- **Builder:** Crael Steve B. Lom-oc
- **Institution:** MSU-IIT, Iligan City, Philippines
- **Device:** Redmi Android tablet ONLY — no computer, no terminal
- **Code editing:** GitHub browser interface only
- **You (Claude Code) handle:** All file edits, commits, and deployments directly

---

## THE APP — LISTAKO
ListaKo is a Filipino-first business management PWA for grocery and sari-sari store owners in the Philippines. It handles inventory, POS transactions, branch management, staff access control, and business analytics.

---

## LIVE CREDENTIALS

### Vercel
- **Live URL:** listako-rouge.vercel.app
- **Project:** listako (craelsteve14-8173s-projects team)

### GitHub
- **Repo:** github.com/craelsteve14-source/listako
- **Branch:** main
- **Main file:** src/App.jsx (all app code in one file)

### Supabase
- **Project ID:** jbkqheprkehhjtrhwggf
- **Region:** ap-southeast-1 (Singapore)
- **URL:** https://jbkqheprkehhjtrhwggf.supabase.co
- **Anon Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impia3FoZXBya2VoaGp0cmh3Z2dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTYxNzgsImV4cCI6MjA5NzQ3MjE3OH0.aOdw3Nfy93hXddKKXfQsk8UxvjUIkgEldgiSMiwvOBA

### Vercel Environment Variables (already set)
```
VITE_SUPABASE_URL=https://jbkqheprkehhjtrhwggf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Test Accounts
| Role | Email | Password |
|------|-------|----------|
| Owner + Super Admin | craelsteve14@gmail.com | listako2024 |
| Test Cashier | romeobehagan@gmail.co | cashier2024 |

### Super Admin Config (hardcoded in App.jsx)
```javascript
const SUPER_ADMIN_EMAIL = "craelsteve14@gmail.com";
const ADMIN_GCASH = "09530897696";
const ADMIN_PHONE = "09530897696";
```

---

## ⚠️ DO NOT TOUCH — SEPARATE PROJECT
- **Master Review Academy** — Supabase project `ztgtrvodalesxqbmrrqd`
- Has real user data (users table + quiz_progress table)
- Completely separate from ListaKo
- Never modify this project

---

## CURRENT BUILD STATUS

### ✅ Phase 1 — Foundation (COMPLETE)
- Auth, signup, admin approval, trial system
- Owner dashboard (Dashboard, Products, Branch, Staff tabs)
- Super Admin panel
- Multi-tenant RLS architecture

### ✅ Phase 2 — POS Core (COMPLETE)
- Cashier POS screen
- Product search + barcode scanner UI
- Cart system with quantity controls
- Checkout with Cash/GCash/Maya/Card/Utang
- Receipt generation
- Stock deduction

### ✅ Phase 3 — Critical Fixes (COMPLETE)
- Real revenue on owner dashboard
- Stock validation (prevents overselling)
- Void transactions with reason
- Utang with customer name (required)
- Utang tracking tab
- Recent transactions on dashboard

### 🔴 IMMEDIATE ISSUE — BUILD ERROR
**The app is currently broken on Vercel.**
- Error: `App.jsx:1623:6 — Expected "finally" but found "setReceiptItems"`
- This is a Vite/esbuild parse error
- The correct fixed file exists but may not be committed yet
- **Fix this first before anything else**
- After fixing, verify live at listako-rouge.vercel.app

---

## TECH STACK (NEVER CHANGE THESE)
```
Frontend:    React + Vite
Styling:     Tailwind CSS
Backend:     Supabase (Postgres + Auth + RLS)
Deployment:  Vercel (auto-deploy from GitHub push)
AI:          Claude API (claude-sonnet-4-6)
```

---

## FILE STRUCTURE
```
listako/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── App.jsx          ← MAIN FILE — entire app in one file
    ├── main.jsx
    └── index.css
```

---

## DATABASE TABLES (Supabase)
```sql
businesses        -- Each store owner's business (tenant)
branches          -- Branches per business
profiles          -- All users with roles
products          -- Product catalog per business
transactions      -- All sales transactions
transaction_items -- Line items per transaction
utang_records     -- Customer credit tracking
daily_reports     -- End of day summaries
super_admins      -- Crael's admin access
```

### Important Notes
- RLS is currently DISABLED on all tables (done for stability fix)
- Must be properly re-enabled in Phase 8
- businesses table has: status, trial_ends_at, plan, rejection_reason columns
- transactions table has: voided_at, voided_by, void_reason, customer_name, customer_phone columns

---

## USER ROLES
```
owner           → Full access, all branches, admin features
branch_manager  → Their branch only
inventory_staff → Stock management only
cashier         → POS only (CashierPOS component)
```

---

## BUSINESS MODEL
- 7-day free trial on approval
- Plans: Basic ₱199 / Pro ₱399 / Business ₱699 per month
- Payment: Manual GCash/Maya to 09530897696
- Crael approves all accounts manually via Admin Panel
- PayMongo integration planned at 50+ subscribers

---

## COMPLETE ROADMAP

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation — Auth, signup, admin, trial | ✅ Done |
| 2 | POS Core — Barcode, cart, checkout, receipt | ✅ Done |
| 3 | Critical Fixes — Revenue, stock validation, void, utang | ✅ Done |
| 4 | Payments Deep — Discounts, closing report, receipt share | 🔴 Next |
| 5 | Inventory — Categories, alerts, restock | Upcoming |
| 6 | Analytics — Revenue graphs, best sellers, reports | Upcoming |
| 7 | Multi-Branch — Unified dashboard, branch comparison | Upcoming |
| 8 | Security — RLS fix, session timeout, PIN lock | Upcoming |
| 9 | Advanced — Returns, offline PWA, PayMongo, barcode gen | Upcoming |
| 10 | Premium Design — Forest Prestige UI, Ledger Mark logo | Last |

---

## PHASE 4 — WHAT TO BUILD NEXT

### Priority 1 — Fix barcode scanner to actually read barcodes
- Install react-zxing library
- Integrate with existing BarcodeScanner component
- Test with real product barcodes

### Priority 2 — Discount system
- Fixed amount discount (e.g. ₱20 off)
- Percentage discount (e.g. 10% off)
- Applied at checkout before total
- Shown on receipt

### Priority 3 — Daily closing report
- Owner taps "Close Day" button
- System generates summary:
  - Total sales by payment method
  - Number of transactions
  - Total voided
  - Total utang recorded
- Saved to daily_reports table

### Priority 4 — Receipt sharing
- After receipt shown, "Share" button appears
- Opens native share sheet
- Can share via Messenger, SMS, Viber
- Receipt formatted as text message

### Priority 5 — GCash/Maya reference number
- When GCash or Maya selected at checkout
- Input field appears for reference number
- Saved with transaction for reconciliation

---

## KNOWN ISSUES TO FIX (All Phases)

### 🔴 Critical (Fix immediately)
1. Build error on Vercel — App.jsx line 1623
2. Barcode scanner camera opens but cannot read barcodes
3. RLS disabled — security risk (fix in Phase 8)

### 🟡 Important (Fix in upcoming phases)
4. Discount system missing (Phase 4)
5. Daily closing report missing (Phase 4)
6. Receipt cannot be printed or shared (Phase 4)
7. Product categories missing (Phase 5)
8. No push notifications for low stock (Phase 5)
9. No cash reconciliation (Phase 4)

### 🟢 Nice to Have (Later phases)
10. Session timeout after inactivity (Phase 8)
11. PIN lock for cashiers (Phase 8)
12. Return/refund system (Phase 9)
13. Product images (Phase 9)
14. Offline PWA capability (Phase 9)
15. PayMongo automatic payments (Phase 9)
16. Multiple price levels (Phase 9)
17. Best-seller analytics (Phase 6)
18. Per-cashier performance (Phase 6)
19. Shift tracking (Phase 6)
20. Data export/backup (Phase 9)

---

## DESIGN SYSTEM (Phase 10 — Apply Last)

### Colors — Forest Prestige
```
Deep Forest:  #0A2818  (primary bg, headers)
Forest:       #1A3D2B  (buttons, active states)
Antique Gold: #B8960C  (accents, highlights)
Warm Ivory:   #F5F0E8  (backgrounds, cards)
Deep Navy:    #0D1B2A  (admin panel header)
Deep Red:     #7A1515  (errors, critical)
```

### Typography
```
Headings:  Playfair Display (serif, weight 600-700)
Body:      Inter (sans-serif, weight 400-600)
Numbers:   Lato (weight 700-900)
```

### Logo — The Ledger Mark (Concept A)
```
Symbol: Three horizontal lines (decreasing) + gold diagonal slash + gold dot
Full:   Symbol + "ListaKo" in Playfair Display italic
Usage:  Full logo on landing page only
        Symbol only on all inner screens
        No emojis anywhere — SVG line icons only
```

---

## MISSING THINGS TO ADD BEFORE LAUNCH

1. **Privacy Policy page** — Required by RA 10173 (Philippine Data Privacy Act)
2. **Terms of Service page** — Required for subscription billing
3. **PWA icons** — pwa-192x192.png and pwa-512x512.png in /public folder
4. **Email confirmation** — Currently disabled, needs proper OTP flow
5. **Test data cleanup** — Remove test transactions from database
6. **Supabase activity** — Keep project active (auto-pauses after 7 days inactive)

---

## HOW TO WORK ON THIS PROJECT

### Priority Order (Always)
1. Fix bugs first
2. Build new features second
3. Stay on current phase
4. Never skip phases

### Code Rules
- All app code lives in `src/App.jsx` — single file approach
- Never use placeholder comments
- Always write complete, production-ready code
- After every change, verify at listako-rouge.vercel.app

### The Golden Rule
> Every decision must answer: "Does this make life easier for a Filipino grocery store owner?"

### Target User Profile
- Non-tech-savvy store owners in the Philippines
- May be using low-end Android phones
- Not all areas have stable internet (offline support critical)
- Language: English (professional and friendly)
- Age range: 25-55 years old

---

*ListaKo — Built by Crael Steve B. Lom-oc with Claude AI*
*MSU-IIT | Iligan City, Philippines | June 2026*
