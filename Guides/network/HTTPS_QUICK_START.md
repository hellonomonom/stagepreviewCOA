# Quick Start: HTTPS for WebXR Testing

## Easiest Method: ngrok (2 minutes) ⚡

### Step 1: Download ngrok
- Go to: https://ngrok.com/download
- Download Windows version
- Extract `ngrok.exe` somewhere (e.g., `C:\ngrok\`)

### Step 2: Start Your Dev Server
```bash
npm run dev
```

### Step 3: Run ngrok (in new terminal)
```bash
cd C:\ngrok  # or wherever you put ngrok.exe
.\ngrok.exe http 3000
```

**OR** if ngrok is in your PATH:
```bash
ngrok http 3000
```

### Step 4: Copy the HTTPS URL
You'll see something like:
```
Forwarding    https://abc123-def456.ngrok.io -> http://localhost:3000
```

**Use this URL:** `https://abc123-def456.ngrok.io`

### Step 5: Test!
- **Quest 3:** Open Quest Browser → Go to the ngrok HTTPS URL
- **Vision Pro:** Open Safari → Go to the ngrok HTTPS URL
- Click "Enter VR" - it should work! 🎉

---

## Alternative: Enable HTTPS in Vite (Self-Signed)

If you want to use `https://192.168.1.8:3000` directly, I can configure Vite to use HTTPS with a self-signed certificate. 

**Warning:** Browsers will show a security warning (you'll need to click "Advanced" → "Proceed anyway"). This works but isn't ideal for VR devices.

Would you like me to:
1. **Set up ngrok** (recommended - easiest, no warnings)
2. **Configure Vite HTTPS** (permanent but with warnings)

Let me know which you prefer! 🚀












