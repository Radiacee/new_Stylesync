# 🔴 URGENT FIX: Conflicting Verification Score Constraints

## Problem
Your database has **TWO conflicting constraints**:
1. ✅ `verification_score >= 0 AND verification_score <= 100` (correct)
2. ❌ `verification_score > 50` (old constraint blocking scores below 50)

Score 45 is being **rejected by the second constraint**.

---

## ⚡ Quick Fix (30 seconds)

### Copy this into Supabase SQL Editor and run:

```sql
-- Remove BOTH old constraints
ALTER TABLE public.paraphrase_analytics 
DROP CONSTRAINT IF EXISTS paraphrase_analytics_verification_score_check;

ALTER TABLE public.paraphrase_analytics 
DROP CONSTRAINT IF EXISTS valid_verification_score;

-- Add the correct constraint (0-100)
ALTER TABLE public.paraphrase_analytics 
ADD CONSTRAINT paraphrase_analytics_verification_score_check 
CHECK (verification_score >= 0 AND verification_score <= 100);
```

**Or use the file:** `QUICK_FIX_CONSTRAINTS.sql`

---

## ✅ After Running:

Try paraphrasing again - it should work now!

**Scores that will work:**
- ✅ 0% to 100% → Accepted
- ❌ -1% or 101% → Rejected

---

## 🔍 Verify Fix Worked

Run this query:
```sql
SELECT 
  conname,
  pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.paraphrase_analytics'::regclass
  AND conname LIKE '%verification%';
```

**Expected result:**
```
paraphrase_analytics_verification_score_check
CHECK ((verification_score >= 0) AND (verification_score <= 100))
```

You should see **ONLY ONE** constraint, not two.

---

## 📋 Full Setup (After Fix)

Once the fix is applied, complete the setup:

1. ✅ `QUICK_FIX_CONSTRAINTS.sql` ← **Run this first!**
2. ✅ `MIGRATION_ADD_PROFILE_ID.sql` ← Then run this
3. ✅ Test paraphrasing
4. ✅ Clean duplicates if needed

---

## 🎯 What Happened?

The schema file had a leftover constraint from when analytics only collected scores >50%. We updated the code to accept all scores, but the old constraint was still in the database.

**Fixed files:**
- ✅ `ANALYTICS_DATABASE_SCHEMA.sql` - Removed duplicate constraint
- ✅ `MIGRATION_FIX_VERIFICATION_SCORE.sql` - Now drops both constraints
- ✅ `QUICK_FIX_CONSTRAINTS.sql` - NEW! Instant fix

---

## 💡 Pro Tip

After fixing, your analytics will accept ALL verification scores. This gives you better data quality and insights into both high and low-scoring paraphrases.
