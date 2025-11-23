# Troubleshooting: Assets Not Loading in Production

## Problem: Videos show white/blank, meshes not loading

### Quick Fix Steps:

1. **Verify assets are in the build:**
```bash
cd /var/www/stagepreview-coa
ls -la dist/assets/
# Should show: meshes/ and videos/ folders
```

2. **If assets are missing, rebuild:**
```bash
npm run build
# Check again
ls -la dist/assets/
```

3. **Check server logs for 404 errors:**
```bash
pm2 logs stagepreview-coa
# Look for 404 errors on /assets/ paths
```

4. **Verify Nginx is proxying correctly:**
```bash
# Test if assets are accessible
curl http://localhost:8080/assets/videos/shG010_Eva_v12.mp4
# Should return video data, not 404
```

5. **Check browser console:**
- Open browser DevTools (F12)
- Check Console tab for errors
- Check Network tab - look for failed requests to `/assets/`

### Common Issues:

#### Issue 1: Assets not copied during build
**Solution:** Vite should automatically copy `public/` to `dist/`, but verify:
```bash
ls -la public/assets/  # Source files
ls -la dist/assets/    # Built files (should match)
```

#### Issue 2: Path issues
**Solution:** Ensure paths in code use `/assets/` (absolute path from root)

#### Issue 3: Server not serving static files
**Solution:** The updated server.js should handle this, but verify:
- Check `NODE_ENV=production` in `.env`
- Restart server: `pm2 restart stagepreview-coa`

#### Issue 4: Nginx blocking assets
**Solution:** Check Nginx config allows asset requests:
```bash
nginx -t
systemctl reload nginx
```

### Manual Asset Check:

```bash
# On your server, run:
cd /var/www/stagepreview-coa

# Check if dist/assets exists
if [ -d "dist/assets" ]; then
  echo "✓ Assets folder exists"
  ls -la dist/assets/
else
  echo "✗ Assets folder missing - rebuild needed"
  npm run build
fi

# Check specific files
ls -la dist/assets/videos/ | head -5
ls -la dist/assets/meshes/FrontProjection_perspective/ | head -5
```

### After Fixing:

1. Rebuild: `npm run build`
2. Restart: `pm2 restart stagepreview-coa`
3. Clear browser cache (Ctrl+Shift+R)
4. Test in browser

