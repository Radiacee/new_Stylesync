-- Migration: Update verification_score constraint to allow all scores (0-100)
-- Run this in Supabase SQL Editor to fix the constraint

-- Step 1: Drop the old constraints (both of them)
ALTER TABLE public.paraphrase_analytics 
DROP CONSTRAINT IF EXISTS paraphrase_analytics_verification_score_check;

ALTER TABLE public.paraphrase_analytics 
DROP CONSTRAINT IF EXISTS valid_verification_score;

-- Step 2: Add the new constraint (allows 0-100 instead of requiring > 50)
ALTER TABLE public.paraphrase_analytics 
ADD CONSTRAINT paraphrase_analytics_verification_score_check 
CHECK (verification_score >= 0 AND verification_score <= 100);

-- Verify the change
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.paraphrase_analytics'::regclass
  AND conname LIKE '%verification_score%';

-- Test: This should now work (previously would fail with score < 50)
-- Uncomment to test:
-- INSERT INTO public.paraphrase_analytics (
--   user_id, tone, formality, pacing, descriptiveness, directness,
--   verification_score, input_length, output_length, consent_given
-- ) VALUES (
--   auth.uid(), 'test', 0.5, 0.5, 0.5, 0.5,
--   47, 100, 100, false
-- );
