-- StyleSync Admin Panel Database Setup
-- Run these SQL commands in your Supabase SQL Editor

-- 1. Create RPC function to get table information
CREATE OR REPLACE FUNCTION get_table_info()
RETURNS TABLE (
  table_name TEXT,
  table_type TEXT,
  table_schema TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::TEXT,
    t.table_type::TEXT,
    t.table_schema::TEXT
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create RPC function to execute admin queries (SELECT only)
CREATE OR REPLACE FUNCTION execute_admin_query(sql_query TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  query_lower TEXT;
BEGIN
  -- Security check: only allow SELECT queries
  query_lower := LOWER(TRIM(sql_query));
  
  IF NOT (query_lower LIKE 'select%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed for security reasons';
  END IF;
  
  -- Execute the query and return as JSON
  EXECUTE format('SELECT json_agg(row_to_json(t)) FROM (%s) t', sql_query) INTO result;
  
  RETURN COALESCE(result, '[]'::JSON);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Query execution failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create admin activity log table
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create RPC function to log admin activities
CREATE OR REPLACE FUNCTION log_admin_activity(
  admin_email TEXT,
  action TEXT,
  details JSONB DEFAULT NULL,
  ip_address INET DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO admin_activity_log (admin_email, action, details, ip_address)
  VALUES (admin_email, action, details, ip_address)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create function to get user statistics
CREATE OR REPLACE FUNCTION get_user_statistics()
RETURNS JSON AS $$
DECLARE
  stats JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'confirmed_users', (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL),
    'users_today', (SELECT COUNT(*) FROM auth.users WHERE DATE(created_at) = CURRENT_DATE),
    'users_this_week', (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '7 days'),
    'users_this_month', (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '30 days')
  ) INTO stats;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create function to get paraphrase statistics
CREATE OR REPLACE FUNCTION get_paraphrase_statistics()
RETURNS JSON AS $$
DECLARE
  stats JSON;
BEGIN
  SELECT json_build_object(
    'total_paraphrases', COALESCE((SELECT COUNT(*) FROM paraphrase_history), 0),
    'paraphrases_today', COALESCE((SELECT COUNT(*) FROM paraphrase_history WHERE DATE(created_at) = CURRENT_DATE), 0),
    'paraphrases_this_week', COALESCE((SELECT COUNT(*) FROM paraphrase_history WHERE created_at >= NOW() - INTERVAL '7 days'), 0),
    'unique_users_active', COALESCE((SELECT COUNT(DISTINCT user_id) FROM paraphrase_history WHERE created_at >= NOW() - INTERVAL '30 days'), 0)
  ) INTO stats;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant necessary permissions (adjust as needed)
-- Note: These functions are SECURITY DEFINER, so they run with the definer's permissions
-- Make sure your service role has the necessary permissions

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at ON admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin_email ON admin_activity_log(admin_email);

-- 9. Create RPC function to safely delete user data
CREATE OR REPLACE FUNCTION admin_delete_user_data(user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Delete from paraphrase_history
  DELETE FROM paraphrase_history WHERE user_id = admin_delete_user_data.user_id;
  
  -- Delete from profiles if exists
  DELETE FROM profiles WHERE id = admin_delete_user_data.user_id;
  
  -- Return summary
  SELECT json_build_object(
    'user_id', admin_delete_user_data.user_id,
    'deleted_at', NOW(),
    'status', 'success'
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create view for admin dashboard summary
CREATE OR REPLACE VIEW admin_dashboard_summary AS
SELECT
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL) as confirmed_users,
  COALESCE((SELECT COUNT(*) FROM paraphrase_history), 0) as total_paraphrases,
  COALESCE((SELECT COUNT(*) FROM paraphrase_history WHERE DATE(created_at) = CURRENT_DATE), 0) as paraphrases_today,
  COALESCE((SELECT COUNT(DISTINCT user_id) FROM paraphrase_history WHERE created_at >= NOW() - INTERVAL '7 days'), 0) as active_users_week;

-- Usage Examples:
-- SELECT * FROM get_table_info();
-- SELECT get_user_statistics();
-- SELECT get_paraphrase_statistics();
-- SELECT * FROM admin_dashboard_summary;
-- SELECT execute_admin_query('SELECT COUNT(*) FROM auth.users');

COMMENT ON FUNCTION get_table_info() IS 'Returns list of tables in public schema for admin panel';
COMMENT ON FUNCTION execute_admin_query(TEXT) IS 'Executes SELECT-only queries for admin panel with security checks';
COMMENT ON FUNCTION log_admin_activity(TEXT, TEXT, JSONB, INET) IS 'Logs admin activities for audit trail';
COMMENT ON TABLE admin_activity_log IS 'Stores admin activity logs for security auditing';
COMMENT ON VIEW admin_dashboard_summary IS 'Provides summary statistics for admin dashboard';
