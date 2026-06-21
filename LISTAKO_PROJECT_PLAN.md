# ListaKo — Complete Project Plan
**Filipino-First Business Management Ecosystem**
Builder: Crael Steve B. Lom-oc | MSU-IIT | Iligan City, Philippines
Last Updated: June 21, 2026

---

## 1. PROJECT OVERVIEW

### Vision
To replace the traditional paper-and-pencil method used by Filipino grocery store owners with a smart, affordable, and easy-to-use digital system that grows with their business.

### What ListaKo Is
ListaKo is a Progressive Web App (PWA) built for Filipino grocery and sari-sari store owners. It has four integrated modules:

| Module | Description |
|--------|-------------|
| ListaKo Bookkeeping | Tracks income, expenses, and utang (customer credit) |
| ListaKo POS | Barcode scanning, checkout processing, receipt printing |
| ListaKo Inventory | Real-time stock tracking, low stock alerts, restock management |
| ListaKo Dashboard | Revenue graphs, sales insights, multi-branch analytics |

### The Problem We Solve

| Problem | Impact |
|---------|--------|
| Store owners use paper and pencil | Prone to error, data loss, slow checkout |
| No real-time inventory tracking | Products run out without warning |
| No revenue insights | Owner cannot make data-driven decisions |
| Manual price calculation | Slow service, long queues |
| No multi-branch visibility | Owners with multiple stores have no unified view |

---

## 2. TARGET USERS

- Filipino grocery store owners
- Sari-sari store owners
- Informal online sellers
- Location: Philippines (primary target: Mindanao)
- Device: Mobile-first PWA, must work on low-end Android devices
- Language: English (professional and friendly)

---

## 3. TECH STACK

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + Vite | Fast, component-based UI |
| Styling | Tailwind CSS | Clean and responsive design |
| Backend / DB | Supabase | Auth, database, real-time sync |
| Deployment | Vercel | Auto-deploy from GitHub |
| AI Features | Claude API (claude-sonnet-4-6) | Natural language parser |
| Barcode Scanning | react-zxing / QuaggaJS | Camera-based barcode reading |
| Receipt Printing | React-to-Print / ESC/POS | Print to thermal printers |
| Version Control | GitHub | Code storage |
| PWA | vite-plugin-pwa | Offline capability |
| Offline Storage | idb (IndexedDB) | Offline transaction queue |

### Live URLs
- **App:** listako-rouge.vercel.app
- **GitHub:** github.com/craelsteve14-source/listako
- **Supabase Project:** jbkqheprkehhjtrhwggf (Singapore — ap-southeast-1)
- **Supabase URL:** https://jbkqheprkehhjtrhwggf.supabase.co

### Builder Setup
- Device: Redmi Android tablet (only device — no computer)
- Code editing: GitHub browser interface
- Deployment: Vercel auto-build on GitHub push
- No terminal access — all done via browser

---

## 4. DATABASE STRUCTURE

### Tables
```
businesses          → Each store owner's business (the tenant)
branches            → Store branches under each business
profiles            → All users (owner + staff) with roles
products            → Products catalog per business
transactions        → Every sale transaction
transaction_items   → Individual items in each transaction
utang_records       → Customer credit tracking
daily_reports       → End of day summaries
super_admins        → Crael's admin access table
```

### Multi-Tenant Architecture
- Every table has a `business_id` column
- Row Level Security (RLS) ensures zero data crossover between businesses
- Owner A can never see Owner B's data
- Each business is completely isolated

### User Roles
| Role | Access Level | Key Permissions |
|------|-------------|-----------------|
| Owner | Full Access | All branches, all data, staff management |
| Branch Manager | Branch Level | Their branch only, manage staff |
| Inventory Staff | Inventory Only | Update stock, receive alerts |
| Cashier | POS Only | Scan products, process checkout, print receipts |

---

## 5. SUPER ADMIN CONFIGURATION

- **Super Admin:** Crael Steve B. Lom-oc
- **Email:** craelsteve14@gmail.com
- **GCash/Maya Number:** 09530897696
- **SMS Alert Number:** 09530897696
- **Admin Panel URL:** listako-rouge.vercel.app (👑 Admin tab in dashboard)

### Super Admin Powers
- Approve or decline new business signups
- Extend trial periods
- Upgrade subscription plans
- Suspend or restore accounts
- See all businesses across the platform

---

## 6. BUSINESS MODEL

### Account Approval Flow
```
Owner signs up
      ↓
Account status = "pending"
      ↓
Crael receives email + SMS notification
      ↓
Crael reviews in Admin Panel
      ↓
Crael taps "Activate" or "Decline"
      ↓
Owner gets notified
      ↓
7-day free trial begins
```

### Trial System
- Every approved account gets **7 days free trial**
- Full access to all features during trial
- Countdown banner shows days remaining
- After trial — account locked until subscription payment

### Subscription Plans (Launch Pricing)
| Plan | Price | Branches | Staff | Best For |
|------|-------|----------|-------|----------|
| Basic | ₱199/month | 1 | 5 | Small sari-sari stores |
| Pro | ₱399/month | 3 | 15 | Growing grocery stores |
| Business | ₱699/month | Unlimited | Unlimited | Multi-branch operators |

### Launch Promo (After All Phases Complete)
- First 50 subscribers: ₱99/month for 3 months
- Then regular pricing kicks in
- Creates urgency and gets early adopters

### Payment Method (Manual — Direct to Crael)
- Customer sends GCash/Maya to **09530897696**
- Sends receipt screenshot to **craelsteve14@gmail.com**
- Crael approves in Admin Panel
- Account unlocked within 24 hours
- **PayMongo automatic payments** to be integrated at 50+ subscribers

### When to Launch
Launch ONLY after all Phases 1-9 are complete and tested by real store owners.

---

## 7. PWA (PROGRESSIVE WEB APP) PLAN

### What This Means
ListaKo behaves like a native app:
- Installable via "Add to Home Screen" — no app store needed
- Opens full screen — no browser bar
- Works offline — no internet required
- Syncs when connection restores

### Offline Architecture
```
[Device / Phone]
    └── Service Worker (caches app assets)
    └── IndexedDB / idb library (stores offline transactions)

[When Internet Returns]
    └── Auto-sync to Supabase
    └── Owner dashboard updates with all branch data
```

### Files Needed
- `vite-plugin-pwa` — generates service worker
- `idb` library — IndexedDB wrapper
- `public/pwa-192x192.png` — app icon (192x192)
- `public/pwa-512x512.png` — app icon (512x512)

### Future: Google Play Store
- Wrap PWA using Trusted Web Activity (TWA)
- Submit to Google Play Store
- ListaKo appears like a real native app

---

## 8. DESIGN SYSTEM — FOREST PRESTIGE

*To be applied in Phase 10 after all features are complete.*

### Color Palette
| Name | Hex | Usage |
|------|-----|-------|
| Deep Forest | #0A2818 | Primary background, headers |
| Forest | #1A3D2B | Secondary green, buttons |
| Accent Green | #2C5F3F | Hover states |
| Antique Gold | #B8960C | Accents, highlights |
| Champagne | #E8D5A3 | Gold light |
| Warm Ivory | #F5F0E8 | Background, cards |
| Deep Navy | #0D1B2A | Admin panel header |
| Navy Mid | #1B2D45 | Admin secondary |
| Deep Red | #7A1515 | Errors, critical alerts |

### Typography
| Usage | Font | Weight |
|-------|------|--------|
| Display / Headings | Playfair Display | 600-700 |
| Body / Labels | Inter | 400-600 |
| Numbers / Prices | Lato | 700-900 |

### Logo — Concept A: The Ledger Mark
```
Three horizontal lines (decreasing length) = lista / ledger
Gold diagonal slash upward = growth and momentum  
Gold dot at top = the goal / destination
```

### Logo Usage Rules
- **Landing screen:** Full logo — icon + "ListaKo" wordmark + tagline
- **Inner screens:** Symbol only (the three lines + gold slash)
- **App icon:** Symbol only on dark forest green background
- **Admin panel:** Symbol only on deep navy background

### Icon Style
- No emojis anywhere in the app
- SVG line icons only — 1.5px stroke weight
- Clean, minimal, professional

### Key Design Principles
- Low stock indicator: small red dot + word "Critical" — no emoji
- Approve/Decline buttons: uppercase text, no emoji
- Admin identifier: ◆ symbol instead of crown emoji
- Trial badge: "Complimentary Access · 7 Days" — elegant card style

---

## 9. COMPLETE BUILD ROADMAP

### Phase 1 — Foundation ✅ COMPLETE
- Supabase project setup (Singapore server)
- 6 database tables with full RLS security
- Owner signup with 2-step form
- Owner login with Filipino error messages
- Forgot password with OTP
- Multi-tenant architecture (each business isolated)
- Owner dashboard with 4 tabs (Dashboard, Products, Branch, Staff)
- Product management (add, edit, delete, barcode, stock, low stock alert)
- Branch management
- Staff management with roles
- Super Admin panel (only Crael can access)
- Approve / Reject / Suspend / Restore businesses
- 7-day free trial system with countdown banner
- Auto-lock after trial expires
- Subscription screen with GCash payment info
- Pending / Rejected / Suspended screens
- Vercel deployment live

### Phase 2 — POS Core ✅ COMPLETE
- Product search by name (real-time)
- Barcode scanner (camera with targeting overlay + manual fallback)
- Cart system with quantity adjustment
- Real-time total calculation
- Payment methods: Cash, GCash, Maya, Card, Utang
- Change calculator with quick cash buttons
- Checkout flow with order summary
- Receipt generation with unique receipt number
- Stock auto-deduction after sale
- Today's Sales history tab
- Cashier-specific dashboard (role-based)

### Phase 3 — Critical Fixes ✅ COMPLETE
- Real revenue dashboard (owner sees actual ₱ today)
- Stock validation at checkout (prevents overselling)
- Void transactions with reason
- Utang with customer name (required field)
- Utang tracking tab (list of all outstanding utang)
- Mark utang as paid
- Recent transactions on owner dashboard
- Utang balance card on dashboard

### Phase 4 — Payments Deep ⬅️ NEXT
- Discount system (fixed amount or percentage)
- Daily closing report (total per payment method)
- Receipt sharing via SMS/Messenger
- Receipt thermal printer support
- Cash drawer reconciliation
- GCash/Maya reference number recording

### Phase 5 — Inventory
- Product categories (Beverages, Snacks, Household, etc.)
- Category filtering in POS search
- Low stock push notifications
- Restock management (record deliveries)
- Inventory staff panel
- Batch stock update
- Stock history log

### Phase 6 — Analytics
- Owner revenue dashboard with graphs
- Best-selling products
- Slow-moving products
- Per-cashier performance reports
- Per-branch sales comparison
- Weekly and monthly revenue comparison
- Shift tracking (open/close shift)
- Export reports to PDF

### Phase 7 — Multi-Branch
- Unified owner dashboard across all branches
- Per-branch revenue breakdown
- Transfer products between branches
- Branch vs branch comparison graphs
- Branch manager dashboard
- Staff performance per branch

### Phase 8 — Security
- RLS properly re-enabled (currently disabled for stability)
- Session timeout after 15 minutes inactivity
- PIN lock for cashiers (4-digit PIN per transaction)
- Staff invite email verification
- Login attempt limiting
- Audit log (who did what and when)

### Phase 9 — Advanced Features
- Return and refund system
- Product images (camera upload)
- Offline PWA (full offline capability)
- Auto-sync when connection restores
- Barcode generation for products without barcodes
- Multiple price levels (retail vs wholesale)
- Customer database (regular customers / suki)
- PayMongo automatic payment integration

### Phase 10 — Premium Design (LAST)
- Apply Forest Prestige color system
- Apply Ledger Mark logo throughout
- Playfair Display + Inter + Lato typography
- Replace all emojis with SVG line icons
- Premium receipt design
- Animated transitions
- Dark mode option

---

## 10. KNOWN LOOPHOLES TO FIX (Priority Order)

### 🔴 Critical
| # | Issue | Phase |
|---|-------|-------|
| 1 | Void/cancel transaction | ✅ Phase 3 Done |
| 2 | Utang needs customer name | ✅ Phase 3 Done |
| 3 | Stock validation at checkout | ✅ Phase 3 Done |
| 4 | Owner dashboard real revenue | ✅ Phase 3 Done |
| 5 | Barcode scanner actual reading | Phase 4 |
| 6 | RLS security disabled | Phase 8 |

### 🟡 Important
| # | Issue | Phase |
|---|-------|-------|
| 7 | Discount system | Phase 4 |
| 8 | Daily closing report | Phase 4 |
| 9 | Receipt printing/sharing | Phase 4 |
| 10 | Product categories | Phase 5 |
| 11 | No daily closing report | Phase 4 |
| 12 | No cash reconciliation | Phase 4 |

### 🟢 Nice to Have
| # | Issue | Phase |
|---|-------|-------|
| 13 | PIN lock for cashiers | Phase 8 |
| 14 | Push notifications | Phase 5 |
| 15 | Return/refund system | Phase 9 |
| 16 | Product images | Phase 9 |
| 17 | Offline PWA | Phase 9 |
| 18 | Multiple price levels | Phase 9 |
| 19 | Per-branch comparison | Phase 7 |
| 20 | Best-seller tracking | Phase 6 |
| 21 | Cashier performance | Phase 6 |
| 22 | Shift tracking | Phase 6 |
| 23 | Data backup/export | Phase 9 |
| 24 | Receipt thermal printing | Phase 4 |

---

## 11. HOW TO BUILD (Claude Code Workflow)

### Connecting Claude Code to GitHub
1. Open Claude Code
2. Connect GitHub connector → `craelsteve14-source/listako`
3. Claude Code can now read, edit, and commit files directly
4. No more copy-paste — everything is automatic

### Build Rules (Always Follow)
1. **Bugs first** — fix anything broken before touching anything new
2. **New features second** — build once things are stable
3. **Current phase third** — complete the current phase before moving forward
4. **Never skip phases** — each phase builds on the previous
5. **Always test before moving on** — confirm live at listako-rouge.vercel.app

### The Golden Rule
> Every single decision must be made with one question:
> "Does this deliver the best possible experience for a Filipino grocery store owner?"

### Code Standards
- Single file approach: main app code lives in `src/App.jsx`
- Always write complete files — no placeholder comments
- Fix bugs directly — never describe the fix, apply it
- Always include deployment steps
- Production-ready code only

---

## 12. ENVIRONMENT VARIABLES (Vercel)

```
VITE_SUPABASE_URL=https://jbkqheprkehhjtrhwggf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 13. TEST ACCOUNTS

| Account | Email | Password | Role |
|---------|-------|----------|------|
| Super Admin / Owner | craelsteve14@gmail.com | listako2024 | Owner + Super Admin |
| Test Cashier | romeobehagan@gmail.co | cashier2024 | Cashier |

---

## 14. LAUNCH CHECKLIST

Before launching ListaKo to real store owners, all of these must be true:

- [ ] Phase 1 — Foundation ✅ Complete
- [ ] Phase 2 — POS Core ✅ Complete
- [ ] Phase 3 — Critical Fixes ✅ Complete
- [ ] Phase 4 — Payments Deep
- [ ] Phase 5 — Inventory
- [ ] Phase 6 — Analytics
- [ ] Phase 7 — Multi-Branch
- [ ] Phase 8 — Security
- [ ] Phase 9 — Advanced Features
- [ ] Phase 10 — Premium Design
- [ ] Tested by 3-5 real store owners (free beta)
- [ ] All major bugs fixed from beta testing
- [ ] PayMongo registered and approved
- [ ] PWA icons designed (192x192 and 512x512)
- [ ] Ledger Mark logo finalized
- [ ] Privacy Policy page added
- [ ] Terms of Service page added
- [ ] Launch promo campaign ready (₱99/month for first 50)

---

## 15. REVENUE PROJECTION

| Subscribers | Basic ₱199 | Pro ₱399 | Business ₱699 |
|-------------|-----------|---------|--------------|
| 10 | ₱1,990 | ₱3,990 | ₱6,990 |
| 50 | ₱9,950 | ₱19,950 | ₱34,950 |
| 100 | ₱19,900 | ₱39,900 | ₱69,900 |
| 500 | ₱99,500 | ₱199,500 | ₱349,500 |

*Switch to PayMongo automatic payments at 50+ subscribers.*

---

*ListaKo Project Plan — Created by Crael Steve B. Lom-oc | MSU-IIT | June 2026*
*Built with Claude AI — Anthropic*
