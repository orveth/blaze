// Blaze Application

const API_BASE = '/api';

// State
let authToken = localStorage.getItem('blaze_token') || '';
let currentEditCard = null;
let cardToDelete = null;
let initialFormState = null;

// DOM Elements
const loginModal = document.getElementById('loginModal');
const cardModal = document.getElementById('cardModal');
const statsModal = document.getElementById('statsModal');
const confirmModal = document.getElementById('confirmModal');
const loginForm = document.getElementById('loginForm');
const cardForm = document.getElementById('cardForm');
const board = document.getElementById('board');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    Filters.init();
    
    if (!authToken) {
        showLoginModal();
    } else {
        loadBoard();
        // Initialize WebSocket after auth
        BoardSync.init();
    }

    setupEventListeners();
    setupDragAndDrop();
});

// Event Listeners
function setupEventListeners() {
    // Login
    loginForm.addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Card Modal
    document.getElementById('addCardBtn').addEventListener('click', () => openCardModal());
    cardForm.addEventListener('submit', handleSaveCard);
    document.getElementById('deleteCardBtn').addEventListener('click', () => {
        cardToDelete = currentEditCard;
        confirmModal.showModal();
    });
    document.getElementById('cancelCardBtn').addEventListener('click', () => closeCardModalWithConfirm());

    // Stats
    document.getElementById('statsBtn').addEventListener('click', openStatsModal);

    // Confirm Delete
    document.getElementById('confirmCancel').addEventListener('click', () => confirmModal.close());
    document.getElementById('confirmDelete').addEventListener('click', handleDeleteCard);

    // Close modals on backdrop click (not cardModal - prevent accidental data loss)
    [statsModal, confirmModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.close();
        });
    });

    // Close buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const dialog = btn.closest('dialog');
            if (dialog === cardModal) {
                closeCardModalWithConfirm();
            } else {
                dialog.close();
            }
        });
    });

    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (cardModal.open) {
                closeCardModalWithConfirm();
            }
            [statsModal, confirmModal].forEach(modal => {
                if (modal.open) modal.close();
            });
        }
    });
}

// Auth
function showLoginModal() {
    loginModal.showModal();
}

async function handleLogin(e) {
    e.preventDefault();
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (!response.ok) {
            throw new Error('Invalid password');
        }

        const data = await response.json();
        authToken = data.token;
        localStorage.setItem('blaze_token', authToken);
        loginModal.close();
        loadBoard();
        // Initialize WebSocket after successful login
        BoardSync.init();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function handleLogout() {
    authToken = '';
    localStorage.removeItem('blaze_token');
    // Disconnect WebSocket on logout
    BoardSync.disconnect();
    showLoginModal();
    clearBoard();
}

// API Helpers
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        handleLogout();
        throw new Error('Session expired');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || 'Request failed');
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

// Board
async function loadBoard() {
    try {
        showLoading();
        const data = await apiCall('/board');
        renderBoard(data.columns);
    } catch (error) {
        showToast(`Failed to load board: ${error.message}`, 'error');
    }
}

function clearBoard() {
    document.querySelectorAll('.cards').forEach(container => {
        container.innerHTML = '';
    });
    updateCardCounts({});
}

function showLoading() {
    document.querySelectorAll('.cards').forEach(container => {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading</span></div>';
    });
}

function renderBoard(columns) {
    // Clear all columns
    document.querySelectorAll('.cards').forEach(container => {
        container.innerHTML = '';
    });

    // Track counts for each column
    const counts = {};

    // Render cards in each column
    Object.entries(columns).forEach(([columnName, cards]) => {
        const container = document.querySelector(`.cards[data-column="${columnName}"]`);
        if (!container) return;

        counts[columnName] = cards.length;

        if (cards.length === 0) {
            container.innerHTML = '<div class="empty-state">No cards yet</div>';
            return;
        }

        cards.forEach(card => {
            container.appendChild(createCardElement(card));
        });
    });

    updateCardCounts(counts);
    Filters.populateTags();
    Filters.apply();
}

function updateCardCounts(counts) {
    document.querySelectorAll('.column').forEach(column => {
        const columnName = column.dataset.column;
        const countEl = column.querySelector('.card-count');
        if (countEl) {
            // If counts provided, use it; otherwise count cards in DOM
            const count = counts 
                ? (counts[columnName] || 0)
                : column.querySelectorAll('.card').length;
            countEl.textContent = count > 0 ? `(${count})` : '';
        }
    });
}

function createCardElement(card) {
    const div = document.createElement('div');
    div.className = 'card';
    div.draggable = true;
    div.dataset.id = card.id;
    div.dataset.priority = card.priority;
    div.dataset.tags = card.tags ? card.tags.join(',') : '';

    // Check dates for styling
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let dueClass = '';
    if (card.due_date && card.column !== 'done') {
        const dueDate = new Date(card.due_date);
        const daysDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysDiff < 0) {
            div.classList.add('overdue');
            dueClass = 'overdue';
        } else if (daysDiff <= 2) {
            dueClass = 'soon';
        }
    }

    // Build card HTML
    let html = `<div class="card-title">${escapeHtml(card.title)}</div>`;

    if (card.description) {
        html += `<div class="card-description">${escapeHtml(card.description)}</div>`;
    }

    // Meta section
    const metaParts = [];

    if (card.due_date) {
        const dueDate = new Date(card.due_date);
        const formattedDate = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        metaParts.push(`<span class="card-due ${dueClass}">${formattedDate}</span>`);
    }

    if (card.tags && card.tags.length > 0) {
        const tagsHtml = card.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
        metaParts.push(`<div class="card-tags">${tagsHtml}</div>`);
    }

    if (metaParts.length > 0) {
        html += `<div class="card-meta">${metaParts.join('')}</div>`;
    }

    div.innerHTML = html;

    // Click to edit
    div.addEventListener('click', () => openCardModal(card));

    return div;
}

// Drag and Drop
function setupDragAndDrop() {
    // Drag start
    board.addEventListener('dragstart', (e) => {
        if (!e.target.classList.contains('card')) return;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', e.target.dataset.id);
    });

    // Drag end
    board.addEventListener('dragend', (e) => {
        if (!e.target.classList.contains('card')) return;
        e.target.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    // Drag over columns
    document.querySelectorAll('.cards').forEach(container => {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            container.classList.add('drag-over');
        });

        container.addEventListener('dragleave', (e) => {
            if (!container.contains(e.relatedTarget)) {
                container.classList.remove('drag-over');
            }
        });

        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');

            const cardId = e.dataTransfer.getData('text/plain');
            const newColumn = container.dataset.column;

            const card = document.querySelector(`.card[data-id="${cardId}"]`);
            if (!card) return;

            const oldContainer = card.parentElement;
            const oldColumn = oldContainer.dataset.column;

            // Skip if dropping in same column
            if (oldColumn === newColumn) return;

            try {
                await apiCall(`/cards/${cardId}/move`, {
                    method: 'PATCH',
                    body: JSON.stringify({ column: newColumn })
                });

                // Remove empty state from target if present
                const emptyState = container.querySelector('.empty-state');
                if (emptyState) emptyState.remove();

                // Move the card element
                container.appendChild(card);

                // Add empty state to old column if now empty
                if (oldContainer && oldContainer.querySelectorAll('.card').length === 0) {
                    oldContainer.innerHTML = '<div class="empty-state">No cards yet</div>';
                }

                // Update counts
                const oldCount = oldContainer.closest('.column').querySelector('.card-count');
                const newCount = container.closest('.column').querySelector('.card-count');
                
                if (oldCount) {
                    const oldNum = parseInt(oldCount.textContent.replace(/[()]/g, '')) || 0;
                    oldCount.textContent = oldNum - 1 > 0 ? `(${oldNum - 1})` : '';
                }
                if (newCount) {
                    const newNum = parseInt(newCount.textContent.replace(/[()]/g, '')) || 0;
                    newCount.textContent = `(${newNum + 1})`;
                }
            } catch (error) {
                showToast(`Failed to move: ${error.message}`, 'error');
                loadBoard();
            }
        });
    });

    // Touch support for mobile
    setupTouchDrag();
}

// Touch drag support
function setupTouchDrag() {
    let dragState = null;

    // Cleanup helper
    function cleanup() {
        if (!dragState) return;
        
        if (dragState.longPressTimer) {
            clearTimeout(dragState.longPressTimer);
        }
        if (dragState.ghost) {
            dragState.ghost.remove();
        }
        if (dragState.card) {
            dragState.card.classList.remove('touch-dragging-source');
        }
        document.querySelectorAll('.cards.drag-over').forEach(el => el.classList.remove('drag-over'));
        document.body.classList.remove('touch-dragging');
        dragState = null;
    }

    // Haptic feedback
    function vibrate(pattern = 20) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }

    board.addEventListener('touchstart', (e) => {
        const card = e.target.closest('.card');
        if (!card) return;

        const touch = e.touches[0];
        const rect = card.getBoundingClientRect();

        dragState = {
            card: card,
            startX: touch.clientX,
            startY: touch.clientY,
            offsetX: touch.clientX - rect.left,
            offsetY: touch.clientY - rect.top,
            isDragging: false,
            ghost: null,
            longPressTimer: null
        };

        // Long press to initiate drag (350ms)
        dragState.longPressTimer = setTimeout(() => {
            if (!dragState) return;
            
            // Create ghost clone
            const ghost = card.cloneNode(true);
            ghost.classList.add('touch-drag-ghost');
            ghost.style.width = rect.width + 'px';
            ghost.style.left = (touch.clientX - dragState.offsetX) + 'px';
            ghost.style.top = (touch.clientY - dragState.offsetY) + 'px';
            document.body.appendChild(ghost);
            
            // Mark source card
            card.classList.add('touch-dragging-source');
            document.body.classList.add('touch-dragging');
            
            dragState.ghost = ghost;
            dragState.isDragging = true;
            
            // Haptic feedback
            vibrate(30);
        }, 350);
    }, { passive: true });

    board.addEventListener('touchmove', (e) => {
        if (!dragState) return;

        const touch = e.touches[0];
        const moveX = Math.abs(touch.clientX - dragState.startX);
        const moveY = Math.abs(touch.clientY - dragState.startY);

        // Cancel long press if user starts scrolling before it triggers
        if (!dragState.isDragging && (moveX > 10 || moveY > 10)) {
            if (dragState.longPressTimer) {
                clearTimeout(dragState.longPressTimer);
                dragState.longPressTimer = null;
            }
            dragState = null;
            return;
        }

        if (!dragState.isDragging) return;

        e.preventDefault();

        // Move ghost
        dragState.ghost.style.left = (touch.clientX - dragState.offsetX) + 'px';
        dragState.ghost.style.top = (touch.clientY - dragState.offsetY) + 'px';

        // Find drop target (ghost has pointer-events: none, so we can detect through it)
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const dropZone = target?.closest('.cards');
        
        // Update drop zone highlights
        document.querySelectorAll('.cards.drag-over').forEach(el => {
            if (el !== dropZone) el.classList.remove('drag-over');
        });
        
        if (dropZone && !dropZone.classList.contains('drag-over')) {
            dropZone.classList.add('drag-over');
            vibrate(10);
        }
    }, { passive: false });

    async function handleDrop(touch) {
        if (!dragState || !dragState.isDragging) {
            cleanup();
            return;
        }

        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const dropZone = target?.closest('.cards');
        const card = dragState.card;
        const oldContainer = card.parentElement;

        cleanup();

        if (dropZone && dropZone !== oldContainer) {
            const cardId = card.dataset.id;
            const newColumn = dropZone.dataset.column;

            try {
                await apiCall(`/cards/${cardId}/move`, {
                    method: 'PATCH',
                    body: JSON.stringify({ column: newColumn })
                });

                const emptyState = dropZone.querySelector('.empty-state');
                if (emptyState) emptyState.remove();

                dropZone.appendChild(card);

                if (oldContainer.querySelectorAll('.card').length === 0) {
                    oldContainer.innerHTML = '<div class="empty-state">No cards yet</div>';
                }

                // Update counts
                const oldCount = oldContainer.closest('.column').querySelector('.card-count');
                const newCount = dropZone.closest('.column').querySelector('.card-count');
                
                if (oldCount) {
                    const oldNum = parseInt(oldCount.textContent.replace(/[()]/g, '')) || 0;
                    oldCount.textContent = oldNum - 1 > 0 ? `(${oldNum - 1})` : '';
                }
                if (newCount) {
                    const newNum = parseInt(newCount.textContent.replace(/[()]/g, '')) || 0;
                    newCount.textContent = `(${newNum + 1})`;
                }

                vibrate([20, 50, 20]);
            } catch (error) {
                showToast(`Failed to move: ${error.message}`, 'error');
                loadBoard();
            }
        }
    }

    board.addEventListener('touchend', (e) => {
        if (!dragState) return;
        
        if (dragState.longPressTimer) {
            clearTimeout(dragState.longPressTimer);
        }

        if (!dragState.isDragging) {
            dragState = null;
            return;
        }

        handleDrop(e.changedTouches[0]);
    });

    board.addEventListener('touchcancel', () => {
        cleanup();
    });

    // Also cleanup if touch leaves the document
    document.addEventListener('touchend', (e) => {
        if (dragState && dragState.isDragging && !board.contains(e.target)) {
            cleanup();
        }
    });
}

// Card Modal
function getFormState() {
    return {
        title: document.getElementById('cardTitle').value,
        description: document.getElementById('cardDescription').value,
        priority: document.getElementById('cardPriority').value,
        column: document.getElementById('cardColumn').value,
        dueDate: document.getElementById('cardDueDate').value,
        tags: document.getElementById('cardTags').value
    };
}

function isFormDirty() {
    if (!initialFormState) return false;
    const current = getFormState();
    return Object.keys(initialFormState).some(key => initialFormState[key] !== current[key]);
}

function closeCardModalWithConfirm() {
    if (isFormDirty()) {
        if (confirm('You have unsaved changes. Discard them?')) {
            cardModal.close();
        }
    } else {
        cardModal.close();
    }
}

function openCardModal(card = null) {
    currentEditCard = card;
    const title = document.getElementById('cardModalTitle');
    const deleteBtn = document.getElementById('deleteCardBtn');

    if (card) {
        title.textContent = 'Edit Card';
        deleteBtn.style.display = 'block';

        document.getElementById('cardId').value = card.id;
        document.getElementById('cardTitle').value = card.title;
        document.getElementById('cardDescription').value = card.description || '';
        document.getElementById('cardPriority').value = card.priority;
        document.getElementById('cardColumn').value = card.column;

        if (card.due_date) {
            const date = new Date(card.due_date);
            document.getElementById('cardDueDate').value = date.toISOString().split('T')[0];
        } else {
            document.getElementById('cardDueDate').value = '';
        }

        document.getElementById('cardTags').value = (card.tags || []).join(', ');
    } else {
        title.textContent = 'New Card';
        deleteBtn.style.display = 'none';
        cardForm.reset();
        document.getElementById('cardId').value = '';
    }

    cardModal.showModal();
    
    // Capture initial state for dirty checking
    initialFormState = getFormState();
}

async function handleSaveCard(e) {
    e.preventDefault();

    const formData = new FormData(cardForm);
    const dueDateValue = formData.get('due_date');

    const cardData = {
        title: formData.get('title').trim(),
        description: formData.get('description').trim() || null,
        priority: formData.get('priority'),
        column: formData.get('column'),
        due_date: dueDateValue ? new Date(dueDateValue + 'T00:00:00').toISOString() : null,
        tags: formData.get('tags').split(',').map(t => t.trim()).filter(t => t)
    };

    const cardId = formData.get('cardId');

    try {
        if (cardId) {
            await apiCall(`/cards/${cardId}`, {
                method: 'PUT',
                body: JSON.stringify(cardData)
            });
        } else {
            await apiCall('/cards', {
                method: 'POST',
                body: JSON.stringify(cardData)
            });
        }

        cardModal.close();
        loadBoard();
    } catch (error) {
        showToast(`Failed to save: ${error.message}`, 'error');
    }
}

async function handleDeleteCard() {
    if (!cardToDelete) return;

    try {
        await apiCall(`/cards/${cardToDelete.id}`, {
            method: 'DELETE'
        });

        confirmModal.close();
        cardModal.close();
        loadBoard();
    } catch (error) {
        showToast(`Failed to delete: ${error.message}`, 'error');
    }

    cardToDelete = null;
}

// Stats Modal
async function openStatsModal() {
    const content = document.getElementById('statsContent');
    content.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading</span></div>';
    statsModal.showModal();

    try {
        const stats = await apiCall('/board/stats');
        renderStats(stats);
    } catch (error) {
        content.innerHTML = `<p style="color: var(--priority-urgent)">Failed to load: ${escapeHtml(error.message)}</p>`;
    }
}

function renderStats(stats) {
    const content = document.getElementById('statsContent');

    const columnNames = {
        backlog: 'Backlog',
        todo: 'To Do',
        in_progress: 'In Progress',
        review: 'Review',
        done: 'Done'
    };

    const priorityNames = {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        urgent: 'Urgent'
    };

    let html = `
        <div class="stats-grid">
            <div class="stat-item">
                <span class="stat-label">Total Cards</span>
                <span class="stat-value">${stats.total_cards}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Overdue</span>
                <span class="stat-value" style="color: var(--priority-urgent)">${stats.overdue_count}</span>
            </div>
        </div>

        <div class="stats-section">
            <h4>By Column</h4>
            <div class="stats-grid">
                ${Object.entries(stats.by_column).map(([col, count]) => `
                    <div class="stat-item">
                        <span class="stat-label">${columnNames[col] || col}</span>
                        <span class="stat-value">${count}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="stats-section">
            <h4>By Priority</h4>
            <div class="stats-grid">
                ${Object.entries(stats.by_priority).map(([priority, count]) => `
                    <div class="stat-item">
                        <span class="stat-label">${priorityNames[priority] || priority}</span>
                        <span class="stat-value">${count}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    content.innerHTML = html;
}

// Utilities
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('exiting');
        setTimeout(() => toast.remove(), 200);
    }, 2500);
}

// Export functions for WebSocket sync module
window.createCardElement = createCardElement;
window.updateCardCounts = updateCardCounts;
