# Quick Setup: Quest 3 Console Debugging

## Fastest Method (5 minutes)

### Step 1: Enable Developer Mode
1. Put on Quest 3
2. Open **Settings** (gear icon)
3. Go to **System** → **Developer**
4. Toggle **Developer Mode** ON

### Step 2: Install Android Platform Tools
1. Download: https://developer.android.com/tools/releases/platform-tools
2. Extract `platform-tools` folder to `C:\platform-tools` (or anywhere)

### Step 3: Connect Quest
1. Connect Quest 3 to PC via USB-C cable
2. Quest should show "Allow USB Debugging?" - tap **Allow**

### Step 4: Run Port Forwarding
Open PowerShell in the `platform-tools` folder:

```powershell
# Check connection
.\adb devices

# Forward Chrome DevTools port
.\adb forward tcp:9222 localabstract:chrome_devtools_remote
```

You should see: `9222` (output confirming port forward)

### Step 5: Open Chrome DevTools
1. Open Chrome on your PC
2. Go to: `chrome://inspect/#devices`
3. You should see your Quest 3 listed
4. Open your WebXR app in Quest Browser
5. Click **"inspect"** on the tab
6. **Console logs appear!** 🎉

---

## Alternative: Use the Batch Script

I've created `QUICK_CONSOLE_DEBUG.bat` - just run it!

**Note:** Place it in the `platform-tools` folder or make sure ADB is in your PATH.

---

## What You'll See

Once connected, Chrome DevTools will show:
- ✅ All `console.log()` messages
- ✅ Errors and warnings
- ✅ Network requests
- ✅ Can set breakpoints to debug
- ✅ Performance profiling

---

## Troubleshooting

**"adb devices" shows nothing:**
- Check USB cable (use a data cable, not charging-only)
- Enable USB debugging in Quest settings
- Try different USB port on PC

**"Port already in use":**
```powershell
adb kill-server
adb start-server
```

**Can't find Quest in chrome://inspect:**
- Make sure Quest Browser is open
- Refresh the chrome://inspect page
- Check port forwarding is active: `adb forward --list`

---

## Pro Tips

1. **Keep port forwarding active** - run the command each time you connect Quest
2. **Use wireless debugging** - once set up, no cable needed (see full guide)
3. **Save your Quest IP** - easier for wireless connection later
4. **Bookmark chrome://inspect** - quick access to DevTools

---

## Next Steps

Once console is working:
1. Open your WebXR app in Quest Browser
2. Enter VR mode
3. Press trigger (for teleportation)
4. Check console for debug messages!



