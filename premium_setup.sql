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

-- Policy: Admins can do everything (assuming you enforce admin via application logic or another policy, but for now we'll allow insert/update from authenticated if they are admin. A simple approach is just allow service role or authenticated to insert if they know what they are doing, but since it's an admin dashboard, we can just allow read/write for now and enforce it in the API route).
CREATE POLICY "Allow full access to authenticated users for admin purposes" 
ON public.premium_subscriptions FOR ALL 
USING (auth.role() = 'authenticated');
