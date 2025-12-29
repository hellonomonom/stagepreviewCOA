# Password Protection Guide

This guide shows you how to add password protection to your deployed website using Nginx HTTP Basic Authentication. This is the recommended method as it's simple, secure, and doesn't require any code changes.

## Step 1: Install Apache2 Utils

On your server, install the `apache2-utils` package which contains the `htpasswd` tool:

```bash
sudo apt install -y apache2-utils
```

## Step 2: Create Password File

Create a password file and add your first user (replace 'admin' with your desired username):

```bash
sudo htpasswd -c /etc/nginx/.htpasswd admin
```

You'll be prompted to enter and confirm a password.

**To add more users later** (without the `-c` flag):
```bash
sudo htpasswd /etc/nginx/.htpasswd anotheruser
```

**To remove a user:**
```bash
sudo htpasswd -D /etc/nginx/.htpasswd username
```

**To change a user's password:**
```bash
sudo htpasswd /etc/nginx/.htpasswd username
```

**To list all users:**
```bash
cat /etc/nginx/.htpasswd
```

## Step 3: Update Nginx Configuration

Edit your Nginx config file:

```bash
sudo nano /etc/nginx/sites-available/stagepreview-coa
```

Add the `auth_basic` directives inside the `server` block. Here's the updated configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Password protection
    auth_basic "Restricted Access";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    client_max_body_size 100M;
    
    # Logging
    access_log /var/log/nginx/stagepreview-coa-access.log;
    error_log /var/log/nginx/stagepreview-coa-error.log;

    # Serve static files directly (optional optimization)
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

    # Health check - no password required (optional)
    location /health {
        proxy_pass http://nodejs_backend;
        access_log off;
        # No auth_basic here - health checks should be public
    }

    # Frontend SPA - requires password
    location / {
        proxy_pass http://nodejs_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Note:** The `auth_basic` directives at the server level will apply to all locations unless overridden. The `/health` endpoint above is excluded from authentication, which is recommended for monitoring purposes.

## Step 4: Test and Reload Nginx

Test your Nginx configuration:

```bash
sudo nginx -t
```

If the test passes, reload Nginx:

```bash
sudo systemctl reload nginx
```

## Step 5: Test Access

Visit your website in a browser - you should now see a login prompt asking for username and password. Enter the credentials you created in Step 2.

---

## Security Best Practices

1. **Use strong passwords** - At least 12 characters, mix of letters, numbers, and symbols
2. **Use HTTPS** - Basic auth sends passwords in base64 (not encrypted). Always use HTTPS in production to encrypt the connection
3. **Limit access** - Only give credentials to trusted users
4. **Regular updates** - Keep Nginx and your server updated
5. **Monitor access** - Check Nginx access logs regularly: `sudo tail -f /var/log/nginx/stagepreview-coa-access.log`
6. **Secure the password file** - Ensure proper permissions:
   ```bash
   sudo chmod 644 /etc/nginx/.htpasswd
   sudo chown root:www-data /etc/nginx/.htpasswd
   ```

---

## Troubleshooting

### "auth_basic_user_file" not found error
- Check the file exists: `ls -la /etc/nginx/.htpasswd`
- Verify file permissions: `sudo chmod 644 /etc/nginx/.htpasswd`
- Check file ownership: `sudo chown root:www-data /etc/nginx/.htpasswd`

### Can't access website after setup
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Verify htpasswd file format: `cat /etc/nginx/.htpasswd` (should show username:hashed_password)
- Test Nginx config: `sudo nginx -t`
- Verify Nginx is running: `sudo systemctl status nginx`

### Password prompt not appearing
- Clear browser cache and cookies
- Try in an incognito/private window
- Check that `auth_basic` directives are inside the correct `server` block
- Verify the location blocks inherit from the server-level auth (or add auth to specific locations)

### Wrong password error
- Verify username spelling (case-sensitive)
- Check password was set correctly: `sudo htpasswd -v /etc/nginx/.htpasswd username`
- Try resetting the password: `sudo htpasswd /etc/nginx/.htpasswd username`

---

## Example: Complete Setup

Here's a complete example of setting up password protection:

```bash
# 1. Install tools
sudo apt install -y apache2-utils

# 2. Create password file with user 'admin'
sudo htpasswd -c /etc/nginx/.htpasswd admin
# Enter password when prompted

# 3. Edit Nginx config
sudo nano /etc/nginx/sites-available/stagepreview-coa
# Add the auth_basic lines as shown above

# 4. Test and reload
sudo nginx -t
sudo systemctl reload nginx

# 5. Test in browser
# Visit your site - you should see a login prompt
```

---

## Additional Notes

- The password file is stored at `/etc/nginx/.htpasswd` (the leading dot makes it hidden)
- Passwords are hashed using bcrypt or MD5 (htpasswd uses MD5 by default)
- Multiple users can be added to the same file
- The realm message ("Restricted Access") appears in the browser login dialog
- Basic auth works with all modern browsers automatically
