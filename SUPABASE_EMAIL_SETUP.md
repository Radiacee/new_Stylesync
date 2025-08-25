# **Supabase Email Confirmation Configuration Guide**

## **🔧 Required Supabase Dashboard Settings**

### **Step 1: Update Redirect URLs**
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `byizfaahznabizeitpmt`
3. Navigate to **Authentication** → **URL Configuration**
4. Update the **Site URL** and **Redirect URLs**:

#### **For Development:**
```
Site URL: http://localhost:3000
Redirect URLs: 
- http://localhost:3000/auth/callback
- http://localhost:3000/auth/confirm
```

#### **For Production (Replace with your deployed URL):**
```
Site URL: https://your-deployed-app.vercel.app
Redirect URLs:
- https://your-deployed-app.vercel.app/auth/callback
- https://your-deployed-app.vercel.app/auth/confirm
```

### **Step 2: Email Template Configuration**
1. Go to **Authentication** → **Email Templates**
2. Select **Confirm signup** template
3. Update the confirmation URL to use your callback:

**Replace the default confirmation link with:**
```html
<a href="{{ .SiteURL }}/auth/callback#access_token={{ .TokenHash }}&type=signup&expires_at={{ .ExpiresAt }}&refresh_token={{ .RefreshToken }}">
  Confirm your email
</a>
```

Or for a simpler approach, ensure it points to:
```
{{ .SiteURL }}/auth/callback?token={{ .Token }}&type=signup
```

### **Step 3: Auth Settings**
1. Go to **Authentication** → **Settings**
2. Ensure these settings:
   - ✅ **Enable email confirmations**: ON
   - ✅ **Double confirm email changes**: ON (recommended)
   - ✅ **Enable custom SMTP**: OFF (unless you have custom email)

## **🔄 How the New Flow Works**

### **User Journey:**
1. **User signs up** → Email sent with confirmation link
2. **User clicks email link** → Redirects to `/auth/callback`
3. **Callback handler** → Processes tokens and redirects to `/auth/confirm`
4. **Confirm page** → Sets session and redirects to `/paraphrase`

### **Technical Flow:**
```
Email Link → /auth/callback → /auth/confirm → /paraphrase
              (server)       (client)       (main app)
```

## **🚀 Deployment Configuration**

### **Environment Variables Required:**
Make sure your deployment has these environment variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://byizfaahznabizeitpmt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aXpmYWFoem5hYml6ZWl0cG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDQ3MjAsImV4cCI6MjA3MDU4MDcyMH0.iOG_kG8Vywbhft27rvwHu2yz4ZnoijZSxOQuyuo9qXI
```

### **Vercel Deployment:**
1. Update your Supabase redirect URLs to include your Vercel URL
2. Redeploy your application
3. Test the email confirmation flow

## **🧪 Testing Instructions**

### **Local Testing:**
1. Start your dev server: `npm run dev`
2. Go to `http://localhost:3000/auth/sign-in`
3. Create a new account
4. Check your email for confirmation
5. Click the confirmation link
6. Should redirect properly through the callback flow

### **Production Testing:**
1. Deploy to Vercel/Netlify with updated environment variables
2. Update Supabase redirect URLs to your production domain
3. Test the same signup flow on your deployed site

## **🔍 Troubleshooting**

### **If email confirmation still redirects to localhost:**
- Check your Supabase **Site URL** setting
- Verify **Redirect URLs** include your production domain
- Clear browser cache and try again

### **If you get authentication errors:**
- Check browser console for detailed error messages
- Verify environment variables are set correctly in deployment
- Ensure Supabase project is properly configured

### **If the flow breaks:**
- Check the `/auth/callback` route is accessible
- Verify the `/auth/confirm` page loads properly
- Look for JavaScript errors in browser console

## **📝 Quick Fix Checklist**

- [ ] Update Supabase Site URL to production domain
- [ ] Add production domain to Redirect URLs
- [ ] Deploy with correct environment variables
- [ ] Test email confirmation flow end-to-end
- [ ] Verify user gets redirected to `/paraphrase` after confirmation

This configuration should resolve the localhost redirect issue and provide a smooth email confirmation experience for your users!
