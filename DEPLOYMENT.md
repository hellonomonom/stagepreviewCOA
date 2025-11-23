# Deployment Guide: Stage Preview COA on DigitalOcean

This guide will walk you through deploying the Stage Preview COA application on a DigitalOcean VPS (Droplet).

## Prerequisites

- A DigitalOcean account
- A domain name (optional but recommended)
- Basic knowledge of Linux command line
- SSH access to your computer

---

## Step 1: Create a DigitalOcean Droplet

1. **Log in to DigitalOcean** and click "Create" → "Droplets"

2. **Choose configuration:**
   - **Image**: Ubuntu 22.04 LTS (or latest LTS)
   - **Plan**: 
     - **Basic**: $6/month (1GB RAM, 1 vCPU) - Minimum for testing
     - **Basic**: $12/month (2GB RAM, 1 vCPU) - Recommended for production
     - **Basic**: $18/month (4GB RAM, 2 vCPU) - Better performance
   - **Region**: Choose closest to your users
   - **Authentication**: SSH keys (recommended) or password
   - **Hostname**: `stagepreview-coa` (or your choice)

3. **Click "Create Droplet"** and wait for it to be ready (1-2 minutes)

4. **Note your Droplet's IP address** (you'll need this): 157.230.118.34


---

## Step 2: Connect to Your Droplet

### On Windows (PowerShell or Git Bash):

```bash
ssh root@YOUR_DROPLET_IP
```

Replace `YOUR_DROPLET_IP` with the IP address from Step 1.

If using SSH keys, you may need to specify the key:
```bash
ssh -i path/to/your/key root@YOUR_DROPLET_IP
```

### First-time connection:
- You'll see a security warning - type `yes` to continue
- If using password auth, enter your password

---

## Step 3: Initial Server Setup

Once connected, run these commands:

### Update system packages:
```bash
apt update && apt upgrade -y
```

### Install Node.js 18+ (using NodeSource):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Verify installation:
```bash
node --version  # Should show v20.x.x
npm --version
```

### Install FFmpeg (required for NDI):
```bash
apt install -y ffmpeg
```

Verify:
```bash
ffmpeg -version
```

### Install PM2 (process manager):
```bash
npm install -g pm2
```

### Install Nginx (web server):
```bash
apt install -y nginx
```

### Install Git (if not already installed):
```bash
apt install -y git
```

---

## Step 4: Clone Your Repository

```bash
# Create a directory for your app
mkdir -p /var/www
cd /var/www

# Clone your repository (replace with your repo URL)
git clone https://github.com/hellonomonom/stagepreviewCOA.git stagepreview-coa

# Or if using SSH:
# git clone git@github.com:your-username/stagepreviewCOA.git stagepreview-coa

cd stagepreview-coa
```

**Alternative**: If your repo is private or you prefer, you can upload files using SCP:
```bash
# From your local machine:
scp -r . root@YOUR_DROPLET_IP:/var/www/stagepreview-coa
```

---

## Step 5: Install Dependencies and Build

```bash
cd /var/www/stagepreview-coa

# Install dependencies
npm install

# Build the frontend
npm run build
```

---

## Step 6: Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit the file (optional - defaults work for most cases)
nano .env
```

Press `Ctrl+X`, then `Y`, then `Enter` to save and exit.

---

## Step 7: Configure Nginx

1. **Copy the Nginx configuration:**
```bash
cp nginx.conf /etc/nginx/sites-available/stagepreview-coa
```

2. **Edit the configuration:**
```bash
nano /etc/nginx/sites-available/stagepreview-coa
```

3. **Update the domain name:**
   - Replace `your-domain.com` with your actual domain
   - Or use your Droplet's IP address for testing

4. **Enable the site:**
```bash
ln -s /etc/nginx/sites-available/stagepreview-coa /etc/nginx/sites-enabled/
```

5. **Test Nginx configuration:**
```bash
nginx -t
```

6. **Remove default site (optional):**
```bash
rm /etc/nginx/sites-enabled/default
```

7. **Reload Nginx:**
```bash
systemctl reload nginx
```

---

## Step 8: Start the Application with PM2

```bash
cd /var/www/stagepreview-coa

# Start the application
pm2 start ecosystem.config.cjs

# Save PM2 configuration (so it restarts on server reboot)
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the command it outputs (usually something like: sudo env PATH=...)
```

**Check status:**
```bash
pm2 status
pm2 logs stagepreview-coa
```

---

## Step 9: Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable

# Check status
ufw status
```

---

## Step 10: Test Your Application

1. **Open your browser** and go to:
   - `http://YOUR_DROPLET_IP` (if no domain)
   - `http://your-domain.com` (if domain is configured)

2. **Check health endpoint:**
   - `http://YOUR_DROPLET_IP/health`

3. **View logs if issues:**
```bash
pm2 logs stagepreview-coa
tail -f /var/log/nginx/stagepreview-coa-error.log
```

---

## Step 11: Set Up SSL (HTTPS) - Optional but Recommended

### Using Let's Encrypt (Free SSL):

1. **Install Certbot:**
```bash
apt install -y certbot python3-certbot-nginx
```

2. **Get SSL certificate:**
```bash
certbot --nginx -d your-domain.com -d www.your-domain.com
```

3. **Follow the prompts:**
   - Enter your email
   - Agree to terms
   - Choose whether to redirect HTTP to HTTPS (recommended: Yes)

4. **Auto-renewal is set up automatically**, but test it:
```bash
certbot renew --dry-run
```

5. **Update Nginx config** to use the HTTPS block (uncomment it in nginx.conf)

---

## Step 12: Future Deployments

After initial setup, to deploy updates:

```bash
cd /var/www/stagepreview-coa

# Option 1: Use the deployment script
npm run deploy
# or
bash deploy.sh

# Option 2: Manual deployment
git pull origin main
npm install
npm run build
pm2 restart stagepreview-coa
```

---

## Useful Commands

### PM2 Commands:
```bash
pm2 status                    # View app status
pm2 logs stagepreview-coa     # View logs
pm2 restart stagepreview-coa   # Restart app
pm2 stop stagepreview-coa     # Stop app
pm2 monit                     # Monitor resources
```

### Nginx Commands:
```bash
sudo systemctl status nginx    # Check status
sudo systemctl restart nginx   # Restart
sudo nginx -t                  # Test config
sudo tail -f /var/log/nginx/stagepreview-coa-error.log  # View errors
```

### System Commands:
```bash
df -h                         # Check disk space
free -h                       # Check memory
top                           # Monitor system resources
```

---

## Troubleshooting

### Application won't start:
1. Check logs: `pm2 logs stagepreview-coa`
2. Verify Node.js: `node --version`
3. Check port: `netstat -tulpn | grep 8080`
4. Verify build: `ls -la dist/`

### Nginx 502 Bad Gateway:
1. Check if app is running: `pm2 status`
2. Check app logs: `pm2 logs stagepreview-coa`
3. Verify port 8080 is accessible: `curl http://localhost:8080/health`

### Can't access from browser:
1. Check firewall: `ufw status`
2. Verify Nginx: `systemctl status nginx`
3. Check Nginx config: `nginx -t`

### NDI not working:
1. Verify FFmpeg: `ffmpeg -version`
2. Check if NDI tools are installed (may need additional setup)
3. Review server logs for NDI-related errors

---

## Security Recommendations

1. **Create a non-root user:**
```bash
adduser deploy
usermod -aG sudo deploy
# Then use this user instead of root
```

2. **Disable root SSH login** (edit `/etc/ssh/sshd_config`):
```
PermitRootLogin no
```

3. **Set up fail2ban** (protect against brute force):
```bash
apt install -y fail2ban
systemctl enable fail2ban
```

4. **Regular updates:**
```bash
apt update && apt upgrade -y
```

5. **Backup your data:**
   - Use DigitalOcean snapshots
   - Or set up automated backups

---

## Cost Estimate

- **Droplet**: $6-18/month
- **Domain**: $10-15/year (optional)
- **Total**: ~$7-20/month

---

## Support

If you encounter issues:
1. Check the logs (PM2 and Nginx)
2. Verify all dependencies are installed
3. Ensure ports are open in firewall
4. Check DigitalOcean's status page

---

## Next Steps

- Set up monitoring (PM2 Plus, or external service)
- Configure backups
- Set up CI/CD for automatic deployments
- Add domain email (optional)

Good luck with your deployment! 🚀

