# Network Access Fix - Access Dev Server from Quest 3

## What I Fixed

Updated `vite.config.js` to allow network access by adding:
```javascript
host: '0.0.0.0', // Allow access from network devices
```

This makes the dev server accessible from other devices on your network (like Quest 3).

---

## Next Steps

### 1. Restart Your Dev Server

**Important:** You need to restart the dev server for changes to take effect!

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### 2. Check Windows Firewall (May Be Needed)

Windows Firewall might block port 3000. To allow it:

**Option A: Quick Fix - Allow Node.js through Firewall**
1. Windows Search → "Windows Defender Firewall"
2. Click "Allow an app or feature through Windows Defender Firewall"
3. Click "Change settings" (admin required)
4. Find "Node.js" and check both "Private" and "Public"
5. If not listed, click "Allow another app" → Browse → Find Node.js

**Option B: Add Firewall Rule for Port 3000**
```powershell
# Run PowerShell as Administrator, then:
New-NetFirewallRule -DisplayName "Allow Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### 3. Test Access

**From Your Computer:**
- Try: `http://192.168.1.8:3000` in your browser
- Should work now!

**From Quest 3:**
- Open Quest Browser
- Go to: `http://192.168.1.8:3000`
- Should load your app!

---

## Troubleshooting

### Still Can't Access?

1. **Check if server is running:**
   ```bash
   # Look for output like:
   VITE v5.x.x  ready in xxx ms
   ➜  Local:   http://localhost:3000/
   ➜  Network: http://192.168.1.8:3000/
   ```

2. **Check Windows Firewall:**
   - Windows might ask for permission when you first access
   - Click "Allow access" if prompted

3. **Verify IP Address:**
   ```bash
   ipconfig
   ```
   Make sure you're using the correct IPv4 address

4. **Check Network:**
   - Quest 3 and computer must be on **same WiFi network**
   - Try pinging from Quest (if possible) or another device

5. **Try Different Port:**
   If port 3000 is blocked, you can change it:
   ```javascript
   // vite.config.js
   port: 3001, // Try a different port
   ```

### Quick Test

1. Restart dev server: `npm run dev`
2. Look for "Network:" URL in the console output
3. Try that URL from Quest 3
4. Should work! 🎉

---

## What You Should See

When you start the dev server, you should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
➜  Network: http://192.168.1.8:3000/
```

The "Network:" URL is what you use on Quest 3!












