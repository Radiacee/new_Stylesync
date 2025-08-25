import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  
  // Check if this is a hash-based redirect (from email confirmation)
  const hashParams = request.url.split('#')[1];
  if (hashParams) {
    const params = new URLSearchParams(hashParams);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    
    if (access_token && refresh_token) {
      // For hash-based auth, redirect to a client-side handler
      return NextResponse.redirect(`${origin}/auth/confirm?${hashParams}`);
    }
  }
  
  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${origin}/paraphrase`);
    }
  }

  // Redirect to sign in page if something went wrong
  return NextResponse.redirect(`${origin}/auth/sign-in?error=auth_failed`);
}
