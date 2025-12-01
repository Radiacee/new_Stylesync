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

// GET /api/admin - Handle different admin endpoints
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');
  
  if (endpoint === 'reports') {
    try {
      const { supabase } = auth;
      
      // Try with service role for full access
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      let queryClient = supabase;
      
      if (serviceRoleKey) {
        queryClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        );
      }
      
      const { data: reports, error } = await queryClient
        .from('content_reports')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return NextResponse.json({ reports: [], tableNotFound: true });
        }
        throw error;
      }
      
      return NextResponse.json({ reports: reports || [] });
    } catch (error) {
      console.error('Admin reports fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reports', reports: [] },
        { status: 500 }
      );
    }
  }
  
  if (endpoint === 'users') {
    try {
      const { supabase } = auth;
      
      let users: any[] = [];
      
      // Try to get users with service role key if available
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (serviceRoleKey) {
        try {
          const serviceRoleSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey
          );
          
          const { data: authUsers, error: authError } = await serviceRoleSupabase.auth.admin.listUsers();
          
          if (!authError && authUsers?.users) {
            // Get profile data for each user
            const { data: profiles } = await supabase
              .from('style_profiles')
              .select('*');
            
            // Combine auth data with profile data
            users = authUsers.users.map(user => {
              const profile = profiles?.find(p => p.user_id === user.id);
              return {
                id: user.id,
                email: user.email,
                created_at: user.created_at,
                last_sign_in_at: user.last_sign_in_at,
                email_confirmed_at: user.email_confirmed_at,
                user_metadata: user.user_metadata,
                profile: profile || null
              };
            });
          }
        } catch (serviceError) {
          console.log('Service role access failed:', serviceError);
        }
      }
      
      // If service role didn't work or isn't available, fall back to profiles
      if (users.length === 0) {
        const { data: profiles } = await supabase
          .from('style_profiles')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (profiles) {
          users = profiles.map(profile => ({
            id: profile.user_id || profile.id,
            email: 'Email requires service role key - configure SUPABASE_SERVICE_ROLE_KEY',
            created_at: profile.created_at,
            last_sign_in_at: profile.updated_at,
            email_confirmed_at: profile.created_at,
            user_metadata: profile,
            profile: profile,
            isFromProfile: true
          }));
        }
      }

      return NextResponse.json({ users });
    } catch (error) {
      console.error('Admin users fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }
  }

  // Default endpoint - return stats
  try {
    const { supabase } = auth;
    
    // Get user count from style_profiles table
    const { count: userCount } = await supabase
      .from('style_profiles')
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

// PUT /api/admin - Update resources (e.g., report status)
export async function PUT(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { endpoint, reportId, status } = await req.json();
    
    if (endpoint === 'reports' && reportId && status) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!serviceRoleKey) {
        return NextResponse.json(
          { error: 'Service role key required for updates' },
          { status: 400 }
        );
      }
      
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      );
      
      const { error } = await serviceClient
        .from('content_reports')
        .update({ 
          status, 
          reviewed_by: auth.user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', reportId);
      
      if (error) throw error;
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  } catch (error) {
    console.error('Admin update error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
