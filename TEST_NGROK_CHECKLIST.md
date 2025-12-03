# Test ngrok - Quick Checklist

## Current Status

Based on my check:
- ❌ **Dev server is NOT running** (port 3000 is free)
- ❌ **ngrok not found** (need to install/setup)

---

## Quick Test Steps

### 1️⃣ Start Dev Server

**Open terminal and run:**
```bash
npm run dev
```

**Wait for:**
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:3000/
```

**✅ Keep this terminal open!**

---

### 2️⃣ Check if ngrok is Installed

**Look for ngrok in one of these places:**
- `C:\ngrok\ngrok.exe`
- Your Downloads folder (`ngrok.exe` or `ngrok-v3-windows-amd64.zip`)

**Or run this in PowerShell:**
```powershell
cd C:\ngrok
.\ngrok.exe version
```

**If it shows version → ngrok is installed! ✅**
**If it says "not found" → need to install ngrok ❌**

---

### 3️⃣ Install ngrok (If Needed)

**A. Download:**
- Go to: https://ngrok.com/download
- Download Windows version

**B. Extract:**
- Extract to: `C:\ngrok\`
- You should have: `C:\ngrok\ngrok.exe`

**C. Sign Up:**
- Go to: https://dashboard.ngrok.com/signup
- Create free account
- Copy your **authtoken**

**D. Configure:**
```powershell
cd C:\ngrok
.\ngrok.exe config add-authtoken YOUR_TOKEN_HERE
```

---

### 4️⃣ Start ngrok

**Open a NEW terminal** (keep dev server running!)

**Run:**
```powershell
cd C:\ngrok
.\ngrok.exe http 3000
```

**You should see:**
```
Forwarding    https://abc123-def456.ngrok.io -> http://localhost:3000
```

**✅ Copy that HTTPS URL!**

---

### 5️⃣ Test It

**In browser:**
1. Open: Your ngrok HTTPS URL
2. Your app should load
3. VR button should appear!

**On Quest 3:**
1. Open Quest Browser
2. Go to: Your ngrok HTTPS URL
3. Click "Enter VR" 🎉

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "Port 3000: connection refused" | Start dev server: `npm run dev` |
| "authtoken not configured" | Run: `.\ngrok.exe config add-authtoken YOUR_TOKEN` |
| "ngrok: command not found" | Use full path: `C:\ngrok\ngrok.exe` |
| "Tunnel failed" | Make sure dev server is running first |

---

## Tell Me:

1. **Is your dev server running?** (Can you see http://localhost:3000 in browser?)
2. **Do you have ngrok.exe?** (Where is it located?)
3. **What happens when you run ngrok?** (Success or error message?)

I'll help you troubleshoot! 🚀

