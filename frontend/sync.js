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
     */
    function handleUpdate(msg) {
        console.log('[WS] Received:', msg);
        
        switch (msg.type) {
            case 'card_created':
                handleCardCreated(msg.card);
                break;
            case 'card_updated':
                handleCardUpdated(msg.card);
                break;
            case 'card_moved':
                handleCardMoved(msg.card);
                break;
            case 'card_deleted':
                handleCardDeleted(msg.card_id);
                break;
            case 'card_archived':
                handleCardArchived(msg.card.id);
                break;
            case 'card_unarchived':
                handleCardUnarchived(msg.card);
                break;
            case 'column_archived':
                handleColumnArchived(msg.column);
                break;
            default:
                console.warn('[WS] Unknown message type:', msg.type);
        }
    }

    /**
     * Handle card creation from WebSocket
     */
    function handleCardCreated(card) {
        // Check if card already exists (might be our own mutation)
        const existing = document.querySelector(`.card[data-id="${card.id}"]`);
        if (existing) {
            console.log('[WS] Card already exists:', card.id);
            return;
        }

        // Create card element
        const cardEl = window.createCardElement(card);
        const container = document.querySelector(`.cards[data-column="${card.column}"]`);
        
        if (container) {
            container.appendChild(cardEl);
            window.updateCardCounts();
            console.log('[WS] Added card:', card.id);
        }
    }

    /**
     * Handle card update from WebSocket
     */
    function handleCardUpdated(card) {
        const existingCard = document.querySelector(`.card[data-id="${card.id}"]`);
        if (!existingCard) {
            console.log('[WS] Card not found for update:', card.id);
            return;
        }

        // Replace the card element
        const newCard = window.createCardElement(card);
        existingCard.replaceWith(newCard);
        console.log('[WS] Updated card:', card.id);
    }

    /**
     * Handle card move from WebSocket
     * 
     * Key insight: When the local user drags a card, the drag-drop handler
     * has a reference to the original DOM element. If we create a NEW element
     * here, and then the drag handler appends the OLD element, we get duplicates.
     * 
     * Solution: Move the existing element instead of creating a new one.
     */
    function handleCardMoved(card) {
        const existingCard = document.querySelector(`.card[data-id="${card.id}"]`);
        const newContainer = document.querySelector(`.cards[data-column="${card.column}"]`);
        
        if (!newContainer) {
            console.log('[WS] Target column not found:', card.column);
            return;
        }

        if (!existingCard) {
            // Card doesn't exist locally - must be from another client
            const newCard = window.createCardElement(card);
            newContainer.appendChild(newCard);
            window.updateCardCounts();
            console.log('[WS] Created card in column:', card.id, card.column);
            return;
        }

        // Skip if card is already in the correct column
        if (existingCard.closest('.cards') === newContainer) {
            console.log('[WS] Card already in correct column:', card.id);
            return;
        }

        // Move the EXISTING element (don't create new - prevents duplicates)
        newContainer.appendChild(existingCard);
        window.updateCardCounts();
        console.log('[WS] Moved card:', card.id, 'to', card.column);
    }

    /**
     * Handle card deletion from WebSocket
     */
    function handleCardDeleted(cardId) {
        const card = document.querySelector(`.card[data-id="${cardId}"]`);
        if (!card) {
            console.log('[WS] Card not found for deletion:', cardId);
            return;
        }

        card.remove();
        window.updateCardCounts();
        console.log('[WS] Deleted card:', cardId);
    }

    /**
     * Handle card archiving from WebSocket
     */
    function handleCardArchived(cardId) {
        const card = document.querySelector(`.card[data-id="${cardId}"]`);
        if (!card) {
            console.log('[WS] Card not found for archiving:', cardId);
            return;
        }

        // Remove archived card from board (hidden by default)
        card.remove();
        window.updateCardCounts();
        console.log('[WS] Archived card:', cardId);
    }

    /**
     * Handle card unarchiving from WebSocket
     */
    function handleCardUnarchived(card) {
        // Check if card already exists
        const existing = document.querySelector(`.card[data-id="${card.id}"]`);
        if (existing) {
            console.log('[WS] Card already exists:', card.id);
            return;
        }

        // Add card back to board
        const cardEl = window.createCardElement(card);
        const container = document.querySelector(`.cards[data-column="${card.column}"]`);
        
        if (container) {
            container.appendChild(cardEl);
            window.updateCardCounts();
            console.log('[WS] Unarchived card:', card.id);
        }
    }

    /**
     * Handle column archiving from WebSocket
     */
    function handleColumnArchived(columnName) {
        // Remove all cards from the archived column
        const cards = document.querySelectorAll(`.cards[data-column="${columnName}"] .card`);
        cards.forEach(card => card.remove());
        window.updateCardCounts();
        console.log('[WS] Archived column:', columnName);
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
