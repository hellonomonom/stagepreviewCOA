# Setup ngrok - Final Steps

## ✅ Current Status
- ✅ ngrok installed at: `C:\ngrok\ngrok.exe`
- ✅ Version: 3.33.1 working
- ✅ Dev server running on port 3000
- ⏳ Need to configure authtoken (one-time setup)

---

## Complete Setup (5 minutes)

### Step 1: Get Your Authtoken

1. **Open browser:** https://dashboard.ngrok.com/signup
2. **Sign up** (free account - use email or GitHub)
3. **After signup:** You'll see dashboard
4. **Go to:** https://dashboard.ngrok.com/get-started/your-authtoken
5. **Copy your authtoken** (long string like: `2abc123def456...`)

**⏸️ Do you have your authtoken? Tell me when you're ready!**

---

### Step 2: Configure Authtoken

**Open PowerShell** and run:

```powershell
cd C:\ngrok
.\ngrok.exe config add-authtoken YOUR_TOKEN_HERE
```

Replace `YOUR_TOKEN_HERE` with your actual authtoken!

**You should see:** "Authtoken saved to configuration file"

**⏸️ Tell me when you see the success message!**

---

### Step 3: Start ngrok

**Open a NEW PowerShell window** (keep dev server running!)

**Run:**
```powershell
cd C:\ngrok
.\ngrok.exe http 3000
```

**You'll see output like:**
```
ngrok                                                                  

Session Status                online
Account                       Your Name (Plan: Free)
Version                       3.33.1
Region                        United States (us)
Forwarding                    https://abc123-def456.ngrok.io -> http://localhost:3000
```

**✅ Copy the HTTPS URL!** (the part after "Forwarding")

**⏸️ What HTTPS URL do you see?**

---

### Step 4: Test HTTPS URL

1. **Open browser** → Paste your ngrok HTTPS URL
2. **Your app should load!**
3. **VR button should be visible!**

**On Quest 3:**
- Open Quest Browser
- Go to your ngrok HTTPS URL
- Click "Enter VR" 🎉

---

## Quick Commands

```powershell
# Navigate to ngrok
cd C:\ngrok

# Configure authtoken (once)
.\ngrok.exe config add-authtoken YOUR_TOKEN

# Start ngrok (every time)
.\ngrok.exe http 3000
```

---

## Need Help?

**If you get stuck:**
- "authtoken not configured" → Run Step 2 again
- "Tunnel failed" → Make sure dev server is running
- Can't find authtoken → Check dashboard: https://dashboard.ngrok.com/get-started/your-authtoken

---

**Ready to start?** 
1. First get your authtoken from ngrok dashboard
2. Then configure it with the command above
3. Then start ngrok!

Let me know when you have your authtoken! 🚀




