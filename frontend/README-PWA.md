# PWA Setup

Blaze is now a Progressive Web App (PWA) that can be installed on mobile and desktop devices.

## Features

- **Offline support**: Service worker caches static assets and API responses
- **Install to home screen**: Add Blaze as a standalone app
- **App shortcuts**: Quick actions from the home screen icon
- **Native app experience**: Runs in standalone mode without browser chrome

## Icon Generation

To generate the required PNG icons:

1. Open `/static/generate-icons.html` in your browser
2. Click "Download 192x192" to save `icon-192.png`
3. Click "Download 512x512" to save `icon-512.png`
4. Save both files to `/frontend/` directory

The icons use the Blaze arrow mark on a dark background.

## Files

- `manifest.json` - PWA manifest with app metadata
- `sw.js` - Service worker for offline caching
- `generate-icons.html` - Icon generator tool
- `icon-192.png` - Small icon (needs generation)
- `icon-512.png` - Large icon (needs generation)

## Caching Strategy

- **Static assets** (HTML, CSS, JS): Cache-first with network fallback
- **API requests**: Network-first with cache fallback (for offline resilience)
- **Cache versioning**: `blaze-v1` (increment when assets change significantly)

## Testing

1. Serve the app (backend must be running)
2. Open in browser with PWA support (Chrome, Edge, Safari)
3. Check browser DevTools → Application → Manifest
4. Check Service Worker registration
5. Test offline: Disconnect network, reload page (should load from cache)
6. Install: Click browser's "Install app" prompt or menu option

## Browser Support

- Chrome/Edge: Full support
- Safari (iOS/macOS): Full support (since iOS 16.4)
- Firefox: Partial support (no install prompt, but caching works)
