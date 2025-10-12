# Quick Reference: Profile Name in Analytics

## 🚀 Setup (2 SQL Queries)

### 1. Fix Constraints (if needed):
```sql
ALTER TABLE public.paraphrase_analytics DROP CONSTRAINT IF EXISTS paraphrase_analytics_verification_score_check;
ALTER TABLE public.paraphrase_analytics DROP CONSTRAINT IF EXISTS valid_verification_score;
ALTER TABLE public.paraphrase_analytics ADD CONSTRAINT paraphrase_analytics_verification_score_check CHECK (verification_score >= 0 AND verification_score <= 100);
```

### 2. Add Profile Name:
```sql
ALTER TABLE public.paraphrase_analytics ADD COLUMN IF NOT EXISTS profile_name TEXT;
```

Then restart: `npm run dev`

---

## 🎯 How It Works

| Action | Result | Console Message |
|--------|--------|-----------------|
| First paraphrase with "Professional Writing" | ✅ Recorded | "Analytics submitted successfully" |
| Second paraphrase with "Professional Writing" | ⏭️ Skipped | "Analytics skipped - already recorded for this style profile" |
| First paraphrase with "Casual Blog" | ✅ Recorded | "Analytics submitted successfully" |

---

## 📊 Admin Dashboard Display

**Before:**
```
[85% Match] [✓ Consent]
```

**After:**
```
[85% Match] [📝 Professional Writing] [✓ Consent]
```

---

## ✅ Verify Setup

```sql
-- Check columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'paraphrase_analytics' AND column_name LIKE 'profile%';

-- Expected:
-- profile_id
-- profile_name
```

---

## 🎨 Files Changed

1. ✅ `src/lib/analytics.ts` - Added `profileName` to interface
2. ✅ `src/app/api/analytics/submit/route.ts` - Duplicate check by profile_id
3. ✅ `src/app/admin/analytics/page.tsx` - Display profile name badge
4. ✅ Database - Added `profile_name` column

---

## 🔍 Quick Test

1. Load saved profile "Test Profile"
2. Paraphrase → Check console: "Analytics submitted successfully"
3. Paraphrase again → Check console: "Analytics skipped..."
4. Check admin dashboard → See `📝 Test Profile`

**Done!** 🎉
