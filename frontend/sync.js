// Blaze Board Sync Module (WebSocket)

const BoardSync = (function() {
    // State
    let ws = null;
    let reconnectDelay = 1000; // Start at 1s
    const maxDelay = 30000; // Cap at 30s
    let pingInterval = null;

    /**
     * Initialize the sync module and connect
     * Call this after authentication
     */
    function init() {
        connect();
    }

    /**
     * Connect to WebSocket server
     */
    function connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsUrl = `${protocol}://${window.location.host}/ws`;
        
        console.log('[WS] Connecting to', wsUrl);
        ws = new WebSocket(wsUrl);
        
        ws.onopen = handleOpen;
        ws.onmessage = handleMessage;
        ws.onclose = handleClose;
        ws.onerror = handleError;
    }

    /**
     * Handle WebSocket open
     */
    function handleOpen() {
        console.log('[WS] Connected');
        reconnectDelay = 1000; // Reset backoff
        
        // Send ping every 30s to keep connection alive
        pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send('ping');
            }
        }, 30000);
    }

    /**
     * Handle incoming WebSocket message
     */
    function handleMessage(event) {
        if (event.data === 'pong') {
            return; // Keepalive response
        }
        
        try {
            const msg = JSON.parse(event.data);
            handleUpdate(msg);
        } catch (e) {
            console.error('[WS] Failed to parse message:', e);
        }
    }

    /**
     * Handle WebSocket close - reconnect with backoff
     */
    function handleClose() {
        console.log('[WS] Disconnected, reconnecting in', reconnectDelay, 'ms');
        clearInterval(pingInterval);
        pingInterval = null;
        setTimeout(() => connect(), reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
    }

    /**
     * Handle WebSocket error
     */
    function handleError(err) {
        console.error('[WS] Error:', err);
        if (ws) {
            ws.close();
        }
    }

    /**
     * Handle board update from server
     * Phase 2 will implement handlers for card_created, card_updated, etc.
     */
    function handleUpdate(msg) {
        console.log('[WS] Received:', msg);
        // Phase 2 will implement handlers for card_created, card_updated, etc.
    }

    /**
     * Disconnect from WebSocket server
     * Call this on logout
     */
    function disconnect() {
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
        if (ws) {
            ws.close();
            ws = null;
        }
    }

    /**
     * Check if currently connected
     */
    function isConnected() {
        return ws && ws.readyState === WebSocket.OPEN;
    }

    // Public API
    return {
        init,
        disconnect,
        isConnected
    };
})();
