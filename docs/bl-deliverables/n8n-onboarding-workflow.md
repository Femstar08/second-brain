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
