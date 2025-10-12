# 🚀 Setup Analytics - Do This Now!

## Changes Made:
✅ **Analytics now collects ALL paraphrase results** (not just >50% score)
✅ **Analytics page uses AdminLayout** (email-based admin check)
✅ **Better error messages** when no data exists
✅ **Console logging** to help debug data loading

---

## 📋 Setup Checklist:

### 1️⃣ Create Database Tables (Required!)

The analytics page won't work until you create the tables.

**Steps:**
1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Open the file: `ANALYTICS_DATABASE_SCHEMA.sql`
4. **Copy ALL the contents**
5. **Paste into Supabase SQL Editor**
6. Click **Run** ▶️

**What this creates:**
- `paraphrase_analytics` table (stores all analytics data)
- `user_preferences` table (stores user consent settings)
- `profiles` table (stores user profiles with admin flag)
- Row Level Security policies
- Helpful views and functions

---

### 2️⃣ Verify Your Admin Email

The admin check is based on email address, not database flag.

**Check this file:** `src/app/admin/AdminLayout.tsx`

```typescript
const ADMIN_EMAILS = [
  'banlutachristiandave2@gmail.com', // Your current email
  // Add more admin emails here if needed
];
```

Make sure your email (`banlutachristiandave2@gmail.com`) is in this list. ✓

---

### 3️⃣ Test the System

#### Test as User:
1. Go to **`/paraphrase`** page
2. Paste any text
3. Click **"Paraphrase"**
4. Wait for results
5. Look for **"Style Verification"** panel below results
6. Check browser console - should see: `"Analytics submitted successfully"`

#### Test as Admin:
1. Go to **`/admin`** page
2. Click **"Analytics Dashboard"** card
3. Should see the analytics page (not redirect to homepage!)
4. Check browser console for: `"Analytics loaded: X entries"`

---

## 🔍 Debugging Tips:

### If analytics page redirects to homepage:
- Your email might not match exactly
- Check browser console for auth errors
- Try signing out and back in

### If no data appears:
1. Open browser console (F12)
2. Look for error messages
3. Check if tables exist in Supabase
4. Verify user has actually paraphrased something
5. Check console for: `"Analytics loaded: 0 entries"`

### If you see table errors:
- Run the SQL schema again
- Make sure you're signed in to Supabase
- Check Supabase logs for SQL errors

---

## ✨ What's Collected:

**Every time a user paraphrases:**
- Style settings (tone, formality, pacing, etc.)
- Verification score (how well style matched)
- Input/output length
- Sample excerpt (ONLY if user gives consent)
- Timestamp

**No sensitive data** is collected unless user explicitly opts in!

---

## 📊 Expected Behavior:

### After Setup:
1. ✅ Users paraphrase normally (no changes to their experience)
2. ✅ Analytics automatically submitted after each paraphrase
3. ✅ Admin can view all analytics at `/admin/analytics`
4. ✅ See aggregate stats: average scores, popular tones, etc.
5. ✅ Filter by consent status or high scores
6. ✅ Sort by date or verification score

---

## 🎯 Quick Verification:

Run this in Supabase SQL Editor after setup:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('paraphrase_analytics', 'user_preferences', 'profiles');

-- Should return 3 rows
```

If you see 3 tables, you're good! 🎉

---

## Need Help?

Check these files:
- `ANALYTICS_QUICK_START.md` - Detailed setup guide
- `ANALYTICS_DOCUMENTATION.md` - Full documentation
- `ANALYTICS_SQL_TROUBLESHOOTING.md` - SQL error fixes
