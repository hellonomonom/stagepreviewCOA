# Quick Guide: Enable WebXR for Testing

## Fastest Way: Desktop Testing (No Headset Needed)

### 1. Install WebXR Emulator (2 minutes)

**Chrome/Edge:**
1. Go to: https://chrome.google.com/webstore/detail/webxr-api-emulator/mjddjgeghkdijejnciaefnkjmkafnnje
2. Click "Add to Chrome"
3. Click the WebXR Emulator icon in toolbar
4. Select "Headset: Oculus Quest"
5. Click "Enable"

**That's it!** Your VR button should now work.

---

## Test Your App

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Open browser: `http://localhost:3000`

3. Look for VR button in bottom-right corner

4. Click "Enter VR" - you'll see a VR simulation!

5. Use mouse to look around (simulates head movement)

---

## Testing on Real Devices

### Quest 3 (Wireless)

1. **Find your computer's IP:**
   - Windows: Open CMD, type `ipconfig`, find IPv4 Address
   - Mac: Open Terminal, type `ifconfig`, find inet address

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **On Quest 3:**
   - Open Quest Browser
   - Go to: `http://YOUR_IP:3000` (e.g., `http://192.168.1.100:3000`)
   - Click "Enter VR"

**Note:** Both devices must be on same WiFi network.

---

### Apple Vision Pro

**Requires HTTPS!** Use one of these:

**Option A: ngrok (Easiest)**
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000
# Use the HTTPS URL it gives you (e.g., https://abc123.ngrok.io)
```

Then on Vision Pro:
- Open Safari
- Navigate to your ngrok HTTPS URL
- Click "Enter VR"

**Option B: Deploy to HTTPS server**
- Deploy to any HTTPS server
- Access from Vision Pro Safari

---

## Troubleshooting

**VR button not showing?**
- Open browser console (F12)
- Check for errors
- Verify WebXR is enabled

**"WebXR requires HTTPS" error?**
- Desktop testing: Use `localhost` (works without HTTPS)
- Quest 3: Can use HTTP on local network
- Vision Pro: Requires HTTPS (use ngrok)

**Still not working?**
- Check browser console for errors
- Verify WebXR Emulator is enabled (desktop)
- Try restarting browser
- Check device is on same network (Quest)

---

## Quick Checklist

- [ ] WebXR Emulator installed (desktop)
- [ ] Dev server running
- [ ] Browser console shows no errors
- [ ] VR button visible
- [ ] Can click "Enter VR"

**Ready to test!** 🚀


