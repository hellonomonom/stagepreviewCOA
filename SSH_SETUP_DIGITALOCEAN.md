# SSH Setup for Digital Ocean Server

## Overview

This guide will help you set up SSH access to your Digital Ocean server at `157.230.118.34` so you can configure nginx and SSL certificates.

---

## Option 1: Using Digital Ocean Console (Easiest - No SSH Keys Needed)

If you just need quick access to run commands:

1. **Log into Digital Ocean Dashboard**
   - Go to: https://cloud.digitalocean.com/
   - Log in with your account

2. **Access Your Droplet**
   - Click on **"Droplets"** in the left menu
   - Find your droplet (the one with IP `157.230.118.34`)
   - Click on the droplet name

3. **Open Console**
   - Click the **"Access"** button (top right)
   - Click **"Launch Droplet Console"** or **"Console"**
   - This opens a web-based terminal in your browser

4. **You're In!**
   - You can now run commands directly in the browser console
   - No SSH keys needed for this method

**Note:** The console is useful for quick tasks, but SSH is better for file transfers and longer sessions.

---

## Option 2: Set Up SSH Access (Recommended)

SSH allows you to connect from your local computer using a terminal.

### Step 1: Check if You Have SSH Keys

**On Windows (PowerShell):**
```powershell
# Check if you have SSH keys
ls ~/.ssh
```

If you see `id_rsa` and `id_rsa.pub` (or `id_ed25519` and `id_ed25519.pub`), you already have SSH keys. Skip to Step 3.

### Step 2: Generate SSH Key (If You Don't Have One)

**On Windows (PowerShell):**
```powershell
# Generate a new SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Press Enter to accept default location
# Optionally set a passphrase (or press Enter for no passphrase)
```

**On Mac/Linux:**
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

This creates:
- `~/.ssh/id_ed25519` (private key - keep secret!)
- `~/.ssh/id_ed25519.pub` (public key - this is what you'll add to Digital Ocean)

### Step 3: Get Your Public Key

**On Windows (PowerShell):**
```powershell
# Display your public key
cat ~/.ssh/id_ed25519.pub
# or if you have id_rsa:
cat ~/.ssh/id_rsa.pub
```

**On Mac/Linux:**
```bash
cat ~/.ssh/id_ed25519.pub
# or:
cat ~/.ssh/id_rsa.pub
```

**Copy the entire output** - it looks like:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... your_email@example.com
```

### Step 4: Add SSH Key to Digital Ocean

1. **Go to Digital Ocean Dashboard**
   - Navigate to: https://cloud.digitalocean.com/account/security
   - Or: Settings → Security → SSH Keys

2. **Add SSH Key**
   - Click **"Add SSH Key"**
   - **Name:** Give it a name (e.g., "My Laptop")
   - **Public Key:** Paste the public key you copied in Step 3
   - Click **"Add SSH Key"**

### Step 5: Add SSH Key to Your Droplet

**If your droplet already exists:**

1. **Go to your Droplet**
   - Click on **"Droplets"** → Select your droplet (157.230.118.34)

2. **Access Console** (as described in Option 1)

3. **Add your public key to the server:**
   ```bash
   # Create .ssh directory if it doesn't exist
   mkdir -p ~/.ssh
   chmod 700 ~/.ssh
   
   # Add your public key
   nano ~/.ssh/authorized_keys
   # Paste your public key, save and exit (Ctrl+X, Y, Enter)
   
   # Set correct permissions
   chmod 600 ~/.ssh/authorized_keys
   ```

**Or create a new droplet with SSH key:**
- When creating a new droplet, select your SSH key in the "Authentication" section

### Step 6: Connect via SSH

**On Windows (PowerShell or Command Prompt):**
```powershell
# Connect to your server
ssh root@157.230.118.34

# Or if you have a username:
ssh your-username@157.230.118.34
```

**On Mac/Linux:**
```bash
ssh root@157.230.118.34
```

**First time connection:**
- You'll see: "The authenticity of host... can't be established. Are you sure you want to continue?"
- Type: `yes` and press Enter
- You should now be logged into your server!

---

## Option 3: Using Password Authentication (Less Secure)

If you prefer to use a password instead of SSH keys:

1. **Access Console** (Option 1 above)

2. **Set a root password** (if not already set):
   ```bash
   passwd
   # Enter new password twice
   ```

3. **Enable password authentication** (if disabled):
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Find: PasswordAuthentication no
   # Change to: PasswordAuthentication yes
   # Save and exit
   
   sudo systemctl restart sshd
   ```

4. **Connect with password:**
   ```bash
   ssh root@157.230.118.34
   # Enter password when prompted
   ```

**⚠️ Warning:** Password authentication is less secure than SSH keys. Use SSH keys if possible.

---

## Troubleshooting

### "Permission denied (publickey)"
- Make sure you added your public key to Digital Ocean
- Verify the key is in `~/.ssh/authorized_keys` on the server
- Check file permissions: `chmod 600 ~/.ssh/authorized_keys`

### "Connection refused"
- Check if your droplet is running in Digital Ocean dashboard
- Verify the IP address: `157.230.118.34`
- Check firewall settings

### "Host key verification failed"
- Remove old host key:
  ```bash
  ssh-keygen -R 157.230.118.34
  ```

### Can't find SSH keys
- Generate new keys (Step 2 above)
- Make sure you're in the right directory: `cd ~/.ssh`

---

## Quick Test

Once connected, test that everything works:

```bash
# Check you're on the right server
hostname -I
# Should show: 157.230.118.34

# Check nginx is installed
nginx -v

# Check Node.js/PM2
pm2 --version
```

---

## Next Steps

Once you have SSH access:

1. ✅ You can configure nginx (see `SUBDOMAIN_SETUP.md`)
2. ✅ You can install SSL certificates
3. ✅ You can manage your Node.js application
4. ✅ You can transfer files using `scp` or `rsync`

---

## Security Best Practices

1. **Use SSH keys** instead of passwords
2. **Disable root login** if possible (create a sudo user)
3. **Use a strong passphrase** for your SSH key
4. **Keep your server updated:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

---

## Need Help?

If you're stuck:
- Use Digital Ocean Console (Option 1) for immediate access
- Check Digital Ocean documentation: https://docs.digitalocean.com/products/droplets/how-to/connect-with-ssh/
- Verify your droplet is running in the Digital Ocean dashboard



