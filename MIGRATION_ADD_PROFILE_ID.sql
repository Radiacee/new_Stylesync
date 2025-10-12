-- Migration: Add profile_id column to paraphrase_analytics
-- This allows tracking analytics by saved style profile instead of individual settings
-- Run this in Supabase SQL Editor

-- Step 1: Add profile_id column (nullable, since existing entries don't have it)
ALTER TABLE public.paraphrase_analytics 
ADD COLUMN IF NOT EXISTS profile_id TEXT;

-- Step 2: Add index for faster lookups by profile_id
CREATE INDEX IF NOT EXISTS idx_paraphrase_analytics_profile_id 
ON public.paraphrase_analytics(profile_id);

-- Step 3: Add composite index for user + profile duplicate checks
CREATE INDEX IF NOT EXISTS idx_paraphrase_analytics_user_profile 
ON public.paraphrase_analytics(user_id, profile_id);

-- Step 4: Add comment explaining the column
COMMENT ON COLUMN public.paraphrase_analytics.profile_id IS 
'Optional: ID of the saved style profile used. Used to prevent duplicate analytics for the same saved profile.';

-- Verify the changes
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'paraphrase_analytics'
  AND column_name = 'profile_id';

-- Check indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'paraphrase_analytics'
  AND indexname LIKE '%profile%';

-- Done! Now analytics will track by saved profile ID
-- Entries without profile_id (custom on-the-fly styles) will still be accepted
