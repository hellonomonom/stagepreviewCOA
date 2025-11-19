import { defineConfig } from 'vite';
import path from 'path';
import os from 'os';
import fs from 'fs';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    // Middleware to serve the default video file
    middlewareMode: false,
    fs: {
      // Allow serving files from outside the project root
      allow: ['..']
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
          const videoPath = 'C:\\Users\\tobia\\Downloads\\HealthCareShowCase.mp4';
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
    }
  ]
});

