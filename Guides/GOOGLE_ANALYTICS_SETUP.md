# Google Analytics Setup Guide

This guide explains how to set up Google Analytics (GA4) for the Stage Preview COA application.

## Prerequisites

- A Google account
- Access to [Google Analytics](https://analytics.google.com/)

## Step 1: Create a Google Analytics Property

1. Go to [Google Analytics](https://analytics.google.com/)
2. Click **Admin** (gear icon) in the bottom left
3. In the **Property** column, click **Create Property**
4. Enter a property name (e.g., "Stage Preview COA")
5. Configure your reporting time zone and currency
6. Click **Next** and complete the business information
7. Click **Create**

## Step 2: Get Your Measurement ID

1. After creating the property, you'll see a **Data Streams** section
2. Click **Add stream** → **Web**
3. Enter your website URL and stream name
4. Click **Create stream**
5. Copy your **Measurement ID** (format: `G-XXXXXXXXXX`)

## Step 3: Configure Environment Variable

1. Copy the `.env.example` file to `.env` (if it doesn't exist):
   ```bash
   cp env.example .env
   ```

2. Open `.env` and add your Measurement ID:
   ```
   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```
   Replace `G-XXXXXXXXXX` with your actual Measurement ID.

3. **Important**: Never commit your `.env` file to version control. It should already be in `.gitignore`.

## Step 4: Verify Installation

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open your browser's Developer Console (F12)
3. In development mode, you should see `[Analytics]` log messages when events are tracked
4. In production, check Google Analytics Real-Time reports to verify data is being collected

## Usage

### Automatic Tracking

The following events are automatically tracked:
- Page views (when the app loads)
- Basic user interactions

### Manual Event Tracking

You can track custom events in your code:

```javascript
import { trackEvent, trackPageView, trackException } from './src/utils/analytics.js';

// Track a custom event
trackEvent('button_click', {
  button_name: 'play',
  section: 'playback_controls'
});

// Track a page view
trackPageView('/settings');

// Track an exception/error
trackException('Video load failed', false);
```

### Example: Tracking Video Playback

```javascript
// In your video playback code
playButton.addEventListener('click', () => {
  trackEvent('video_play', {
    video_name: videoFileName,
    video_duration: videoDuration
  });
  // ... rest of your code
});
```

### Example: Tracking Settings Changes

```javascript
// Track when user changes mapping type
mappingTypeSelect.addEventListener('change', (e) => {
  trackEvent('mapping_type_changed', {
    mapping_type: e.target.value,
    previous_type: currentMappingType
  });
  // ... rest of your code
});
```

## Available Tracking Functions

- `trackEvent(eventName, eventParams)` - Track custom events
- `trackPageView(pagePath)` - Track page views
- `trackTiming(name, value, category, label)` - Track performance metrics
- `trackException(description, fatal)` - Track errors and exceptions

## Privacy Considerations

- Google Analytics collects anonymous usage data
- Consider adding a privacy policy to your application
- Users can opt out using browser extensions or Google's opt-out tools
- For GDPR compliance, you may need to add a cookie consent banner

## Troubleshooting

### Analytics not working in development

- Check that `VITE_GA_MEASUREMENT_ID` is set in your `.env` file
- Restart your development server after changing `.env`
- Check the browser console for errors
- In development mode, events are logged to console instead of sent to GA

### Analytics not working in production

- Ensure `.env` file is present on your production server
- Check that `VITE_GA_MEASUREMENT_ID` is set correctly
- Verify your build includes the environment variable:
  ```bash
  npm run build
  ```
- Check browser console for errors
- Verify ad blockers aren't blocking Google Analytics

### Testing in Real-Time

1. Go to Google Analytics → **Reports** → **Real-time**
2. Interact with your application
3. You should see events appear within a few seconds

## Additional Resources

- [Google Analytics 4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [GA4 Event Tracking Guide](https://developers.google.com/analytics/devguides/collection/ga4/events)
- [GA4 DebugView](https://support.google.com/analytics/answer/7201382) - For debugging events

