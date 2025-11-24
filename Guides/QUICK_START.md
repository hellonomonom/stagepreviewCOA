# Quick Start: DigitalOcean Deployment

## TL;DR - Fast Deployment Steps

1. **Create Droplet** (Ubuntu 22.04, $12/month recommended)
2. **SSH into server**: `ssh root@YOUR_IP`
3. **Run setup commands**:
```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs ffmpeg nginx git
npm install -g pm2
```

4. **Clone/upload your code**:
```bash
mkdir -p /var/www && cd /var/www
git clone YOUR_REPO_URL stagepreview-coa
cd stagepreview-coa
```

5. **Deploy**:
```bash
npm install
npm run build
cp nginx.conf /etc/nginx/sites-available/stagepreview-coa
nano /etc/nginx/sites-available/stagepreview-coa  # Update domain/IP
ln -s /etc/nginx/sites-available/stagepreview-coa /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # Follow the command it outputs
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
```

6. **Test**: Open `http://YOUR_IP` in browser

## For Detailed Instructions

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete step-by-step guide.

## Common Commands

```bash
# View logs
pm2 logs stagepreview-coa

# Restart app
pm2 restart stagepreview-coa

# Deploy updates
cd /var/www/stagepreview-coa && npm run deploy
```

