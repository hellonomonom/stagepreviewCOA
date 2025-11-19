// vite.config.js
import { defineConfig } from "file:///C:/Users/tobia/Dropbox/_Projects/Anyma/Coachella26/StagePreview/stagepreviewCOA/node_modules/vite/dist/node/index.js";
import path from "path";
import os from "os";
import fs from "fs";
var vite_config_default = defineConfig({
  server: {
    port: 3e3,
    open: true,
    // Middleware to serve the default video file
    middlewareMode: false,
    fs: {
      // Allow serving files from outside the project root
      allow: [".."]
    }
  },
  // Use cache directory outside Dropbox to avoid file locking issues
  cacheDir: path.join(os.tmpdir(), "vite-cache-stagepreview-coa"),
  // Custom plugin to serve the video file
  plugins: [
    {
      name: "serve-default-video",
      configureServer(server) {
        server.middlewares.use("/default-video.mp4", (req, res, next) => {
          const videoPath = "C:\\Users\\tobia\\Downloads\\HealthCareShowCase.mp4";
          if (fs.existsSync(videoPath)) {
            const stat = fs.statSync(videoPath);
            const fileSize = stat.size;
            const range = req.headers.range;
            if (range) {
              const parts = range.replace(/bytes=/, "").split("-");
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
              const chunksize = end - start + 1;
              const file = fs.createReadStream(videoPath, { start, end });
              const head = {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunksize,
                "Content-Type": "video/mp4"
              };
              res.writeHead(206, head);
              file.pipe(res);
            } else {
              const head = {
                "Content-Length": fileSize,
                "Content-Type": "video/mp4"
              };
              res.writeHead(200, head);
              fs.createReadStream(videoPath).pipe(res);
            }
          } else {
            res.writeHead(404);
            res.end("Video file not found");
          }
        });
      }
    }
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx0b2JpYVxcXFxEcm9wYm94XFxcXF9Qcm9qZWN0c1xcXFxBbnltYVxcXFxDb2FjaGVsbGEyNlxcXFxTdGFnZVByZXZpZXdcXFxcc3RhZ2VwcmV2aWV3Q09BXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx0b2JpYVxcXFxEcm9wYm94XFxcXF9Qcm9qZWN0c1xcXFxBbnltYVxcXFxDb2FjaGVsbGEyNlxcXFxTdGFnZVByZXZpZXdcXFxcc3RhZ2VwcmV2aWV3Q09BXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy90b2JpYS9Ecm9wYm94L19Qcm9qZWN0cy9BbnltYS9Db2FjaGVsbGEyNi9TdGFnZVByZXZpZXcvc3RhZ2VwcmV2aWV3Q09BL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBvcyBmcm9tICdvcyc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiAzMDAwLFxuICAgIG9wZW46IHRydWUsXG4gICAgLy8gTWlkZGxld2FyZSB0byBzZXJ2ZSB0aGUgZGVmYXVsdCB2aWRlbyBmaWxlXG4gICAgbWlkZGxld2FyZU1vZGU6IGZhbHNlLFxuICAgIGZzOiB7XG4gICAgICAvLyBBbGxvdyBzZXJ2aW5nIGZpbGVzIGZyb20gb3V0c2lkZSB0aGUgcHJvamVjdCByb290XG4gICAgICBhbGxvdzogWycuLiddXG4gICAgfVxuICB9LFxuICAvLyBVc2UgY2FjaGUgZGlyZWN0b3J5IG91dHNpZGUgRHJvcGJveCB0byBhdm9pZCBmaWxlIGxvY2tpbmcgaXNzdWVzXG4gIGNhY2hlRGlyOiBwYXRoLmpvaW4ob3MudG1wZGlyKCksICd2aXRlLWNhY2hlLXN0YWdlcHJldmlldy1jb2EnKSxcbiAgLy8gQ3VzdG9tIHBsdWdpbiB0byBzZXJ2ZSB0aGUgdmlkZW8gZmlsZVxuICBwbHVnaW5zOiBbXG4gICAge1xuICAgICAgbmFtZTogJ3NlcnZlLWRlZmF1bHQtdmlkZW8nLFxuICAgICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKCcvZGVmYXVsdC12aWRlby5tcDQnLCAocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAgICAgICBjb25zdCB2aWRlb1BhdGggPSAnQzpcXFxcVXNlcnNcXFxcdG9iaWFcXFxcRG93bmxvYWRzXFxcXEhlYWx0aENhcmVTaG93Q2FzZS5tcDQnO1xuICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHZpZGVvUGF0aCkpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyh2aWRlb1BhdGgpO1xuICAgICAgICAgICAgY29uc3QgZmlsZVNpemUgPSBzdGF0LnNpemU7XG4gICAgICAgICAgICBjb25zdCByYW5nZSA9IHJlcS5oZWFkZXJzLnJhbmdlO1xuXG4gICAgICAgICAgICBpZiAocmFuZ2UpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGFydHMgPSByYW5nZS5yZXBsYWNlKC9ieXRlcz0vLCBcIlwiKS5zcGxpdChcIi1cIik7XG4gICAgICAgICAgICAgIGNvbnN0IHN0YXJ0ID0gcGFyc2VJbnQocGFydHNbMF0sIDEwKTtcbiAgICAgICAgICAgICAgY29uc3QgZW5kID0gcGFydHNbMV0gPyBwYXJzZUludChwYXJ0c1sxXSwgMTApIDogZmlsZVNpemUgLSAxO1xuICAgICAgICAgICAgICBjb25zdCBjaHVua3NpemUgPSAoZW5kIC0gc3RhcnQpICsgMTtcbiAgICAgICAgICAgICAgY29uc3QgZmlsZSA9IGZzLmNyZWF0ZVJlYWRTdHJlYW0odmlkZW9QYXRoLCB7IHN0YXJ0LCBlbmQgfSk7XG4gICAgICAgICAgICAgIGNvbnN0IGhlYWQgPSB7XG4gICAgICAgICAgICAgICAgJ0NvbnRlbnQtUmFuZ2UnOiBgYnl0ZXMgJHtzdGFydH0tJHtlbmR9LyR7ZmlsZVNpemV9YCxcbiAgICAgICAgICAgICAgICAnQWNjZXB0LVJhbmdlcyc6ICdieXRlcycsXG4gICAgICAgICAgICAgICAgJ0NvbnRlbnQtTGVuZ3RoJzogY2h1bmtzaXplLFxuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAndmlkZW8vbXA0JyxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCgyMDYsIGhlYWQpO1xuICAgICAgICAgICAgICBmaWxlLnBpcGUocmVzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnN0IGhlYWQgPSB7XG4gICAgICAgICAgICAgICAgJ0NvbnRlbnQtTGVuZ3RoJzogZmlsZVNpemUsXG4gICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICd2aWRlby9tcDQnLFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwMCwgaGVhZCk7XG4gICAgICAgICAgICAgIGZzLmNyZWF0ZVJlYWRTdHJlYW0odmlkZW9QYXRoKS5waXBlKHJlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNDA0KTtcbiAgICAgICAgICAgIHJlcy5lbmQoJ1ZpZGVvIGZpbGUgbm90IGZvdW5kJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIF1cbn0pO1xuXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWliLFNBQVMsb0JBQW9CO0FBQzljLE9BQU8sVUFBVTtBQUNqQixPQUFPLFFBQVE7QUFDZixPQUFPLFFBQVE7QUFFZixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUE7QUFBQSxJQUVOLGdCQUFnQjtBQUFBLElBQ2hCLElBQUk7QUFBQTtBQUFBLE1BRUYsT0FBTyxDQUFDLElBQUk7QUFBQSxJQUNkO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFFQSxVQUFVLEtBQUssS0FBSyxHQUFHLE9BQU8sR0FBRyw2QkFBNkI7QUFBQTtBQUFBLEVBRTlELFNBQVM7QUFBQSxJQUNQO0FBQUEsTUFDRSxNQUFNO0FBQUEsTUFDTixnQkFBZ0IsUUFBUTtBQUN0QixlQUFPLFlBQVksSUFBSSxzQkFBc0IsQ0FBQyxLQUFLLEtBQUssU0FBUztBQUMvRCxnQkFBTSxZQUFZO0FBQ2xCLGNBQUksR0FBRyxXQUFXLFNBQVMsR0FBRztBQUM1QixrQkFBTSxPQUFPLEdBQUcsU0FBUyxTQUFTO0FBQ2xDLGtCQUFNLFdBQVcsS0FBSztBQUN0QixrQkFBTSxRQUFRLElBQUksUUFBUTtBQUUxQixnQkFBSSxPQUFPO0FBQ1Qsb0JBQU0sUUFBUSxNQUFNLFFBQVEsVUFBVSxFQUFFLEVBQUUsTUFBTSxHQUFHO0FBQ25ELG9CQUFNLFFBQVEsU0FBUyxNQUFNLENBQUMsR0FBRyxFQUFFO0FBQ25DLG9CQUFNLE1BQU0sTUFBTSxDQUFDLElBQUksU0FBUyxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksV0FBVztBQUMzRCxvQkFBTSxZQUFhLE1BQU0sUUFBUztBQUNsQyxvQkFBTSxPQUFPLEdBQUcsaUJBQWlCLFdBQVcsRUFBRSxPQUFPLElBQUksQ0FBQztBQUMxRCxvQkFBTSxPQUFPO0FBQUEsZ0JBQ1gsaUJBQWlCLFNBQVMsS0FBSyxJQUFJLEdBQUcsSUFBSSxRQUFRO0FBQUEsZ0JBQ2xELGlCQUFpQjtBQUFBLGdCQUNqQixrQkFBa0I7QUFBQSxnQkFDbEIsZ0JBQWdCO0FBQUEsY0FDbEI7QUFDQSxrQkFBSSxVQUFVLEtBQUssSUFBSTtBQUN2QixtQkFBSyxLQUFLLEdBQUc7QUFBQSxZQUNmLE9BQU87QUFDTCxvQkFBTSxPQUFPO0FBQUEsZ0JBQ1gsa0JBQWtCO0FBQUEsZ0JBQ2xCLGdCQUFnQjtBQUFBLGNBQ2xCO0FBQ0Esa0JBQUksVUFBVSxLQUFLLElBQUk7QUFDdkIsaUJBQUcsaUJBQWlCLFNBQVMsRUFBRSxLQUFLLEdBQUc7QUFBQSxZQUN6QztBQUFBLFVBQ0YsT0FBTztBQUNMLGdCQUFJLFVBQVUsR0FBRztBQUNqQixnQkFBSSxJQUFJLHNCQUFzQjtBQUFBLFVBQ2hDO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFDSDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
