import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = [
  'banlutachristiandave2@gmail.com',
  'admin@stylesync.com',
];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  
  // If there's an error parameter, handle it
  if (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(`${origin}/auth/sign-in?error=${error}`);
  }
  
  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Check if the user is an admin
      const { data: { user } } = await supabase.auth.getUser();
      const nextParam = searchParams.get('next') || '/paraphrase';
      const isRecovery = searchParams.get('type') === 'recovery' || nextParam === '/auth/update-password';
      
      if (isRecovery) {
        return NextResponse.redirect(`${origin}/auth/update-password`);
      } else if (user && ADMIN_EMAILS.includes(user.email || '')) {
        return NextResponse.redirect(`${origin}/admin`);
      } else {
        return NextResponse.redirect(`${origin}${nextParam.startsWith('/') ? nextParam : '/' + nextParam}`);
      }
    } else {
      console.error('Code exchange error:', error);
      return NextResponse.redirect(`${origin}/auth/sign-in?error=session_failed`);
    }
  }

  // If no code, redirect to confirmation page to handle hash tokens, forwarding query parameters
  const nextParamsString = searchParams.toString();
  const redirectUrl = nextParamsString ? `${origin}/auth/confirm?${nextParamsString}` : `${origin}/auth/confirm`;
  return NextResponse.redirect(redirectUrl);
}
