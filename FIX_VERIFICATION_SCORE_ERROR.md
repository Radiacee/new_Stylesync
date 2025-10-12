# 🔧 Fix: Verification Score Constraint Error

## Problem
You're getting this error:
```
Database error: new row for relation "paraphrase_analytics" 
violates check constraint "paraphrase_analytics_verification_score_check"
```

**Cause:** Your database still has the OLD constraint that requires `verification_score > 50`, but we've updated the system to accept ALL scores (0-100).

## ✅ Solution

### Step 1: Run Migration SQL

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Open the file: **`MIGRATION_FIX_VERIFICATION_SCORE.sql`**
4. **Copy all contents**
5. **Paste into SQL Editor**
6. Click **Run** ▶️

### Step 2: Verify Fix

After running the migration, you should see:
```
constraint_name: paraphrase_analytics_verification_score_check
constraint_definition: CHECK ((verification_score >= (0)::double precision) AND (verification_score <= (100)::double precision))
```

### Step 3: Test

Try paraphrasing again. The analytics should now submit successfully, even with scores below 50%.

## 📋 What the Migration Does

1. **Drops** the old constraint (verification_score > 50)
2. **Creates** new constraint (verification_score >= 0 AND <= 100)
3. **Verifies** the change was applied

## 🎯 Expected Behavior After Fix

**Before (ERROR):**
- Score 47% → ❌ Database error (constraint violation)
- Score 51% → ✅ Accepted

**After (FIXED):**
- Score 47% → ✅ Accepted
- Score 0% → ✅ Accepted
- Score 100% → ✅ Accepted
- Score -1% → ❌ Rejected (below 0)
- Score 101% → ❌ Rejected (above 100)

## 🐛 If Still Having Issues

### Check Constraint Status:
```sql
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.paraphrase_analytics'::regclass
  AND conname LIKE '%verification_score%';
```

### Manually Test Insert:
```sql
-- Replace 'YOUR_USER_ID' with actual user ID
INSERT INTO public.paraphrase_analytics (
  user_id, tone, formality, pacing, descriptiveness, directness,
  verification_score, input_length, output_length, consent_given
) VALUES (
  'YOUR_USER_ID', 'test', 0.5, 0.5, 0.5, 0.5,
  25, 100, 100, false
);
```

If this works, the constraint is fixed! ✅

### Check for Other Constraints:
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.paraphrase_analytics'::regclass;
```

## 🔄 Alternative: Recreate Table

If the migration doesn't work, you can recreate the table:

1. Backup existing data (if any)
2. Drop the table: `DROP TABLE public.paraphrase_analytics CASCADE;`
3. Run the full schema from `ANALYTICS_DATABASE_SCHEMA.sql`

⚠️ **Warning:** This will delete all existing analytics data!

## 📞 Need Help?

If you're still getting errors:
1. Copy the full error message
2. Run the constraint check query above
3. Share the output so we can debug further
