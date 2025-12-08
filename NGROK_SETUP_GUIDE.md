# Step-by-Step: ngrok Setup Guide

## Complete Walkthrough for Windows

---

## Step 1: Download ngrok

1. **Go to ngrok website:**
   - Open browser: https://ngrok.com/download
   - Or direct link: https://ngrok.com/download

2. **Download for Windows:**
   - Click the Windows download button
   - File will be: `ngrok-v3-windows-amd64.zip` (or similar)

3. **Extract the file:**
   - Right-click the `.zip` file
   - Click "Extract All..."
   - Extract to a folder (e.g., `C:\ngrok\`)
   - You'll get `ngrok.exe` inside

---

## Step 2: Set Up ngrok (Optional - Add to PATH)

**Option A: Use from folder (Easiest)**
- Just remember where you put it (e.g., `C:\ngrok\`)
- Use full path when running: `C:\ngrok\ngrok.exe http 3000`

**Option B: Add to PATH (Recommended)**
1. Copy the folder path (e.g., `C:\ngrok`)
2. Windows Search → "Environment Variables"
3. Click "Edit the system environment variables"
4. Click "Environment Variables" button
5. Under "User variables", find "Path" → Click "Edit"
6. Click "New" → Paste your ngrok folder path (e.g., `C:\ngrok`)
7. Click "OK" on all dialogs
8. **Close and reopen** your terminal/PowerShell

Now you can just type `ngrok http 3000` from anywhere!

---

## Step 3: Create ngrok Account (Free)

1. **Sign up for free account:**
   - Go to: https://dashboard.ngrok.com/signup
   - Sign up with email or GitHub

2. **Get your authtoken:**
   - After signing up, go to: https://dashboard.ngrok.com/get-started/your-authtoken
   - Copy your authtoken (looks like: `2abc123def456ghi789...`)

3. **Configure ngrok:**
   Open PowerShell or Command Prompt and run:
   ```bash
   ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
   ```
   
   Replace `YOUR_AUTHTOKEN_HERE` with the token you copied.

---

## Step 4: Start Your Dev Server

1. **Open terminal in your project folder:**
   - Navigate to: `C:\Users\tobia\Dropbox\_Projects\Anyma\Coachella26\StagePreview\stagepreviewCOA`

2. **Start the dev server:**
   ```bash
   npm run dev
   ```

3. **Wait for it to start:**
   - You should see: `VITE v5.x.x  ready in xxx ms`
   - Local: `http://localhost:3000/`
   - Network: `http://192.168.1.8:3000/`

4. **Leave this terminal running!** ⚠️

---

## Step 5: Start ngrok (New Terminal)

1. **Open a NEW terminal window** (keep dev server running!)

2. **Navigate to ngrok folder OR use PATH:**
   
   **If using folder:**
   ```bash
   cd C:\ngrok
   .\ngrok.exe http 3000
   ```
   
   **If added to PATH:**
   ```bash
   ngrok http 3000
   ```

3. **You'll see ngrok interface:**
   ```
   ngrok                                                                  
                                                                        
   Session Status                online
   Account                       Your Name (Plan: Free)
   Version                       3.x.x
   Region                        United States (us)
   Latency                       -
   Web Interface                 http://127.0.0.1:4040
   Forwarding                    https://abc123-def456.ngrok.io -> http://localhost:3000
   
   Connections                   ttl     opn     rt1     rt5     p50     p90
                                 0       0       0.00    0.00    0.00    0.00
   ```

4. **Copy the HTTPS URL:**
   - Look for: `Forwarding    https://abc123-def456.ngrok.io -> http://localhost:3000`
   - Your HTTPS URL is: `https://abc123-def456.ngrok.io`

---

## Step 6: Test from Quest 3

1. **Put on Quest 3 headset**

2. **Open Quest Browser**

3. **Type in address bar:**
   ```
   https://abc123-def456.ngrok.io
   ```
   (Use your actual ngrok URL from Step 5)

4. **Your app should load!**

5. **Look for VR button** in bottom-right corner

6. **Click "Enter VR"** - it should work! 🎉

---

## Step 7: Test from Vision Pro (If You Have One)

1. **Put on Vision Pro**

2. **Open Safari**

3. **Type in address bar:**
   ```
   https://abc123-def456.ngrok.io
   ```

4. **Click "Enter VR"** - should work! 🎉

---

## Troubleshooting

### "ngrok: command not found"
- **Solution:** Use full path: `C:\ngrok\ngrok.exe http 3000`
- Or add ngrok to PATH (see Step 2, Option B)

### "authtoken not configured"
- **Solution:** Run: `ngrok config add-authtoken YOUR_TOKEN`
- Get token from: https://dashboard.ngrok.com/get-started/your-authtoken

### "Tunnel session closed"
- **Solution:** Restart ngrok (Ctrl+C, then run `ngrok http 3000` again)
- Get new HTTPS URL from ngrok output

### "Connection refused" on Quest 3
- **Solution:** Make sure dev server is running (`npm run dev`)
- Check that ngrok is pointing to port 3000
- Verify you're using the HTTPS URL (not HTTP)

### Page loads but VR button doesn't show
- **Solution:** Open browser console (if possible) to check errors
- Make sure you're using HTTPS URL
- Check that WebXR is supported on the device

---

## Quick Reference Commands

```bash
# Start dev server (Terminal 1)
npm run dev

# Start ngrok (Terminal 2)
ngrok http 3000

# Or with full path
C:\ngrok\ngrok.exe http 3000
```

---

## What You Should See

**Terminal 1 (Dev Server):**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
➜  Network: http://192.168.1.8:3000/
```

**Terminal 2 (ngrok):**
```
Forwarding    https://abc123-def456.ngrok.io -> http://localhost:3000
```

**Quest 3 Browser:**
- Your app loads
- VR button visible
- Click "Enter VR" works!

---

## Tips

1. **Keep both terminals open:**
   - Terminal 1: Dev server running
   - Terminal 2: ngrok running

2. **ngrok URL changes each time:**
   - Each time you restart ngrok, you get a new URL
   - Free accounts get random URLs
   - Paid accounts can have fixed domains

3. **ngrok dashboard:**
   - Visit: http://127.0.0.1:4040 (while ngrok is running)
   - See all requests, inspect traffic, debug issues

4. **Stop ngrok:**
   - Press `Ctrl+C` in ngrok terminal
   - HTTPS URL will stop working

---

## Next Steps

Once ngrok is working:

1. ✅ Test VR on Quest 3
2. ✅ Test VR on Vision Pro (if available)
3. ✅ Verify all features work
4. ✅ Ready for Phase 2 development!

Let me know if you get stuck at any step! 🚀




