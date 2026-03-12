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
