# Beacon & Ledger — £100k Growth Strategy Design

**Date:** 2026-03-01
**Author:** Clio (autonomous agent for Femi)
**Status:** Approved — Approach C (Hybrid)

---

## 1. Current State

- **Entity:** Beacon & Ledger Ltd — AAT Licensed, ICO Registered, ACSP Authorised
- **Revenue:** Pre-revenue. Two ltd company clients signed, payments starting ~April 2026
  - Client 1: £120/mo (bookkeeping)
  - Client 2: £250/mo (accounts preparation)
- **Signed MRR:** £370/mo (when payments begin)
- **Target:** £100k revenue within 12 months → ~£8,333/mo required
- **Tech stack:** Xero, Ignition, ClickUp, Supabase, n8n, M365, Dext
- **Existing assets:** LinkedIn strategy, outreach pack, pitch deck, service pricing, brand docs, BeaconBot PRD
- **Constraint:** Femi is balancing 5 SaaS builds, property systems, a book, AWS cert, job search, and family. Execution bandwidth is finite.

## 2. Why the Original Plan Failed

The Nov 2025 plan targeted 25 consulting clients at £3,500/mo (£87.5k MRR) within months. This didn't materialise because:

1. **No proven product** — consulting automation was aspirational, not built
2. **Wrong sequence** — tried to sell consulting before having compliance clients as proof
3. **Bandwidth** — too many parallel priorities to execute aggressive outreach
4. **Market mismatch** — £3,500/mo requires established trust; cold prospects don't pay that

The accounting practice arm has actual traction. The consulting arm doesn't. Strategy must follow reality.

## 3. Chosen Approach: Hybrid (Approach C)

**Core thesis:** Land compliance clients cheaply and reliably. Upsell advisory services. Let revenue compound.

### Phase 1: Foundation (Months 1-3, March–May 2026)

**Goal:** £2,000/mo MRR (8-10 clients)

Actions:
- Activate existing 2 clients, collect first payments
- Target ltd company directors via LinkedIn + referrals
- Lead with compliance packages: bookkeeping (£120-200/mo), accounts prep (£250/mo), tax returns (£350-750 one-off)
- Use free compliance health checks as lead magnet (already designed in outreach pack)
- Set up Ignition proposals with standardised packages
- Automate onboarding via n8n + Xero + Dext

Client acquisition target: 6-8 new clients at £200-300/mo average

### Phase 2: Growth (Months 4-8, June–October 2026)

**Goal:** £5,000/mo MRR (18-22 clients)

Actions:
- Upsell existing clients to advisory add-ons (£100-200/mo extra)
- Advisory = quarterly reviews, cashflow forecasting, tax planning
- Launch basic BeaconBot dashboard for client self-service (see §6)
- Introduce company secretarial services as cross-sell (£50-100/mo)
- Start referral programme: £100 credit per referred client
- Content marketing: weekly LinkedIn posts on ltd company tax tips

Client acquisition target: 10-12 new clients + 4-6 upsells

### Phase 3: Scale (Months 9-12, November 2026–February 2027)

**Goal:** £8,333+/mo MRR (25-30 clients)

Actions:
- Introduce consulting packages for small accounting firms (£600-1,000/mo)
- Use own practice as case study: "Here's how we manage 25+ clients with 1 person"
- BeaconBot as differentiator in pitches
- Hire part-time bookkeeper if client load exceeds 20
- Target professional referral partners (solicitors, IFAs, mortgage brokers)

Client acquisition target: 5-8 new clients + consulting prospects

### Revenue Model

| Month | Clients | Avg MRR/Client | Monthly MRR | Cumulative Revenue |
|-------|---------|----------------|-------------|-------------------|
| 1     | 2       | £185           | £370        | £370              |
| 3     | 10      | £220           | £2,200      | £4,570            |
| 6     | 18      | £280           | £5,040      | £18,250           |
| 9     | 24      | £320           | £7,680      | £40,410           |
| 12    | 30      | £350           | £10,500     | £100,380          |

Average MRR/client rises as advisory upsells land. Cumulative revenue crosses £100k at month 12 with ~30 clients averaging £350/mo.

## 4. Client Acquisition Channels

**Primary (80% of effort):**
1. **LinkedIn outbound** — refreshed strategy targeting ltd company directors, not accounting firms. 20 connections/day, 5 DMs/day. Content: tax tips, compliance deadlines, founder finance insights.
2. **Referrals** — £100 credit per referred client. Ask every client at month 2.

**Secondary (20% of effort):**
3. **Google Business Profile** — local SEO for "[area] accountant for limited companies"
4. **Professional referral partners** — solicitors, IFAs who serve ltd company directors
5. **Free compliance health check** — lead magnet from existing outreach pack, refreshed for 2026

**Not doing (yet):**
- Paid ads (no budget until £3k+ MRR)
- Accounting firm consulting outreach (Phase 3 only)
- Networking events (time cost too high for Femi's bandwidth)

## 5. Service Packages (Ignition-ready)

### Starter — £150/mo
- Monthly bookkeeping (Xero)
- Bank reconciliation
- Receipt management (Dext)
- Quarterly VAT returns (if registered)

### Core — £300/mo
- Everything in Starter
- Annual accounts preparation
- Corporation tax return
- Confirmation statement filing
- Quarterly review call

### Growth — £450/mo
- Everything in Core
- Monthly management accounts
- Cashflow forecasting
- Tax planning (2x/year)
- Ad-hoc queries (unlimited email)

### Add-ons
- Self-assessment: £200-350 one-off
- Payroll: £50/mo (1-5 employees)
- Company secretarial: £75/mo
- Advisory retainer: £150/mo

## 6. BeaconBot — Phased Build

**Decision:** Park the full PRD. Build a lightweight version that serves as sales differentiator and operational efficiency tool.

### Phase 1 (Now): Static Dashboard
- Client portal showing key dates (tax deadlines, filing dates, VAT quarters)
- Auto-generated from Xero data via n8n
- Hosted on Supabase + simple frontend
- Purpose: "Your clients get a dashboard. Other accountants give them spreadsheets."

### Phase 2 (Month 4-6): Basic Agents
- Corp Tax agent (L1 — Q&A only): answers "when is my tax due?", "what's my CT liability estimate?"
- Compliance agent (L1): tracks Companies House deadlines, director verification status
- Built on existing n8n + Supabase infrastructure
- No autonomous learning, no advisory synthesis yet

### Phase 3 (Month 9+): Advisory Layer
- Cashflow forecasting module
- Dividend vs salary optimisation
- Quarterly review prep automation
- Only build if revenue supports it and clients actually want it

**The full PRD (6 agents, knowledge graph, white-labelling) is the 18-24 month vision.** Not the 12-month plan.

## 7. Automation Stack (Operational)

What to automate now with n8n:

1. **Client onboarding** — Ignition signed → Xero org created → Dext invite sent → ClickUp tasks generated → welcome email sent
2. **Monthly bookkeeping reminders** — auto-chase for receipts/bank access
3. **Deadline tracking** — CT600, confirmation statements, VAT quarters → ClickUp + email alerts
4. **Invoice generation** — monthly recurring via Ignition/Xero
5. **Compliance calendar** — auto-populated per client from Companies House data

What NOT to automate yet:
- Advisory delivery (too bespoke, too few clients)
- Marketing funnels (manual outreach is more effective at this stage)
- BeaconBot agent architecture (premature)

## 8. Key Metrics

Track weekly:
- **MRR** — target trajectory per §3 table
- **Pipeline** — leads in conversation, proposals sent, proposals accepted
- **Client count** — total active paying clients
- **Churn** — any client losses (target: 0 in year 1)
- **Average revenue per client** — should trend up as upsells land

Track monthly:
- **Cumulative revenue** — on track for £100k?
- **Cost base** — software, contractor costs, Femi's time allocation
- **Net margin** — target 70%+ (low overhead, automation-heavy)

## 9. Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Client acquisition slower than projected | Medium | Lower average price point makes it easier to close. Free health check reduces friction. |
| Femi's bandwidth stretched across projects | High | Automate everything possible. Only B&L and job search are revenue-critical — others can pause. |
| Clients churn early | Low | Sticky services (bookkeeping = monthly dependency). Lock-in via annual engagement letters. |
| BeaconBot scope creep | Medium | Strict phased approach. No full build until revenue justifies it. |
| Market competition from bigger firms | Low | Ltd company directors underserved by big firms. Personal service + tech = differentiator. |

## 10. What Clio Delivers

As Femi's autonomous agent, Clio will:

1. **Build refreshed LinkedIn content calendar** — targeting ltd company directors, not accounting firms
2. **Create Ignition-ready service packages** — Starter/Core/Growth/Add-ons with pricing
3. **Design client acquisition tracker** — ClickUp or spreadsheet for pipeline management
4. **Set up revenue dashboard** — monthly MRR tracking against £100k target
5. **Draft outreach templates** — updated for March 2026 (MTD is now live, not upcoming)
6. **Spec BeaconBot Phase 1** — static client dashboard, minimal viable version
7. **Build n8n onboarding workflow** — automated client setup pipeline

---

**This design targets £100k cumulative revenue by month 12 with 30 clients averaging £350/mo. It's conservative, executable within Femi's bandwidth, and builds on the only thing that has actual traction: the accounting practice.**
