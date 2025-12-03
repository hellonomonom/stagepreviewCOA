# Quick Start: Enable WebXR for Testing

## 🚀 Fastest Method: Desktop Testing (2 minutes)

### Step 1: Install WebXR Emulator

**Chrome/Edge:**
1. Open Chrome or Edge browser
2. Go to: https://chrome.google.com/webstore/detail/webxr-api-emulator/mjddjgeghkdijejnciaefnkjmkafnnje
3. Click **"Add to Chrome"**
4. Click the **WebXR Emulator icon** in your browser toolbar (puzzle piece icon)
5. Select **"Headset: Oculus Quest"** from dropdown
6. Click **"Enable"** button

### Step 2: Start Your App

```bash
npm run dev
```

Your app will open at: `http://localhost:3000`

### Step 3: Test VR

1. Look for the **VR button** in the bottom-right corner of your app
2. Click **"Enter VR"**
3. You'll see a VR simulation window
4. Use your **mouse** to look around (simulates head movement)
5. Click **"Exit VR"** to return

**That's it!** You're testing VR! 🎉

---

## 📱 Testing on Quest 3 (Real Headset)

### Step 1: Find Your Computer's IP Address

**Windows:**
```bash
ipconfig
```
Look for **"IPv4 Address"** (e.g., `192.168.1.100`)

**Mac:**
```bash
ifconfig | grep "inet "
```
Look for your local network IP (usually starts with `192.168`)

### Step 2: Start Dev Server

```bash
npm run dev
```

Your app runs on port **3000**.

### Step 3: Connect Quest 3

1. Put on Quest 3 headset
2. Open **Quest Browser** (pre-installed)
3. Type in address bar: `http://YOUR_IP:3000`
   - Example: `http://192.168.1.100:3000`
4. Click **"Enter VR"** button
5. Experience real VR! 🎮

**Important:** Both Quest 3 and your computer must be on the **same WiFi network**.

---

## 🍎 Testing on Apple Vision Pro

### Step 1: Set Up HTTPS (Required)

Vision Pro requires HTTPS. Use **ngrok**:

```bash
# Install ngrok: https://ngrok.com/download
# Then run:
ngrok http 3000
```

This gives you an HTTPS URL like: `https://abc123.ngrok.io`

### Step 2: Access from Vision Pro

1. Put on Vision Pro
2. Open **Safari**
3. Navigate to your ngrok HTTPS URL
4. Click **"Enter VR"**

---

## 🔍 Troubleshooting

### VR Button Not Showing?

1. Open browser console: Press **F12**
2. Check for errors in Console tab
3. Verify WebXR Emulator is enabled (desktop testing)

### "WebXR requires HTTPS" Error?

- **Desktop testing:** Use `localhost` (works without HTTPS)
- **Quest 3:** Can use HTTP on local network (no HTTPS needed)
- **Vision Pro:** Must use HTTPS (use ngrok or deploy to HTTPS server)

### Still Not Working?

1. Check browser console for specific errors
2. Verify WebXR Emulator extension is enabled
3. Try restarting browser
4. Make sure dev server is running on port 3000

---

## ✅ Quick Checklist

- [ ] WebXR Emulator installed (for desktop testing)
- [ ] Dev server running: `npm run dev`
- [ ] Browser console shows no errors
- [ ] VR button visible in bottom-right corner
- [ ] Can click "Enter VR" successfully

---

## 🎯 What You Should See

1. **VR Button** appears in bottom-right corner when WebXR is available
2. Button shows **"Enter VR"** text
3. When clicked, button changes to **"Exit VR"** and turns blue
4. Scene renders in VR mode
5. You can look around (head tracking or mouse for emulator)

---

## 💡 Tips

- **Desktop testing** is fastest for development
- **Quest 3** gives best real-world experience
- Check **browser console** (F12) if something doesn't work
- WebXR Emulator is perfect for quick testing without a headset

Ready to test! Start with desktop testing, then move to real devices when ready. 🚀


