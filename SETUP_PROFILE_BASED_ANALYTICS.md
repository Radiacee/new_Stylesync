# ✅ Analytics by Saved Profile - Setup Guide

## 🎯 What Changed

Previously, analytics tracked by individual style settings. Now it tracks by **saved style profile ID**.

### New Behavior:
- ✅ User paraphrases with "My Professional Style" → Analytics submitted
- ⏭️ User paraphrases again with same profile → Skipped (already recorded)
- ✅ User paraphrases with "My Casual Style" → New analytics submitted
- ✅ User creates new profile with identical settings → New analytics (different profile!)

---

## 📋 Required Setup (3 Steps)

### Step 1: Fix Verification Score Constraint
**File:** `MIGRATION_FIX_VERIFICATION_SCORE.sql`

```sql
ALTER TABLE public.paraphrase_analytics 
DROP CONSTRAINT IF EXISTS paraphrase_analytics_verification_score_check;

ALTER TABLE public.paraphrase_analytics 
ADD CONSTRAINT paraphrase_analytics_verification_score_check 
CHECK (verification_score >= 0 AND verification_score <= 100);
```

**Why:** Your current database requires score > 50, but we changed it to accept all scores (0-100).

---

### Step 2: Add Profile ID Column
**File:** `MIGRATION_ADD_PROFILE_ID.sql`

```sql
ALTER TABLE public.paraphrase_analytics 
ADD COLUMN IF NOT EXISTS profile_id TEXT;

CREATE INDEX IF NOT EXISTS idx_paraphrase_analytics_profile_id 
ON public.paraphrase_analytics(profile_id);

CREATE INDEX IF NOT EXISTS idx_paraphrase_analytics_user_profile 
ON public.paraphrase_analytics(user_id, profile_id);
```

**Why:** Adds the `profile_id` column for tracking which saved profile was used.

---

### Step 3: Verify Tables
Run this to check everything is set up:

```sql
-- Check profile_id column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'paraphrase_analytics'
  AND column_name = 'profile_id';

-- Check verification_score constraint
SELECT pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.paraphrase_analytics'::regclass
  AND conname LIKE '%verification_score%';
```

---

## 🚀 Quick Setup (Copy-Paste into Supabase)

### Option A: If you already have the table
Run both migration files in order:

1. Open **Supabase SQL Editor**
2. Copy `MIGRATION_FIX_VERIFICATION_SCORE.sql` → Run ▶️
3. Copy `MIGRATION_ADD_PROFILE_ID.sql` → Run ▶️
4. Done! ✅

### Option B: Fresh install (no existing data)
Run the updated schema:

1. Open **Supabase SQL Editor**
2. Copy `ANALYTICS_DATABASE_SCHEMA.sql` → Run ▶️
3. Done! ✅

---

## 🔍 How It Works

### Before (Old System):
```typescript
// Checked these fields for duplicates:
user_id + tone + formality + pacing + descriptiveness + directness
```

**Problem:** If user tweaked formality by 0.01, created new entry even though it's "the same style"

### After (New System):
```typescript
// Checks this for duplicates:
user_id + profile_id
```

**Benefit:** Tracks by saved profile, so adjusting settings in the same profile doesn't create duplicates

---

## 📊 Example Scenarios

### Scenario 1: Same Profile, Multiple Uses
```
User: Dave
Profile: "Professional Writing" (ID: abc-123)

Paraphrase 1 with abc-123 → ✅ Analytics created
Paraphrase 2 with abc-123 → ⏭️ Skipped (already recorded)
Paraphrase 3 with abc-123 → ⏭️ Skipped (already recorded)

Result: 1 analytics entry
```

### Scenario 2: Different Profiles
```
User: Dave

Paraphrase with "Professional" (ID: abc-123) → ✅ Entry 1
Paraphrase with "Casual" (ID: def-456) → ✅ Entry 2
Paraphrase with "Academic" (ID: ghi-789) → ✅ Entry 3

Result: 3 analytics entries (one per profile)
```

### Scenario 3: Editing Profile Settings
```
User: Dave
Profile: "Professional" (ID: abc-123)
Initial: Formality 80%

Paraphrase → ✅ Analytics created

// User edits profile
Profile: "Professional" (ID: abc-123)
Updated: Formality 85%

Paraphrase → ⏭️ Skipped (same profile ID)

Result: 1 analytics entry (profile ID unchanged)
```

### Scenario 4: Creating New Profile with Same Settings
```
User: Dave

Profile A: "Professional" (ID: abc-123) - Formality 80%
Paraphrase → ✅ Entry 1

// User creates new profile with identical settings
Profile B: "Work Style" (ID: xyz-999) - Formality 80%
Paraphrase → ✅ Entry 2

Result: 2 entries (different profile IDs)
```

---

## 🧹 Cleanup Existing Duplicates

After running migrations:

1. Go to **Admin → Analytics**
2. Click **"🧹 Clean Duplicates"**
3. Confirm
4. See results

**What it does:**
- Groups by `user_id + profile_id`
- Keeps first entry per profile
- Deletes all subsequent duplicates

---

## 🐛 Troubleshooting

### Error: "column profile_id does not exist"
**Solution:** Run `MIGRATION_ADD_PROFILE_ID.sql`

### Error: "verification_score check constraint violated"
**Solution:** Run `MIGRATION_FIX_VERIFICATION_SCORE.sql`

### Still seeing duplicates
**Cause:** Old data from before migrations
**Solution:** Click "Clean Duplicates" button in admin panel

### Analytics not submitting
**Check:**
1. Browser console for errors
2. Supabase logs
3. Run verification queries above

---

## 📝 Technical Details

### Database Schema:
```sql
CREATE TABLE paraphrase_analytics (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_id TEXT,  -- NEW! Optional profile ID
  tone TEXT NOT NULL,
  formality REAL NOT NULL,
  -- ... other fields
);
```

### API Logic:
```typescript
// Check for duplicates by profile_id
if (profileId) {
  const existing = await supabase
    .from('paraphrase_analytics')
    .select('id')
    .eq('user_id', userId)
    .eq('profile_id', profileId)
    .single();
    
  if (existing) {
    return { skipped: true }; // Duplicate!
  }
}
```

### Fallback Behavior:
- If `profile_id` is null (custom on-the-fly styles), analytics still works
- Cleanup tool falls back to style settings for entries without profile_id
- Backward compatible with old data

---

## ✨ Benefits

### For Users:
- Can use same profile multiple times without spam
- Each saved profile counted once
- Editing profile settings doesn't create duplicates

### For Data Quality:
- Tracks "profile diversity" not "paraphrase count"
- More meaningful analytics
- Cleaner dataset

### For Admin:
- See which saved profiles are popular
- Understand user style preferences
- Less noise from repeated use

---

## 🎯 Next Steps

1. ✅ Run migrations (2 SQL files)
2. ✅ Verify setup (run check queries)
3. ✅ Test paraphrasing with saved profiles
4. ✅ Run cleanup if you have old duplicates
5. ✅ Check admin dashboard

Done! Your analytics now tracks by saved profile ID! 🚀
