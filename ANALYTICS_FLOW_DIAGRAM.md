# Analytics Flow: Profile Name & Duplicate Prevention

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER PARAPHRASES                            │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │  Using Saved Profile?   │
                    └─────────────────────────┘
                        │                 │
                       YES               NO
                        │                 │
                        ▼                 ▼
         ┌──────────────────────┐   ┌─────────────────┐
         │  Get profile.id      │   │  Manual styles  │
         │  Get profile.name    │   │  (no profile)   │
         └──────────────────────┘   └─────────────────┘
                        │                 │
                        └────────┬────────┘
                                 │
                                 ▼
         ┌───────────────────────────────────────────────┐
         │  src/lib/analytics.ts                         │
         │  prepareAnalyticsData()                       │
         │                                               │
         │  Returns:                                     │
         │  {                                            │
         │    userId: "abc-123",                         │
         │    profileId: "prof-456",      ← NEW         │
         │    profileName: "Professional", ← NEW        │
         │    styleOptions: {...},                       │
         │    verificationScore: 85,                     │
         │    ...                                        │
         │  }                                            │
         └───────────────────────────────────────────────┘
                                 │
                                 ▼
         ┌───────────────────────────────────────────────┐
         │  POST /api/analytics/submit                   │
         │  src/app/api/analytics/submit/route.ts        │
         └───────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  Has profileId?         │
                    └─────────────────────────┘
                        │                 │
                       YES               NO
                        │                 │
                        ▼                 ▼
         ┌──────────────────────┐   ┌─────────────────┐
         │  Check for duplicate │   │  Insert without │
         │  by user_id +        │   │  duplicate      │
         │  profile_id          │   │  check          │
         └──────────────────────┘   └─────────────────┘
                        │                 │
              ┌─────────┴─────────┐       │
              │                   │       │
             YES                 NO       │
         (duplicate)        (first time)  │
              │                   │       │
              ▼                   ▼       │
    ┌─────────────────┐   ┌───────────────────────┐
    │  Return:        │   │  INSERT INTO          │
    │  {              │   │  paraphrase_analytics │
    │   skipped: true │   │  VALUES (             │
    │  }              │   │   profile_id,         │
    │                 │   │   profile_name, ← NEW │
    │  Console:       │   │   ...                 │
    │  "Analytics     │   │  )                    │
    │   skipped..."   │   │                       │
    └─────────────────┘   └───────────────────────┘
              │                   │
              │                   ▼
              │         ┌─────────────────┐
              │         │  Return:        │
              │         │  {              │
              │         │   success: true │
              │         │  }              │
              │         │                 │
              │         │  Console:       │
              │         │  "Analytics     │
              │         │   submitted..." │
              │         └─────────────────┘
              │                   │
              └─────────┬─────────┘
                        │
                        ▼
         ┌───────────────────────────────────────────────┐
         │  ADMIN DASHBOARD                              │
         │  src/app/admin/analytics/page.tsx             │
         │                                               │
         │  Display:                                     │
         │  ┌─────────────────────────────────────────┐ │
         │  │ [85% Match] [📝 Professional] [✓ Consent]│ │
         │  │                      ↑                   │ │
         │  │                  profile_name            │ │
         │  │                                          │ │
         │  │ Style Settings:                          │ │
         │  │ • Tone: Professional                     │ │
         │  │ • Formality: 80%                         │ │
         │  │ ...                                      │ │
         │  └─────────────────────────────────────────┘ │
         └───────────────────────────────────────────────┘
```

---

## Database Structure

```sql
┌─────────────────────────────────────────────────────────────────┐
│  paraphrase_analytics                                           │
├─────────────────────────────────────────────────────────────────┤
│  id                 UUID PRIMARY KEY                            │
│  user_id            UUID  (references auth.users)               │
│  profile_id         TEXT  ← Duplicate detection                 │
│  profile_name       TEXT  ← Display in dashboard                │
│  tone               TEXT                                        │
│  formality          REAL                                        │
│  pacing             REAL                                        │
│  descriptiveness    REAL                                        │
│  directness         REAL                                        │
│  custom_lexicon     TEXT[]                                      │
│  sample_excerpt     TEXT                                        │
│  verification_score REAL  (CHECK: 0-100)                        │
│  input_length       INTEGER                                     │
│  output_length      INTEGER                                     │
│  consent_given      BOOLEAN                                     │
│  created_at         TIMESTAMPTZ                                 │
└─────────────────────────────────────────────────────────────────┘

Indexes:
• idx_analytics_profile_id (profile_id)
• idx_analytics_user_profile (user_id, profile_id) ← Duplicate check
```

---

## Example Scenarios

### Scenario 1: First Time with Profile
```
User: Paraphrase with "Professional Writing"
API: Check DB → No entry for user + profile_id
API: INSERT new entry with profile_name = "Professional Writing"
DB: ✅ 1 entry
Console: "Analytics submitted successfully"
Dashboard: Shows [📝 Professional Writing]
```

### Scenario 2: Duplicate (Same Profile)
```
User: Paraphrase again with "Professional Writing"
API: Check DB → Found entry for user + profile_id
API: Skip insert, return {skipped: true}
DB: ✅ Still 1 entry (no duplicate)
Console: "Analytics skipped - already recorded for this style profile"
Dashboard: Still shows 1 entry
```

### Scenario 3: Different Profile
```
User: Paraphrase with "Casual Blog"
API: Check DB → No entry for user + new profile_id
API: INSERT new entry with profile_name = "Casual Blog"
DB: ✅ 2 entries (one per profile)
Console: "Analytics submitted successfully"
Dashboard: Shows both [📝 Professional Writing] and [📝 Casual Blog]
```

### Scenario 4: Manual Styles (No Profile)
```
User: Paraphrase with manual slider adjustments
API: No profile_id → Skip duplicate check
API: INSERT new entry with profile_name = NULL
DB: ✅ New entry (no profile)
Console: "Analytics submitted successfully"
Dashboard: Shows entry WITHOUT profile name badge
```

---

## Data Examples

### Database Entry with Profile:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "abc-123-def-456",
  "profile_id": "prof-789",
  "profile_name": "Professional Writing",
  "tone": "professional",
  "formality": 0.8,
  "pacing": 0.6,
  "descriptiveness": 0.5,
  "directness": 0.7,
  "verification_score": 85,
  "consent_given": true,
  "created_at": "2025-01-15T14:30:00Z"
}
```

### API Request:
```json
POST /api/analytics/submit
{
  "userId": "abc-123-def-456",
  "profileId": "prof-789",
  "profileName": "Professional Writing",
  "styleOptions": {
    "tone": "professional",
    "formality": 0.8,
    "pacing": 0.6,
    "descriptiveness": 0.5,
    "directness": 0.7
  },
  "verificationScore": 85,
  "inputLength": 500,
  "outputLength": 520,
  "consentGiven": true
}
```

### API Response (Success):
```json
{
  "success": true,
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### API Response (Skipped):
```json
{
  "success": true,
  "skipped": true,
  "existingId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Analytics already recorded for this saved style profile"
}
```

---

## Component Hierarchy

```
paraphrase/page.tsx
│
├─ Load saved profile
│  └─ profile = { id, name, tone, formality, ... }
│
├─ User paraphrases
│  └─ verificationScore calculated
│
└─ prepareAnalyticsData(profile, score, ...)
   │
   ├─ profileId: profile.id
   ├─ profileName: profile.name
   └─ styleOptions: { tone, formality, ... }
   │
   └─ submitAnalytics(analyticsData)
      │
      └─ POST /api/analytics/submit
         │
         ├─ Duplicate check by profile_id
         │
         └─ INSERT with profile_name
            │
            └─ Admin dashboard displays profile_name
```

---

## Success Indicators

✅ **Console Messages:**
- First time: "Analytics submitted successfully"
- Duplicate: "Analytics skipped - already recorded for this style profile"

✅ **Admin Dashboard:**
- Profile name badge appears: `📝 Professional Writing`
- Only ONE entry per user per profile

✅ **Database:**
- `profile_name` column populated
- No duplicate entries for same user + profile_id

---

## Troubleshooting Flow

```
Issue: Profile name not showing
│
├─ Check: Is profile_name column added?
│  └─ Query: SELECT column_name FROM information_schema.columns...
│     ├─ NO → Run MIGRATION_ADD_PROFILE_NAME.sql
│     └─ YES → Continue
│
├─ Check: Is profileName being sent?
│  └─ DevTools → Network → submit request → Payload
│     ├─ NO → Check prepareAnalyticsData() in analytics.ts
│     └─ YES → Continue
│
└─ Check: Is profile_name being stored?
   └─ Query: SELECT profile_name FROM paraphrase_analytics...
      ├─ NO → Check API route insert statement
      └─ YES → Check admin page display logic
```

---

## Summary

**Input:** User paraphrases with saved profile "Professional Writing"

**Process:**
1. ✅ Extract profile.id and profile.name
2. ✅ Check database for existing entry (user_id + profile_id)
3. ✅ If duplicate → Skip, return {skipped: true}
4. ✅ If new → Insert with profile_name
5. ✅ Admin sees profile name badge in dashboard

**Output:** ONE entry per user per profile, with profile name displayed

🎉 **Complete!**
