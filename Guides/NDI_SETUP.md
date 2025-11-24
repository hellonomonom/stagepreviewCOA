# NDI Stream Setup Guide

## Problem
Standard FFmpeg builds do not include NDI support (removed in 2019). To use NDI streams, you need FFmpeg compiled with NDI SDK support.

## Solutions

### Option 1: Install FFmpeg with NDI Support (Recommended for Production)

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

### Option 2: Use OBS Studio as Bridge (Easier Alternative)

1. **Install OBS Studio**
   - Download from https://obsproject.com/
   - Install OBS Studio

2. **Install OBS NDI Plugin**
   - Install the OBS NDI plugin/extension
   - Or use OBS Studio's built-in NDI support (if available)

3. **Setup OBS**
   - Add NDI Source in OBS to receive your NDI stream
   - Add "Virtual Camera" output in OBS
   - Start the virtual camera

4. **Capture Virtual Camera**
   - Your application can then capture from the virtual camera
   - This works with standard FFmpeg (no NDI support needed)

### Option 3: Use NDI Tools

1. **Install NDI Tools**
   - Download from https://www.ndi.tv/tools/
   - Install NDI Tools

2. **Use NDI Tools to Convert**
   - Use NDI Tools to receive the stream
   - Output to a format your application can use
   - Or use NDI Tools' web interface

### Option 4: Alternative Implementation (WebSocket/Frame-based)

For a custom solution, you could:
- Use NDI SDK directly in Node.js (requires native bindings)
- Stream frames via WebSocket
- Use a different streaming protocol

## Current Status

The server is configured to:
- ✅ Discover NDI streams via mDNS
- ❌ Stream NDI content (requires FFmpeg with NDI support)

## Testing NDI Support

To check if your FFmpeg has NDI support, run:
```bash
ffmpeg -f libndi_newtek -list_sources 1 -i dummy
```

If you see "Unknown input format" or similar, FFmpeg doesn't have NDI support.

## Next Steps

1. Choose one of the options above
2. Install the required software
3. Restart the server
4. Try selecting an NDI stream again




