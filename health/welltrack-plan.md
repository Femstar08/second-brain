# WellTrack — Product Plan
Started: 2026-02-27
Status: Planning phase | Lightweight Telegram version running in parallel

---

## What WellTrack Is

A personal health intelligence layer that replaces manual tracking with an AI-powered daily system.
Built around Femi's own protocol first. Commercialised once proven on himself.

Core philosophy: data in should be as frictionless as possible. Intelligence out should be immediate and actionable.

---

## Phase 0 — Lightweight Telegram Version (Running Now)

What is live:
- 5am daily check-in prompt via Telegram cron job
- Femi responds with Sleep / Stress / Libido / Energy scores + watch screenshot
- Clio calculates full day plan and responds immediately
- Food and workout logging via Telegram messages throughout the day
- Daily log saved to health/daily-log.md

This is the MVP behaviour. Everything the app does, this does first.

---

## Phase 1 — WellTrack MVP App

### Core User Flows

1. Morning check-in (push notification at 5am)
   - Log Sleep / Stress / Libido / Energy via sliders or quick tap
   - Sync wearable data automatically (Garmin via Terra)
   - Receive AI-generated day plan immediately

2. Workout logging
   - Log exercises post-session (voice or form input)
   - Track: exercise, sets, reps, weight, RPE (rate of perceived exertion)
   - Progressive overload tracking week on week

3. Food logging
   - Photo or text input
   - AI estimates macros and flags alignment with protocol
   - Tracks: protein target, calorie range, meal timing (fasting window)

4. Evening check-in (optional, 8pm)
   - Sessions completed? Yes / No
   - Supplement blocks taken?
   - Evening mood / fatigue

5. Weekly summary
   - Trend across all metrics
   - Progressive overload progress
   - Protocol adherence score
   - Recommendations for next week

---

## Tech Stack (Proposed)

| Layer | Tool | Rationale |
|---|---|---|
| Mobile app | React Native or Flutter | Cross-platform, single codebase |
| Database | Supabase | Already running, Femi knows it |
| Wearable data | Terra API | Garmin + Health Connect |
| Automation / AI | n8n + Claude | Already running |
| Auth | Supabase Auth | Built in |
| Food logging AI | Claude vision | Photo to macro estimation |
| Notifications | Supabase Edge Functions + FCM | Push at 5am |

---

## Data Model (Draft)

### users
- id, name, timezone, created_at

### daily_logs
- id, user_id, date
- sleep_score, stress_score, libido_score, energy_score
- sleep_duration_min, sleep_deep_min, sleep_rem_min
- hrv, body_battery, resting_hr (from Garmin)
- notes

### workouts
- id, user_id, date, session_type (morning/evening)
- exercises: JSONB array [{name, sets, reps, weight_kg, rpe}]
- duration_min, completed (bool)

### food_logs
- id, user_id, date, meal_type (breakfast/lunch/dinner/snack)
- description, photo_url
- estimated_protein_g, estimated_calories, estimated_carbs_g, estimated_fat_g

### supplements
- id, user_id, date
- morning (bool), pre_workout (bool), dinner (bool), bedtime (bool)

### day_plans
- id, user_id, date
- morning_session_plan (text)
- evening_session_plan (text)
- nutrition_guidance (text)
- recovery_notes (text)
- generated_at

---

## Commercialisation Path

Phase 0: Femi uses it alone via Telegram (now)
Phase 1: Build MVP app, Femi is sole user, validate all flows
Phase 2: Invite 5 to 10 beta users with similar protocols (ED recovery, body recomp)
Phase 3: Refine based on beta feedback, build onboarding flow
Phase 4: Soft launch — niche positioning (men's health, hormone optimisation, performance)
Phase 5: Productise AI coaching layer, tiered pricing

---

## Open Questions to Resolve

- [ ] App name confirmed as WellTrack?
- [ ] React Native vs Flutter — preference?
- [ ] Self-hosted or cloud deployment initially?
- [ ] Monetisation model: subscription or one-time?
- [ ] Target user beyond Femi: men 35-55, ED recovery niche, or broader recomp?
- [ ] Terra API pricing — check free tier limits
- [ ] IP and legal: sole ownership or co-founder structure?

---

## Next Actions

- [ ] Validate Telegram lightweight version over 2 weeks
- [ ] Document everything that works and everything that is friction
- [ ] Define MVP feature list (ruthlessly minimal)
- [ ] Spec the data model fully
- [ ] Set up Terra API account and connect Garmin
- [ ] Begin React Native or Flutter scaffold
