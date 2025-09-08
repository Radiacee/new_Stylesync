# StyleSync Deployment Guide

This guide provides comprehensive instructions for deploying StyleSync to various hosting platforms.

## 🔧 Environment Variables Required

### **Required for Production:**
```env
GROQ_API_KEY=your_groq_api_key_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### **Optional (with defaults):**
```env
GROQ_MODEL=llama3-70b-8192
GROQ_TEMPERATURE=0.3
NODE_ENV=production
```

⚠️ **Security Note**: Never commit actual API keys to your repository. Use your deployment platform's environment variable system.

---

## 🚀 Platform-Specific Deployment Instructions

### **Vercel (Recommended)**

Vercel provides the best experience for Next.js applications.

#### **Automatic Deployment:**
1. Connect your GitHub repository to Vercel
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "Import Project" and select your repository
4. Configure environment variables in the Vercel dashboard:
   - Go to **Settings** → **Environment Variables**
   - Add each required variable (see list above)
5. Deploy automatically on every git push

#### **Manual Deployment:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to production
vercel --prod

# Set environment variables via CLI
vercel env add GROQ_API_KEY
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### **Netlify**

Great alternative with similar features to Vercel.

#### **Setup Steps:**
1. Go to [netlify.com](https://netlify.com) and sign in
2. Connect your GitHub repository
3. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
4. Add environment variables:
   - Go to **Site settings** → **Environment variables**
   - Add each required variable
5. Deploy your site

#### **CLI Deployment:**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build the project
npm run build

# Deploy to production
netlify deploy --prod --dir=.next
```

### **Railway**

Perfect for full-stack applications with databases.

#### **Setup Steps:**
1. Go to [railway.app](https://railway.app) and sign in
2. Create new project from GitHub repository
3. Add environment variables:
   - Go to your project dashboard
   - Click **Variables** tab
   - Add each required variable
4. Railway will automatically deploy

#### **CLI Deployment:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway up
```

### **Self-Hosted Options**

#### **Docker Deployment:**
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t stylesync .
docker run -p 3000:3000 --env-file .env stylesync
```

#### **PM2 Process Manager:**
```bash
# Install PM2
npm install -g pm2

# Build the application
npm run build

# Start with PM2
pm2 start npm --name "stylesync" -- start
pm2 save
pm2 startup
```

---

## 🔍 Testing Your Deployment

### **Functionality Checklist:**

1. **Authentication Flow:**
   - ✅ User can sign up with email
   - ✅ Email confirmation works
   - ✅ User can sign in/out

2. **Core Features:**
   - ✅ Style profile creation and management
   - ✅ AI paraphrasing (check `usedModel: true`)
   - ✅ History tracking and notes
   - ✅ Admin panel access (for admin users)

3. **Performance Tests:**
   - ✅ Page load times under 3 seconds
   - ✅ API responses under 1 second
   - ✅ Mobile responsiveness

### **Testing Commands:**
```bash
# Test the deployment URL
curl https://your-deployment-url.com/api/health

# Test authentication endpoint
curl -X POST https://your-deployment-url.com/api/auth/test

# Test paraphrasing API
curl -X POST https://your-deployment-url.com/api/paraphrase \
  -H "Content-Type: application/json" \
  -d '{"text":"Test text","useModel":true}'
```

---

## 🐛 Troubleshooting Common Issues

### **Environment Variables Not Loading:**
```bash
# Check if variables are set correctly
echo $GROQ_API_KEY
echo $NEXT_PUBLIC_SUPABASE_URL

# Restart your deployment after adding variables
# Most platforms require a redeploy for env changes
```

### **Supabase Connection Issues:**
1. Verify your Supabase URL format: `https://project-id.supabase.co`
2. Check that your anon key is correct
3. Ensure Row Level Security policies are set up
4. Verify your project is not paused

### **Groq API Issues:**
1. Confirm your API key format: `gsk_...`
2. Check your API quota and usage limits
3. Verify the model name is correct: `llama3-70b-8192`
4. Test the API key directly:
   ```bash
   curl -X POST "https://api.groq.com/openai/v1/chat/completions" \
     -H "Authorization: Bearer $GROQ_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Hello"}],"model":"llama3-70b-8192"}'
   ```

### **Build Failures:**
```bash
# Clear cache and reinstall
rm -rf .next node_modules package-lock.json
npm install
npm run build

# Check for TypeScript errors
npm run type-check

# Check for linting issues
npm run lint
```

### **Runtime Errors:**
1. Check deployment platform logs
2. Enable debug mode with `DEBUG=*`
3. Monitor API endpoint responses
4. Verify database connectivity

---

## 📊 Performance Optimization

### **Build Optimization:**
```bash
# Analyze bundle size
npm run build
npm run analyze

# Enable production optimizations
export NODE_ENV=production
```

### **Caching Strategy:**
- Static assets cached for 1 year
- API responses cached for 5 minutes
- Database queries optimized with indexes

### **Monitoring Setup:**
```bash
# Add performance monitoring
npm install @vercel/analytics
# or
npm install plausible-tracker
```

---

## 🔒 Security Considerations

### **Environment Security:**
- ✅ Never commit `.env` files to Git
- ✅ Use different API keys for development/production
- ✅ Regularly rotate API keys
- ✅ Monitor API usage for anomalies

### **Runtime Security:**
- ✅ HTTPS enforced on all platforms
- ✅ CORS properly configured
- ✅ Rate limiting on API endpoints
- ✅ Input validation on all forms

### **Database Security:**
- ✅ Row Level Security enabled
- ✅ API keys restricted to necessary permissions
- ✅ Regular backups scheduled
- ✅ Access logs monitored

---

## 📈 Success Metrics

### **Deployment is successful when:**
- ✅ All pages load without errors
- ✅ Authentication works end-to-end
- ✅ AI paraphrasing returns `usedModel: true`
- ✅ Database operations complete successfully
- ✅ Admin panel accessible to authorized users
- ✅ Mobile interface responsive and functional

### **Performance benchmarks:**
- Page load: < 3 seconds
- API response: < 1 second
- Database queries: < 500ms
- Lighthouse score: > 90

---

## 📞 Support Resources

### **Platform-Specific Help:**
- **Vercel**: [docs.vercel.com](https://docs.vercel.com)
- **Netlify**: [docs.netlify.com](https://docs.netlify.com)
- **Railway**: [docs.railway.app](https://docs.railway.app)

### **Debugging Tools:**
- Browser DevTools Network tab
- Platform deployment logs
- Supabase dashboard logs
- Groq API usage dashboard

### **Community Support:**
- Next.js Discord community
- Supabase Discord community
- GitHub Issues for project-specific problems

---

**🎉 Congratulations! Your StyleSync application should now be successfully deployed and ready for users.**
