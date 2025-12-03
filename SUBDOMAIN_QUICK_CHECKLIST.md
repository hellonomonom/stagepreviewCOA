# Subdomain Setup - Quick Checklist: preview.anyma.com

Use this checklist alongside `SUBDOMAIN_SETUP.md` for step-by-step guidance.

## Pre-Setup
- [ ] Digital Ocean server IP: `157.230.118.34` (noted)
- [ ] Current server: http://157.230.118.34/
- [ ] Target subdomain: preview.anyma.com
- [ ] Domain DNS access confirmed (IONOS)
- [ ] **SSH access to server** (see `SSH_SETUP_DIGITALOCEAN.md` if needed)
  - [ ] Option: Use Digital Ocean Console (web-based, no SSH keys)
  - [ ] Option: Set up SSH keys for command line access

## DNS Configuration (IONOS)
- [ ] Logged into IONOS (ionos.de)
- [ ] Navigated to: Domains → DNS Settings
- [ ] Added A record:
  - Type: `A`
  - Name: `preview` (NOT `preview.anyma.com`)
  - Value: `157.230.118.34`
- [ ] Waited 5-60 minutes for DNS propagation
- [ ] Verified DNS: `nslookup preview.anyma.com` returns `157.230.118.34`

## Server Configuration
- [ ] SSH'd into Digital Ocean server (157.230.118.34)
- [ ] Updated nginx config: `server_name preview.anyma.com;`
- [ ] Tested nginx config: `sudo nginx -t`
- [ ] Reloaded nginx: `sudo systemctl reload nginx`

## SSL Certificate (Required for WebXR!)
- [ ] Installed Certbot: `sudo apt install certbot python3-certbot-nginx -y`
- [ ] Obtained SSL certificate: `sudo certbot --nginx -d preview.anyma.com`
- [ ] Verified HTTPS works: `curl -I https://preview.anyma.com`
- [ ] Checked auto-renewal: `sudo certbot renew --dry-run`

## Firewall
- [ ] Opened port 80: `sudo ufw allow 80/tcp`
- [ ] Opened port 443: `sudo ufw allow 443/tcp`

## Testing
- [ ] HTTP redirects to HTTPS: `curl -I http://preview.anyma.com`
- [ ] HTTPS loads in browser: `https://preview.anyma.com`
- [ ] SSL padlock shows in browser 🔒
- [ ] Application loads correctly (same as http://157.230.118.34/)
- [ ] WebXR tested on Quest 3 / Vision Pro / Desktop

## Verification Commands
```bash
# DNS (should return 157.230.118.34)
nslookup preview.anyma.com

# Nginx
sudo nginx -t
sudo systemctl status nginx

# Node.js
pm2 status
pm2 logs stagepreview-coa

# SSL
sudo certbot certificates

# Test URLs
curl -I http://157.230.118.34/
curl -I https://preview.anyma.com
```

## ✅ Done!
Your subdomain is live at: `https://preview.anyma.com`

**Current server:** http://157.230.118.34/  
**New subdomain:** https://preview.anyma.com

**WebXR Status:** ✅ Ready (HTTPS configured)

