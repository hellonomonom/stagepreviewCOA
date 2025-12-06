# Quick Deploy Script

Simple automated script to connect to the DigitalOcean server, pull from git, and restart the app.

## Usage

### Windows (PowerShell):
```powershell
# Option 1: Using npm script
npm run quick-deploy

# Option 2: Direct PowerShell execution
powershell -ExecutionPolicy Bypass -File quick-deploy.ps1
```

### Linux/Mac/Git Bash:
```bash
# Option 1: Using npm script
npm run quick-deploy:bash

# Option 2: Direct execution
bash quick-deploy.sh
```

## What It Does

1. **Connects** to the DigitalOcean server via SSH
2. **Pulls** latest changes from git (tries `main` branch, then `master`)
3. **Restarts** the application using PM2
4. **Shows** PM2 status to confirm the app is running

## Requirements

- `deploy.config.json` file must exist with server configuration
- SSH key must be accessible at the path specified in config
- Server must be running and accessible

## Configuration

The script uses `deploy.config.json` which should contain:
```json
{
  "sshKey": "path/to/your/privatekey",
  "serverUser": "root",
  "serverHost": "157.230.118.34",
  "serverPath": "/var/www/stagepreview-coa"
}
```

## Troubleshooting

If the script fails:

1. **Check server connectivity:**
   ```bash
   ping 157.230.118.34
   ```

2. **Test SSH connection manually:**
   ```bash
   ssh -i "path/to/privatekey" root@157.230.118.34
   ```

3. **Check PM2 logs on server:**
   ```bash
   ssh -i "path/to/privatekey" root@157.230.118.34 "pm2 logs stagepreview-coa --lines 50"
   ```

4. **Verify git repository status:**
   ```bash
   ssh -i "path/to/privatekey" root@157.230.118.34 "cd /var/www/stagepreview-coa && git status"
   ```

## Difference from Full Deploy

- **Quick Deploy** (`quick-deploy.ps1`): Just pulls git and restarts PM2 (faster)
- **Full Deploy** (`deploy-remote.ps1`): Runs full deployment script including npm install and build

Use **Quick Deploy** when you just need to pull code changes and restart.
Use **Full Deploy** when you need to install dependencies or rebuild the app.





