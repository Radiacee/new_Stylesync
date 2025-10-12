# Setup Guide: Profile Name Display in Analytics

## Overview
This update adds the **saved style profile name** to analytics entries, making it easy to see which saved style was used for each paraphrase. 

**Duplicate Prevention**: When you use the same saved style profile again, it won't be recorded - only the first paraphrase with that profile is saved.

---

## Quick Setup (3 Steps)

### Step 1: Fix Constraint Issues (If Needed)
If you're still having constraint errors, run this first:

```sql
-- Run in Supabase SQL Editor
ALTER TABLE public.paraphrase_analytics 
DROP CONSTRAINT IF EXISTS paraphrase_analytics_verification_score_check;

ALTER TABLE public.paraphrase_analytics 
DROP CONSTRAINT IF EXISTS valid_verification_score;

ALTER TABLE public.paraphrase_analytics 
ADD CONSTRAINT paraphrase_analytics_verification_score_check 
CHECK (verification_score >= 0 AND verification_score <= 100);
```

### Step 2: Add Profile Name Column
Run this in Supabase SQL Editor:

```sql
-- Add profile_name column
ALTER TABLE public.paraphrase_analytics 
ADD COLUMN IF NOT EXISTS profile_name TEXT;

COMMENT ON COLUMN public.paraphrase_analytics.profile_name IS 
'Name of the saved style profile used (for display in analytics dashboard)';
```

### Step 3: Restart Your App
```powershell
# Stop the dev server (Ctrl+C in terminal)
# Then restart:
npm run dev
```

---

## How It Works

### 1. **Profile Name Display**
When you paraphrase using a saved style profile, the analytics will show:
- 📝 **Profile Name** badge next to the verification score
- Makes it easy to see which saved style was used

### 2. **Automatic Duplicate Prevention**
- First paraphrase with a saved profile → ✅ **Recorded**
- Second paraphrase with same profile → ⏭️ **Skipped** (console message: "Analytics skipped - already recorded for this style profile")
- Different saved profile → ✅ **Recorded** (new entry)

### 3. **Admin Dashboard View**
The analytics dashboard now shows:
```
[85% Match] [📝 Professional Writing] [✓ Consent]
```

---

## Testing

### Test 1: First Paraphrase with Saved Profile
1. Go to paraphrase page
2. Load a saved style profile (e.g., "Professional Writing")
3. Paraphrase some text
4. Check browser console → Should see: **"Analytics submitted successfully"**
5. Check admin dashboard → Should see new entry with **📝 Professional Writing** badge

### Test 2: Duplicate Prevention
1. Use the SAME saved profile again
2. Paraphrase different text
3. Check browser console → Should see: **"Analytics skipped - already recorded for this style profile"**
4. Check admin dashboard → Should still only see ONE entry for that profile

### Test 3: Different Profile
1. Load a DIFFERENT saved profile (e.g., "Casual Blog")
2. Paraphrase some text
3. Check console → Should see: **"Analytics submitted successfully"**
4. Check admin dashboard → Should see new entry with **📝 Casual Blog** badge

---

## Database Schema Changes

### New Column Added:
```sql
profile_name TEXT  -- Name of the saved style profile
```

### Duplicate Detection Logic:
- **If profile_id exists**: Checks for existing entry by `user_id + profile_id`
- **If no profile_id**: Checks by `user_id + style settings` (fallback)
- **Result**: Only ONE entry per user per saved profile

---

## Verification Queries

### Check if column was added:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'paraphrase_analytics'
  AND column_name IN ('profile_id', 'profile_name');
```

Expected output:
```
profile_id    | text | YES
profile_name  | text | YES
```

### Check constraint is correct:
```sql
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.paraphrase_analytics'::regclass
  AND conname LIKE '%verification%';
```

Expected output:
```
paraphrase_analytics_verification_score_check | CHECK ((verification_score >= 0) AND (verification_score <= 100))
```

### View analytics with profile names:
```sql
SELECT 
  id,
  profile_name,
  verification_score,
  tone,
  created_at
FROM public.paraphrase_analytics
ORDER BY created_at DESC
LIMIT 10;
```

---

## Console Messages

When you paraphrase, you'll see these messages:

### ✅ First Time with Profile:
```
Analytics submitted successfully
{success: true, id: "..."}
```

### ⏭️ Duplicate (Already Recorded):
```
Analytics skipped - already recorded for this style profile
{success: true, skipped: true, existingId: "..."}
```

---

## Troubleshooting

### Profile name not showing?
1. Check if column exists:
   ```sql
   \d public.paraphrase_analytics
   ```
2. Verify data was inserted with profile name:
   ```sql
   SELECT profile_name FROM public.paraphrase_analytics WHERE profile_name IS NOT NULL;
   ```

### Still recording duplicates?
1. Check if profile_id is being sent:
   - Open browser DevTools → Network tab
   - Paraphrase with saved profile
   - Click on `submit` request
   - Check payload: should include `profileId` and `profileName`

2. Verify duplicate check is working:
   ```sql
   SELECT user_id, profile_id, COUNT(*) as count
   FROM public.paraphrase_analytics
   WHERE profile_id IS NOT NULL
   GROUP BY user_id, profile_id
   HAVING COUNT(*) > 1;
   ```
   Should return 0 rows (no duplicates)

### Constraint errors persist?
1. Run Step 1 again (drop both constraints)
2. Verify only one constraint exists (query above)
3. If still failing, check error message in console/terminal

---

## What Changed?

### Files Modified:
1. ✅ `src/lib/analytics.ts` - Added `profileName` to interface and submission
2. ✅ `src/app/api/analytics/submit/route.ts` - Accept and store `profile_name`
3. ✅ `src/app/admin/analytics/page.tsx` - Display profile name badge
4. ✅ `ANALYTICS_DATABASE_SCHEMA.sql` - Added `profile_name` column

### New Files:
1. ✅ `MIGRATION_ADD_PROFILE_NAME.sql` - Migration to add column
2. ✅ `SETUP_PROFILE_NAME_DISPLAY.md` - This guide

---

## Benefits

### For Users:
- ✨ No duplicate analytics if they use the same saved profile multiple times
- 🎯 Clear feedback when analytics is skipped

### For Admins:
- 📊 See which saved profiles are most popular
- 🔍 Easily identify patterns by profile name
- 🚀 Better insights into user behavior

---

## Next Steps

After setup is complete:
1. ✅ Paraphrase with different saved profiles
2. ✅ Check admin dashboard to see profile names
3. ✅ Try paraphrasing with same profile again (should be skipped)
4. ✅ Monitor console for success/skip messages

**That's it!** Your analytics now tracks which saved style profiles are being used! 🎉
