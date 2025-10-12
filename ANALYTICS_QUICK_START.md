# Analytics System - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Database Setup (2 minutes)

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy all content from `ANALYTICS_DATABASE_SCHEMA.sql`
4. Paste and Execute

**Tables Created:**
- `paraphrase_analytics` ✓
- `user_preferences` ✓
- `profiles` ✓ (with is_admin support)
- `analytics_suggestions` view ✓

### Step 2: Add Admin Email (30 seconds)

Open `src/app/admin/AdminLayout.tsx` and add your email to the `ADMIN_EMAILS` array:

```typescript
const ADMIN_EMAILS = [
  'banlutachristiandave2@gmail.com', // Already there
  'your-email@example.com', // Add yours here
];
```

### Step 3: Test It! (2 minutes)

#### As Regular User:
1. Navigate to `/paraphrase`
2. Create or select a style profile
3. Paste some text and click "Paraphrase"
4. Wait for result
5. Look for "Style Verification" panel
6. Analytics automatically submitted for ALL results! ✓
7. Check sidebar for "📊 Analytics Sharing" widget
8. Click "Details" to see what's collected
9. Toggle consent ON to share sample text

#### As Admin:
1. Navigate to `/admin`
2. Click "Analytics Dashboard" card
3. See all submitted data!
4. Check statistics cards
5. Try filters: All / With Consent / High Score
6. Sort by Date or Score

## ✅ Verification

### Check Data Collected:
```sql
SELECT * FROM public.paraphrase_analytics 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check Consent Status:
```sql
SELECT * FROM public.user_preferences;
```

### Check You're Admin:
```sql
SELECT id, email, is_admin 
FROM public.profiles 
WHERE is_admin = true;
```

## 🎯 What Happens Automatically

### When Score > 50%:
✅ Style settings collected  
✅ Verification score recorded  
✅ Text lengths saved  
✅ Timestamp added  
❌ Sample text (only if consent enabled)

### User Sees:
📊 Analytics Sharing widget in sidebar  
💡 Clear explanation of data usage  
🔄 Toggle to enable/disable consent  
📖 Details panel for full info

## 🔍 Quick Troubleshooting

### "No data in admin dashboard"
- Check: `SELECT COUNT(*) FROM paraphrase_analytics;`
- Ensure verification score > 50%
- Check browser console for errors

### "Access denied to admin page"
- Check: `is_admin = true` in profiles table
- Sign out and sign in again
- Clear browser cache

### "Analytics not submitting"
- Check verification score in UI
- Open browser console (F12)
- Look for API errors
- Check network tab

### "Consent not saving"
- Check: `user_preferences` table exists
- Run schema again if needed
- Check RLS policies

## 📊 Understanding the Data

### Verification Score
- **50-60%**: Collected but needs improvement
- **60-70%**: Good alignment
- **70-80%**: Great match!
- **80%+**: Excellent! Top suggestions

### What Gets Collected

**Always:**
```json
{
  "tone": "professional",
  "formality": 0.7,
  "pacing": 0.5,
  "descriptiveness": 0.6,
  "directness": 0.8,
  "customLexicon": ["word1", "word2"]
}
```

**Only With Consent:**
```json
{
  "sampleExcerpt": "Your writing sample text..."
}
```

## 🎨 Admin Dashboard Features

### Statistics Cards
- 📈 Total Submissions
- ⭐ Average Score
- ✅ Consent Rate
- 🎯 Top Tone

### Filters
- 🔵 All - Show everything
- 💜 With Consent - Only consented data
- 🟢 High Score - 70%+ only

### Sorting
- 📅 Date - Newest first
- 📊 Score - Highest first

## 💡 Tips for Success

### For Users:
1. **Create detailed profiles** - Better matches = higher scores
2. **Add sample text** - Helps AI understand your style
3. **Enable consent** - Helps improve suggestions for everyone
4. **Try different styles** - Find what works best

### For Admins:
1. **Monitor weekly** - Check trends
2. **Look for patterns** - What styles score highest?
3. **Check consent rates** - Are users comfortable sharing?
4. **Plan features** - Use insights for roadmap

## 🔒 Privacy Reminders

✅ **Users control their data**  
✅ **Consent required for samples**  
✅ **Can change mind anytime**  
✅ **Transparent about usage**  
✅ **Anonymized in suggestions**

## 📚 Full Documentation

- **Technical Details**: See `ANALYTICS_DOCUMENTATION.md`
- **Database Schema**: See `ANALYTICS_DATABASE_SCHEMA.sql`
- **Implementation**: See `ANALYTICS_IMPLEMENTATION_SUMMARY.md`

## 🆘 Need Help?

1. Check browser console (F12)
2. Check Supabase logs
3. Run SQL verification queries
4. Review error messages
5. Check this guide again

## ✨ Success!

If you can:
- ✅ See analytics in admin dashboard
- ✅ Toggle consent on/off
- ✅ Filter and sort data
- ✅ View individual entries

**You're all set! 🎉**

---

**Next Steps:**
1. Collect data over next few days
2. Review patterns in admin dashboard
3. Use insights to improve the product
4. Phase 2: Add user suggestions feature

**Time to complete**: ~5 minutes  
**Difficulty**: Easy  
**Result**: Full analytics system working!
