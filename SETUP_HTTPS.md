# Setup HTTPS for Local Development

## Why HTTPS?
- **Required for WebXR on Apple Vision Pro**
- **Required for WebXR in production** (Quest 3 can use HTTP on local network, but HTTPS is recommended)
- **Matches production environment**

---

## Option 1: ngrok (Easiest - 2 minutes) ⚡

### Step 1: Install ngrok

**Windows:**
1. Download from: https://ngrok.com/download
2. Extract `ngrok.exe` to a folder (e.g., `C:\ngrok\`)
3. Add to PATH (optional, or use full path)

**Or use Chocolatey:**
```bash
choco install ngrok
```

### Step 2: Start Your Dev Server

```bash
npm run dev
```

### Step 3: Start ngrok

**In a new terminal window:**
```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding    https://abc123.ngrok.io -> http://localhost:3000
```

### Step 4: Use the HTTPS URL

- **On Quest 3:** Open Quest Browser → Go to `https://abc123.ngrok.io`
- **On Vision Pro:** Open Safari → Go to `https://abc123.ngrok.io`
- **On Desktop:** Open `https://abc123.ngrok.io`

**That's it!** You now have HTTPS! 🎉

**Note:** The URL changes each time you restart ngrok (unless you have a paid account). Perfect for quick testing.

---

## Option 2: mkcert (Permanent - 10 minutes) 🔒

This creates a **trusted local SSL certificate** that works permanently.

### Step 1: Install mkcert

**Windows (using Chocolatey):**
```bash
choco install mkcert
```

**Or manually:**
1. Download from: https://github.com/FiloSottile/mkcert/releases
2. Download `mkcert-v1.x.x-windows-amd64.exe`
3. Rename to `mkcert.exe` and place in a folder in your PATH

### Step 2: Install Local CA

```bash
mkcert -install
```

This installs a local Certificate Authority that your system will trust.

### Step 3: Generate Certificate for Your IP

```bash
# Generate certificate for your local IP
mkcert 192.168.1.8 localhost 127.0.0.1

# This creates two files:
# - 192.168.1.8+2.pem (certificate)
# - 192.168.1.8+2-key.pem (private key)
```

**Note:** The filename format is `IP+number.pem`. List your files to see the exact name.

### Step 4: Update vite.config.js

I'll add HTTPS configuration to your Vite config:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    https: {
      key: fs.readFileSync(path.join(__dirname, '192.168.1.8+2-key.pem')),
      cert: fs.readFileSync(path.join(__dirname, '192.168.1.8+2.pem')),
    },
    // ... rest of config
  },
});
```

### Step 5: Restart Dev Server

```bash
npm run dev
```

You should see:
```
➜  Local:   https://localhost:3000/
➜  Network: https://192.168.1.8:3000/
```

**Now you have permanent HTTPS!** The certificate is trusted by your system, so no browser warnings.

---

## Option 3: Simple Self-Signed Certificate (No Installation)

If you don't want to install anything, Vite can generate a self-signed certificate automatically:

### Update vite.config.js:

```javascript
server: {
  port: 3000,
  host: '0.0.0.0',
  https: true, // Vite will auto-generate self-signed certificate
  // ...
}
```

**Note:** Browsers will show a security warning (click "Advanced" → "Proceed anyway"). This works but isn't ideal for VR devices.

---

## Comparison

| Method | Setup Time | Browser Warnings | Works on Quest 3 | Works on Vision Pro |
|--------|-----------|------------------|------------------|---------------------|
| **ngrok** | 2 min | ❌ None | ✅ Yes | ✅ Yes |
| **mkcert** | 10 min | ❌ None | ✅ Yes | ✅ Yes |
| **Self-signed** | 1 min | ⚠️ Warning | ⚠️ Maybe | ❌ Probably not |

---

## Recommendation

**For Quick Testing:** Use **ngrok** - it's instant and works perfectly.

**For Development:** Use **mkcert** - it's permanent and trusted by your system.

---

## Troubleshooting

### ngrok: "Tunnel session closed"
- Restart ngrok: `ngrok http 3000`
- Get new URL from ngrok output

### mkcert: Certificate not trusted
- Make sure you ran `mkcert -install`
- Try regenerating certificate
- On Quest 3, you may need to accept the certificate in browser settings

### HTTPS not working
- Check that dev server is running
- Verify certificate file paths in vite.config.js
- Check browser console for errors

---

## Next Steps

After setting up HTTPS:

1. **Test on Quest 3:**
   - Use your HTTPS URL (ngrok or `https://192.168.1.8:3000`)
   - Click "Enter VR" - should work!

2. **Test on Vision Pro:**
   - Use HTTPS URL in Safari
   - Click "Enter VR" - should work!

Ready to test! 🚀


