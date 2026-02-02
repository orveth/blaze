// Kanban Board Application

const API_BASE = '/api';

// State
let authToken = localStorage.getItem('kanban_token') || '';
let currentEditCard = null;
let cardToDelete = null;

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
    if (!authToken) {
        showLoginModal();
    } else {
        loadBoard();
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

    // Stats
    document.getElementById('statsBtn').addEventListener('click', openStatsModal);

    // Confirm Delete
    document.getElementById('confirmCancel').addEventListener('click', () => confirmModal.close());
    document.getElementById('confirmDelete').addEventListener('click', handleDeleteCard);

    // Close modals on backdrop click
    [cardModal, statsModal, confirmModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.close();
        });
    });

    // Close buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('dialog').close());
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
        localStorage.setItem('kanban_token', authToken);
        loginModal.close();
        loadBoard();
        showToast('Logged in successfully', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function handleLogout() {
    authToken = '';
    localStorage.removeItem('kanban_token');
    showLoginModal();
    clearBoard();
    showToast('Logged out', 'info');
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

    // Handle 204 No Content
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
}

function showLoading() {
    document.querySelectorAll('.cards').forEach(container => {
        container.innerHTML = '<div class="loading">Loading</div>';
    });
}

function renderBoard(columns) {
    // Clear all columns
    document.querySelectorAll('.cards').forEach(container => {
        container.innerHTML = '';
    });

    // Render cards in each column
    Object.entries(columns).forEach(([columnName, cards]) => {
        const container = document.querySelector(`.cards[data-column="${columnName}"]`);
        if (!container) return;

        if (cards.length === 0) {
            container.innerHTML = '<div class="empty-column">No cards</div>';
            return;
        }

        cards.forEach(card => {
            container.appendChild(createCardElement(card));
        });
    });
}

function createCardElement(card) {
    const div = document.createElement('div');
    div.className = 'card';
    div.draggable = true;
    div.dataset.id = card.id;
    div.dataset.priority = card.priority;

    // Check if overdue (only for non-done cards with due dates)
    if (card.due_date && card.column !== 'done') {
        const dueDate = new Date(card.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dueDate < today) {
            div.classList.add('overdue');
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isOverdue = dueDate < today && card.column !== 'done';
        const formattedDate = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        metaParts.push(`<span class="card-due ${isOverdue ? 'overdue' : ''}">📅 ${formattedDate}</span>`);
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

            // Find the card element and its current container BEFORE moving
            const card = document.querySelector(`.card[data-id="${cardId}"]`);
            if (!card) return;

            const oldContainer = card.parentElement;

            // Skip if dropping in same column
            if (oldContainer === container) return;

            try {
                await apiCall(`/cards/${cardId}/move`, {
                    method: 'PATCH',
                    body: JSON.stringify({ column: newColumn })
                });

                // Remove empty state from target if present
                const emptyState = container.querySelector('.empty-column');
                if (emptyState) emptyState.remove();

                // Move the card element
                container.appendChild(card);

                // Add empty state to old column if now empty
                if (oldContainer && oldContainer.querySelectorAll('.card').length === 0) {
                    oldContainer.innerHTML = '<div class="empty-column">No cards</div>';
                }

                showToast('Card moved', 'success');
            } catch (error) {
                showToast(`Failed to move card: ${error.message}`, 'error');
                loadBoard(); // Refresh to restore state
            }
        });
    });
}

// Card Modal
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

        // Handle due_date - extract just the date part if present
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
            showToast('Card updated', 'success');
        } else {
            await apiCall('/cards', {
                method: 'POST',
                body: JSON.stringify(cardData)
            });
            showToast('Card created', 'success');
        }

        cardModal.close();
        loadBoard();
    } catch (error) {
        showToast(`Failed to save card: ${error.message}`, 'error');
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
        showToast('Card deleted', 'success');
    } catch (error) {
        showToast(`Failed to delete card: ${error.message}`, 'error');
    }

    cardToDelete = null;
}

// Stats Modal
async function openStatsModal() {
    const content = document.getElementById('statsContent');
    content.innerHTML = '<div class="loading">Loading</div>';
    statsModal.showModal();

    try {
        const stats = await apiCall('/board/stats');
        renderStats(stats);
    } catch (error) {
        content.innerHTML = `<p>Failed to load stats: ${escapeHtml(error.message)}</p>`;
    }
}

function renderStats(stats) {
    const content = document.getElementById('statsContent');

    let html = `
        <div class="stat-row">
            <span class="stat-label">Total Cards</span>
            <span class="stat-value">${stats.total_cards}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Overdue</span>
            <span class="stat-value" style="color: var(--priority-urgent)">${stats.overdue_count}</span>
        </div>
    `;

    // By Column
    const columnNames = {
        backlog: '📥 Backlog',
        todo: '📋 To Do',
        in_progress: '🔨 In Progress',
        review: '👀 Review',
        done: '✅ Done'
    };

    html += '<div class="stat-section"><h4>By Column</h4>';
    Object.entries(stats.by_column).forEach(([col, count]) => {
        html += `
            <div class="stat-row">
                <span class="stat-label">${columnNames[col] || col}</span>
                <span class="stat-value">${count}</span>
            </div>
        `;
    });
    html += '</div>';

    // By Priority
    const priorityNames = {
        low: '🟢 Low',
        medium: '🟡 Medium',
        high: '🟠 High',
        urgent: '🔴 Urgent'
    };

    html += '<div class="stat-section"><h4>By Priority</h4>';
    Object.entries(stats.by_priority).forEach(([priority, count]) => {
        html += `
            <div class="stat-row">
                <span class="stat-label">${priorityNames[priority] || priority}</span>
                <span class="stat-value">${count}</span>
            </div>
        `;
    });
    html += '</div>';

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
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
