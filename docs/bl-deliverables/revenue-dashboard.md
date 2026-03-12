# Revenue Dashboard — £100k Tracker

Updated: 2026-03-01
Implementation: Google Sheet (immediate) → Supabase dashboard (Phase 2)

---

## Google Sheet Structure

### Tab 1: Monthly MRR Tracker

| Month | Target MRR | Actual MRR | Clients | Avg/Client | Cumulative Rev | % of £100k |
|-------|-----------|------------|---------|------------|---------------|------------|
| Mar 2026 | £370 | | 2 | £185 | | |
| Apr 2026 | £770 | | 4 | £193 | | |
| May 2026 | £1,500 | | 7 | £214 | | |
| Jun 2026 | £2,200 | | 10 | £220 | | |
| Jul 2026 | £3,000 | | 13 | £231 | | |
| Aug 2026 | £3,800 | | 16 | £238 | | |
| Sep 2026 | £4,500 | | 18 | £250 | | |
| Oct 2026 | £5,500 | | 20 | £275 | | |
| Nov 2026 | £6,500 | | 22 | £295 | | |
| Dec 2026 | £7,500 | | 25 | £300 | | |
| Jan 2027 | £9,000 | | 28 | £321 | | |
| Feb 2027 | £10,500 | | 30 | £350 | | |

Cumulative target column formula: running sum of Actual MRR
% of £100k formula: Cumulative Rev / 100000

### Tab 2: Client Roster

| Client | Company | Package | MRR | Start Date | Status | Upsell Target |
|--------|---------|---------|-----|------------|--------|---------------|
| Client 1 | [Name] | Starter | £120 | Apr 2026 | Active | Core (Sep) |
| Client 2 | [Name] | Core | £250 | Apr 2026 | Active | Growth (Dec) |

### Tab 3: Pipeline Summary

Auto-populated from ClickUp or manual entry:
- Leads this month
- Conversion rate (lead → client)
- Average time to close (days)
- Top acquisition channel

### Tab 4: Financial Health

| Metric | Value |
|--------|-------|
| MRR | =SUM(client MRRs) |
| ARR | =MRR*12 |
| Software costs | £X/mo (Xero, Dext, Ignition, ClickUp, n8n) |
| Net margin | =(MRR - costs) / MRR |
| Months to £100k | =calculated |
| On track? | =IF(cumulative >= target, "YES", "BEHIND") |

---

## Actuals vs Target Chart

Plot monthly:
- Line 1: Target cumulative revenue (from table above)
- Line 2: Actual cumulative revenue
- Gap between lines = how far ahead/behind

Green zone: actual >= target
Red zone: actual < target by more than 10%

---

## n8n Automation (Phase 2, when client count > 10)

Build n8n workflow:
1. Pull MRR data from Xero recurring invoices
2. Pull client count from ClickUp
3. Update Google Sheet automatically
4. Send weekly summary email to Femi every Monday 7am

Summary email template:
```
Weekly B&L Revenue Update

MRR: £X,XXX (target: £X,XXX)
Clients: XX (target: XX)
Cumulative revenue: £XX,XXX (XX% of £100k)
Status: ON TRACK / BEHIND BY £X,XXX

New this week:
- [Client name] signed ([Package], £XXX/mo)
- [X] proposals sent
- [X] discovery calls completed

Action needed:
- [Any overdue follow-ups]
- [Any clients at risk]
```
