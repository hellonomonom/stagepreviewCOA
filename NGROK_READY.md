# ✅ ngrok is Ready to Use!

## Current Status

- ✅ **ngrok installed:** `C:\ngrok\ngrok.exe` (version 3.33.1)
- ✅ **Dev server running:** Port 3000 is active
- ⏳ **Need authtoken:** One-time setup required

---

## Quick Setup (3 Steps)

### 1️⃣ Get Authtoken (2 minutes)

**Open this URL:**
👉 https://dashboard.ngrok.com/get-started/your-authtoken

- **Sign up** if needed (free account)
- **Copy your authtoken** (long string)

---

### 2️⃣ Configure Authtoken (30 seconds)

**Open PowerShell** and run:

```powershell
cd C:\ngrok
.\ngrok.exe config add-authtoken YOUR_TOKEN_HERE
```

Replace `YOUR_TOKEN_HERE` with the token you copied!

**Or use the helper script:**
- Right-click `setup-ngrok-authtoken.ps1` → Run with PowerShell
- It will ask for your authtoken

---

### 3️⃣ Start ngrok (10 seconds)

**Open PowerShell** and run:

```powershell
cd C:\ngrok
.\ngrok.exe http 3000
```

**Or use the helper script:**
- Right-click `start-ngrok.ps1` → Run with PowerShell

**Copy the HTTPS URL** you see (e.g., `https://abc123.ngrok.io`)

---

## Use Your HTTPS URL

- **Browser:** Your ngrok HTTPS URL
- **Quest 3:** Quest Browser → Your ngrok HTTPS URL  
- **Vision Pro:** Safari → Your ngrok HTTPS URL

**Click "Enter VR"** and enjoy! 🎉

---

## Helper Scripts Created

1. **`setup-ngrok-authtoken.ps1`** - Configure authtoken (interactive)
2. **`start-ngrok.ps1`** - Start ngrok quickly
3. **`START_NGROK_SIMPLE.bat`** - Batch file version

---

## Quick Reference

```powershell
# Configure authtoken (once)
cd C:\ngrok
.\ngrok.exe config add-authtoken YOUR_TOKEN

# Start ngrok (every time)
cd C:\ngrok
.\ngrok.exe http 3000
```

---

## Need Help?

1. **Get authtoken:** https://dashboard.ngrok.com/get-started/your-authtoken
2. **Can't sign up?** Use GitHub or email (free)
3. **Error configuring?** Make sure you copied the full authtoken

---

**Ready?** Start with Step 1 - get your authtoken! 🚀



