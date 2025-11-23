# SSH Connection Setup for DigitalOcean

## Problem
You're trying to use a `.ppk` file (PuTTY format) with the standard `ssh` command, which requires OpenSSH format keys.

## Solution 1: Convert .ppk to OpenSSH Format (Recommended)

### Step 1: Install PuTTYgen (if not already installed)
- Download from: https://www.putty.org/
- Or use the one that comes with PuTTY

### Step 2: Convert the key
1. Open **PuTTYgen**
2. Click **"Load"**
3. Select your `privatekey.ppk` file
4. Enter your passphrase if the key has one
5. Click **"Conversions"** → **"Export OpenSSH key"**
6. Save it as `privatekey` (no extension) or `privatekey.pem`
7. **Important**: Save it in a secure location (NOT in Dropbox if it's synced)

### Step 3: Set proper permissions (on Windows, this is less critical, but good practice)
The key file should have restricted permissions. On Windows, right-click the file:
- Properties → Security → Advanced
- Remove all users except yourself
- Give yourself "Read" permission only

### Step 4: Use the converted key
```bash
ssh -i "C:\Users\tobia\Dropbox\_Projects\Anyma\Coachella26\StagePreview\Deployment\privatekey" root@157.230.118.34
```

---

## Solution 2: Use PuTTY (Windows GUI)

If you prefer using PuTTY's GUI:

1. Open **PuTTY**
2. Enter host: `157.230.118.34`
3. Port: `22`
4. Connection type: `SSH`
5. Go to **Connection** → **SSH** → **Auth** → **Credentials**
6. Click **"Browse"** and select your `privatekey.ppk` file
7. Go back to **Session**, enter a name, click **"Save"**
8. Click **"Open"**

---

## Solution 3: Use plink (PuTTY Command Line)

If you have PuTTY installed, you can use `plink` instead of `ssh`:

```bash
plink -i "C:\Users\tobia\Dropbox\_Projects\Anyma\Coachella26\StagePreview\Deployment\privatekey.ppk" root@157.230.118.34
```

Note: `plink.exe` is usually in the same folder as PuTTY (e.g., `C:\Program Files\PuTTY\`)

---

## Solution 4: Generate New OpenSSH Key (Alternative)

If you want to start fresh with an OpenSSH key:

### On Windows (PowerShell or Git Bash):
```bash
# Generate a new key pair
ssh-keygen -t ed25519 -C "your_email@example.com"

# Or if ed25519 is not available:
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

This will create:
- `id_ed25519` (private key) - **KEEP THIS SECRET**
- `id_ed25519.pub` (public key) - Add this to DigitalOcean

### Add the public key to DigitalOcean:
1. Copy the contents of `id_ed25519.pub`
2. Go to DigitalOcean → **Settings** → **Security** → **SSH Keys**
3. Click **"Add SSH Key"**
4. Paste your public key
5. Give it a name and save

### Then connect:
```bash
ssh -i "path\to\id_ed25519" root@157.230.118.34
```

---

## Solution 5: Use Password Authentication (Temporary)

If you enabled password authentication when creating the droplet:

```bash
ssh root@157.230.118.34
# Then enter password when prompted
```

**Note**: This is less secure. Convert to key-based auth as soon as possible.

---

## Troubleshooting

### "Permission denied (publickey)"
- Make sure the key path is correct
- Make sure you're using the private key (not the public key)
- Check if the key has a passphrase and enter it when prompted
- Verify the key is in OpenSSH format (not .ppk)

### "Bad permissions"
On Linux/Mac, fix permissions:
```bash
chmod 600 privatekey
```

### "Host key verification failed"
Remove the old host key:
```bash
ssh-keygen -R 157.230.118.34
```

### Still having issues?
1. Check DigitalOcean droplet console to verify it's running
2. Verify your IP isn't blocked by firewall
3. Try connecting from a different network
4. Check DigitalOcean's network/firewall settings

---

## Security Best Practices

1. **Never share your private key** - Keep it secure
2. **Use passphrases** on your keys
3. **Don't store keys in synced folders** (like Dropbox) if possible
4. **Use different keys** for different servers
5. **Disable password authentication** once key-based auth is working
6. **Use a non-root user** for daily operations (create one after initial setup)

---

## Quick Reference

**Convert .ppk to OpenSSH:**
- Use PuTTYgen → Conversions → Export OpenSSH key

**Connect with OpenSSH key:**
```bash
ssh -i "path\to\privatekey" root@157.230.118.34
```

**Connect with PuTTY:**
- Use PuTTY GUI with .ppk file

**Connect with plink:**
```bash
plink -i "path\to\privatekey.ppk" root@157.230.118.34
```

