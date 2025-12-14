# VR Testing Guide - Phase 1

## Quick Start: Testing WebXR

### Option 1: Desktop Testing (Easiest - No Headset Required)

**WebXR Emulator Chrome Extension**

1. **Install the Extension:**
   - Open Chrome or Edge browser
   - Go to Chrome Web Store: [WebXR API Emulator](https://chrome.google.com/webstore/detail/webxr-api-emulator/mjddjgeghkdijejnciaefnkjmkafnnje)
   - Click "Add to Chrome"

2. **Enable WebXR:**
   - Click the WebXR Emulator icon in your browser toolbar
   - Select "Headset: Oculus Quest" or "Headset: Generic Headset"
   - Click "Enable"

3. **Test the App:**
   - Open your app at `http://localhost:3000` (or your dev server)
   - The VR button should appear in the bottom-right corner
   - Click "Enter VR" to test VR mode
   - Use mouse to look around (head tracking simulation)

**Note:** The emulator simulates VR on desktop - perfect for development but not as smooth as real hardware.

---

### Option 2: Quest 3 Testing (Real VR)

**Prerequisites:**
- Quest 3 headset
- Quest Browser (comes pre-installed)
- Your app must be accessible over HTTPS (or use local network)

**Method A: Local Network (Development)**

1. **Enable Developer Mode on Quest:**
   - Open Meta Quest mobile app
   - Go to Settings → Headset Settings → Developer Mode
   - Enable Developer Mode

2. **Find Your Computer's IP Address:**
   ```bash
   # Windows
   ipconfig
   # Look for IPv4 Address (e.g., 192.168.1.100)
   
   # Mac/Linux
   ifconfig
   # Look for inet address
   ```

3. **Start Your Dev Server:**
   - Make sure your dev server is running
   - Note your computer's IP address and port (e.g., `192.168.1.100:3000`)

4. **Access from Quest:**
   - Put on Quest headset
   - Open Quest Browser
   - Navigate to: `http://YOUR_IP:3000` (e.g., `http://192.168.1.100:3000`)
   - The VR button should appear
   - Click "Enter VR"

**Method B: HTTPS Deployment (Production-like)**

1. **Set Up HTTPS Locally:**
   - Use a tool like `mkcert` to create local SSL certificates
   - Or use ngrok for HTTPS tunneling (see below)

2. **Or Use ngrok (Easiest):**
   ```bash
   # Install ngrok: https://ngrok.com/download
   ngrok http 3000
   # This gives you an HTTPS URL like: https://abc123.ngrok.io
   ```

3. **Access from Quest:**
   - Open Quest Browser
   - Navigate to your HTTPS URL
   - Click "Enter VR"

---

### Option 3: Apple Vision Pro Testing

**Prerequisites:**
- Apple Vision Pro headset
- Safari browser (WebXR enabled by default in visionOS 2+)
- Your app must be accessible over HTTPS

**Steps:**

1. **Set Up HTTPS:**
   - Use ngrok or deploy to a server with HTTPS
   - WebXR requires HTTPS (except localhost won't work for Vision Pro)

2. **Access from Vision Pro:**
   - Put on Vision Pro
   - Open Safari
   - Navigate to your HTTPS URL
   - The VR button should appear
   - Click "Enter VR"

**Note:** Vision Pro uses hand tracking with gaze-and-pinch for interaction.

---

## Troubleshooting

### VR Button Not Showing

**Check Browser Console:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for messages about WebXR support

**Common Issues:**

1. **"WebXR not supported"**
   - Browser doesn't support WebXR
   - Try Chrome/Edge on desktop
   - Try Quest Browser or Safari on devices

2. **"WebXR requires HTTPS"**
   - Use HTTPS URL (ngrok, or local HTTPS)
   - Or use localhost for desktop testing only

3. **Button appears but VR fails**
   - Check console for error messages
   - Verify headset is connected and powered on
   - Try restarting browser/headset

### Enable WebXR Flags (If Needed)

**Chrome/Edge Desktop:**
- Open `chrome://flags` or `edge://flags`
- Search for "WebXR"
- Enable "WebXR Incubations"
- Enable "WebXR Hand Input"
- Restart browser

**Note:** Modern Chrome/Edge should have WebXR enabled by default.

---

## Quick Test Checklist

- [ ] WebXR Emulator installed (for desktop testing)
- [ ] Dev server running (`npm run dev`)
- [ ] Browser console shows no errors
- [ ] VR button appears in bottom-right corner
- [ ] Clicking "Enter VR" starts VR session
- [ ] Scene renders in VR
- [ ] Head tracking works (or mouse for emulator)
- [ ] Clicking "Exit VR" returns to desktop mode

---

## Testing with Real Devices

### Quest 3 Checklist

- [ ] Quest 3 powered on
- [ ] Connected to same WiFi network as dev computer
- [ ] Quest Browser installed (comes pre-installed)
- [ ] App accessible via IP address or HTTPS
- [ ] VR button visible
- [ ] "Enter VR" works
- [ ] Head tracking smooth
- [ ] Performance acceptable (72fps target)

### Apple Vision Pro Checklist

- [ ] Vision Pro powered on
- [ ] Safari browser open
- [ ] App accessible via HTTPS (required)
- [ ] VR button visible
- [ ] "Enter VR" works
- [ ] Head tracking smooth
- [ ] Hand tracking works (gaze-and-pinch)
- [ ] Performance acceptable (90fps target)

---

## Common Error Messages

### "WebXR not supported in this browser"
- **Solution:** Use a supported browser (Quest Browser, Safari on Vision Pro, or Chrome with emulator)

### "WebXR requires HTTPS"
- **Solution:** Use HTTPS URL or localhost (for desktop only)
- **Quick Fix:** Use ngrok: `ngrok http 3000`

### "VR not available on this device"
- **Solution:** Verify headset is connected and powered on
- Check browser permissions

### "Failed to enter VR mode"
- **Solution:** Check browser console for detailed error
- Verify WebXR permissions are granted
- Try restarting browser/headset

---

## Next Steps After Testing

Once Phase 1 is working:

1. Test all basic functionality
2. Verify performance
3. Document any issues
4. Move to Phase 2 (VR camera presets, enhanced features)

---

## Useful Commands

```bash
# Start dev server
npm run dev

# Check if port 3000 is in use
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# Find your IP address
ipconfig    # Windows
ifconfig    # Mac/Linux
ip addr     # Linux
```

---

## Need Help?

- Check browser console for error messages
- Verify WebXR support: Open console and type `navigator.xr`
- Test with WebXR Emulator first (easiest)
- Check device browser compatibility

Happy testing! 🎉












