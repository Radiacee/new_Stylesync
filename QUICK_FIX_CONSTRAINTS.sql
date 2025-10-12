    -- QUICK FIX: Remove conflicting verification_score constraints
-- Run this NOW in Supabase SQL Editor to fix your error

-- Remove BOTH old constraints
ALTER TABLE public.paraphrase_analytics 
DROP CONSTRAINT IF EXISTS paraphrase_analytics_verification_score_check;

ALTER TABLE public.paraphrase_analytics 
DROP CONSTRAINT IF EXISTS valid_verification_score;

-- Add the correct constraint (0-100)
ALTER TABLE public.paraphrase_analytics 
ADD CONSTRAINT paraphrase_analytics_verification_score_check 
CHECK (verification_score >= 0 AND verification_score <= 100);

-- Verify it worked
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.paraphrase_analytics'::regclass
  AND conname LIKE '%verification%';

-- You should see only ONE constraint:
-- paraphrase_analytics_verification_score_check | CHECK ((verification_score >= 0) AND (verification_score <= 100))
