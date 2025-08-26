import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = [
  'banlutachristiandave2@gmail.com',
  'admin@stylesync.com',
];

async function checkAdminAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user || !ADMIN_EMAILS.includes(user.email || '')) {
    return null;
  }

  return { user, supabase };
}

// GET /api/admin/stats - Get dashboard statistics
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { supabase } = auth;
    
    // Get user count
    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Get paraphrase count
    const { count: paraphraseCount } = await supabase
      .from('paraphrase_history')
      .select('*', { count: 'exact', head: true });

    // Get recent activity (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentActivity } = await supabase
      .from('paraphrase_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday);

    return NextResponse.json({
      totalUsers: userCount || 0,
      totalProfiles: userCount || 0,
      totalParaphrases: paraphraseCount || 0,
      recentActivity: recentActivity || 0
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}

// POST /api/admin/query - Execute database query
export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { query } = await req.json();
    
    // Security check - only allow SELECT queries
    if (!query || !query.trim().toLowerCase().startsWith('select')) {
      return NextResponse.json(
        { error: 'Only SELECT queries are allowed' },
        { status: 400 }
      );
    }

    const { supabase } = auth;
    const startTime = Date.now();
    
    // Execute the query using rpc if available, otherwise use direct query
    const { data, error } = await supabase.rpc('execute_admin_query', { 
      sql_query: query 
    });

    if (error) {
      throw error;
    }

    const executionTime = Date.now() - startTime;

    return NextResponse.json({
      data: data || [],
      columns: data && data.length > 0 ? Object.keys(data[0]) : [],
      rowCount: data ? data.length : 0,
      executionTime
    });
  } catch (error) {
    console.error('Admin query error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
