import express from 'express';
import cors from 'cors';
import mdns from 'multicast-dns';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set FFmpeg path if available and derive binary path for spawn/exec
let ffmpegBinary = 'ffmpeg';
try {
  if (ffmpegInstaller && ffmpegInstaller.path) {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    ffmpegBinary = ffmpegInstaller.path;
    console.log(`Using bundled FFmpeg: ${ffmpegBinary}`);
  } else {
    console.log('FFmpeg installer path not found, will try system FFmpeg');
  }
} catch (error) {
  console.log('FFmpeg installer not available, will try system FFmpeg:', error.message);
}

const execAsync = promisify(exec);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

// WebSocket server for NDI streaming
const wss = new WebSocketServer({ server, path: '/ndi/ws' });

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve static assets from dist folder in production (must be before SPA fallback)
if (NODE_ENV === 'production') {
  // Serve assets with proper MIME types and range support for videos
  app.use('/assets', express.static(path.join(__dirname, 'dist', 'assets'), {
    maxAge: '1y', // Cache for 1 year
    etag: true,
    setHeaders: (res, filePath) => {
      // Ensure proper MIME types for video files
      if (filePath.endsWith('.mp4')) {
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
      }
    }
  }));
}

// NDI Discovery endpoint
app.get('/ndi/discover', async (req, res) => {
  try {
    console.log('NDI discovery requested');
    
    // Discover NDI streams using multiple methods
    const streams = await discoverNDIStreams();
    
    console.log(`Returning ${streams.length} NDI stream(s):`, streams);
    res.json(streams);
  } catch (error) {
    console.error('Error discovering NDI streams:', error);
    res.status(500).json({ error: 'Failed to discover NDI streams', message: error.message });
  }
});

// Store active NDI stream processes
const activeStreams = new Map();

// Function to stream from OBS Virtual Camera (works with standard FFmpeg)
function streamFromOBSCamera(cameraName, res, req) {
  console.log(`Streaming from OBS Virtual Camera: ${cameraName}`);
  
  // Set up MPEG-TS streaming headers
  res.setHeader('Content-Type', 'video/mp2t');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Transfer-Encoding', 'chunked');
  
  // Use FFmpeg to capture from OBS Virtual Camera (Windows DirectShow)
  const ffmpegProcess = ffmpeg()
    .input(`video=${cameraName}`)
    .inputOptions([
      '-f', 'dshow',           // DirectShow input (Windows)
      '-framerate', '30'       // Frame rate
    ])
    .outputOptions([
      '-c:v', 'libx264',       // H.264 video codec
      '-preset', 'ultrafast',  // Fast encoding for low latency
      '-tune', 'zerolatency',  // Zero latency tuning
      '-c:a', 'aac',           // AAC audio codec
      '-f', 'mpegts',          // MPEG-TS output format
      '-flags', 'low_delay',   // Low delay flag
      '-strict', 'experimental'
    ])
    .format('mpegts')
    .on('start', (commandLine) => {
      console.log('OBS Virtual Camera FFmpeg command:', commandLine);
    })
    .on('error', (err) => {
      console.error('OBS Virtual Camera FFmpeg error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to stream from OBS Virtual Camera',
          message: err.message,
          instructions: [
            '1. Make sure OBS Studio is running',
            '2. Add your NDI source to OBS',
            '3. Start OBS Virtual Camera (Tools > Start Virtual Camera)',
            '4. Verify the camera name matches: ' + cameraName
          ]
        });
      }
    })
    .on('end', () => {
      console.log('OBS Virtual Camera stream ended');
    });
  
  // Pipe FFmpeg output to response
  ffmpegProcess.pipe(res, { end: false });
  
  // Store the process
  activeStreams.set(`obs-${cameraName}`, ffmpegProcess);
  
  // Clean up on client disconnect
  req.on('close', () => {
    console.log(`Client disconnected from OBS Virtual Camera: ${cameraName}`);
    const process = activeStreams.get(`obs-${cameraName}`);
    if (process) {
      process.kill('SIGTERM');
      activeStreams.delete(`obs-${cameraName}`);
    }
  });
}

// NDI Stream endpoint - serves NDI stream via OBS Virtual Camera or direct capture
// Alternative approach: Use OBS Virtual Camera as bridge (works with standard FFmpeg)
app.get('/ndi/stream/:streamName', async (req, res) => {
  try {
    const streamName = decodeURIComponent(req.params.streamName);
    console.log(`NDI stream requested: ${streamName}`);
    
    // Try multiple approaches:
    // 1. Direct NDI via FFmpeg (if available)
    // 2. OBS Virtual Camera (if OBS is running with NDI input)
    // 3. WebSocket frame streaming
    
    // First, try OBS Virtual Camera approach (most reliable without NDI SDK)
    // OBS Virtual Camera appears as a video device that standard FFmpeg can capture
    const obsVirtualCameraDevices = [
      'OBS Virtual Camera',
      'OBS-Camera',
      'obs-virtual-camera'
    ];
    
    let useOBSVirtualCamera = false;
    let virtualCameraName = null;
    
    // Check if OBS Virtual Camera is available
    try {
      let ffmpegOutput = '';
      try {
        const result = await execAsync(`"${ffmpegBinary}" -list_devices true -f dshow -i dummy`, { timeout: 3000 });
        ffmpegOutput = (result.stdout || '') + (result.stderr || '');
      } catch (error) {
        ffmpegOutput = (error.stdout || '') + (error.stderr || '');
      }
      for (const deviceName of obsVirtualCameraDevices) {
        if (ffmpegOutput.includes(deviceName)) {
          virtualCameraName = deviceName;
          useOBSVirtualCamera = true;
          console.log(`Found OBS Virtual Camera: ${deviceName}`);
          break;
        }
      }
    } catch (error) {
      console.log('Could not check for OBS Virtual Camera, trying direct NDI...', error.message);
    }
    
    // If OBS Virtual Camera is available, use it
    if (useOBSVirtualCamera && virtualCameraName) {
      console.log(`Using OBS Virtual Camera: ${virtualCameraName}`);
      return streamFromOBSCamera(virtualCameraName, res, req);
    }
    
    // Otherwise, try direct NDI (requires FFmpeg with NDI support)
    console.log('Attempting direct NDI connection...');
    
    // Set up MPEG-TS streaming headers
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Create FFmpeg command to convert NDI to MPEG-TS
    // FFmpeg with NDI support uses libndi_newtek format
    // Try different input methods for NDI
    
    // Method 1: Try with explicit format and input
    let ffmpegProcess;
    
    try {
      // First, try the standard NDI input format
      // In fluent-ffmpeg, use .input() for the source and .inputOptions() for format flags
      ffmpegProcess = ffmpeg()
        .input(streamName)        // NDI source name
        .inputOptions([
          '-f', 'libndi_newtek'   // NDI input format
        ])
        .outputOptions([
          '-c:v', 'libx264',       // H.264 video codec
          '-preset', 'ultrafast',  // Fast encoding for low latency
          '-tune', 'zerolatency',  // Zero latency tuning
          '-c:a', 'aac',           // AAC audio codec
          '-f', 'mpegts',          // MPEG-TS output format
          '-flags', 'low_delay',   // Low delay flag
          '-strict', 'experimental'
        ])
        .format('mpegts')
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err.message);
          console.error('Full error:', err);
          
          // Check for common NDI-related errors
          const errorMsg = err.message.toLowerCase();
          const isNDISupportError = errorMsg.includes('libndi_newtek') || 
                                   errorMsg.includes('unknown input format') ||
                                   errorMsg.includes('no input') ||
                                   errorMsg.includes('invalid data found');
          
          if (isNDISupportError) {
            console.log('NDI support issue detected, trying alternative method...');
            tryAlternativeNDIInput(streamName, res);
          } else if (!res.headersSent) {
            res.status(501).json({ 
              error: 'Direct NDI connection failed',
              message: err.message,
              streamName: streamName,
              solution: 'Use OBS Virtual Camera instead',
              instructions: [
                '1. Install OBS Studio',
                '2. Add NDI Source in OBS and select: "' + streamName + '"',
                '3. Start OBS Virtual Camera (Tools > Start Virtual Camera)',
                '4. Try again - the server will automatically use OBS Virtual Camera'
              ],
              note: 'FFmpeg does not have NDI support. OBS Virtual Camera works with standard FFmpeg.'
            });
          }
        })
        .on('end', () => {
          console.log('FFmpeg stream ended');
          activeStreams.delete(streamName);
        });
      
      // Pipe FFmpeg output to response
      ffmpegProcess.pipe(res, { end: false });
      
    } catch (error) {
      console.error('Error creating FFmpeg process:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Failed to create FFmpeg process',
          message: error.message
        });
      }
      return;
    }
    
    // Helper function - if direct NDI fails, provide clear instructions
    function tryAlternativeNDIInput(streamName, response) {
      console.log('Direct NDI failed, providing instructions for OBS Virtual Camera setup...');
      
      if (!response.headersSent) {
        response.status(501).json({
          error: 'NDI streaming requires OBS Virtual Camera or FFmpeg with NDI support',
          message: 'FFmpeg cannot connect to NDI source directly',
          streamName: streamName,
          solution: 'Use OBS Virtual Camera as a bridge',
          instructions: [
            '1. Install OBS Studio (https://obsproject.com/)',
            '2. In OBS: Sources > Add > NDI Source',
            '3. Select your NDI stream: "' + streamName + '"',
            '4. Tools > Start Virtual Camera',
            '5. Refresh and try again - the server will automatically detect OBS Virtual Camera'
          ],
          alternative: 'Or install FFmpeg compiled with NDI SDK support (see NDI_SETUP.md)'
        });
      }
    }
    
    // Store the process
    activeStreams.set(streamName, ffmpegProcess);
    
    // Clean up on client disconnect
    req.on('close', () => {
      console.log(`Client disconnected from stream: ${streamName}`);
      const process = activeStreams.get(streamName);
      if (process) {
        process.kill('SIGTERM');
        activeStreams.delete(streamName);
      }
    });
    
  } catch (error) {
    console.error(`Error serving NDI stream ${req.params.streamName}:`, error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to serve NDI stream', 
        message: error.message,
        streamName: req.params.streamName,
        note: 'Alternative: Use WebSocket endpoint at ws://localhost:8080/ndi/ws'
      });
    }
  }
});

// Store active WebSocket frame streams
const wsFrameStreams = new Map();

// WebSocket endpoint for frame-based NDI streaming (Canvas Texture approach)
wss.on('connection', (ws, req) => {
  console.log('WebSocket connection established for frame streaming');
  let currentStreamName = null;
  let ffmpegProcess = null;
  let frameInterval = null;
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'connect' && data.streamName) {
        currentStreamName = data.streamName;
        console.log(`WebSocket: Connecting to stream: ${currentStreamName}`);
        
        // Clean up any existing process
        if (ffmpegProcess) {
          ffmpegProcess.kill('SIGTERM');
          ffmpegProcess = null;
        }
        
        // Try OBS Virtual Camera first
        let useOBSVirtualCamera = false;
        let virtualCameraName = null;
        
        try {
          let ffmpegOutput = '';
          try {
            const result = await execAsync(`"${ffmpegBinary}" -list_devices true -f dshow -i dummy`, { timeout: 3000 });
            ffmpegOutput = (result.stdout || '') + (result.stderr || '');
          } catch (error) {
            ffmpegOutput = (error.stdout || '') + (error.stderr || '');
          }
          const obsVirtualCameraDevices = ['OBS Virtual Camera', 'OBS-Camera', 'obs-virtual-camera'];
          for (const deviceName of obsVirtualCameraDevices) {
            if (ffmpegOutput.includes(deviceName)) {
              virtualCameraName = deviceName;
              useOBSVirtualCamera = true;
              console.log(`WebSocket: Found OBS Virtual Camera: ${deviceName}`);
              break;
            }
          }
        } catch (error) {
          console.log('WebSocket: Could not check for OBS Virtual Camera', error.message);
        }
        
        // Start FFmpeg to capture frames and convert to JPEG sequence
        const ffmpegArgs = [];
        
        if (useOBSVirtualCamera && virtualCameraName) {
          // Capture from OBS Virtual Camera
          ffmpegArgs.push(
            '-f', 'dshow',
            '-i', `video=${virtualCameraName}`,
            '-framerate', '30'
          );
        } else {
          // Try direct NDI (will fail if no support, but we'll handle it)
          ffmpegArgs.push(
            '-f', 'libndi_newtek',
            '-i', currentStreamName
          );
        }
        
        // Output as JPEG frames to stdout
        ffmpegArgs.push(
          '-vf', 'fps=30',  // 30 frames per second
          '-f', 'image2pipe',  // Output as image sequence
          '-vcodec', 'mjpeg',  // MJPEG codec
          '-q:v', '3',  // Quality (1-31, lower is better)
          '-'  // Output to stdout
        );
        
        // Spawn FFmpeg process
        ffmpegProcess = spawn(ffmpegBinary, ffmpegArgs);
        
        let frameBuffer = Buffer.alloc(0);
        
        // Collect JPEG frames from stdout
        ffmpegProcess.stdout.on('data', (chunk) => {
          frameBuffer = Buffer.concat([frameBuffer, chunk]);
          
          // Try to find JPEG boundaries (FF D8 = JPEG start, FF D9 = JPEG end)
          let startIndex = frameBuffer.indexOf(Buffer.from([0xFF, 0xD8]));
          
          while (startIndex !== -1) {
            // Find the end of this JPEG
            let endIndex = frameBuffer.indexOf(Buffer.from([0xFF, 0xD9]), startIndex);
            
            if (endIndex !== -1) {
              // Extract complete JPEG
              const jpegFrame = frameBuffer.slice(startIndex, endIndex + 2);
              
              // Convert to base64 and send via WebSocket
              if (ws.readyState === ws.OPEN) {
                const base64Frame = jpegFrame.toString('base64');
                ws.send(JSON.stringify({
                  type: 'frame',
                  data: base64Frame,
                  format: 'jpeg'
                }));
              }
              
              // Remove processed frame from buffer
              frameBuffer = frameBuffer.slice(endIndex + 2);
              startIndex = frameBuffer.indexOf(Buffer.from([0xFF, 0xD8]));
            } else {
              // Incomplete frame, wait for more data
              break;
            }
          }
        });
        
        ffmpegProcess.stderr.on('data', (data) => {
          // FFmpeg outputs to stderr, but we can ignore most of it
          const output = data.toString();
          if (output.includes('error') || output.includes('Error')) {
            console.error('FFmpeg error:', output);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'FFmpeg error: ' + output
              }));
            }
          }
        });
        
        ffmpegProcess.on('error', (error) => {
          console.error('FFmpeg process error:', error);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to start FFmpeg: ' + error.message
            }));
          }
        });
        
        ffmpegProcess.on('close', (code) => {
          console.log(`FFmpeg process exited with code ${code}`);
          ffmpegProcess = null;
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
              type: 'closed',
              message: 'Stream ended'
            }));
          }
        });
        
        // Send connection confirmation
        ws.send(JSON.stringify({
          type: 'connected',
          streamName: currentStreamName,
          method: useOBSVirtualCamera ? 'OBS Virtual Camera' : 'Direct NDI'
        }));
        
      } else if (data.type === 'disconnect') {
        console.log('WebSocket: Disconnecting from stream');
        if (ffmpegProcess) {
          ffmpegProcess.kill('SIGTERM');
          ffmpegProcess = null;
        }
        currentStreamName = null;
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: error.message 
        }));
      }
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    if (ffmpegProcess) {
      ffmpegProcess.kill('SIGTERM');
      ffmpegProcess = null;
    }
    if (currentStreamName) {
      wsFrameStreams.delete(currentStreamName);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Function to discover NDI streams using mDNS
async function discoverNDIStreams() {
  const discoveredStreams = new Map(); // Use Map to avoid duplicates
  
  // Method 1: mDNS discovery for NDI sources
  try {
    const streams = await discoverNDIViaMDNS();
    streams.forEach(stream => {
      discoveredStreams.set(stream, stream);
    });
    console.log(`mDNS discovery found ${streams.length} stream(s)`);
  } catch (error) {
    console.error('mDNS discovery error:', error.message);
  }
  
  // Method 2: Try using NDI Tools command line (if available on Windows)
  try {
    const streams = await discoverNDIViaTools();
    streams.forEach(stream => {
      discoveredStreams.set(stream, stream);
    });
    console.log(`NDI Tools discovery found ${streams.length} stream(s)`);
  } catch (error) {
    console.error('NDI Tools discovery error:', error.message);
  }
  
  // Convert Map to array
  const uniqueStreams = Array.from(discoveredStreams.keys());
  return uniqueStreams;
}

// Method 1: Discover NDI sources via mDNS
function discoverNDIViaMDNS() {
  return new Promise((resolve, reject) => {
    const mdnsClient = mdns();
    const streams = [];
    const timeout = 5000; // 5 second timeout for better discovery
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      mdnsClient.destroy();
      resolve(streams);
    }, timeout);
    
    // Query for NDI services
    // NDI uses service type "_ndi._tcp" for discovery
    mdnsClient.query({
      questions: [{
        name: '_ndi._tcp.local',
        type: 'PTR'
      }]
    });
    
    // Also listen for any incoming mDNS packets that might contain NDI info
    mdnsClient.on('response', (response) => {
      try {
        // Parse PTR records for NDI sources
        if (response.answers) {
          response.answers.forEach(answer => {
            if (answer.type === 'PTR') {
              let streamName = null;
              
              // Check if it's an NDI service
              if (answer.name === '_ndi._tcp.local' || answer.name.includes('_ndi._tcp')) {
                // Extract stream name from PTR data
                const data = answer.data || '';
                // NDI PTR records typically look like: "StreamName._ndi._tcp.local"
                streamName = data.replace(/\._ndi\._tcp\.local\.?$/, '').replace(/\.local\.?$/, '');
                
                // Filter out false positives like "_ndi" or empty names
                if (streamName && streamName.length > 1 && streamName !== '_ndi' && !streams.includes(streamName)) {
                  streams.push(streamName);
                  console.log(`Found NDI stream via mDNS PTR: ${streamName}`);
                }
              }
            }
          });
        }
        
        // Check additional records for more NDI information
        if (response.additionals) {
          response.additionals.forEach(record => {
            if (record.type === 'SRV' || record.type === 'TXT') {
              const name = record.name || '';
              // Look for NDI service records
              if (name.includes('_ndi._tcp')) {
                // Extract stream name (first part before ._ndi._tcp)
                const parts = name.split('.');
                const streamName = parts[0];
                
                // Filter out false positives
                if (streamName && streamName.length > 1 && streamName !== '_ndi' && !streams.includes(streamName)) {
                  streams.push(streamName);
                  console.log(`Found NDI stream via mDNS SRV/TXT: ${streamName}`);
                }
              }
            }
          });
        }
        
        // Also check authority records
        if (response.authorities) {
          response.authorities.forEach(record => {
            if (record.type === 'PTR' && record.name.includes('_ndi._tcp')) {
              const data = record.data || '';
              const streamName = data.replace(/\._ndi\._tcp\.local\.?$/, '').replace(/\.local\.?$/, '');
              // Filter out false positives
              if (streamName && streamName.length > 1 && streamName !== '_ndi' && !streams.includes(streamName)) {
                streams.push(streamName);
                console.log(`Found NDI stream via mDNS authority: ${streamName}`);
              }
            }
          });
        }
      } catch (error) {
        console.error('Error parsing mDNS response:', error);
      }
    });
    
    // Listen for incoming queries (some NDI sources announce themselves)
    mdnsClient.on('query', (query) => {
      // NDI sources sometimes announce via queries
      if (query.questions) {
        query.questions.forEach(question => {
          if (question.name && question.name.includes('_ndi._tcp')) {
            const parts = question.name.split('.');
            const streamName = parts[0];
            // Filter out false positives
            if (streamName && streamName.length > 1 && streamName !== '_ndi' && !streams.includes(streamName)) {
              streams.push(streamName);
              console.log(`Found NDI stream via mDNS query: ${streamName}`);
            }
          }
        });
      }
    });
    
    mdnsClient.on('error', (error) => {
      clearTimeout(timeoutId);
      mdnsClient.destroy();
      // Don't reject, just resolve with empty array
      console.error('mDNS error:', error.message);
      resolve(streams);
    });
    
    // Send multiple queries with slight delays to catch all responses
    setTimeout(() => {
      mdnsClient.query({
        questions: [{
          name: '_ndi._tcp.local',
          type: 'PTR'
        }]
      });
    }, 1000);
    
    setTimeout(() => {
      mdnsClient.query({
        questions: [{
          name: '_services._dns-sd._udp.local',
          type: 'PTR'
        }]
      });
    }, 2000);
  });
}

// Method 2: Try to discover using NDI Tools or system commands (Windows)
async function discoverNDIViaTools() {
  const streams = [];
  
  // Check if NDI Tools are installed (common locations on Windows)
  const ndiToolsPaths = [
    'C:\\Program Files\\NDI\\NDI Tools\\',
    'C:\\Program Files (x86)\\NDI\\NDI Tools\\',
    process.env.PROGRAMFILES + '\\NDI\\NDI Tools\\',
    process.env['PROGRAMFILES(X86)'] + '\\NDI\\NDI Tools\\'
  ];
  
  // Try to use NDI Access Manager or other NDI tools
  // Note: This is a fallback method - actual implementation may vary
  
  // Alternative: Try to query Windows registry for NDI sources
  // NDI sometimes stores source information in the registry
  try {
    // Query registry for NDI sources (if available)
    const { stdout } = await execAsync(
      'reg query "HKEY_CURRENT_USER\\Software\\NewTek\\NDI" /s 2>nul || echo ""',
      { timeout: 2000 }
    );
    
    // Parse registry output for NDI source names
    // This is a basic implementation - may need refinement
    const lines = stdout.split('\n');
    lines.forEach(line => {
      const match = line.match(/NDI.*Source|Source.*Name/i);
      if (match) {
        // Extract potential source name
        const parts = line.split(/\s+/);
        parts.forEach(part => {
          if (part.length > 3 && !part.includes('REG_') && !part.includes('HKEY')) {
            if (!streams.includes(part)) {
              streams.push(part);
            }
          }
        });
      }
    });
  } catch (error) {
    // Registry query failed - this is expected if NDI isn't configured this way
    console.log('Registry query not available or no NDI registry entries found');
  }
  
  return streams;
}

// Endpoint to detect video frame rate using ffprobe
app.get('/api/video/framerate', async (req, res) => {
  try {
    const { videoPath } = req.query;
    
    if (!videoPath) {
      return res.status(400).json({ error: 'videoPath parameter is required' });
    }
    
    // Determine full file path
    let fullPath;
    if (videoPath.startsWith('/assets/videos/')) {
      // Video from public folder
      if (NODE_ENV === 'production') {
        fullPath = path.join(__dirname, 'dist', videoPath);
      } else {
        fullPath = path.join(__dirname, 'public', videoPath);
      }
    } else if (videoPath.startsWith('/')) {
      // Absolute path
      fullPath = path.join(__dirname, videoPath);
    } else {
      // Relative path
      fullPath = path.join(__dirname, videoPath);
    }
    
    // Security: ensure path is within project directory
    const resolvedPath = path.resolve(fullPath);
    const projectRoot = path.resolve(__dirname);
    if (!resolvedPath.startsWith(projectRoot)) {
      return res.status(403).json({ error: 'Access denied: path outside project directory' });
    }
    
    // Check if file exists and read MP4 header
    const fs = await import('fs');
    
    try {
      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: 'Video file not found' });
      }
      
      // Parse MP4 header to get frame rate
      const chunkSize = 512 * 1024; // Read first 512KB (should contain moov atom)
      const fd = fs.openSync(resolvedPath, 'r');
      const buffer = Buffer.alloc(chunkSize);
      const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, 0);
      fs.closeSync(fd);
      
      let offset = 0;
      const maxOffset = Math.min(bytesRead, chunkSize);
      
      console.log(`[FPS Detection] Reading MP4 header from ${resolvedPath}, bytes read: ${bytesRead}`);
      
      if (bytesRead < 8) {
        return res.status(500).json({ error: 'File too small to contain MP4 header' });
      }
      
      let movieTimescale = null;
      let movieDuration = null;
      let trackTimescale = null;
      let trackDuration = null;
      let sampleCount = null;
      
      // Find movie header and track information
      while (offset < maxOffset - 8) {
        if (offset + 8 > buffer.length) break;
        
        const size = buffer.readUInt32BE(offset);
        if (size === 0 || size > maxOffset || offset + size > buffer.length) break;
        
        const type = buffer.slice(offset + 4, offset + 8).toString('ascii');
        
        if (type === 'moov') {
          const moovSize = size;
          const moovEnd = Math.min(offset + moovSize, maxOffset);
          let moovOffset = offset + 8;
          
          while (moovOffset < moovEnd - 8) {
            const atomSize = buffer.readUInt32BE(moovOffset);
            if (atomSize === 0 || atomSize > moovEnd - moovOffset) break;
            
            const atomType = buffer.slice(moovOffset + 4, moovOffset + 8).toString('ascii');
            
            // Parse movie header
            if (atomType === 'mvhd') {
              // mvhd (movie header) layout:
              // size+type(8)
              // version(1)+flags(3)
              // version 0:
              //   creation(4) modification(4) timescale(4) duration(4)
              // version 1:
              //   creation(8) modification(8) timescale(4) duration(8)
              const version = buffer[moovOffset + 8];
              let timescaleOffset, durationOffset;

              if (version === 1) {
                timescaleOffset = moovOffset + 32;
                durationOffset = moovOffset + 36;
              } else {
                timescaleOffset = moovOffset + 20;
                durationOffset = moovOffset + 24;
              }

              movieTimescale = buffer.readUInt32BE(timescaleOffset);

              if (version === 1) {
                const durationHigh = buffer.readUInt32BE(durationOffset);
                const durationLow = buffer.readUInt32BE(durationOffset + 4);
                movieDuration = (durationHigh * 0x100000000) + durationLow;
              } else {
                movieDuration = buffer.readUInt32BE(durationOffset);
              }
            }
            
            // Parse track to find video track
            if (atomType === 'trak') {
              const trakSize = atomSize;
              const trakEnd = Math.min(moovOffset + trakSize, moovEnd);
              let trakOffset = moovOffset + 8;
              
              let isVideoTrack = false;
              let currentTrackTimescale = null;
              let currentTrackDuration = null;
              let currentSampleCount = null;
              let currentSttsTotalSamples = null;
              let currentSttsTotalDelta = null; // sum(sampleCount * sampleDelta) in track timescale units
              
              while (trakOffset < trakEnd - 8) {
                const trakAtomSize = buffer.readUInt32BE(trakOffset);
                if (trakAtomSize === 0 || trakAtomSize > trakEnd - trakOffset) break;
                
                const trakAtomType = buffer.slice(trakOffset + 4, trakOffset + 8).toString('ascii');
                
                if (trakAtomType === 'mdia') {
                  const mdiaSize = trakAtomSize;
                  const mdiaEnd = Math.min(trakOffset + mdiaSize, trakEnd);
                  let mdiaOffset = trakOffset + 8;
                  
                  while (mdiaOffset < mdiaEnd - 8) {
                    const mdiaAtomSize = buffer.readUInt32BE(mdiaOffset);
                    if (mdiaAtomSize === 0 || mdiaAtomSize > mdiaEnd - mdiaOffset) break;
                    
                    const mdiaAtomType = buffer.slice(mdiaOffset + 4, mdiaOffset + 8).toString('ascii');
                    
                    // Check handler type
                    if (mdiaAtomType === 'hdlr') {
                      const hdlrHandlerTypeOffset = mdiaOffset + 16;
                      if (hdlrHandlerTypeOffset + 4 <= mdiaEnd) {
                        const handlerType = buffer.slice(hdlrHandlerTypeOffset, hdlrHandlerTypeOffset + 4).toString('ascii');
                        if (handlerType === 'vide') {
                          isVideoTrack = true;
                        }
                      }
                    }
                    
                    if (mdiaAtomType === 'mdhd') {
                      // mdhd (media header) layout:
                      // size+type(8)
                      // version(1)+flags(3)
                      // version 0:
                      //   creation(4) modification(4) timescale(4) duration(4)
                      // version 1:
                      //   creation(8) modification(8) timescale(4) duration(8)
                      const mdhdVersion = buffer[mdiaOffset + 8];
                      let mdhdTimescaleOffset, mdhdDurationOffset;

                      if (mdhdVersion === 1) {
                        mdhdTimescaleOffset = mdiaOffset + 32;
                        mdhdDurationOffset = mdiaOffset + 36;
                      } else {
                        mdhdTimescaleOffset = mdiaOffset + 20;
                        mdhdDurationOffset = mdiaOffset + 24;
                      }

                      if (mdhdTimescaleOffset + 4 <= mdiaEnd) {
                        currentTrackTimescale = buffer.readUInt32BE(mdhdTimescaleOffset);
                      }

                      if (mdhdDurationOffset + (mdhdVersion === 1 ? 8 : 4) <= mdiaEnd) {
                        if (mdhdVersion === 1) {
                          const durationHigh = buffer.readUInt32BE(mdhdDurationOffset);
                          const durationLow = buffer.readUInt32BE(mdhdDurationOffset + 4);
                          currentTrackDuration = (durationHigh * 0x100000000) + durationLow;
                        } else {
                          currentTrackDuration = buffer.readUInt32BE(mdhdDurationOffset);
                        }
                      }
                    }
                    
                    // Parse sample table
                    if (mdiaAtomType === 'minf') {
                      const minfSize = mdiaAtomSize;
                      const minfEnd = Math.min(mdiaOffset + minfSize, mdiaEnd);
                      let minfOffset = mdiaOffset + 8;
                      
                      while (minfOffset < minfEnd - 8) {
                        const minfAtomSize = buffer.readUInt32BE(minfOffset);
                        if (minfAtomSize === 0 || minfAtomSize > minfEnd - minfOffset) break;
                        
                        const minfAtomType = buffer.slice(minfOffset + 4, minfOffset + 8).toString('ascii');
                        
                        if (minfAtomType === 'stbl') {
                          const stblSize = minfAtomSize;
                          const stblEnd = Math.min(minfOffset + stblSize, minfEnd);
                          let stblOffset = minfOffset + 8;
                          
                          while (stblOffset < stblEnd - 8) {
                            const stblAtomSize = buffer.readUInt32BE(stblOffset);
                            if (stblAtomSize === 0 || stblAtomSize > stblEnd - stblOffset) break;
                            
                            const stblAtomType = buffer.slice(stblOffset + 4, stblOffset + 8).toString('ascii');
                            
                            // Parse stsz (sample size) atom
                            if (stblAtomType === 'stsz') {
                              const stszVersion = buffer[stblOffset + 8];
                              if (stszVersion === 0 && stblOffset + 20 <= stblEnd) {
                                currentSampleCount = buffer.readUInt32BE(stblOffset + 16);
                              }
                            }
                            
                            if (stblAtomType === 'stts') {
                              // stts (time-to-sample) atom:
                              // version/flags (4)
                              // entry_count (4)
                              // entries: { sample_count (4), sample_delta (4) } * entry_count
                              // Use this to compute average FPS reliably, even when mdhd duration differs (edit lists, etc.).
                              const sttsVersion = buffer[stblOffset + 8];
                              if (sttsVersion === 0 && stblOffset + 16 <= stblEnd) {
                                const entryCount = buffer.readUInt32BE(stblOffset + 12);
                                const entriesStart = stblOffset + 16;
                                const entriesBytes = entryCount * 8;
                                if (entriesStart + entriesBytes <= stblEnd) {
                                  let totalSamples = 0;
                                  let totalDelta = 0;
                                  for (let i = 0; i < entryCount; i++) {
                                    const entryOffset = entriesStart + (i * 8);
                                    const sc = buffer.readUInt32BE(entryOffset);
                                    const sd = buffer.readUInt32BE(entryOffset + 4);
                                    totalSamples += sc;
                                    totalDelta += sc * sd;
                                  }
                                  if (totalSamples > 0 && totalDelta > 0) {
                                    currentSttsTotalSamples = totalSamples;
                                    currentSttsTotalDelta = totalDelta;
                                  }
                                }
                              }
                            }
                            
                            stblOffset += stblAtomSize;
                          }
                        }
                        
                        minfOffset += minfAtomSize;
                      }
                    }
                    
                    mdiaOffset += mdiaAtomSize;
                  }
                }
                
                trakOffset += trakAtomSize;
              }
              
              // If we found a video track, calculate FPS from header metadata.
              if (isVideoTrack && currentTrackTimescale) {
                // Preferred: derive average FPS from stts (timing table)
                if (currentSttsTotalSamples && currentSttsTotalDelta) {
                  const fps = (currentSttsTotalSamples * currentTrackTimescale) / currentSttsTotalDelta;
                  console.log(`[FPS Detection] Video track FPS (stts):`, {
                    sttsTotalSamples: currentSttsTotalSamples,
                    sttsTotalDelta: currentSttsTotalDelta,
                    trackTimescale: currentTrackTimescale,
                    fps,
                    roundedFps: Math.round(fps)
                  });
                  if (fps > 0 && fps <= 120) {
                    return res.json({ fps: Math.round(fps) });
                  }
                }

                // Fallback: sampleCount / (mdhdDuration / timescale)
                if (currentSampleCount && currentTrackDuration) {
                  const durationInSeconds = currentTrackDuration / currentTrackTimescale;
                  if (durationInSeconds > 0 && currentSampleCount > 0) {
                    const fps = currentSampleCount / durationInSeconds;
                    console.log(`[FPS Detection] Video track FPS (mdhd+stsz):`, {
                      sampleCount: currentSampleCount,
                      trackTimescale: currentTrackTimescale,
                      trackDuration: currentTrackDuration,
                      durationInSeconds,
                      fps,
                      roundedFps: Math.round(fps)
                    });
                    if (fps > 0 && fps <= 120) {
                      return res.json({ fps: Math.round(fps) });
                    }
                  }
                }
              }
              
              // Store for fallback
              if (currentSampleCount && !sampleCount) {
                sampleCount = currentSampleCount;
                if (currentTrackTimescale) trackTimescale = currentTrackTimescale;
                if (currentTrackDuration) trackDuration = currentTrackDuration;
              }
            }
            
            moovOffset += atomSize;
          }
        }
        
        offset += size;
      }
      
      // Fallback: use movie timescale and sample count
      if (movieTimescale && movieDuration && sampleCount && trackTimescale && trackDuration) {
        const durationInSeconds = trackDuration / trackTimescale;
        if (durationInSeconds > 0 && sampleCount > 0) {
          const fps = sampleCount / durationInSeconds;
          console.log(`[FPS Detection] Fallback FPS calculation:`, {
            sampleCount,
            trackTimescale,
            trackDuration,
            durationInSeconds,
            fps,
            roundedFps: Math.round(fps)
          });
          if (fps > 0 && fps <= 120) {
            return res.json({ fps: Math.round(fps) });
          }
        }
      }
      
      console.log(`[FPS Detection] Failed to parse frame rate from MP4 header`);
      return res.status(404).json({ error: 'Frame rate not found in MP4 header' });
    } catch (parseError) {
      console.error('[FPS Detection] Error parsing MP4 header:', parseError);
      console.error('[FPS Detection] Error stack:', parseError.stack);
      return res.status(500).json({ 
        error: 'Failed to parse MP4 header', 
        details: parseError.message,
        ...(process.env.NODE_ENV === 'development' && { stack: parseError.stack })
      });
    }
  } catch (error) {
    console.error('Error detecting frame rate:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Endpoint to detect frame rate from uploaded file
app.post('/api/video/framerate/upload', async (req, res) => {
  try {
    // This would require multer for file uploads
    // For now, we'll handle file uploads differently
    // The client can send the file as base64 or we can use a different approach
    res.status(501).json({ error: 'File upload endpoint not yet implemented. Use file path endpoint instead.' });
  } catch (error) {
    console.error('Error processing uploaded file:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'NDI Discovery Service' });
});

// Serve static files from dist folder in production (must be after all API routes)
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  
  // Serve index.html for all routes (SPA fallback) - must be last
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`NDI Discovery Service running on http://localhost:${PORT}`);
  console.log(`Discovery endpoint: http://localhost:${PORT}/ndi/discover`);
  console.log(`Stream endpoint: http://localhost:${PORT}/ndi/stream/:streamName`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ndi/ws`);
  console.log('\nNDI discovery is active using mDNS and system tools.');
  console.log('NDI streaming uses FFmpeg with NDI support.');
  console.log('Click "Refresh NDI Streams" in the web interface to discover available streams.');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nError: Port ${PORT} is already in use.`);
    console.log('Solutions:');
    console.log('1. Stop the process using port 8080');
    console.log('2. Or change the PORT in server.js to a different port');
    console.log(`\nTo find and kill the process: taskkill /PID [process_id] /F`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

