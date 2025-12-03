# Remote Deployment Automation

This project includes automation scripts to easily deploy updates to your DigitalOcean server directly from Cursor.

## Quick Start

1. **Create your deployment configuration:**
   ```bash
   cp deploy.config.example.json deploy.config.json
   ```

2. **Edit `deploy.config.json`** with your SSH key path and server details:
   ```json
   {
     "sshKey": "C:\\Users\\tobia\\Dropbox\\_Projects\\Anyma\\Coachella26\\StagePreview\\Deployment\\privatekey",
     "serverUser": "root",
     "serverHost": "157.230.118.34",
     "serverPath": "/var/www/stagepreview-coa"
   }
   ```

3. **Deploy from Cursor terminal:**
   
   **Using PowerShell (Windows default):**
   ```bash
   npm run deploy:remote
   ```
   
   **Using Git Bash:**
   ```bash
   npm run deploy:remote:bash
   ```

## What It Does

The deployment script will:
1. ✅ Connect to your DigitalOcean server via SSH
2. ✅ Navigate to your project directory
3. ✅ Pull latest changes from git (`git pull origin main`)
4. ✅ Run the deployment script (`deploy.sh`) which:
   - Installs/updates dependencies (`npm install`)
   - Builds the frontend (`npm run build`)
   - Restarts the application with PM2

## Manual Execution

You can also run the scripts directly:

**PowerShell:**
```powershell
.\deploy-remote.ps1
```

**Bash (Git Bash):**
```bash
bash deploy-remote.sh
```

## Configuration

The `deploy.config.json` file contains:
- `sshKey`: Path to your SSH private key (OpenSSH format)
- `serverUser`: SSH username (usually `root`)
- `serverHost`: Server IP address or hostname
- `serverPath`: Project directory path on the server

**⚠️ Important:** The `deploy.config.json` file is gitignored and should never be committed to version control as it contains sensitive information.

## Troubleshooting

### SSH Key Issues
- Make sure your SSH key is in OpenSSH format (not .ppk)
- See `Guides/SSH_SETUP.md` for converting keys
- Verify the key path in `deploy.config.json` is correct

### Connection Issues
- Verify the server is running and accessible
- Check your firewall settings
- Test SSH connection manually first:
  ```bash
  ssh -i "path/to/key" root@157.230.118.34
  ```

### Deployment Failures
- Check that the server path exists: `/var/www/stagepreview-coa`
- Verify git repository is set up on the server
- Check PM2 status: `pm2 status`
- View logs: `pm2 logs stagepreview-coa`

## Files

- `deploy-remote.ps1` - PowerShell deployment script
- `deploy-remote.sh` - Bash deployment script  
- `deploy.config.example.json` - Configuration template
- `deploy.config.json` - Your actual config (gitignored, create from example)
- `deploy.sh` - Server-side deployment script (runs on the server)







