# StyleSync Deployment Guide

## Environment Variables Required for Production

Your StyleSync application needs the following environment variables to work properly in production:

### Required Variables:
```
GROQ_API_KEY=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
NEXT_PUBLIC_SUPABASE_URL=https://byizfaahznabizeitpmt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aXpmYWFoem5hYml6ZWl0cG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDQ3MjAsImV4cCI6MjA3MDU4MDcyMH0.iOG_kG8Vywbhft27rvwHu2yz4ZnoijZSxOQuyuo9qXI
```

### Optional Variables (with defaults):
```
GROQ_MODEL=llama3-70b-8192
GROQ_TEMPERATURE=0.3
NODE_ENV=production
```

## Platform-Specific Setup Instructions

### 🚀 **Vercel Deployment**
1. Go to [vercel.com](https://vercel.com) and sign in
2. Import your GitHub repository
3. In your project dashboard, go to **Settings** → **Environment Variables**
4. Add each environment variable:
   - Name: `GROQ_API_KEY`, Value: `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`
   - Name: `NEXT_PUBLIC_SUPABASE_URL`, Value: `https://byizfaahznabizeitpmt.supabase.co`
   - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aXpmYWFoem5hYml6ZWl0cG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDQ3MjAsImV4cCI6MjA3MDU4MDcyMH0.iOG_kG8Vywbhft27rvwHu2yz4ZnoijZSxOQuyuo9qXI`
5. Redeploy your application

### 📡 **Netlify Deployment**
1. Go to [netlify.com](https://netlify.com) and sign in
2. Import your GitHub repository
3. In your site dashboard, go to **Site settings** → **Environment variables**
4. Add each environment variable (same values as above)
5. Redeploy your site

### 🌊 **Railway Deployment**
1. Go to [railway.app](https://railway.app) and sign in
2. Create new project from GitHub repository
3. In your project dashboard, go to **Variables** tab
4. Add each environment variable (same values as above)
5. Redeploy your service

## Testing Your Deployment

After setting up environment variables and redeploying:

1. **Visit your deployed URL**
2. **Go to the Paraphrase page**
3. **Enter some text and click "Paraphrase"**
4. **Check the response** - it should show:
   - `usedModel: true` (instead of `false`)
   - Properly paraphrased text (not the placeholder text)

## Troubleshooting

### If you still get `usedModel: false`:
1. **Check deployment logs** for environment variable loading
2. **Verify all environment variables** are set correctly
3. **Try a hard refresh** or clear browser cache
4. **Check the browser Network tab** for API errors

### If you see API errors:
1. **Verify GROQ API key** is valid and active
2. **Check API key format** (should start with `gsk_`)
3. **Ensure no extra spaces** in environment variable values
4. **Check deployment platform logs** for detailed errors

## Security Notes

- ✅ Your `.env` file is properly excluded from Git
- ✅ Environment variables are securely handled by your deployment platform
- ✅ API keys are not exposed to client-side code (except public Supabase keys)
- ✅ GROQ API key is only used server-side in API routes

## Success Indicators

Your deployment is working correctly when:
- ✅ `usedModel: true` in API responses
- ✅ AI-generated text instead of placeholder text
- ✅ StyleSync transparency panel shows AI processing details
- ✅ No console errors related to missing environment variables
