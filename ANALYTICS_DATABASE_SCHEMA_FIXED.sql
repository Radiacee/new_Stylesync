-- Analytics System Database Schema (Safe to re-run)
-- This schema supports collecting high-quality paraphrase results for insights and suggestions

-- 1. Paraphrase Analytics Table
-- Stores successful paraphrase results with style settings and verification scores
CREATE TABLE IF NOT EXISTS public.paraphrase_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Style Options
  tone TEXT NOT NULL,
  formality REAL NOT NULL CHECK (formality >= 0 AND formality <= 1),
  pacing REAL NOT NULL CHECK (pacing >= 0 AND pacing <= 1),
  descriptiveness REAL NOT NULL CHECK (descriptiveness >= 0 AND descriptiveness <= 1),
  directness REAL NOT NULL CHECK (directness >= 0 AND directness <= 1),
  custom_lexicon TEXT[] DEFAULT '{}',
  
  -- Sample excerpt (optional, requires user consent)
  sample_excerpt TEXT,
  
  -- Performance Metrics
  verification_score REAL NOT NULL CHECK (verification_score > 50 AND verification_score <= 100),
  input_length INTEGER NOT NULL,
  output_length INTEGER NOT NULL,
  
  -- Privacy & Control
  consent_given BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON public.paraphrase_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_verification_score ON public.paraphrase_analytics(verification_score DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON public.paraphrase_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_consent ON public.paraphrase_analytics(consent_given) WHERE consent_given = true;
CREATE INDEX IF NOT EXISTS idx_analytics_tone ON public.paraphrase_analytics(tone);

-- Composite index for suggestion queries
CREATE INDEX IF NOT EXISTS idx_analytics_suggestions ON public.paraphrase_analytics(
  verification_score DESC, 
  consent_given, 
  created_at DESC
) WHERE verification_score >= 70;

-- Row Level Security (RLS) Policies
ALTER TABLE public.paraphrase_analytics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe to run multiple times)
DROP POLICY IF EXISTS "Users can insert own analytics" ON public.paraphrase_analytics;
DROP POLICY IF EXISTS "Users can view own analytics" ON public.paraphrase_analytics;
DROP POLICY IF EXISTS "Admins can view all analytics" ON public.paraphrase_analytics;

-- Users can insert their own analytics
CREATE POLICY "Users can insert own analytics" 
  ON public.paraphrase_analytics 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own analytics
CREATE POLICY "Users can view own analytics" 
  ON public.paraphrase_analytics 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Admins can view all analytics
CREATE POLICY "Admins can view all analytics" 
  ON public.paraphrase_analytics 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- 2. User Preferences Table
-- Stores user preferences including analytics consent
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  analytics_consent BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;

CREATE POLICY "Users can view own preferences" 
  ON public.user_preferences 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" 
  ON public.user_preferences 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Analytics Aggregation View (Optional - for performance)
-- Pre-aggregated view for faster suggestion queries
CREATE OR REPLACE VIEW public.analytics_suggestions AS
SELECT 
  tone,
  ROUND(AVG(formality)::numeric, 2) as avg_formality,
  ROUND(AVG(pacing)::numeric, 2) as avg_pacing,
  ROUND(AVG(descriptiveness)::numeric, 2) as avg_descriptiveness,
  ROUND(AVG(directness)::numeric, 2) as avg_directness,
  ROUND(AVG(verification_score)::numeric, 1) as avg_score,
  COUNT(*) as usage_count,
  MAX(created_at) as last_used,
  bool_or(consent_given AND sample_excerpt IS NOT NULL) as has_sample
FROM public.paraphrase_analytics
WHERE verification_score >= 70
GROUP BY tone
HAVING COUNT(*) >= 3  -- Only show styles used at least 3 times
ORDER BY avg_score DESC, usage_count DESC;

-- Grant access to the view
GRANT SELECT ON public.analytics_suggestions TO authenticated;

-- 4. Function to clean old analytics data (optional maintenance)
CREATE OR REPLACE FUNCTION clean_old_analytics(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.paraphrase_analytics
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
  AND consent_given = false;  -- Only delete non-consented data
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to get personalized suggestions (optional)
CREATE OR REPLACE FUNCTION get_personalized_suggestions(
  user_tone TEXT DEFAULT NULL,
  min_score REAL DEFAULT 70.0,
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  tone TEXT,
  formality REAL,
  pacing REAL,
  descriptiveness REAL,
  directness REAL,
  avg_score REAL,
  usage_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.tone,
    ROUND(AVG(a.formality)::numeric, 2)::REAL,
    ROUND(AVG(a.pacing)::numeric, 2)::REAL,
    ROUND(AVG(a.descriptiveness)::numeric, 2)::REAL,
    ROUND(AVG(a.directness)::numeric, 2)::REAL,
    ROUND(AVG(a.verification_score)::numeric, 1)::REAL,
    COUNT(*)::BIGINT
  FROM public.paraphrase_analytics a
  WHERE a.verification_score >= min_score
    AND (user_tone IS NULL OR a.tone = user_tone)
  GROUP BY a.tone
  HAVING COUNT(*) >= 2
  ORDER BY AVG(a.verification_score) DESC, COUNT(*) DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE public.paraphrase_analytics IS 'Stores high-quality paraphrase results (>50% verification) for analytics and suggestions';
COMMENT ON TABLE public.user_preferences IS 'User preferences including analytics consent settings';
COMMENT ON COLUMN public.paraphrase_analytics.sample_excerpt IS 'User writing sample - only stored if consent_given is true';
COMMENT ON COLUMN public.paraphrase_analytics.verification_score IS 'Style match percentage - must be > 50%';
COMMENT ON COLUMN public.paraphrase_analytics.consent_given IS 'Whether user consented to share their sample excerpt';

-- Verification queries (run these to check everything is set up correctly)
-- SELECT COUNT(*) FROM public.paraphrase_analytics;
-- SELECT * FROM public.analytics_suggestions LIMIT 10;
-- SELECT * FROM get_personalized_suggestions('professional', 75.0, 5);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Analytics system schema created successfully!';
  RAISE NOTICE 'Tables: paraphrase_analytics, user_preferences';
  RAISE NOTICE 'View: analytics_suggestions';
  RAISE NOTICE 'Functions: clean_old_analytics(), get_personalized_suggestions()';
  RAISE NOTICE 'Next step: Set admin users with UPDATE profiles SET is_admin = true WHERE id = ''your-user-id'';';
END $$;
