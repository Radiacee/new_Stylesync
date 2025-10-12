# Analytics SQL Schema - Troubleshooting

## ✅ Fixed SQL Schema

The SQL schema has been updated to fix the `IF NOT EXISTS` issue with policies.

**Issue:** PostgreSQL doesn't support `IF NOT EXISTS` for `CREATE POLICY`  
**Solution:** Use `DROP POLICY IF EXISTS` before creating policies

## 📁 Which File to Use?

Use either:
- **`ANALYTICS_DATABASE_SCHEMA.sql`** (original, now fixed)
- **`ANALYTICS_DATABASE_SCHEMA_FIXED.sql`** (backup with success message)

Both are identical and safe to run multiple times.

## 🚀 How to Run the Schema

### Option 1: Supabase SQL Editor (Recommended)

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the entire content from `ANALYTICS_DATABASE_SCHEMA.sql`
5. Paste into the editor
6. Click **Run** (or press Ctrl+Enter)

### Option 2: Run in Sections

If you want to run it piece by piece:

#### Section 1: Tables
```sql
-- Copy and run the CREATE TABLE statements first
CREATE TABLE IF NOT EXISTS public.paraphrase_analytics (...);
CREATE TABLE IF NOT EXISTS public.user_preferences (...);
```

#### Section 2: Indexes
```sql
-- Then run the index creation
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ...
```

#### Section 3: RLS Policies
```sql
-- Enable RLS and create policies
ALTER TABLE public.paraphrase_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own analytics" ON public.paraphrase_analytics;
CREATE POLICY "Users can insert own analytics" ...
```

#### Section 4: Views and Functions
```sql
-- Finally, create views and functions
CREATE OR REPLACE VIEW public.analytics_suggestions AS ...
CREATE OR REPLACE FUNCTION clean_old_analytics(...) ...
```

## ✅ Verification

After running the schema, verify everything was created:

### Check Tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('paraphrase_analytics', 'user_preferences');
```

**Expected Result:** 2 rows

### Check Indexes
```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'paraphrase_analytics';
```

**Expected Result:** Multiple rows with names starting with `idx_analytics_`

### Check RLS Policies
```sql
SELECT policyname, tablename 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('paraphrase_analytics', 'user_preferences');
```

**Expected Result:** 5 policies

### Check View
```sql
SELECT * FROM public.analytics_suggestions LIMIT 1;
```

**Expected Result:** Empty result (no error) if no data yet

### Check Functions
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('clean_old_analytics', 'get_personalized_suggestions');
```

**Expected Result:** 2 rows

## 🐛 Common Issues

### Issue: "relation does not exist"
**Cause:** Tables not created yet  
**Fix:** Run the CREATE TABLE statements first

### Issue: "policy already exists"
**Cause:** Old version of schema without DROP POLICY  
**Fix:** Run the new schema which includes DROP POLICY

### Issue: "permission denied"
**Cause:** Not enough privileges  
**Fix:** Make sure you're connected as the database owner or have sufficient privileges

### Issue: "cannot create policy on table without row level security"
**Cause:** RLS not enabled  
**Fix:** Run `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` before creating policies

## 🔧 Manual Cleanup (if needed)

If you need to start fresh:

```sql
-- Drop everything (WARNING: This deletes all data!)
DROP TABLE IF EXISTS public.paraphrase_analytics CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP VIEW IF EXISTS public.analytics_suggestions CASCADE;
DROP FUNCTION IF EXISTS clean_old_analytics(INTEGER);
DROP FUNCTION IF EXISTS get_personalized_suggestions(TEXT, REAL, INTEGER);

-- Then run the schema again
```

## ✅ Success Indicators

You know it worked when:

1. ✅ No error messages in SQL editor
2. ✅ Tables appear in Supabase Table Editor
3. ✅ Policies listed under "RLS" in table settings
4. ✅ View accessible with SELECT query
5. ✅ Functions callable

## 📝 Next Steps

After schema is successfully created:

1. **Set admin user:**
   ```sql
   UPDATE public.profiles 
   SET is_admin = true 
   WHERE id = 'your-user-id';
   ```

2. **Test analytics submission:**
   - Paraphrase some text
   - Check for score > 50%
   - Verify data in table

3. **Check admin dashboard:**
   - Navigate to `/admin/analytics`
   - View submitted data

## 🆘 Still Having Issues?

1. Check Supabase logs (Database → Logs)
2. Verify your Supabase plan has sufficient privileges
3. Make sure you're using PostgreSQL 12+
4. Try running sections individually
5. Check for conflicting table/policy names

## 📞 Error Messages Reference

| Error | Meaning | Solution |
|-------|---------|----------|
| `syntax error at or near "NOT"` | Old schema with IF NOT EXISTS on policies | Use updated schema |
| `relation already exists` | Table already created | Safe to ignore or use IF NOT EXISTS |
| `policy already exists` | Policy already created | Use DROP POLICY IF EXISTS first |
| `permission denied` | Insufficient privileges | Use admin/owner account |
| `function already exists` | Function already created | Use CREATE OR REPLACE |

---

**File Status:** ✅ Fixed and ready to use  
**Safe to Re-run:** ✅ Yes  
**Last Updated:** October 12, 2025
