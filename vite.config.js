import { defineConfig } from 'vite';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';

// Function to read package.json dynamically (ensures we always get the latest version)
function getPackageJson() {
  return JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
}

// Read package.json for version (will be re-read by plugin)
const packageJson = getPackageJson();

// Get git commit hash (if available)
function getGitCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch (e) {
    return 'unknown';
  }
}

// Get build timestamp
const buildTimestamp = new Date().toISOString();

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow access from network devices (Quest 3, etc.)
    open: true,
    // Allow ngrok and other tunnel hosts
    allowedHosts: [
      'localhost',
      '.ngrok.io',
      '.ngrok-free.app',
      '.ngrok-free.dev',
      '.ngrok.app',
      '.ngrok.dev'
    ],
    // Middleware to serve the default video file
    middlewareMode: false,
    fs: {
      // Allow serving files from outside the project root
      allow: ['..']
    },
    // Proxy API requests to backend server
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  },
  // Use cache directory outside Dropbox to avoid file locking issues
  cacheDir: path.join(os.tmpdir(), 'vite-cache-stagepreview-coa'),
  // Custom plugin to serve the video file
  plugins: [
    {
      name: 'serve-default-video',
      configureServer(server) {
        server.middlewares.use('/default-video.mp4', (req, res, next) => {
          const videoPath = path.join(__dirname, 'public', 'assets', 'videos', 'ANYMA_HumanNow.mp4');
          if (fs.existsSync(videoPath)) {
            const stat = fs.statSync(videoPath);
            const fileSize = stat.size;
            const range = req.headers.range;

            if (range) {
              const parts = range.replace(/bytes=/, "").split("-");
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
              const chunksize = (end - start) + 1;
              const file = fs.createReadStream(videoPath, { start, end });
              const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
              };
              res.writeHead(206, head);
              file.pipe(res);
            } else {
              const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
              };
              res.writeHead(200, head);
              fs.createReadStream(videoPath).pipe(res);
            }
          } else {
            res.writeHead(404);
            res.end('Video file not found');
          }
        });
      }
    },
    {
      name: 'inject-version-dynamic',
      configResolved(config) {
        // Read package.json fresh when config is resolved to ensure latest version
        // This ensures the version is always up-to-date when the dev server restarts
        const pkg = getPackageJson();
        if (config.define) {
          config.define.__APP_VERSION__ = JSON.stringify(pkg.version);
        }
      }
    }
  ],
  define: {
    // These will be updated by the plugin, but set initial values
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_TIME__: JSON.stringify(buildTimestamp),
    __GIT_COMMIT__: JSON.stringify(getGitCommitHash()),
  },
  // Expose environment variables to the client
  envPrefix: 'VITE_',
});

