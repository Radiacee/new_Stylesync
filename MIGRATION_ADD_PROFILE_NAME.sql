-- Migration: Add profile_name column to paraphrase_analytics
-- Run this in Supabase SQL Editor

-- Add profile_name column to store the name of the saved style profile
ALTER TABLE public.paraphrase_analytics 
ADD COLUMN IF NOT EXISTS profile_name TEXT;

COMMENT ON COLUMN public.paraphrase_analytics.profile_name IS 
'Name of the saved style profile used (for display in analytics dashboard)';

-- Verify the column was added
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'paraphrase_analytics'
  AND column_name = 'profile_name';
