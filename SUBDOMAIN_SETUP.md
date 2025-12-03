# Subdomain Setup Guide: preview.anyma.com → Digital Ocean Server

## Overview

This guide will help you point `preview.anyma.com` to your Digital Ocean server (157.230.118.34) and set up HTTPS (required for WebXR).

**Current Server:** http://157.230.118.34/  
**Target Subdomain:** https://preview.anyma.com

**✅ WebXR Compatibility:** Yes, WebXR will work perfectly with this setup! WebXR requires HTTPS, which we'll configure using Let's Encrypt SSL certificates.

---

## Prerequisites

- ✅ Digital Ocean droplet/server running at `157.230.118.34`
- ✅ Domain name (`anyma.com`) managed on IONOS
- ✅ **SSH access to your Digital Ocean server** (see `SSH_SETUP_DIGITALOCEAN.md` if needed)
- ✅ Nginx installed on the server
- ✅ Node.js application running (port 8080)
- ✅ Current server accessible at: http://157.230.118.34/

**⚠️ Don't have SSH access yet?** See `SSH_SETUP_DIGITALOCEAN.md` for setup instructions. You can also use Digital Ocean's web console for quick access.

---

## Step 1: Your Digital Ocean Server IP

**Your Server IP:** `157.230.118.34`

This is the IP address you'll use for the DNS A record. Your server is currently accessible at:
- http://157.230.118.34/

After DNS setup, it will also be accessible at:
- https://preview.anyma.com

---

## Step 2: Configure DNS Records

### Your Domain is on IONOS (ionos.de)

Since your domain is managed on IONOS, follow these steps:

1. **Log into IONOS:**
   - Go to: https://www.ionos.de/ (or your country-specific IONOS site)
   - Log in with your account credentials

2. **Navigate to DNS Management:**
   - Go to **"Domains & SSL"** (or **"Domains"**)
   - Select your domain (`website.com`)
   - Click on **"DNS"** or **"DNS Settings"** tab

3. **Add A Record for Subdomain:**
   - Click **"Add Record"** or **"+"** button
   - **Record Type:** Select `A` (or `A Record`)
   - **Name/Host:** Enter `preview` (this creates `preview.anyma.com`)
     - ⚠️ **Important:** Enter only `preview`, NOT `preview.anyma.com`
   - **Points to/Value:** Enter `157.230.118.34`
     - This is your Digital Ocean server IP
   - **TTL:** Leave default (usually 3600 seconds) or set to `3600`
   - Click **"Save"** or **"Add Record"**

4. **Verify the Record:**
   - You should see a new A record in the list:
     ```
     Type: A
     Name: preview
     Value: 157.230.118.34
     TTL: 3600
     ```

**IONOS Interface Notes:**
- The DNS interface may be in German if you're on ionos.de
- Look for: **"DNS-Einstellungen"** (DNS Settings)
- Record type might be labeled: **"A-Eintrag"** (A Record)
- The hostname field might be labeled: **"Name"** or **"Host"**

### Alternative: Using IONOS API or Advanced DNS

If you have access to IONOS API or advanced DNS settings:
- Use the same A record configuration
- Ensure the subdomain points directly to your Digital Ocean IP
- No CNAME needed for subdomains (A record is preferred)

### DNS Propagation

- ⏱️ **Wait 5-60 minutes** for DNS to propagate
- **Test DNS:** Run `nslookup preview.anyma.com` or `dig preview.anyma.com`
- You should see: `157.230.118.34`

---

## Step 3: Update Nginx Configuration

### On Your Digital Ocean Server:

**First, make sure you have SSH access** (see `SSH_SETUP_DIGITALOCEAN.md` if needed).

1. **SSH into your server:**
   ```bash
   ssh root@157.230.118.34
   ```
   
   **Or use Digital Ocean Console:**
   - Go to Digital Ocean Dashboard → Your Droplet → Access → Launch Console
   - This opens a web-based terminal (no SSH keys needed)

2. **Edit the nginx configuration:**
   ```bash
   sudo nano /etc/nginx/sites-available/stagepreview-coa
   ```

3. **Update the server_name:**
   ```nginx
   server {
       listen 80;
       server_name preview.anyma.com;  # Update this line
       
       # ... rest of config
   }
   ```

4. **Test nginx configuration:**
   ```bash
   sudo nginx -t
   ```

5. **Reload nginx:**
   ```bash
   sudo systemctl reload nginx
   ```

---

## Step 4: Install Certbot (Let's Encrypt SSL)

**HTTPS is REQUIRED for WebXR!** Let's Encrypt provides free SSL certificates.

### Install Certbot:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx -y
```

---

## Step 5: Obtain SSL Certificate

### Automatic Setup (Recommended):

Certbot can automatically configure nginx:

```bash
sudo certbot --nginx -d preview.anyma.com
```

**During setup:**
- Enter your email address
- Agree to terms of service
- Choose whether to redirect HTTP to HTTPS (recommended: **Yes**)

### Manual Setup:

If you prefer manual configuration:

```bash
# Get certificate only
sudo certbot certonly --nginx -d preview.anyma.com
```

Then manually update nginx config (see Step 6).

---

## Step 6: Update Nginx for HTTPS

### If Certbot didn't auto-configure, update nginx manually:

1. **Edit nginx config:**
   ```bash
   sudo nano /etc/nginx/sites-available/stagepreview-coa
   ```

2. **Uncomment and update the HTTPS server block:**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name preview.anyma.com;
   
       ssl_certificate /etc/letsencrypt/live/preview.anyma.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/preview.anyma.com/privkey.pem;
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;
       ssl_prefer_server_ciphers on;
   
       client_max_body_size 100M;
   
       access_log /var/log/nginx/stagepreview-coa-ssl-access.log;
       error_log /var/log/nginx/stagepreview-coa-ssl-error.log;
   
       # Static assets
       location /assets/ {
           alias /var/www/stagepreview-coa/dist/assets/;
           expires 30d;
           add_header Cache-Control "public, immutable";
       }
   
       # WebSocket support for NDI streaming
       location /ndi/ws {
           proxy_pass http://nodejs_backend;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_read_timeout 86400;
       }
   
       # Backend API routes
       location /ndi/ {
           proxy_pass http://nodejs_backend;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_set_header Connection "";
           proxy_buffering off;
       }
   
       # Health check
       location /health {
           proxy_pass http://nodejs_backend;
           access_log off;
       }
   
       # Frontend SPA
       location / {
           proxy_pass http://nodejs_backend;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   
   # Redirect HTTP to HTTPS
   server {
       listen 80;
       server_name preview.anyma.com;
       return 301 https://$server_name$request_uri;
   }
   ```

3. **Test and reload:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

## Step 7: Configure Firewall (if needed)

Ensure ports 80 and 443 are open:

```bash
# UFW (Ubuntu)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# Or check Digital Ocean Firewall settings in dashboard
```

---

## Step 8: Set Up Auto-Renewal for SSL

Let's Encrypt certificates expire every 90 days. Set up auto-renewal:

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot should already be set up with a systemd timer, but verify:
sudo systemctl status certbot.timer
```

---

## Step 9: Verify Everything Works

### 1. Test DNS Resolution:
```bash
nslookup preview.anyma.com
# Should return: 157.230.118.34
```

### 2. Test HTTP (should redirect to HTTPS):
```bash
curl -I http://preview.anyma.com
# Should see: HTTP/1.1 301 Moved Permanently
```

### 3. Test HTTPS:
```bash
curl -I https://preview.anyma.com
# Should see: HTTP/2 200
```

### 4. Test in Browser:
- Open: `https://preview.anyma.com`
- Should see your application (same as http://157.230.118.34/)
- Check for SSL padlock 🔒 in address bar

### 5. Test WebXR:
- **Quest 3:** Open Quest Browser → Navigate to `https://preview.anyma.com` → Click "Enter VR"
- **Vision Pro:** Open Safari → Navigate to `https://preview.anyma.com` → Click "Enter VR"
- **Desktop:** Test in Chrome/Firefox with WebXR enabled

---

## WebXR Compatibility ✅

**Yes, WebXR will work with this setup!**

### Requirements Met:
- ✅ **HTTPS:** Required for WebXR (configured with Let's Encrypt)
- ✅ **Valid SSL Certificate:** Let's Encrypt provides trusted certificates
- ✅ **Proper Headers:** Nginx configured with correct proxy headers
- ✅ **WebSocket Support:** Configured for NDI streaming

### WebXR Browser Support:
- **Quest 3:** ✅ Works with HTTPS
- **Apple Vision Pro:** ✅ Works with HTTPS (Safari)
- **Chrome/Edge:** ✅ Works with HTTPS
- **Firefox:** ✅ Works with HTTPS

### Important Notes:
- **HTTP will NOT work** for WebXR on most devices (especially Vision Pro)
- **Self-signed certificates** may cause issues on VR devices
- **Let's Encrypt certificates** are trusted by all major browsers and VR devices

---

## Troubleshooting

### DNS Not Resolving:
- Wait longer (up to 24 hours for full propagation, but usually 5-60 minutes)
- Check DNS records are correct in IONOS
- **IONOS-specific:** Make sure you entered only `preview` in the Name field, NOT `preview.anyma.com`
- **IONOS-specific:** Verify the A record shows: `157.230.118.34`
- **IONOS-specific:** Check if IONOS has any DNS caching or propagation delays
- Use `dig preview.anyma.com` or `nslookup preview.anyma.com` to verify
- Try different DNS servers: `nslookup preview.anyma.com 8.8.8.8` (Google DNS)
- Expected result: `157.230.118.34`

### SSL Certificate Issues:
- Ensure port 80 is open (required for Let's Encrypt validation)
- Check nginx is running: `sudo systemctl status nginx`
- Verify domain points to your server: `nslookup preview.anyma.com`
- Should return: `157.230.118.34`

### 502 Bad Gateway:
- Check Node.js server is running: `pm2 status`
- Check server.js is listening on port 8080
- Check nginx upstream configuration

### WebXR Not Working:
- Verify HTTPS is working (check browser padlock)
- Check browser console for errors
- Ensure WebXR API is available: `navigator.xr` should exist
- Test on multiple devices/browsers

### Connection Refused:
- Check firewall settings
- Verify ports 80/443 are open
- Check nginx is listening: `sudo netstat -tlnp | grep nginx`

---

## Quick Reference Commands

```bash
# Check DNS (should return 157.230.118.34)
nslookup preview.anyma.com
dig preview.anyma.com

# Check nginx status
sudo systemctl status nginx
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Check Node.js/PM2
pm2 status
pm2 logs stagepreview-coa

# Check SSL certificate
sudo certbot certificates

# Renew SSL certificate
sudo certbot renew

# Check firewall
sudo ufw status

# Test current server
curl -I http://157.230.118.34/
curl -I https://preview.anyma.com
```

---

## Next Steps

1. ✅ DNS configured and propagated
2. ✅ Nginx updated with subdomain
3. ✅ SSL certificate installed
4. ✅ HTTPS working
5. ✅ WebXR tested and working

**Your subdomain is now live at:** `https://preview.anyma.com` 🎉

**Current server:** http://157.230.118.34/  
**New subdomain:** https://preview.anyma.com

---

## IONOS-Specific Notes

### Common IONOS DNS Issues:

1. **Wrong Hostname Format:**
   - ❌ Wrong: `preview.anyma.com`
   - ✅ Correct: `preview`

2. **DNS Propagation:**
   - IONOS DNS changes can take 5-60 minutes
   - Sometimes up to 24 hours for full global propagation
   - Use `nslookup` from different locations to verify

3. **IONOS Interface Language:**
   - If interface is in German:
     - **DNS-Einstellungen** = DNS Settings
     - **A-Eintrag** = A Record
     - **Name** = Hostname
     - **Wert** = Value/IP Address

4. **IONOS DNS Management:**
   - Some IONOS plans may have DNS management in different locations
   - Look for: **"Domains"** → **"DNS"** or **"DNS-Einstellungen"**
   - If you can't find DNS settings, contact IONOS support

---

## Additional Resources

- [IONOS DNS Help](https://www.ionos.com/help/domains/domains-and-ssl/dns-settings/)
- [Digital Ocean DNS Documentation](https://docs.digitalocean.com/products/networking/dns/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [WebXR Browser Support](https://immersiveweb.dev/)

---

## Need Help?

If you encounter issues:
1. Check nginx error logs: `sudo tail -f /var/log/nginx/stagepreview-coa-error.log`
2. Check PM2 logs: `pm2 logs stagepreview-coa`
3. Verify all services are running: `sudo systemctl status nginx` and `pm2 status`

