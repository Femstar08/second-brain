# Beacon & Ledger £100k Growth — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Execute the approved hybrid growth strategy to reach £100k cumulative revenue in 12 months, starting from £370/mo MRR with 2 signed clients.

**Architecture:** Seven workstreams executed sequentially over weeks 1-4, then ongoing operational cadence. Mix of content creation (LinkedIn, outreach), tool configuration (Ignition, ClickUp, n8n), and lightweight technical builds (dashboard, tracking). All deliverables saved to the second-brain repo under `docs/bl-deliverables/`.

**Tech Stack:** n8n (automation), Supabase (data/dashboard), Xero (accounting), Ignition (proposals), ClickUp (project management), Dext (receipts), LinkedIn (acquisition)

**Design Doc:** `docs/plans/2026-03-01-bl-growth-strategy-design.md`

---

## Task 1: Create Deliverables Directory & Consolidate Key References

**Files:**
- Create: `docs/bl-deliverables/README.md`
- Reference: `/tmp/beacon-and-ledger/Beacon & Ledger Charter/Beaconledgermarkdownfiles/beaconledger_service_list_and_price.md`

**Step 1: Create directory structure**

```bash
mkdir -p /Users/femi/Projects/second-brain/docs/bl-deliverables
```

**Step 2: Write README with deliverable index**

Create `docs/bl-deliverables/README.md`:
```markdown
# Beacon & Ledger — Growth Deliverables

Strategy: ../plans/2026-03-01-bl-growth-strategy-design.md
Target: £100k cumulative revenue by Feb 2027

## Deliverables
1. service-packages.md — Ignition-ready pricing packages
2. linkedin-content-calendar.md — 4 weeks of content targeting ltd company directors
3. outreach-templates.md — Updated cold/warm outreach for March 2026
4. client-acquisition-tracker.md — Pipeline tracking spec (ClickUp or sheet)
5. revenue-dashboard.md — MRR tracking against £100k target
6. beaconbot-phase1-spec.md — Static client dashboard MVP
7. n8n-onboarding-workflow.md — Automated client setup pipeline

## Key References
- Original pricing: /tmp/beacon-and-ledger/.../beaconledger_service_list_and_price.md
- Original outreach: /tmp/beacon-and-ledger/.../OUTREACH-PACK-ACCOUNTING-FIRMS.md
- Original LinkedIn: /tmp/beacon-and-ledger/.../LINKEDIN-STRATEGY-COMPLETE.md
```

**Step 3: Commit**

```bash
git add docs/bl-deliverables/README.md
git commit -m "feat(bl): create deliverables directory with index"
```

---

## Task 2: Build Ignition-Ready Service Packages

**Files:**
- Create: `docs/bl-deliverables/service-packages.md`
- Reference: `/tmp/beacon-and-ledger/Beacon & Ledger Charter/Beaconledgermarkdownfiles/beaconledger_service_list_and_price.md`
- Reference: `docs/plans/2026-03-01-bl-growth-strategy-design.md` §5

**Step 1: Read existing pricing doc**

Read the original service list to understand the full menu.

**Step 2: Write consolidated packages**

Create `docs/bl-deliverables/service-packages.md` with these exact packages:

```markdown
# Beacon & Ledger — Service Packages

Updated: 2026-03-01
Status: Ready for Ignition setup

---

## Package Tiers

### Starter — £150/month
**For:** Ltd company directors who need reliable bookkeeping

Includes:
- Monthly bookkeeping in Xero
- Bank reconciliation (up to 2 bank accounts)
- Receipt management via Dext
- Quarterly VAT returns (if VAT registered)
- Access to client portal with key dates dashboard
- Email support (response within 24hrs, Mon-Fri)

Engagement: 12-month rolling, 30 days notice
Onboarding fee: £0 (waived for first 20 clients)

---

### Core — £300/month
**For:** Ltd company directors who want accounts and tax handled end-to-end

Includes everything in Starter, plus:
- Annual accounts preparation and filing
- Corporation tax return (CT600) preparation and filing
- Confirmation statement filing
- Quarterly review call (30 min)
- Tax deadline management and reminders
- Priority email support (response within 4hrs, Mon-Fri)

Engagement: 12-month rolling, 30 days notice
Onboarding fee: £0 (waived for first 20 clients)

---

### Growth — £450/month
**For:** Ltd company directors who want proactive financial guidance

Includes everything in Core, plus:
- Monthly management accounts with commentary
- Cashflow forecasting (rolling 12 months)
- Tax planning sessions (2x per year)
- Dividend vs salary optimisation advice
- Unlimited ad-hoc queries (email + scheduled calls)
- Annual strategy review (60 min)

Engagement: 12-month rolling, 30 days notice
Onboarding fee: £0 (waived for first 20 clients)

---

## Add-On Services

| Service | Price | Notes |
|---------|-------|-------|
| Personal self-assessment (SA100) | £200 one-off | Directors with PAYE + dividends |
| Complex self-assessment | £350 one-off | Rental income, capital gains, foreign income |
| Payroll (1-5 employees) | £50/month | RTI submissions, payslips, P60s |
| Payroll (6-15 employees) | £100/month | As above + auto-enrolment |
| Company secretarial | £75/month | Registered office, PSC register, board minutes |
| Advisory retainer | £150/month | Monthly call, ad-hoc strategic advice |
| Company formation | £150 one-off | Registration + initial setup in Xero |
| VAT registration | £100 one-off | Application and initial setup |

---

## Ignition Setup Notes

Each package maps to an Ignition proposal template:
- Template name: `BL-Starter-2026`, `BL-Core-2026`, `BL-Growth-2026`
- Payment terms: Monthly direct debit via GoCardless (Ignition integration)
- Engagement letter: Embedded in Ignition proposal
- E-signature: Required before onboarding begins
- Auto-recurring: Yes, monthly on signing anniversary

## Upsell Path

```
Starter (£150) → Core (£300) at annual accounts time
Core (£300) → Growth (£450) after first quarterly review
Any tier → Add-ons as needs emerge
```

Average client journey: Starter → Core within 6 months, Core → Growth within 12 months.
Target average MRR per client by month 12: £350
```

**Step 3: Commit**

```bash
git add docs/bl-deliverables/service-packages.md
git commit -m "feat(bl): create Ignition-ready service packages with pricing"
```

---

## Task 3: Write Refreshed LinkedIn Content Calendar

**Files:**
- Create: `docs/bl-deliverables/linkedin-content-calendar.md`
- Reference: `/tmp/beacon-and-ledger/Beacon & Ledger Charter/BeaconLedger_Missing_Docs_2025-11-08/LINKEDIN-STRATEGY-COMPLETE.md`
- Reference: `docs/plans/2026-03-01-bl-growth-strategy-design.md` §4

**Step 1: Read original LinkedIn strategy**

Review the Nov 2025 LinkedIn strategy for structure and tone.

**Step 2: Write updated 4-week calendar**

Key changes from original:
- **Target audience shifted:** Ltd company directors, NOT accounting firms
- **Context updated:** MTD for Income Tax is now live (April 2026), not upcoming
- **Tone:** Practitioner sharing real experience, not researcher asking questions
- **CTA:** Free compliance health check, not pilot program

Create `docs/bl-deliverables/linkedin-content-calendar.md`:

```markdown
# LinkedIn Content Calendar — March 2026

Updated: 2026-03-01
Target: Ltd company directors (UK, 1-15 employees)
Goal: 20 connections/day, 5 DMs/day, 2-3 discovery calls/week
Posting: Mon/Wed/Fri at 8:00 AM GMT

---

## Week 1: Establish Authority

### Monday — MTD Reality Check
```
MTD for Income Tax goes live on 6 April 2026.

If your limited company has any self-employed income above £50k, this affects you.

Here's what changes:
→ Quarterly digital submissions to HMRC (not annual)
→ Compatible software required (spreadsheets won't cut it)
→ Penalties for late or incorrect submissions

I run a small accounting practice and I'm already seeing clients who assumed "my accountant will sort it." Your accountant might. But do you know for sure?

3 things to check this week:
1. Does your accountant have MTD-compatible software?
2. Have they told you which of your income streams are affected?
3. Do you have a timeline for setup?

If you can't answer all three — that's a conversation worth having.

DM me if you want a free 15-min compliance check.

#MTD #LimitedCompany #UKBusiness
```

### Wednesday — The Hidden Cost of Bad Bookkeeping
```
Most ltd company directors don't think about bookkeeping until tax season.

Then it's 3 weeks of panic, missing receipts, and a surprise tax bill.

I see it constantly. Here's what "I'll do it later" actually costs:

→ Missed VAT claims (avg £2-5k/year for active companies)
→ Incorrect tax provisions (overpaying or underpaying)
→ Late filing penalties (£100-1,500+ depending on how late)
→ Accountant's "catch-up" fees (£500-2,000 to fix a year of mess)

Monthly bookkeeping costs £150/mo. The mess costs more.

If your books aren't up to date right now — what's stopping you from fixing that?

#Bookkeeping #LimitedCompany #UKTax
```

### Friday — Personal Story
```
I started Beacon & Ledger because I kept seeing the same pattern.

Ltd company directors who are brilliant at what they do. Building products, serving clients, growing teams.

But their finances? A shoebox of receipts. A Xero account they logged into once. A tax return filed at 11:58pm on 31 January.

I'm AAT qualified, 5 years in practice. I built this firm specifically for owner-managed limited companies.

What makes us different:
→ Every client gets a dashboard showing key dates and deadlines
→ Automated reminders so nothing gets missed
→ Monthly bookkeeping included in every package (not an add-on)
→ Fixed monthly pricing (no surprise bills)

Taking on new clients now. Link in comments for a free compliance health check.

#AccountingForFounders #BeaconAndLedger
```

---

## Week 2: Educate on Pain Points

### Monday — Dividend vs Salary
```
"How much salary should I pay myself?"

The most common question I get from ltd company directors.

Quick answer for 2025/26 tax year:

→ Optimal salary: £12,570/year (personal allowance)
→ Above that: take dividends (lower tax rate)
→ But dividends need distributable reserves
→ And your company needs to actually have the cash

The real answer depends on:
- Your other income sources
- Whether you have employees
- Your pension contributions
- Your partner's tax position

There is no one-size-fits-all answer. Anyone who gives you a number without asking these questions is guessing.

Worth a conversation? DM me.

#DividendVsSalary #LimitedCompany #TaxPlanning
```

### Wednesday — Companies House Compliance
```
Companies House compliance isn't glamorous. But getting it wrong is expensive.

Things your limited company must do every year:
→ File confirmation statement (£13 online, £40 paper)
→ File annual accounts (deadline: 9 months after year end)
→ Maintain PSC register
→ Keep registered office address current
→ Director identity verification (new requirement)

Miss any of these?
→ Late filing penalties: £150-1,500
→ Company struck off the register
→ Personal liability for directors

I manage all of this for my clients. Zero missed deadlines since launch.

If you're not 100% sure your company is fully compliant — that's worth checking.

Free compliance health check: link in comments.

#CompaniesHouse #CompanyDirector #Compliance
```

### Friday — Client Win (Social Proof)
```
Started working with a new client last month.

Their situation:
→ 18 months of unreconciled bank transactions
→ VAT returns filed late (twice)
→ No idea what their actual profit was
→ Previous accountant "too busy" to respond

After 3 weeks:
→ Books fully reconciled and up to date
→ VAT position clarified (they were owed £1,800)
→ Monthly reporting in place
→ Dashboard showing every deadline for the next 12 months

This is what structured accounting looks like.

Not heroics. Not last-minute scrambles. Just a system that works.

If your accounts are a mess, it's fixable. Usually faster than you think.

#AccountingWin #LimitedCompany
```

---

## Week 3: Build Trust

### Monday — Tax Calendar Post
```
Key dates for UK limited companies — save this:

📅 1 April 2026: New CT rate year begins
📅 6 April 2026: MTD for Income Tax goes live (£50k+)
📅 7 April 2026: New tax year — update payroll
📅 19 April 2026: Final PAYE payment for 2025/26
📅 [Your year-end + 9 months]: Accounts filing deadline
📅 [Your year-end + 12 months]: CT600 deadline

Missing any of these = penalties.

I send automated reminders to all my clients 30 days before each deadline. Nobody misses anything.

Want me to check your upcoming deadlines? Free. Takes 5 minutes.

DM me or comment "CHECK" below.

#TaxCalendar #LimitedCompany #UKBusiness
```

### Wednesday — Myth Busting
```
Myths I hear from ltd company directors:

"My accountant does everything automatically"
→ Probably not. Most accountants wait for you to send info.

"I don't need bookkeeping, I just need a tax return"
→ Your tax return is only as accurate as your books.

"I can claim everything through my company"
→ No. HMRC has very specific rules on allowable expenses.

"I don't earn enough to worry about MTD"
→ The £50k threshold applies to gross income, not profit.

"My accounts are simple, I don't need an accountant"
→ Simple accounts still need to be right. And filed on time.

Which of these have you heard? Or believed? 👇

#AccountingMyths #LimitedCompany
```

### Friday — Behind the Scenes
```
What running a modern accounting practice actually looks like:

7:30 — Check overnight automations ran correctly
8:00 — Review client dashboards for any red flags
8:30 — Bookkeeping block (3-4 clients)
11:00 — Client call (quarterly review)
12:00 — New client onboarding (automated pipeline)
13:00 — Tax return prep
15:00 — Companies House filings
16:00 — Admin, emails, follow-ups

No paper. No spreadsheets. Everything in Xero, tracked in ClickUp, automated where possible.

This is why my clients get same-day responses and zero missed deadlines.

Building in public. Happy to answer questions about how any of this works.

#BuildInPublic #ModernAccounting #BeaconAndLedger
```

---

## Week 4: Convert

### Monday — Free Offer Post
```
Free compliance health check for UK limited companies.

I'll review:
→ Companies House filings (all up to date?)
→ Upcoming deadlines (anything due in 90 days?)
→ MTD readiness (are you set up for April?)
→ VAT position (registered when you should be? Or shouldn't be?)
→ Payroll compliance (RTI, auto-enrolment)

Takes 15 minutes. No cost. No obligation.

Why? Because half the directors I speak to have at least one thing that needs fixing. And most don't know until it's urgent.

DM me or comment "HEALTH CHECK" to book.

#FreeHealthCheck #LimitedCompany #Compliance
```

### Wednesday — Pricing Transparency
```
What does an accountant actually cost for a limited company?

Beacon & Ledger pricing (no hidden fees):

Starter — £150/month
→ Monthly bookkeeping, bank rec, VAT returns, client portal

Core — £300/month
→ Everything above + annual accounts, CT600, quarterly review calls

Growth — £450/month
→ Everything above + management accounts, cashflow forecasting, tax planning

All packages include:
→ Onboarding fee: £0
→ Software: included (Xero, Dext)
→ Deadlines: all managed
→ Surprises: none

Fixed price. Monthly. Cancel with 30 days notice.

Happy to have a conversation about which tier fits your business.

#AccountingPricing #Transparency #LimitedCompany
```

### Friday — Soft Close
```
If you've been following along this month, you know what Beacon & Ledger does.

Modern accounting for limited companies. Fixed pricing. Automated systems. No missed deadlines.

I'm taking on 5 more clients this month.

If any of these describe you:
→ Your books are behind
→ Your accountant is unresponsive
→ You're not sure about MTD
→ You want monthly visibility into your finances
→ You just want it handled properly

Then let's talk. 15 minutes. No pressure.

DM me or book directly: [Calendly link]

#BeaconAndLedger #LimitedCompany #NewClients
```

---

## Outreach DM Templates

### Connection Request (send to ltd company directors)
```
Hi [Name], I run a small accounting practice specialising in limited companies. Saw you're [role] at [company] — always good to connect with fellow business owners. Best, Femi
```

### After Connection Accepted
```
Thanks for connecting [Name]. Quick question — are you sorted for the MTD changes coming in April? I'm doing free compliance health checks for ltd company directors this month if useful. No strings. Happy to help.
```

### Follow-Up (if no response after 5 days)
```
Hi [Name], just circling back. The MTD deadline is [X] days away — if you're not sure whether it affects you, I can check in 5 minutes. Let me know.
```

---

## Daily Routine (45 min total)

**Morning (20 min):**
- Post (if scheduled)
- Respond to all comments from previous day
- Comment on 3 posts from target connections

**Afternoon (15 min):**
- Send 20 connection requests
- Send 5 DMs to accepted connections

**Evening (10 min):**
- Respond to DMs
- Book any calls
- Log activity in tracker

## Weekly Metrics

| Metric | Target |
|--------|--------|
| Connection requests sent | 100 |
| DMs sent | 25 |
| Comments on others' posts | 15 |
| Discovery calls booked | 2-3 |
| Posts published | 3 |
```

**Step 3: Commit**

```bash
git add docs/bl-deliverables/linkedin-content-calendar.md
git commit -m "feat(bl): create 4-week LinkedIn content calendar targeting ltd company directors"
```

---

## Task 4: Write Updated Outreach Templates

**Files:**
- Create: `docs/bl-deliverables/outreach-templates.md`
- Reference: `/tmp/beacon-and-ledger/Beacon & Ledger Charter/BeaconLedger_Missing_Docs_2025-11-08/OUTREACH-PACK-ACCOUNTING-FIRMS.md`

**Step 1: Read original outreach pack**

Review the Nov 2025 templates for structure.

**Step 2: Write refreshed templates**

Key changes:
- Target: ltd company directors (not accounting firms)
- Context: MTD is imminent (April 2026), not distant
- Offer: free compliance health check (not pilot program)
- Tone: established practitioner (not researcher/launcher)

Create `docs/bl-deliverables/outreach-templates.md`:

```markdown
# Outreach Templates — March 2026

Updated: 2026-03-01
Target: UK ltd company directors (1-15 employees)

---

## Email Templates

### Template 1: Cold Outreach (found via LinkedIn/directory)

Subject: Quick question about your company's MTD setup

Hi [Name],

I found [Company Name] on Companies House — looks like your accounts are due [month]. Quick question: has your accountant confirmed you're set up for MTD for Income Tax (mandatory from April 6)?

I run Beacon & Ledger, a small accounting practice for limited companies. I'm offering a free 15-minute compliance health check this month — I'll review your Companies House filings, upcoming deadlines, and MTD readiness.

No cost, no obligation. I just find that most directors have at least one thing that needs attention.

Worth 15 minutes?

[Calendly link]

Best,
Oluwafemi Osinowo
Beacon & Ledger
AAT Licensed | [Phone] | [Email]

---

### Template 2: Warm Outreach (after LinkedIn connection)

Subject: Following up from LinkedIn

Hi [Name],

Thanks for connecting on LinkedIn.

I noticed [Company Name] — [something specific: recently incorporated / in [industry] / based in [area]]. I specialise in accounting for limited companies like yours.

Two things I wanted to flag:

1. MTD for Income Tax becomes mandatory April 6. If your self-employed income is above £50k, you need to be set up.
2. I'm offering free compliance health checks this month — 15 minutes, I review your filings and flag anything that needs attention.

Interested?

[Calendly link]

Cheers,
Femi

---

### Template 3: Follow-Up (no response after 7 days)

Subject: Re: Quick question about your company's MTD setup

Hi [Name],

Following up on my email last week. I know inboxes are busy.

The short version: I'm offering a free compliance check for ltd company directors before the April MTD deadline. Takes 15 minutes. I'll tell you if anything needs fixing.

If timing isn't right, no worries at all. But if you want to check — here's my calendar:

[Calendly link]

Best,
Femi

---

### Template 4: Post-Discovery Call Follow-Up

Subject: Thanks for the chat — [Company Name]

Hi [Name],

Good speaking with you today. Here's a summary:

**What we discussed:**
- [Key point 1]
- [Key point 2]
- [Action items]

**What I'd recommend:**
- [Package name] at £[X]/month based on your needs
- [Specific add-on if relevant]

**Next step:**
I've attached a proposal via Ignition — you can review the scope, pricing, and sign the engagement letter all in one place. Direct debit sets up automatically.

No rush. Happy to answer any questions.

Femi
Beacon & Ledger

---

## Phone/Video Call Script

### Opening (2 min)
"Hi [Name], thanks for making time. I'm Femi from Beacon & Ledger. I run a small accounting practice specifically for limited companies. This call is just to understand your situation and see if I can help — no hard sell, I promise. Sound good?"

### Discovery (8 min)
- "Tell me about [Company Name] — what does the business do?"
- "How long have you been trading as a limited company?"
- "Who handles your accounting currently — you, an accountant, or a mix?"
- "How's that working for you? Anything frustrating?"
- "Are you aware of the MTD changes coming in April?"
- "Is your bookkeeping up to date right now?"

### Present Solution (3 min)
"Based on what you've told me, here's what I'd suggest..."
[Match to Starter/Core/Growth based on their needs]
"This covers [list key items]. Fixed price, no surprises. And you get a dashboard showing all your deadlines."

### Close (2 min)
"If this sounds useful, I can send you a proposal today via email — you can review it, sign digitally, and we'd get started within a week. Want me to send that over?"

[If yes] "Brilliant. I'll have it in your inbox within the hour."
[If not now] "No problem at all. I'll follow up in [timeframe]. And the health check findings still stand — those are yours regardless."
```

**Step 3: Commit**

```bash
git add docs/bl-deliverables/outreach-templates.md
git commit -m "feat(bl): create updated outreach templates for ltd company directors"
```

---

## Task 5: Design Client Acquisition Tracker

**Files:**
- Create: `docs/bl-deliverables/client-acquisition-tracker.md`

**Step 1: Write tracker spec**

Create `docs/bl-deliverables/client-acquisition-tracker.md`:

```markdown
# Client Acquisition Tracker

Updated: 2026-03-01
Tool: ClickUp (preferred) or Google Sheets

---

## Pipeline Stages

| Stage | Definition | Action Required |
|-------|-----------|----------------|
| **Lead** | Name + company identified, not yet contacted | Send connection request or cold email |
| **Contacted** | First message sent (LinkedIn DM, email, or call) | Wait 5 days, then follow up |
| **Engaged** | Responded positively, conversation active | Book discovery call |
| **Discovery** | Discovery call scheduled or completed | Send proposal via Ignition |
| **Proposal** | Ignition proposal sent, awaiting signature | Follow up after 3 days |
| **Won** | Proposal signed, onboarding begins | Trigger onboarding workflow |
| **Lost** | Declined or went silent after 3 follow-ups | Log reason, revisit in 3 months |

## Fields Per Lead

| Field | Type | Required |
|-------|------|----------|
| Company name | Text | Yes |
| Director name | Text | Yes |
| Company number | Text | Yes |
| Source | Dropdown: LinkedIn / Referral / Directory / Inbound | Yes |
| Stage | Dropdown (pipeline stages above) | Yes |
| Last contacted | Date | Yes |
| Next action | Text | Yes |
| Next action date | Date | Yes |
| Package interest | Dropdown: Starter / Core / Growth / Unknown | No |
| Estimated MRR | Number | No |
| Notes | Long text | No |
| Referrer | Text | No |

## ClickUp Setup

**Space:** Beacon & Ledger
**List:** Client Pipeline
**View 1:** Board view (columns = pipeline stages)
**View 2:** Table view (all fields, sortable)
**View 3:** Calendar view (next action dates)

**Automations:**
- When stage changes to "Contacted" → set "Next action date" to +5 days
- When stage changes to "Proposal" → set "Next action date" to +3 days
- When stage changes to "Won" → create task in "Onboarding" list
- When "Next action date" is today → send notification to Femi

## Weekly Review Checklist

Every Friday, 15 minutes:
- [ ] How many leads added this week?
- [ ] How many moved to Engaged?
- [ ] How many discovery calls completed?
- [ ] How many proposals sent?
- [ ] How many won/lost?
- [ ] Total pipeline value (estimated MRR)?
- [ ] What's blocking progress?

## Monthly Targets (Phase 1)

| Metric | March | April | May |
|--------|-------|-------|-----|
| New leads | 40 | 50 | 50 |
| Discovery calls | 4 | 6 | 8 |
| Proposals sent | 2 | 4 | 5 |
| Clients won | 1 | 3 | 4 |
| Cumulative clients | 3 | 6 | 10 |
| MRR | £770 | £1,500 | £2,200 |
```

**Step 2: Commit**

```bash
git add docs/bl-deliverables/client-acquisition-tracker.md
git commit -m "feat(bl): create client acquisition pipeline tracker spec"
```

---

## Task 6: Build Revenue Dashboard

**Files:**
- Create: `docs/bl-deliverables/revenue-dashboard.md`

**Step 1: Write dashboard spec**

Create `docs/bl-deliverables/revenue-dashboard.md`:

```markdown
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

## n8n Automation (Phase 2)

When client count > 10, build n8n workflow:
1. Pull MRR data from Xero recurring invoices
2. Pull client count from ClickUp
3. Update Google Sheet automatically
4. Send weekly summary email to Femi every Monday 7am
```

**Step 2: Commit**

```bash
git add docs/bl-deliverables/revenue-dashboard.md
git commit -m "feat(bl): create revenue dashboard spec with £100k tracker"
```

---

## Task 7: Spec BeaconBot Phase 1 (Static Client Dashboard)

**Files:**
- Create: `docs/bl-deliverables/beaconbot-phase1-spec.md`
- Reference: `docs/plans/2026-03-01-bl-growth-strategy-design.md` §6

**Step 1: Write Phase 1 spec**

Create `docs/bl-deliverables/beaconbot-phase1-spec.md`:

```markdown
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
```

**Step 2: Commit**

```bash
git add docs/bl-deliverables/beaconbot-phase1-spec.md
git commit -m "feat(bl): spec BeaconBot Phase 1 static client dashboard"
```

---

## Task 8: Design n8n Client Onboarding Workflow

**Files:**
- Create: `docs/bl-deliverables/n8n-onboarding-workflow.md`
- Reference: `/tmp/beacon-and-ledger/Beacon & Ledger Charter/Beaconledgermarkdownfiles/beaconledger_automation_workflow.md`

**Step 1: Read existing automation workflow doc**

Check what automation architecture already exists.

**Step 2: Write onboarding workflow spec**

Create `docs/bl-deliverables/n8n-onboarding-workflow.md`:

```markdown
# n8n Client Onboarding Workflow

Updated: 2026-03-01
Trigger: Ignition proposal signed
Goal: Zero manual steps from signature to "ready to work"

---

## Workflow Overview

```
Ignition Signed
    │
    ├─→ Create Xero Organisation (or connect existing)
    ├─→ Send Dext Invite Email
    ├─→ Create ClickUp Client Tasks
    ├─→ Send Welcome Email (with portal login)
    ├─→ Generate Deadlines in Supabase
    └─→ Notify Femi (Slack/email)
```

## Trigger

**Ignition Webhook** — fires when proposal status changes to "accepted"

Payload includes:
- Client name
- Client email
- Company name
- Package selected
- Start date

## Step 1: Create/Connect Xero Organisation

**If new to Xero:**
- Use Xero API to create new organisation
- Set chart of accounts (B&L standard template)
- Configure financial year end
- Enable bank feeds invitation

**If existing Xero user:**
- Send Xero connection request to client email
- Log "awaiting Xero access" status

**n8n node:** HTTP Request → Xero API (POST /Organisations or manual flag)

## Step 2: Send Dext Invite

- Use Dext API (or email template) to invite client
- Include setup instructions (mobile app, email forwarding address)

**n8n node:** HTTP Request → Dext API or Send Email node

## Step 3: Create ClickUp Client Tasks

Create a new ClickUp list under "Clients" space:
- List name: [Company Name]
- Pre-populated tasks:
  - [ ] Xero access confirmed
  - [ ] Bank feeds connected
  - [ ] Dext set up and receipts flowing
  - [ ] Opening balances entered
  - [ ] First month bookkeeping completed
  - [ ] Engagement letter filed
  - [ ] All deadlines logged

**n8n node:** HTTP Request → ClickUp API (POST /list, POST /task × 7)

## Step 4: Send Welcome Email

Template:
```
Subject: Welcome to Beacon & Ledger — here's what happens next

Hi [Name],

Welcome aboard! Here's everything you need to know about getting started.

**What we'll do this week:**
1. Set up your Xero (or connect to yours)
2. Get Dext running for receipts
3. Log all your compliance deadlines
4. Give you access to your client dashboard

**What we need from you:**
1. Bank feed access (I'll send instructions)
2. Download the Dext app (invite email sent separately)
3. Share any documents from your previous accountant

**Your client portal:**
[Dashboard login link — magic link]

**Questions?**
Reply to this email or call me on [phone].

Looking forward to working together.

Femi
Beacon & Ledger
```

**n8n node:** Send Email node (SMTP or SendGrid)

## Step 5: Generate Supabase Records

- Insert into `clients` table
- Trigger deadline generator workflow (Task 7, Workflow 2)
- Insert initial snapshot (zeros, to be updated after Xero sync)

**n8n node:** Supabase node (INSERT)

## Step 6: Notify Femi

- Send notification: "New client onboarded: [Company Name] ([Package]) — [MRR]"
- Channel: Email or Slack or ClickUp notification

**n8n node:** Send Email or Slack node

## Error Handling

- If Xero API fails → log error, create manual ClickUp task "Set up Xero manually for [Client]"
- If Dext invite fails → send manual email template to Femi
- If any step fails → workflow continues (don't block on one failure), flag failed step in ClickUp

## Build Estimate

| Component | Time |
|-----------|------|
| Ignition webhook setup | 1 hour |
| Xero integration | 3 hours |
| Dext invite | 1 hour |
| ClickUp task creation | 2 hours |
| Welcome email | 1 hour |
| Supabase integration | 1 hour |
| Error handling + testing | 2 hours |
| **Total** | **11 hours** |

Build trigger: After first Ignition proposal is ready to send.
```

**Step 3: Commit**

```bash
git add docs/bl-deliverables/n8n-onboarding-workflow.md
git commit -m "feat(bl): spec n8n client onboarding automation workflow"
```

---

## Task 9: Update Memory & Final Commit

**Files:**
- Modify: `memory/memory.md`
- Modify: `docs/bl-deliverables/README.md` (mark all complete)

**Step 1: Update memory**

Add to memory.md under Beacon & Ledger section:
```
- All 7 deliverables written: service-packages, linkedin-calendar, outreach-templates, acquisition-tracker, revenue-dashboard, beaconbot-phase1-spec, n8n-onboarding-workflow
- Immediate next actions: set up Ignition proposals, start LinkedIn posting, build ClickUp pipeline
```

**Step 2: Final commit**

```bash
git add -A docs/bl-deliverables/ memory/memory.md
git commit -m "feat(bl): complete all 7 growth strategy deliverables"
```

---

## Execution Order & Dependencies

```
Task 1 (directory setup) → no dependencies
Task 2 (service packages) → no dependencies
Task 3 (LinkedIn calendar) → no dependencies
Task 4 (outreach templates) → no dependencies
Task 5 (acquisition tracker) → no dependencies
Task 6 (revenue dashboard) → no dependencies
Task 7 (BeaconBot spec) → no dependencies
Task 8 (n8n onboarding) → depends on Task 7 (Supabase schema)
Task 9 (memory update) → depends on all above
```

Tasks 1-7 are independent and can be parallelised.
Task 8 references Task 7's Supabase schema.
Task 9 is the final commit.

**Total estimated execution time: 45-60 minutes (writing deliverables)**
**Total estimated build time for technical components: ~26 hours (BeaconBot + n8n workflow)**
