# BeaconBot Phase 1 — Static Client Dashboard

Updated: 2026-03-01
Status: Spec ready, build when first client is onboarded
Stack: Supabase (DB + auth) + Next.js or simple HTML/JS + n8n (data sync)

---

## Purpose

Give each B&L client a simple login portal showing:
1. Their upcoming deadlines
2. Key financial snapshots
3. Document links

This is NOT the full BeaconBot PRD. This is a sales differentiator: "Your accountant gives you a spreadsheet. We give you a dashboard."

## User Stories

1. As a client, I can log in and see my next 5 deadlines with days remaining
2. As a client, I can see my company's basic financial position (cash, profit, tax owed)
3. As a client, I can access shared documents (accounts, tax returns)
4. As Femi, I can see all clients' dashboards in an admin view

## Data Model (Supabase)

### Table: clients
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | Director name |
| email | text | Login email |
| company_name | text | |
| company_number | text | Companies House number |
| xero_tenant_id | text | For API sync |
| package | enum | starter/core/growth |
| start_date | date | |
| year_end | date | Drives deadline calculations |

### Table: deadlines
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| client_id | uuid | FK → clients |
| name | text | e.g. "Corporation Tax Return" |
| due_date | date | |
| status | enum | upcoming/due_soon/overdue/filed |
| category | text | tax/companies_house/vat/payroll |

### Table: snapshots
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| client_id | uuid | FK → clients |
| period | text | e.g. "2026-03" |
| cash_balance | numeric | From Xero |
| profit_ytd | numeric | From Xero |
| tax_provision | numeric | Estimated |
| vat_owed | numeric | From Xero |
| updated_at | timestamp | |

## n8n Sync Workflows

### Workflow 1: Xero → Snapshots (weekly, Sunday night)
1. For each client with xero_tenant_id
2. Pull balance sheet summary via Xero API
3. Pull P&L summary via Xero API
4. Calculate tax provision (profit × 25% for small companies)
5. Upsert into snapshots table

### Workflow 2: Deadline Generator (on client creation)
1. When new client added to clients table
2. Calculate all standard deadlines from year_end:
   - Accounts filing: year_end + 9 months
   - CT600: year_end + 12 months
   - Confirmation statement: incorporation anniversary
   - VAT: quarterly from VAT registration date
3. Insert into deadlines table

### Workflow 3: Deadline Status Update (daily, 6am)
1. Query all deadlines
2. If due_date - today ≤ 30 days → status = due_soon
3. If due_date < today and status ≠ filed → status = overdue
4. Send email alert to Femi for any overdue items

## Frontend (Minimal)

Single page per client after login:

```
Welcome, [Name] | [Company Name]

── Upcoming Deadlines ──────────────────
⚠️  VAT Return Q4          12 days left
📋  Confirmation Statement  45 days left
📋  Annual Accounts         142 days left
📋  Corporation Tax         233 days left

── Financial Snapshot (Feb 2026) ───────
Cash Balance:    £24,500
Profit YTD:      £18,200
Tax Provision:   £4,550
VAT Position:    -£1,200 (owed to HMRC)

── Documents ───────────────────────────
📄 2025 Annual Accounts (PDF)
📄 CT600 2025 (PDF)
📄 Monthly Report - Feb 2026 (PDF)
```

## Auth

- Supabase Auth (magic link — no passwords)
- Client enters email → receives link → logged in
- Session persists for 30 days

## Build Estimate

| Component | Time | Priority |
|-----------|------|----------|
| Supabase schema + auth | 2 hours | P1 |
| Deadline generator workflow (n8n) | 3 hours | P1 |
| Basic frontend (HTML/JS) | 4 hours | P1 |
| Xero sync workflow (n8n) | 4 hours | P2 |
| Admin view | 2 hours | P2 |
| **Total** | **15 hours** | |

Build trigger: First paying client is onboarded.
