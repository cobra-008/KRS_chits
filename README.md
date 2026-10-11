# K R S SILVERS — Business Management System

A professional full-stack Silver Chit & Bullion Management application built with **React + Vite + Supabase**.

---

## Tech Stack

| Layer     | Technology            |
|-----------|-----------------------|
| Frontend  | React 18 + Vite       |
| Database  | Supabase (PostgreSQL) |
| Styling   | Vanilla CSS (custom design system) |
| Hosting   | Vercel                |
| Fonts     | Inter + Playfair Display |

---

## First-Time Setup

### Step 1 — Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose a name (e.g. `krs-silvers`), set a strong DB password, pick region closest to India (e.g. `ap-south-1`)
3. Wait ~2 minutes for it to provision

### Step 2 — Run the Database Schema

1. In your Supabase dashboard, click **SQL Editor → New Query**
2. Copy the entire contents of [`supabase/schema.sql`](./supabase/schema.sql) and paste it
3. Click **Run** — all tables, indexes, and RLS policies will be created

### Step 3 — Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Find these in: Supabase Dashboard → **Settings → API**

### Step 4 — Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deploy to Vercel

1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **Import Project**
3. Add environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**

---

## App Features

### 🏠 Home
- Live date & time (IST)
- Quick **Receipt Voucher** and **Issue Voucher** buttons
- All active groups displayed with months-happened progress
- Click group → expand member list with balances
- Double-click member → full account ledger
- **Generate Chit** button per group
- Add / Edit / Remove members per group

### 📄 Receipt Voucher
- Auto-sequential voucher numbering (1, 2, 3…)
- Columns: Lot #, Patla/Kacha No., Weight (g), Tunch (%), Pure (g)
- **No rate column** — pure weight-based
- Real-time fine calculation with KRS rounding rule
- On save: auto-posts to inventory AND customer account

### 📤 Issue Voucher
- Same layout as receipt
- On save: removes from inventory, debits customer account

### 👤 Customers
- Add customer with photo, phone, WhatsApp, address, ID proof
- Search by name, phone, city
- Double-click → full account ledger

### 📋 Account Ledger (double-click any customer/member)
- Date-wise chronological history: chit draws, receipts, issues
- Two separate columns: **Closing Balance** (red = due) and **Closing Excess** (green = overpaid)
- Only past history shown — no future placeholder rows
- Printable

### 👥 Groups
- Create/edit/delete groups
- Fields: name, draw day, months, unit limit (1kg or 1.5kg), start date
- Capacity = months × unit limit per member
- Progress bar for months completed

### ⚖️ Generate Chit (per group)
- Automatic calculation:
  - Company Profit = 4% × total capacity
  - Net Dividend Pool = Discount − Company Profit
  - Dividend per Member = Pool ÷ Members
  - Monthly Premium = Unit Limit − Dividend
  - Net Silver to Issue = Capacity − Discount − Premium − Old Dues
- Save updates withdrawer account and group history
- One-click → Issue Voucher flow

### 📦 Inventory
- All physical kachas/bars in vault
- Multi-select with live calculator (gross weight, tunch avg, pure fine total)
- Issue selected → pre-fills issue voucher

### 📊 Outstanding Balances
- Every member's due vs excess across all groups
- Summary totals at top
- Direct link to individual ledger

### 📅 Transaction History (Day Book)
- All receipts, issues, chit settlements
- Filter by date, type, search by name/voucher
- Net position summary cards

---

## Silver Calculation Rules

```
Raw Fine = Weight (g) × Tunch (%) ÷ 100

Rounding (KRS Rule):
  Fractional part ≤ 0.69  →  round DOWN (treat as 0)
  Fractional part ≥ 0.70  →  round UP   (+1 to integer)

Examples:
  1155.69 → 1155
  1155.70 → 1156
```

---

## Project Structure

```
krs/
├── src/
│   ├── lib/
│   │   ├── supabase.js       # Supabase client
│   │   ├── api.js            # All database operations
│   │   └── silverCalc.js     # Fine calculation engine
│   ├── components/
│   │   ├── Header.jsx        # Brand header + live clock
│   │   └── Navigation.jsx    # Top navigation bar
│   ├── pages/
│   │   ├── HomePage.jsx
│   │   ├── VoucherPage.jsx   # Shared by receipt & issue
│   │   ├── CustomersPage.jsx
│   │   ├── GroupsPage.jsx
│   │   ├── InventoryPage.jsx
│   │   ├── OutstandingPage.jsx
│   │   ├── TransactionsPage.jsx
│   │   └── modals/
│   │       ├── GenerateChitModal.jsx
│   │       ├── CustomerLedgerModal.jsx
│   │       ├── CustomerFormModal.jsx
│   │       ├── GroupFormModal.jsx
│   │       ├── AddMemberModal.jsx
│   │       └── EditMemberModal.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css             # Full design system
├── supabase/
│   └── schema.sql            # PostgreSQL schema — run this first!
├── .env.example
├── vercel.json
└── vite.config.js
```
