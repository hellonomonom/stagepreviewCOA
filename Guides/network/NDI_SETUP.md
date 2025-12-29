# NDI Stream Setup Guide

## Recommended Solution: NDI Webcam Input + Browser MediaStream API

**This is the best solution for low latency, ease of installation, and cross-platform compatibility.**

### Why This Solution?

✅ **Low Latency**: Direct browser access to NDI stream (no server encoding/decoding)  
✅ **Easy Installation**: Only requires NDI Tools (no FFmpeg compilation, no OBS)  
✅ **Cross-Platform**: Works on Windows and macOS (NDI Tools), all modern browsers  

### Installation Steps

1. **Install NDI Tools**
   - Download from https://www.ndi.tv/tools/
   - Install NDI Tools (includes NDI Webcam Input)
   - No additional software needed!

2. **Configure NDI Webcam Input**
   - Launch **NDI Webcam Input** from the NDI Tools folder
   - In the NDI Webcam Input window, select your NDI source from the dropdown
   - The NDI stream will now appear as a virtual webcam device

3. **Grant Browser Permissions**
   - When you select an NDI stream in the StagePreview app, your browser will prompt for camera permission
   - Click "Allow" to grant access to the NDI Webcam Input virtual camera
   - The stream will appear directly in your browser

### How It Works

```
NDI Source → NDI Webcam Input (Virtual Camera) → Browser getUserMedia() → Video Element → Three.js Texture
```

- **NDI Webcam Input** converts the NDI stream into a standard virtual webcam
- Your browser accesses it like any normal camera via `getUserMedia()`
- The video stream is used directly as a Three.js texture
- **No server encoding/decoding** = minimal latency

### Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Windows  | ✅ Full Support | NDI Tools available |
| macOS    | ✅ Full Support | NDI Tools available |
| Linux    | ⚠️ Limited | NDI Tools not officially supported |

### Troubleshooting

**Problem: NDI Webcam Input not showing in browser**
- Make sure NDI Webcam Input is running
- Check that you've selected an NDI source in NDI Webcam Input
- Verify browser camera permissions are granted
- Try refreshing the page

**Problem: Stream not appearing in NDI Webcam Input dropdown**
- Ensure your NDI source is broadcasting on the network
- Check that NDI Tools are properly installed
- Verify network connectivity between source and receiver

**Problem: High latency**
- Check network bandwidth (NDI requires good network)
- Ensure NDI Webcam Input is set to low latency mode (if available)
- Close other applications using the camera

### Alternative Solutions

If NDI Webcam Input doesn't work for your use case, see below for other options:

---

## Alternative Option 1: FFmpeg with NDI Support (Production/Advanced)

**Use when**: You need server-side processing, recording, or multiple simultaneous streams

1. **Download NDI SDK**
   - Visit https://www.ndi.tv/sdk/
   - Download the NDI SDK for your platform
   - Extract the SDK files

2. **Compile FFmpeg with NDI Support**
   - Follow instructions at: https://github.com/lplassman/FFMPEG-NDI
   - Or use a pre-built binary if available for your platform

3. **Update FFmpeg Path**
   - Once installed, update the FFmpeg path in `server.js` if needed
   - The server will automatically detect NDI support

**Pros**: Server-side control, recording capabilities, multiple streams  
**Cons**: Complex installation, requires compilation, higher latency

---

## Alternative Option 2: OBS Studio Bridge

**Use when**: You already have OBS installed or need OBS features

1. **Install OBS Studio**
   - Download from https://obsproject.com/
   - Install OBS Studio

2. **Setup OBS**
   - Add NDI Source in OBS to receive your NDI stream
   - Add "Virtual Camera" output in OBS
   - Start the virtual camera

3. **Use in Browser**
   - The app can access OBS Virtual Camera via browser getUserMedia()
   - Works with standard FFmpeg (no NDI support needed)

**Pros**: Works with existing OBS setup, additional OBS features  
**Cons**: Extra software, higher latency than direct NDI Webcam Input

---

## Current Implementation Status

The server is configured to:
- ✅ Discover NDI streams via mDNS
- ✅ Stream NDI content via NDI Webcam Input (browser direct access)
- ✅ Fallback to server-side streaming (if NDI Webcam Input unavailable)

## Testing NDI Support

To check if NDI Webcam Input is working:
1. Open NDI Webcam Input
2. Select an NDI source
3. Open browser DevTools → Console
4. Run: `navigator.mediaDevices.getUserMedia({ video: true }).then(stream => console.log('Camera found:', stream))`
5. You should see camera devices including NDI Webcam Input

## Next Steps

1. Install NDI Tools
2. Launch NDI Webcam Input and select your NDI source
3. Refresh the StagePreview app
4. Select an NDI stream from the dropdown
5. Grant camera permission when prompted
6. The stream should appear directly in your browser!
