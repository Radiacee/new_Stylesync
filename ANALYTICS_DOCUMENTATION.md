# Analytics System Documentation

## Overview

The Analytics System collects high-quality paraphrase results (>50% style verification) to:
1. Help admins understand which style combinations work best
2. Provide suggestions to users based on successful style profiles
3. Improve the overall paraphrasing quality

## Key Features

### 🎯 What's Collected

**Always Collected (when verification > 50%):**
- Style settings (tone, formality, pacing, descriptiveness, directness)
- Custom lexicon (if any)
- Verification score
- Text lengths (input and output)
- Timestamp

**Optional (Requires User Consent):**
- User's sample excerpt

### 🔒 Privacy & Control

- **User Consent Required**: Sample excerpts are ONLY collected if user explicitly opts in
- **High-Quality Only**: Only results with >50% verification are collected
- **User Control**: Users can toggle consent on/off anytime
- **Anonymized**: Data is aggregated and anonymized in suggestions
- **Transparent**: Clear explanation of what's collected and how it's used

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Paraphrase Page                                       │  │
│  │  - Style Verification (calculates score)              │  │
│  │  - Analytics Consent Widget                           │  │
│  │  - Automatic submission when score > 50%              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Analytics Service                        │
│  - shouldCollectAnalytics()                                  │
│  - prepareAnalyticsData()                                    │
│  - submitAnalytics()                                         │
│  - getUserConsent() / updateUserConsent()                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Endpoints                            │
│  /api/analytics/submit      - Submit analytics data          │
│  /api/analytics/suggestions - Get style suggestions          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Database                            │
│  - paraphrase_analytics (main data)                          │
│  - user_preferences (consent status)                         │
│  - analytics_suggestions (aggregated view)                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Admin Dashboard                          │
│  /admin/analytics                                            │
│  - View all submissions                                      │
│  - Filter by score, consent, etc.                           │
│  - Aggregate statistics                                      │
│  - Top performing styles                                     │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

#### `paraphrase_analytics` Table
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key to auth.users)
- tone (TEXT)
- formality (REAL, 0-1)
- pacing (REAL, 0-1)
- descriptiveness (REAL, 0-1)
- directness (REAL, 0-1)
- custom_lexicon (TEXT[])
- sample_excerpt (TEXT, nullable - only if consent_given)
- verification_score (REAL, >50)
- input_length (INTEGER)
- output_length (INTEGER)
- consent_given (BOOLEAN)
- created_at (TIMESTAMPTZ)
```

#### `user_preferences` Table
```sql
- user_id (UUID, primary key)
- analytics_consent (BOOLEAN, default false)
- updated_at (TIMESTAMPTZ)
```

## User Flow

### 1. Initial Setup (First Time)
```
User paraphrases text
    ↓
StyleVerification calculates score
    ↓
If score > 50%:
    ↓
System checks user consent status
    ↓
Submits analytics (without sample excerpt if no consent)
    ↓
User sees AnalyticsConsent widget in sidebar
```

### 2. Giving Consent
```
User opens Details in AnalyticsConsent widget
    ↓
Reads what data is collected and how it's used
    ↓
Toggles consent switch ON
    ↓
Future submissions include sample excerpt
```

### 3. Admin View
```
Admin logs into /admin/analytics
    ↓
Views aggregate statistics:
  - Total submissions
  - Average scores
  - Top tones
  - Average style settings
    ↓
Filters by:
  - All submissions
  - With consent only
  - High score (≥70%) only
    ↓
Sorts by date or score
```

### 4. Suggestions (Future Feature)
```
User wants to try a new style
    ↓
Views suggestions from /api/analytics/suggestions
    ↓
Sees top-performing style combinations
    ↓
Clicks to apply a suggested profile
    ↓
Profile settings are pre-filled
```

## API Reference

### POST /api/analytics/submit

Submit analytics data for a successful paraphrase.

**Headers:**
```
Authorization: Bearer <supabase_jwt>
Content-Type: application/json
```

**Body:**
```json
{
  "styleOptions": {
    "tone": "professional",
    "formality": 0.7,
    "pacing": 0.5,
    "descriptiveness": 0.6,
    "directness": 0.8,
    "customLexicon": ["innovative", "streamline"]
  },
  "sampleExcerpt": "...",  // Optional, only if consentGiven=true
  "verificationScore": 75.5,
  "inputLength": 250,
  "outputLength": 245,
  "consentGiven": true
}
```

**Response (Success):**
```json
{
  "success": true,
  "id": "uuid",
  "message": "Analytics data submitted successfully"
}
```

**Response (Error):**
```json
{
  "error": "Verification score must be greater than 50%"
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid data (score ≤50% or missing fields)
- `401` - Unauthorized (no valid JWT)
- `500` - Server error

### GET /api/analytics/suggestions

Get public style suggestions based on high-performing data.

**Query Parameters:**
- `limit` (optional, default: 10) - Maximum number of suggestions

**Response:**
```json
{
  "suggestions": [
    {
      "id": "professional_7_5_6_8",
      "styleOptions": {
        "tone": "professional",
        "formality": 0.7,
        "pacing": 0.5,
        "descriptiveness": 0.6,
        "directness": 0.8,
        "customLexicon": []
      },
      "sampleExcerpt": "...",  // Only if user gave consent
      "verificationScore": 82.5,
      "usageCount": 15,
      "averageScore": 82.5,
      "createdAt": "2025-10-12T10:30:00Z",
      "isPublic": true
    }
  ],
  "total": 10
}
```

## Analytics Service API

### TypeScript Interfaces

```typescript
interface AnalyticsData {
  userId: string;
  styleOptions: {
    tone: string;
    formality: number;
    pacing: number;
    descriptiveness: number;
    directness: number;
    customLexicon?: string[];
  };
  sampleExcerpt?: string;
  verificationScore: number;
  inputLength: number;
  outputLength: number;
  timestamp: string;
  consentGiven: boolean;
}

interface AnalyticsSuggestion {
  id: string;
  styleOptions: { /* ... */ };
  sampleExcerpt?: string;
  verificationScore: number;
  usageCount: number;
  averageScore: number;
  createdAt: string;
  isPublic: boolean;
}
```

### Functions

#### `shouldCollectAnalytics(score: number): boolean`
Checks if analytics should be collected based on verification score.

```typescript
const score = 75;
if (shouldCollectAnalytics(score)) {
  // Submit analytics
}
```

#### `prepareAnalyticsData(...): AnalyticsData`
Prepares analytics data from paraphrase result.

```typescript
const data = prepareAnalyticsData(
  userId,
  profile,
  verificationScore,
  input.length,
  output.length,
  userConsent
);
```

#### `submitAnalytics(data: AnalyticsData): Promise<boolean>`
Submits analytics data to the server.

```typescript
const success = await submitAnalytics(analyticsData);
if (success) {
  console.log('Analytics submitted');
}
```

#### `getUserConsent(userId: string): Promise<boolean>`
Gets user's current consent status.

```typescript
const hasConsent = await getUserConsent(userId);
```

#### `updateUserConsent(userId: string, consent: boolean): Promise<boolean>`
Updates user's consent status.

```typescript
const success = await updateUserConsent(userId, true);
```

#### `getStyleSuggestions(limit?: number): Promise<AnalyticsSuggestion[]>`
Fetches public style suggestions.

```typescript
const suggestions = await getStyleSuggestions(10);
```

## Admin Dashboard Features

### Statistics Panel
- **Total Submissions**: Count of all analytics entries
- **Average Score**: Mean verification score across all submissions
- **Consent Rate**: Percentage of users who gave consent
- **Top Tone**: Most frequently used tone

### Average Style Settings
Shows the average values for:
- Formality
- Pacing
- Descriptiveness
- Directness

### Top Tones Chart
Bar chart showing:
- Tone name
- Usage count
- Percentage of total

### Filters
- **All**: Show all submissions
- **With Consent**: Only show entries where users shared samples
- **High Score**: Only show entries with ≥70% verification

### Sorting
- **By Date**: Most recent first
- **By Score**: Highest scores first

### Individual Entry Cards
Each card shows:
- Verification score badge (color-coded)
- Consent indicator
- Timestamp
- All style settings
- Performance metrics
- Custom lexicon (if any)
- Sample excerpt (if consent given)

## Setup Instructions

### 1. Database Setup

Run the SQL schema in your Supabase project:

```bash
# Copy the content from ANALYTICS_DATABASE_SCHEMA.sql
# Paste into Supabase SQL Editor
# Execute the script
```

### 2. Environment Variables

No additional environment variables needed. Uses existing Supabase configuration.

### 3. Admin Access

Ensure admin users have `is_admin = true` in the `profiles` table:

```sql
UPDATE public.profiles 
SET is_admin = true 
WHERE id = '<admin_user_id>';
```

### 4. Test the System

1. Sign in as a regular user
2. Create a style profile
3. Paraphrase some text
4. Check that verification score > 50%
5. See the AnalyticsConsent widget appear
6. Toggle consent on/off
7. Check admin dashboard to see the submission

## Privacy Compliance

### Data Collection Principles

1. **Minimal Collection**: Only collect what's necessary
2. **Explicit Consent**: Sample excerpts require opt-in
3. **User Control**: Users can change consent anytime
4. **Transparency**: Clear explanation of data usage
5. **Anonymization**: Aggregated data for suggestions

### GDPR Compliance

- ✅ Right to access: Users can view their data
- ✅ Right to rectification: Can update consent
- ✅ Right to erasure: Data deleted with account
- ✅ Data minimization: Only high-quality results
- ✅ Purpose limitation: Only for improvements
- ✅ Transparency: Clear privacy notice

### User Communication

The AnalyticsConsent component explains:
- **What** data is collected
- **How** it's used
- **Your** control options
- **Privacy** protections

## Troubleshooting

### Analytics not being submitted

**Check:**
1. Is verification score > 50%?
2. Is user authenticated?
3. Check browser console for errors
4. Verify Supabase tables exist
5. Check RLS policies

**Debug:**
```typescript
console.log('Score:', verificationScore);
console.log('Should collect:', shouldCollectAnalytics(verificationScore));
console.log('User ID:', userId);
console.log('Profile:', profile);
```

### Admin dashboard shows no data

**Check:**
1. Does the user have `is_admin = true`?
2. Are there any analytics entries in the database?
3. Check browser console for API errors
4. Verify RLS policies allow admin access

**Query:**
```sql
SELECT COUNT(*) FROM public.paraphrase_analytics;
SELECT * FROM public.profiles WHERE is_admin = true;
```

### Consent not saving

**Check:**
1. Does `user_preferences` table exist?
2. Are RLS policies configured correctly?
3. Is user authenticated?
4. Check network tab for API errors

## Performance Considerations

### Indexing
The schema includes indexes on:
- `user_id` - For user-specific queries
- `verification_score` - For high-score filtering
- `created_at` - For time-based queries
- `consent_given` - For consent filtering
- Composite index for suggestion queries

### Aggregation
- Use the `analytics_suggestions` view for faster queries
- Cache suggestions on the client side
- Limit result sets appropriately

### Cleanup
- Use the `clean_old_analytics()` function to remove old data
- Default: Keep 90 days of non-consented data
- Consented data is retained (user explicitly shared)

```sql
SELECT clean_old_analytics(90);
```

## Future Enhancements

### Phase 2 Features
1. **Suggestion Application**: One-click apply suggested profiles
2. **Personalized Suggestions**: Based on user's past preferences
3. **A/B Testing**: Compare style variations
4. **Trend Analysis**: Track style popularity over time
5. **Export Reports**: Admin analytics export

### Phase 3 Features
1. **Machine Learning**: Predict optimal settings
2. **Collaborative Filtering**: "Users like you also use..."
3. **Style Templates**: Pre-built profiles from analytics
4. **Performance Metrics**: Response time, success rate
5. **User Feedback**: Rating system for suggestions

## Security Considerations

### Row Level Security (RLS)
- Users can only insert/view their own analytics
- Admins can view all analytics
- Suggestions are public (aggregated data only)

### Data Validation
- Verification score must be > 50%
- Style values must be between 0-1
- Required fields enforced
- SQL injection protection (parameterized queries)

### Authentication
- All endpoints require valid Supabase JWT
- User ID extracted from JWT (can't be spoofed)
- Admin status verified from database

## Support

### Questions?
- Check this documentation first
- Review the code comments
- Test with sample data
- Check Supabase logs

### Reporting Issues
Include:
1. What you were trying to do
2. What happened instead
3. Browser console errors
4. Network tab responses
5. Supabase table states

---

**Last Updated**: October 12, 2025
**Version**: 1.0.0
**Status**: Production Ready
