# Analytics Duplicate Prevention System

## 🎯 Problem Solved
Previously, paraphrasing multiple times with the same style settings would create duplicate entries in the analytics database, cluttering the admin dashboard.

## ✅ Solution Implemented

### **One Entry Per Style Profile Rule** (Lifetime)
**Location:** `src/app/api/analytics/submit/route.ts`

**Core Concept:**
Each user can submit analytics for a specific style profile **ONLY ONCE - EVER**.

**How it works:**
- When analytics data is submitted, the API checks if this user has **ever** submitted analytics with this exact style combination
- Checks match on:
  - Same `user_id`
  - Same `tone`
  - Same `formality`
  - Same `pacing`
  - Same `descriptiveness`
  - Same `directness`

**Behavior:**
- ✅ **First Time**: Creates new analytics entry
- ✅ **Already Exists**: Skips submission silently (returns success with `skipped: true`)
- ✅ **Different Style**: Creates new entry (different profile = different data point)

**Time Window:** Lifetime (no time limit)
- Once you submit analytics for a style profile, that's it!
- Prevents ANY duplicates for that exact style combination
- Encourages users to try different style variations

---

### **Manual Cleanup Tool** (Remove existing duplicates)
**Location:** `src/app/api/analytics/cleanup-duplicates/route.ts`

**How it works:**
- Scans all analytics entries
- Groups entries by user + style settings
- Keeps the **FIRST** (oldest) entry in each group
- Deletes ALL subsequent duplicates (no time window limit)

**Access:**
- Admin analytics dashboard → **"🧹 Clean Duplicates"** button
- Shows confirmation dialog before cleaning
- Displays results: number of duplicates removed

**Rationale:**
- Keeps the first attempt (original data point)
- Removes all retries/duplicates
- One user + one style = one analytics entry

---

## 📊 Benefits

### For Users:
- ✅ Each unique style profile counted once
- ✅ Encourages experimentation with different styles
- ✅ No spam from repeated paraphrasing

### For Admins:
- ✅ Clean, accurate data (one entry per unique style)
- ✅ True measure of style diversity
- ✅ No duplicate inflation of statistics
- ✅ Easy one-click cleanup for existing duplicates

### For Analytics Quality:
- ✅ Each data point represents a unique style choice
- ✅ Accurate representation of style preferences
- ✅ Better insights into what styles users actually try

---

## 🔧 Configuration

### Disable Duplicate Prevention (if needed):

```typescript
// In: src/app/api/analytics/submit/route.ts
// Comment out the duplicate check:

/*
const { data: existingEntry } = await supabase
  .from('paraphrase_analytics')
  .select('id, created_at, verification_score')
  .eq('user_id', userId)
  // ... rest of checks
  .single();

if (existingEntry) {
  return NextResponse.json({ 
    success: true,
    skipped: true,
    message: 'Analytics already recorded for this style profile'
  });
}
*/
```

---

## 🚀 Usage

### For New Paraphrases (Automatic):
1. User paraphrases with Style A → ✅ Analytics submitted
2. User paraphrases again with Style A → ⏭️ Skipped (already recorded)
3. User paraphrases with Style B → ✅ Analytics submitted (new style!)

### For Existing Duplicates (Manual):
1. Go to **Admin Dashboard** → **Analytics**
2. Click **"🧹 Clean Duplicates"**
3. Confirm the action
4. Review the results

**Result Message:**
```
✅ Cleanup complete!

Removed: 15 duplicates
Remaining: 42 entries
Unique Profiles: 42
```

---

## 🔍 Technical Details

### Duplicate Detection Logic:

```sql
SELECT id, created_at, verification_score 
FROM paraphrase_analytics
WHERE user_id = ?
  AND tone = ?
  AND formality = ?
  AND pacing = ?
  AND descriptiveness = ?
  AND directness = ?
LIMIT 1
```

**No time conditions** - checks entire history.

### Response Behavior:

**New Entry:**
```json
{
  "success": true,
  "id": "abc-123",
  "message": "Analytics data submitted successfully"
}
```

**Duplicate (Skipped):**
```json
{
  "success": true,
  "skipped": true,
  "existingId": "xyz-789",
  "message": "Analytics already recorded for this style profile"
}
```

---

## 📈 Example Scenarios

### Scenario 1: Same Style, Multiple Paraphrases
**User:** Dave  
**Action:** Paraphrases 5 times with "Professional, Formal 80%, Pacing 60%"  
**Result:** 
- First paraphrase → ✅ Analytics entry created
- Next 4 paraphrases → ⏭️ Skipped (duplicate style profile)
- **Total entries:** 1

### Scenario 2: Different Styles
**User:** Dave  
**Action:** 
1. Paraphrases with "Professional, Formal 80%"
2. Paraphrases with "Casual, Formal 40%"
3. Paraphrases with "Professional, Formal 81%"

**Result:**
- Paraphrase 1 → ✅ Entry 1 created
- Paraphrase 2 → ✅ Entry 2 created (different style)
- Paraphrase 3 → ✅ Entry 3 created (formality differs by 1%)
- **Total entries:** 3

### Scenario 3: Cleanup Existing Duplicates
**Database before:**
```
ID  | User | Style              | Created
1   | Dave | Professional 0.8   | 2025-10-01
2   | Dave | Professional 0.8   | 2025-10-02  ← Duplicate
3   | Dave | Professional 0.8   | 2025-10-03  ← Duplicate
4   | Dave | Casual 0.4         | 2025-10-04
```

**After cleanup:**
```
ID  | User | Style              | Created
1   | Dave | Professional 0.8   | 2025-10-01  ← Kept (first)
4   | Dave | Casual 0.4         | 2025-10-04
```
**Removed:** 2 duplicates (IDs 2 and 3)

---

## ⚠️ Edge Cases Handled

### Case 1: Slight style variations
**Scenario:** User adjusts formality from 0.80 to 0.81  
**Result:** Creates new entry (different style settings)  
**Why:** Even 1% difference = different style profile = new data point

### Case 2: Same user, different sessions
**Scenario:** User paraphrases today, then again next week with same style  
**Result:** Second attempt skipped  
**Why:** Style profile already recorded (time doesn't matter)

### Case 3: Different users, identical styles
**Scenario:** User A and User B both use "Professional, Formal 80%"  
**Result:** Both get entries  
**Why:** Grouped by user_id (each user can have their own entry)

### Case 4: Custom lexicon changes
**Scenario:** Same style but different custom words  
**Result:** Creates new entry  
**Why:** Custom lexicon is NOT part of duplicate detection (only the 5 main settings)

---

## 🧪 Testing

### Test Duplicate Prevention:
1. Set up a style profile (e.g., "Professional, 80% formal")
2. Paraphrase text → Check analytics dashboard (should see 1 entry)
3. Paraphrase again with SAME style → Check browser console
4. Should see: "Analytics skipped - already recorded for this style profile"
5. Analytics dashboard should still show only 1 entry ✅

### Test Different Styles:
1. Paraphrase with Style A (Professional 80%)
2. Paraphrase with Style B (Casual 40%)
3. Check analytics dashboard
4. Should see 2 entries ✅

### Test Cleanup Tool:
1. Manually create duplicates (or use old data)
2. Go to Admin → Analytics
3. Note the total count
4. Click "Clean Duplicates"
5. Verify count decreased
6. Each user+style combination should appear only once ✅

---

## � Troubleshooting

### Issue: "Analytics not submitting"
**Cause:** You already submitted for this style profile  
**Solution:** This is expected behavior! Try a different style combination

### Issue: "Still seeing duplicates after cleanup"
**Cause:** Entries might have slightly different values  
**Solution:** 
- Check if formality/pacing values are slightly different
- Use `.toFixed(2)` when comparing if needed

### Issue: "Want to allow re-submission"
**Solution:** 
- Delete the existing entry from database manually
- Or modify the API to allow updates instead of skipping

---

## 📝 Key Differences from Previous Version

| Aspect | Old Behavior | New Behavior |
|--------|--------------|--------------|
| **Time Window** | 5 minutes | Lifetime (forever) |
| **Action on Duplicate** | Update existing entry | Skip submission |
| **Philosophy** | Track repeated use | Track unique styles only |
| **Data Growth** | Linear with usage | Linear with style diversity |
| **Entry Count** | Many per user | One per unique style per user |

---

## 📚 Related Files

- `/src/app/api/analytics/submit/route.ts` - One-time submission logic
- `/src/app/api/analytics/cleanup-duplicates/route.ts` - Batch duplicate removal
- `/src/app/admin/analytics/page.tsx` - Admin UI with cleanup button
- `/src/lib/analytics.ts` - Client-side analytics service (handles "skipped" response)
