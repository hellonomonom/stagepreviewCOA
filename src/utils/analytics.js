/**
 * Google Analytics utility for tracking events
 * 
 * Usage:
 *   import { trackEvent, trackPageView } from './utils/analytics.js';
 *   
 *   trackEvent('button_click', { button_name: 'play' });
 *   trackPageView('/page-name');
 */

// Get GA Measurement ID from environment or use default
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-EF6NDS9WVS';

/**
 * Check if Google Analytics is available
 */
function isGAAvailable() {
  return typeof window !== 'undefined' && 
         typeof window.gtag !== 'undefined' && 
         GA_MEASUREMENT_ID && 
         GA_MEASUREMENT_ID !== 'GA_MEASUREMENT_ID' &&
         GA_MEASUREMENT_ID !== '';
}

/**
 * Track a custom event
 * @param {string} eventName - Name of the event (e.g., 'button_click', 'video_play')
 * @param {Object} eventParams - Additional parameters for the event
 */
export function trackEvent(eventName, eventParams = {}) {
  if (!isGAAvailable()) {
    if (import.meta.env.DEV) {
      console.log('[Analytics] Event tracked:', eventName, eventParams);
    }
    return;
  }

  try {
    window.gtag('event', eventName, eventParams);
  } catch (error) {
    console.error('Error tracking event:', error);
  }
}

/**
 * Track a page view
 * @param {string} pagePath - Path of the page (e.g., '/settings', '/media')
 */
export function trackPageView(pagePath) {
  if (!isGAAvailable()) {
    if (import.meta.env.DEV) {
      console.log('[Analytics] Page view:', pagePath);
    }
    return;
  }

  try {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: pagePath
    });
  } catch (error) {
    console.error('Error tracking page view:', error);
  }
}

/**
 * Track user timing
 * @param {string} name - Name of the timing event
 * @param {number} value - Time in milliseconds
 * @param {string} category - Category of the timing (optional)
 * @param {string} label - Label for the timing (optional)
 */
export function trackTiming(name, value, category = 'Performance', label = '') {
  if (!isGAAvailable()) {
    if (import.meta.env.DEV) {
      console.log('[Analytics] Timing:', name, value, category, label);
    }
    return;
  }

  try {
    window.gtag('event', 'timing_complete', {
      name: name,
      value: value,
      event_category: category,
      event_label: label
    });
  } catch (error) {
    console.error('Error tracking timing:', error);
  }
}

/**
 * Track exceptions/errors
 * @param {string} description - Description of the error
 * @param {boolean} fatal - Whether the error is fatal
 */
export function trackException(description, fatal = false) {
  if (!isGAAvailable()) {
    if (import.meta.env.DEV) {
      console.log('[Analytics] Exception:', description, fatal);
    }
    return;
  }

  try {
    window.gtag('event', 'exception', {
      description: description,
      fatal: fatal
    });
  } catch (error) {
    console.error('Error tracking exception:', error);
  }
}

