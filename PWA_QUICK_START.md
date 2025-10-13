# 🚀 Quick Start: Testing Your PWA

## Step 1: Build for Production
PWA features only work in production mode.

```bash
npm run build
npm start
```

## Step 2: Open in Browser
Navigate to: `http://localhost:3000`

## Step 3: Check PWA Features

### In Chrome DevTools:
1. Press `F12` to open DevTools
2. Go to **Application** tab
3. Check these sections:
   - **Manifest**: Should show StyleSync details
   - **Service Workers**: Should show registered worker
   - **Cache Storage**: Should show cached assets

### Run Lighthouse Audit:
1. Press `F12` to open DevTools
2. Go to **Lighthouse** tab
3. Select **Progressive Web App** category
4. Click **Generate report**
5. Review score and recommendations

## Step 4: Test Install

### Desktop (Chrome/Edge):
- Look for install icon (⊕) in address bar
- Click it to install
- App opens in standalone window

### Android:
1. Open in Chrome mobile
2. Tap menu (⋮)
3. Select "Add to Home Screen"
4. App installs with icon

### iOS (Safari):
1. Open in Safari
2. Tap Share button (□↑)
3. Select "Add to Home Screen"
4. Enter name and add

## Step 5: Test Offline

### Desktop:
1. Open app
2. Press `F12` → Application → Service Workers
3. Check "Offline" checkbox
4. Refresh page
5. App should still load (cached pages)

### Mobile:
1. Install app
2. Enable airplane mode
3. Open app
4. Should work for cached pages

## 📊 Expected Results

### ✅ Working:
- App installs on home screen
- Custom icon displays
- Opens in standalone mode
- Cached pages load offline
- Service worker registered
- Manifest loads correctly

### 📱 Platform Differences:
- **Android Chrome**: Full PWA support
- **iOS Safari**: Limited (no install banner)
- **Desktop Chrome**: Full support with install prompt

## 🔧 If Something's Not Working:

### Service Worker Issues:
```bash
# Clear everything and rebuild
rm -rf .next
npm run build
npm start
```

### Cache Issues:
1. Open DevTools → Application
2. Clear all storage
3. Refresh page
4. Check Service Workers tab

### Install Prompt Not Showing:
- Install prompt only appears after 30 seconds
- Won't show if already installed
- Check localStorage for dismissal
- Clear site data and revisit

## 🎉 Success Indicators

When everything works:
- ✅ Lighthouse PWA score > 90
- ✅ Manifest loads without errors
- ✅ Service worker status: Activated
- ✅ Install prompt appears (desktop)
- ✅ App installs with custom icon
- ✅ Offline fallback works

## 📝 Next Steps

1. Convert SVG icons to PNG (see `/public/ICONS_README.md`)
2. Test on real mobile devices
3. Deploy to production with HTTPS
4. Monitor with Lighthouse
5. Customize colors and icons

**Ready for production?** Deploy to Vercel or Netlify - they provide HTTPS automatically!
