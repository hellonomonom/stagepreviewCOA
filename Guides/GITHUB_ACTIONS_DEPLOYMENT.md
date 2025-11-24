# GitHub Actions Automated Deployment Guide

This guide will walk you through setting up GitHub Actions to automatically deploy your Stage Preview COA application whenever you push code to the main branch. No more manual deployments!

## Overview

GitHub Actions will:
1. Trigger automatically on every push to the `main` branch
2. SSH into your server
3. Pull the latest code from GitHub
4. Install dependencies
5. Build the frontend
6. Restart the application with PM2

---

## Prerequisites

- GitHub repository (already set up)
- Server with SSH access
- Node.js and PM2 installed on the server
- Basic understanding of SSH keys

---

## Step 1: Generate SSH Key Pair

**On your local machine**, generate a dedicated SSH key for GitHub Actions:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy
```

- Press Enter when asked for a passphrase (or set one if preferred)
- This creates:
  - `~/.ssh/github_actions_deploy` (private key - keep secret!)
  - `~/.ssh/github_actions_deploy.pub` (public key - safe to share)

**Display the keys:**

```bash
# Private key (you'll add this to GitHub Secrets)
cat ~/.ssh/github_actions_deploy

# Public key (you'll add this to your server)
cat ~/.ssh/github_actions_deploy.pub
```

**Important:** Copy both outputs - you'll need them in the next steps.

---

## Step 2: Add Public Key to Your Server

**Connect to your server via SSH:**

```bash
ssh user@your-server-ip
```

**Add the public key to authorized_keys:**

```bash
# Create .ssh directory if it doesn't exist
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add the public key (replace with your actual public key)
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI..." >> ~/.ssh/authorized_keys

# Set correct permissions
chmod 600 ~/.ssh/authorized_keys
```

**Test SSH access from your local machine:**

```bash
ssh -i ~/.ssh/github_actions_deploy user@your-server-ip
```

If it connects without asking for a password, you're good! Exit the SSH session.

---

## Step 3: Configure GitHub Secrets

**On GitHub:**

1. Go to your repository: `https://github.com/hellonomonom/stagepreviewCOA`

2. Click **Settings** → **Secrets and variables** → **Actions**

3. Click **New repository secret** and add these secrets:

### Secret 1: SERVER_HOST

- **Name:** `SERVER_HOST`
- **Value:** Your server IP address or domain
  - Example: `157.230.118.34`
  - Or: `your-domain.com`

### Secret 2: SERVER_USER

- **Name:** `SERVER_USER`
- **Value:** Your SSH username
  - Example: `root` or `deploy`

### Secret 3: SSH_PRIVATE_KEY

- **Name:** `SSH_PRIVATE_KEY`
- **Value:** The entire private key content from Step 1
  - Copy everything including:
    - `-----BEGIN OPENSSH PRIVATE KEY-----`
    - All the key content in between
    - `-----END OPENSSH PRIVATE KEY-----`
  - Make sure there are no extra spaces or line breaks

### Secret 4: SSH_PORT (Optional)

- **Name:** `SSH_PORT`
- **Value:** `22` (or your custom SSH port if changed)

---

## Step 4: Create GitHub Actions Workflow

**On your local machine:**

1. **Create the workflow directory:**

```bash
mkdir -p .github/workflows
```

2. **Create the workflow file:**

Create `.github/workflows/deploy.yml` with this content:

```yaml
name: Deploy to Server

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: ${{ secrets.SSH_PORT || 22 }}
          script: |
            cd /var/www/stagepreview-coa
            git pull origin main
            npm install --production=false
            npm run build
            pm2 restart stagepreview-coa || pm2 start ecosystem.config.cjs
            pm2 save
```

**Alternative: Using your existing deploy.sh script**

If you prefer to use your existing `deploy.sh` script:

```yaml
name: Deploy to Server

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: ${{ secrets.SSH_PORT || 22 }}
          script: |
            cd /var/www/stagepreview-coa
            bash deploy.sh
```

---

## Step 5: Commit and Push

**On your local machine:**

```bash
# Add the workflow file
git add .github/workflows/deploy.yml

# Commit
git commit -m "Add GitHub Actions automated deployment"

# Push to trigger the first deployment
git push origin main
```

---

## Step 6: Monitor Deployment

**On GitHub:**

1. Go to your repository
2. Click the **Actions** tab
3. You should see "Deploy to Server" workflow running
4. Click on it to see real-time deployment progress
5. Green checkmark = success, red X = failure

**On your server:**

Check if deployment completed:

```bash
# Check PM2 status
pm2 status

# View recent logs
pm2 logs stagepreview-coa --lines 50

# Verify latest code
cd /var/www/stagepreview-coa
git log -1
```

---

## How It Works

1. **You push code** to the `main` branch
2. **GitHub Actions triggers** automatically
3. **Workflow runs** on GitHub's servers
4. **SSH connection** is established to your server
5. **Deployment commands execute:**
   - Pull latest code
   - Install dependencies
   - Build frontend
   - Restart PM2
6. **Website is updated** with new code

---

## Troubleshooting

### Deployment Fails: "Permission denied (publickey)"

**Problem:** SSH key authentication failed

**Solutions:**
1. Verify public key is in `~/.ssh/authorized_keys` on server:
   ```bash
   cat ~/.ssh/authorized_keys
   ```

2. Check file permissions on server:
   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/authorized_keys
   ```

3. Verify private key in GitHub Secrets is complete (include BEGIN/END lines)

4. Test SSH manually:
   ```bash
   ssh -i ~/.ssh/github_actions_deploy user@your-server-ip
   ```

### Deployment Fails: "git pull failed"

**Problem:** Git authentication or network issue

**Solutions:**
1. Ensure server has access to GitHub (not a private repo issue)
2. Check git remote URL:
   ```bash
   cd /var/www/stagepreview-coa
   git remote -v
   ```

3. If using HTTPS, ensure credentials are cached or use SSH URL

### Deployment Fails: "npm: command not found"

**Problem:** Node.js/npm not in PATH

**Solutions:**
1. Use full path to npm in workflow:
   ```yaml
   script: |
     /usr/bin/npm install --production=false
     # or
     ~/.nvm/versions/node/v20.x.x/bin/npm install --production=false
   ```

2. Or source Node.js in script:
   ```yaml
   script: |
     source ~/.nvm/nvm.sh
     npm install --production=false
   ```

### Deployment Fails: "pm2: command not found"

**Problem:** PM2 not in PATH

**Solutions:**
1. Use full path:
   ```yaml
   /usr/bin/pm2 restart stagepreview-coa
   # or
   ~/.npm-global/bin/pm2 restart stagepreview-coa
   ```

2. Or install PM2 globally on server:
   ```bash
   npm install -g pm2
   ```

### Build Fails

**Problem:** Frontend build errors

**Solutions:**
1. Check build logs in GitHub Actions
2. Test build locally first: `npm run build`
3. Ensure all dependencies are in `package.json`
4. Check Node.js version matches (server vs GitHub Actions)

### Deployment Succeeds But Website Not Updated

**Problem:** PM2 didn't restart or cached content

**Solutions:**
1. Check PM2 actually restarted:
   ```bash
   pm2 list
   pm2 logs stagepreview-coa
   ```

2. Clear browser cache or hard refresh (Ctrl+Shift+R)

3. Verify dist folder was updated:
   ```bash
   ls -la /var/www/stagepreview-coa/dist
   ```

---

## Advanced Configuration

### Deploy Only on Specific Paths

Deploy only when certain files change:

```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'src/**'
      - 'public/**'
      - 'package.json'
      - '.github/workflows/deploy.yml'
```

### Add Deployment Notifications

Send notifications on success/failure:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server via SSH
        # ... deployment steps ...
      
      - name: Notify on success
        if: success()
        run: |
          echo "Deployment successful!"
          # Add Slack/Discord/Email notification here
      
      - name: Notify on failure
        if: failure()
        run: |
          echo "Deployment failed!"
          # Add error notification here
```

### Deploy to Multiple Environments

Deploy to staging and production:

```yaml
on:
  push:
    branches:
      - main      # Production
      - staging   # Staging

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Determine environment
        id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "env=production" >> $GITHUB_OUTPUT
            echo "path=/var/www/stagepreview-coa" >> $GITHUB_OUTPUT
          else
            echo "env=staging" >> $GITHUB_OUTPUT
            echo "path=/var/www/stagepreview-coa-staging" >> $GITHUB_OUTPUT
          fi
      
      - name: Deploy
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd ${{ steps.env.outputs.path }}
            git pull origin ${{ github.ref_name }}
            npm install --production=false
            npm run build
            pm2 restart stagepreview-coa-${{ steps.env.outputs.env }}
```

### Add Pre-deployment Checks

Run tests before deploying:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm test  # If you have tests
  
  deploy:
    needs: test  # Only deploy if tests pass
    runs-on: ubuntu-latest
    # ... deployment steps ...
```

---

## Security Best Practices

1. **Never commit secrets** - Always use GitHub Secrets
2. **Use dedicated SSH key** - Don't reuse your personal SSH key
3. **Rotate keys regularly** - Generate new keys periodically
4. **Limit SSH access** - Use firewall rules to restrict access
5. **Monitor deployments** - Review GitHub Actions logs regularly
6. **Use HTTPS** - Always use HTTPS for webhooks and connections
7. **Restrict branch** - Only deploy from trusted branches (main)

---

## Quick Reference

### Check Deployment Status
```bash
# On GitHub
Actions tab → Latest workflow run

# On server
pm2 status
pm2 logs stagepreview-coa
```

### Manual Deployment (if needed)
```bash
cd /var/www/stagepreview-coa
bash deploy.sh
```

### View GitHub Actions Logs
1. Go to repository → Actions tab
2. Click on workflow run
3. Click on "Deploy to server via SSH" step
4. View real-time output

### Disable Auto-deployment
Temporarily disable by commenting out the workflow trigger:

```yaml
# on:
#   push:
#     branches:
#       - main
```

Or delete the workflow file.

---

## Summary

✅ **Setup Complete When:**
- SSH key pair generated
- Public key added to server
- GitHub Secrets configured
- Workflow file created and committed
- First deployment succeeds in Actions tab

🚀 **From Now On:**
- Just push to `main` branch
- Deployment happens automatically
- Check Actions tab for status
- Website updates within minutes

---

## Need Help?

- Check GitHub Actions logs for error messages
- Verify all secrets are set correctly
- Test SSH connection manually
- Review server logs: `pm2 logs stagepreview-coa`
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`

Happy deploying! 🎉

