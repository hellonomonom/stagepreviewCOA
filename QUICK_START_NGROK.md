# Quick Start: ngrok for HTTPS

## Fastest Path (5 minutes)

### 1️⃣ Download & Extract
- Download: https://ngrok.com/download
- Extract `ngrok.exe` to `C:\ngrok\`

### 2️⃣ Sign Up & Get Token
- Sign up: https://dashboard.ngrok.com/signup (free)
- Copy your authtoken from dashboard

### 3️⃣ Configure
Open PowerShell:
```powershell
cd C:\ngrok
.\ngrok.exe config add-authtoken YOUR_TOKEN_HERE
```

### 4️⃣ Start Dev Server
```bash
npm run dev
```

### 5️⃣ Start ngrok (New Terminal)
```powershell
cd C:\ngrok
.\ngrok.exe http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 6️⃣ Use on Quest 3
- Open Quest Browser
- Go to your ngrok HTTPS URL
- Click "Enter VR" 🎉

---

## That's It!

**Need detailed steps?** See `NGROK_WALKTHROUGH.md`

**Having issues?** Tell me which step you're stuck on!

