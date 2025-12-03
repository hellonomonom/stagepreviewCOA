# Complete ngrok Setup for HTTPS

## Step-by-Step Guide

Your dev server is running! Now let's set up ngrok for HTTPS.

---

## Step 1: Download ngrok

1. **Open your browser**
2. **Go to:** https://ngrok.com/download
3. **Click:** "Download for Windows" button
4. **File downloads:** `ngrok-v3-windows-amd64.zip` (or similar)

**⏸️ Tell me when the download finishes!**

---

## Step 2: Extract ngrok

1. **Find the downloaded file** in your Downloads folder
2. **Right-click** on `ngrok-v3-windows-amd64.zip`
3. **Click:** "Extract All..."
4. **Choose location:** `C:\ngrok\`
   - If folder doesn't exist, create it first
5. **Click:** "Extract"
6. **You should have:** `C:\ngrok\ngrok.exe`

**⏸️ Tell me when you see ngrok.exe in C:\ngrok\**

---

## Step 3: Create Free ngrok Account

1. **Go to:** https://dashboard.ngrok.com/signup
2. **Sign up:**
   - Use email or GitHub
   - It's free!
3. **After signup:** You'll be on the dashboard
4. **Find "Your Authtoken" section**
5. **Copy your authtoken** (long string of letters/numbers)
   - Looks like: `2abc123def456ghi789jkl012...`
   - **Keep this safe!**

**⏸️ Tell me when you have your authtoken copied!**

---

## Step 4: Configure ngrok Authtoken

**Open PowerShell** and run:

```powershell
cd C:\ngrok
.\ngrok.exe config add-authtoken YOUR_AUTHTOKEN_HERE
```

Replace `YOUR_AUTHTOKEN_HERE` with the token you copied!

**You should see:** "Authtoken saved to configuration file"

**⏸️ Tell me if you see the success message!**

---

## Step 5: Start ngrok

**Open a NEW PowerShell window** (keep dev server running!)

**Run:**
```powershell
cd C:\ngrok
.\ngrok.exe http 3000
```

**You should see:**
```
ngrok                                                                  

Session Status                online
Account                       Your Name (Plan: Free)
Forwarding                    https://abc123-def456.ngrok.io -> http://localhost:3000
```

**✅ Copy the HTTPS URL!** (e.g., `https://abc123-def456.ngrok.io`)

**⏸️ What HTTPS URL do you see?**

---

## Step 6: Test HTTPS URL

1. **Open browser** (on your computer)
2. **Go to:** Your ngrok HTTPS URL
3. **Your app should load!**
4. **VR button should be visible!**

**✅ Does it work?**

---

## Quick Commands Reference

```powershell
# Navigate to ngrok
cd C:\ngrok

# Configure authtoken (only once)
.\ngrok.exe config add-authtoken YOUR_TOKEN

# Start ngrok (every time you want HTTPS)
.\ngrok.exe http 3000
```

---

## Troubleshooting

### "authtoken not configured"
**Fix:** Run Step 4 again with your authtoken

### "Tunnel failed to start"
**Fix:** Make sure dev server is running on port 3000

### "ngrok: command not found"
**Fix:** Use full path: `C:\ngrok\ngrok.exe`

### "Port 3000: connection refused"
**Fix:** Start dev server first: `npm run dev`

---

## Next Steps After Setup

1. ✅ Test HTTPS URL in browser
2. ✅ Test on Quest 3 (Quest Browser → HTTPS URL)
3. ✅ Test on Vision Pro (Safari → HTTPS URL)
4. ✅ Click "Enter VR" and enjoy! 🎉

---

**Let me know which step you're on, and I'll help you!** 🚀

