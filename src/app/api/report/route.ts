import { NextRequest } from 'next/server';
import { z } from 'zod';

const reportSchema = z.object({
  reportType: z.enum(['inappropriate_content', 'hate_speech', 'spam', 'copyright', 'other']),
  contentText: z.string().min(1).max(5000),
  description: z.string().max(1000).optional(),
  userId: z.string().optional()
});

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { reportType, contentText, description, userId } = reportSchema.parse(json);
    
    // Get supabase client
    const { supabase } = await import('../../../lib/supabaseClient.ts');
    
    if (!supabase) {
      // If no Supabase, log to console (for development)
      console.log('=== CONTENT REPORT ===');
      console.log('Type:', reportType);
      console.log('Content:', contentText.slice(0, 200) + '...');
      console.log('Description:', description);
      console.log('User ID:', userId || 'anonymous');
      console.log('Timestamp:', new Date().toISOString());
      console.log('======================');
      
      return new Response(JSON.stringify({ success: true, message: 'Report logged (no database)' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Store report in database
    const { error } = await supabase.from('content_reports').insert({
      report_type: reportType,
      content_text: contentText.slice(0, 5000),
      description: description || null,
      user_id: userId || null,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    
    if (error) {
      // If table doesn't exist, log error but return success
      if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        console.log('Report table not found, logging to console:', { reportType, contentText: contentText.slice(0, 100) });
        return new Response(JSON.stringify({ success: true, message: 'Report logged' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw error;
    }
    
    return new Response(JSON.stringify({ success: true, message: 'Report submitted successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (err: any) {
    console.error('Report submission error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to submit report' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// SQL for creating the reports table (run in Supabase SQL editor)
export const REPORTS_TABLE_SQL = `
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  content_text text not null,
  description text,
  user_id uuid references auth.users(id) on delete set null,
  status text default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- RLS policies
alter table public.content_reports enable row level security;

-- Allow anyone to insert reports
create policy "Allow insert reports" on public.content_reports 
  for insert with check (true);

-- Only admins can view reports (you'll need to set up admin role)
create policy "Allow admin select" on public.content_reports 
  for select using (auth.jwt() ->> 'role' = 'admin');
`;
