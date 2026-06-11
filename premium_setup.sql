-- Run this in your Supabase SQL Editor to create the premium subscriptions table

CREATE TABLE IF NOT EXISTS public.premium_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.premium_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own subscription
CREATE POLICY "Users can view own subscription" 
ON public.premium_subscriptions FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Admins can do everything
-- (For this demo, we allow authenticated users full access. In a real app, restrict by admin email/role)
DROP POLICY IF EXISTS "Allow full access to authenticated users for admin purposes";
CREATE POLICY "Allow admin access" 
ON public.premium_subscriptions FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
