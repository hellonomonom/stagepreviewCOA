# How to Check Browser Console on Quest 3

## Method 1: Oculus Developer Hub (Easiest)

### Setup:
1. **Install Oculus Developer Hub** (Windows/Mac):
   - Download from: https://developer.oculus.com/downloads/package/oculus-developer-hub/
   - Install the application

2. **Enable Developer Mode on Quest 3:**
   - Open Oculus app on your phone
   - Go to Settings → Devices → Your Quest 3
   - Tap "Developer Mode" toggle to ON
   - Or: Settings → System → Developer (in Quest headset)

3. **Connect Quest 3:**
   - Connect Quest 3 to PC via USB-C cable
   - Open Oculus Developer Hub
   - Quest should appear in the device list
   - Click "View Browser Console" or "Logcat"

### View Console:
- Oculus Developer Hub has a "Browser Console" feature
- It shows console.log, console.error, etc. from the Quest browser
- Refresh your WebXR app and see logs in real-time

---

## Method 2: Chrome Remote Debugging (Recommended)

### Setup:
1. **Enable USB Debugging on Quest 3:**
   - Settings → System → Developer
   - Enable "USB Connection Dialog"
   - Connect Quest to PC via USB

2. **Install ADB (Android Debug Bridge):**
   - Download: https://developer.android.com/tools/releases/platform-tools
   - Extract to a folder (e.g., `C:\platform-tools`)
   - Add to PATH or use from folder

3. **Connect via ADB:**
   ```powershell
   # Open PowerShell in project directory
   cd C:\platform-tools  # or wherever ADB is
   
   # Check if Quest is detected
   .\adb devices
   
   # Forward port for Chrome remote debugging
   .\adb forward tcp:9222 localabstract:chrome_devtools_remote
   ```

4. **Open Chrome DevTools:**
   - Open Chrome on your PC
   - Go to: `chrome://inspect/#devices`
   - You should see your Quest 3 browser tabs
   - Click "inspect" on the tab running your WebXR app
   - Console logs will appear in DevTools!

---

## Method 3: Wireless Debugging (No Cable Needed)

### Setup:
1. **Enable Wireless ADB:**
   - Connect Quest to PC via USB first (one time setup)
   - Find Quest's IP address:
     ```powershell
     .\adb shell ip addr show wlan0
     # Look for "inet 192.168.x.x"
     ```

2. **Enable Wireless Connection:**
   ```powershell
   # Connect via USB first
   .\adb devices
   
   # Enable wireless debugging
   .\adb tcpip 5555
   
   # Disconnect USB, then connect wirelessly
   .\adb connect 192.168.x.x:5555  # Use your Quest IP
   
   # Forward port for Chrome
   .\adb forward tcp:9222 localabstract:chrome_devtools_remote
   ```

3. **Open Chrome DevTools:**
   - `chrome://inspect/#devices` on PC
   - Inspect Quest browser tab

---

## Method 4: Built-in Browser Console (Limited)

### In Quest Browser:
1. Open your WebXR app in Quest Browser
2. Press **Menu button** (left controller)
3. Look for "Developer Tools" or similar
4. Limited console access, but can see some errors

---

## Method 5: Remote Logging Service

### Simple HTTP Logger:
Add this to your code to send logs to your PC:

```javascript
// Add to main.js or VRManager.js
function logToServer(level, ...args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  
  fetch('http://YOUR_PC_IP:8080/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, message, timestamp: Date.now() })
  }).catch(() => {}); // Ignore errors
}

// Override console methods
const originalLog = console.log;
console.log = (...args) => {
  originalLog(...args);
  logToServer('log', ...args);
};

const originalError = console.error;
console.error = (...args) => {
  originalError(...args);
  logToServer('error', ...args);
};
```

Then set up a simple server on your PC to receive logs.

---

## Quick Start: Chrome Remote Debugging

**Fastest way to get started:**

1. **Enable Developer Mode:**
   - Quest: Settings → System → Developer → Enable

2. **Connect via USB and run:**
   ```powershell
   # Download platform-tools if needed
   # Then run:
   adb devices
   adb forward tcp:9222 localabstract:chrome_devtools_remote
   ```

3. **Open in Chrome:**
   - Go to `chrome://inspect/#devices`
   - Find your Quest browser tab
   - Click "inspect"

4. **See console logs!**
   - Console tab shows all logs
   - Network tab shows requests
   - Can set breakpoints for debugging

---

## Troubleshooting

### "adb devices" shows nothing:
- Check USB cable (needs data transfer, not just charging)
- Enable USB debugging in Quest settings
- Install Quest drivers if needed

### "Port already in use":
```powershell
# Kill existing ADB
adb kill-server
adb start-server
```

### Can't find Quest in chrome://inspect:
- Make sure port forwarding is active
- Check Quest browser has your app open
- Try refreshing chrome://inspect page

---

## Recommended: Method 2 (Chrome Remote Debugging)

This gives you the full Chrome DevTools experience:
- ✅ Full console with all logs
- ✅ Network inspector
- ✅ Breakpoints and debugging
- ✅ Performance profiling
- ✅ Element inspection

**Try this first!** It's the most powerful option.











