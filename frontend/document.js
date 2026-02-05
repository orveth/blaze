/**
 * Blaze Document View
 * Full-page markdown document viewer and editor
 */

// --- State ---
let token = localStorage.getItem('blaze_token');
let planId = null;
let fileName = null;
let originalFileName = null;
let plan = null;
let file = null;
let isEditing = false;
let hasUnsavedChanges = false;
let isNewFile = false;

// --- DOM Elements ---
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const confirmModal = document.getElementById('confirmModal');
const toastContainer = document.getElementById('toastContainer');

const backLink = document.getElementById('backLink');
const planTitleEl = document.getElementById('planTitle');
const fileNameEl = document.getElementById('fileName');
const editBtn = document.getElementById('editBtn');

const docView = document.getElementById('docView');
const docContent = document.getElementById('docContent');

const docEdit = document.getElementById('docEdit');
const docEditor = document.getElementById('docEditor');
const filenameInput = document.getElementById('filenameInput');

const docPreview = document.getElementById('docPreview');
const previewContent = document.getElementById('previewContent');

// --- Init ---
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Parse URL: /doc/planId/filename or /doc/planId/new
    const path = window.location.pathname;
    const match = path.match(/^\/doc\/([^/]+)\/(.+)$/);

    if (!match) {
        toast('Invalid document URL', 'error');
        return;
    }

    planId = match[1];
    const filenamePart = decodeURIComponent(match[2]);

    if (filenamePart === 'new') {
        isNewFile = true;
        fileName = '';
        originalFileName = '';
    } else {
        fileName = filenamePart;
        originalFileName = fileName;
    }

    if (!token) {
        showLogin();
        return;
    }

    setupEventListeners();
    if (isNewFile) {
        loadPlanForNewFile();
    } else {
        loadDocument();
    }
}

function setupEventListeners() {
    // Login
    loginForm.addEventListener('submit', handleLogin);
    
    // Edit button
    editBtn.addEventListener('click', enterEditMode);
    
    // Editor controls
    document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);
    document.getElementById('saveBtn').addEventListener('click', saveDocument);
    document.getElementById('previewBtn').addEventListener('click', showPreview);
    
    // Preview controls
    document.getElementById('backToEditBtn').addEventListener('click', hidePreview);
    document.getElementById('cancelPreviewBtn').addEventListener('click', cancelEdit);
    document.getElementById('savePreviewBtn').addEventListener('click', saveDocument);
    
    // Confirm modal
    document.getElementById('confirmCancel').addEventListener('click', () => confirmModal.close());
    document.getElementById('confirmDelete').addEventListener('click', deleteDocument);
    
    // Track changes
    docEditor.addEventListener('input', () => { hasUnsavedChanges = true; });
    filenameInput.addEventListener('input', () => { hasUnsavedChanges = true; });
    
    // Warn on unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges && isEditing) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Cmd/Ctrl+S to save
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            if (isEditing) {
                e.preventDefault();
                saveDocument();
            }
        }
        
        // Escape to cancel
        if (e.key === 'Escape') {
            if (confirmModal.open) {
                confirmModal.close();
            } else if (docPreview.style.display !== 'none') {
                hidePreview();
            } else if (isEditing && !hasUnsavedChanges) {
                cancelEdit();
            }
        }
    });
    
    // Close modals on backdrop click
    [loginModal, confirmModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.close();
        });
    });
}

// --- Auth ---
function showLogin() {
    loginModal.showModal();
    document.getElementById('password').focus();
}

async function handleLogin(e) {
    e.preventDefault();
    const password = document.getElementById('password').value;
    
    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        if (!res.ok) {
            toast('Invalid token', 'error');
            return;
        }
        
        const data = await res.json();
        token = data.token;
        localStorage.setItem('blaze_token', token);
        loginModal.close();
        loginForm.reset();
        loadDocument();
    } catch (err) {
        toast('Login failed', 'error');
    }
}

// --- API Helpers ---
async function api(path, options = {}) {
    const res = await fetch(path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });
    
    if (res.status === 401) {
        token = null;
        localStorage.removeItem('blaze_token');
        showLogin();
        throw new Error('Unauthorized');
    }
    
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(err.detail || 'Request failed');
    }
    
    if (res.status === 204) return null;
    return res.json();
}

// --- Document Loading ---
async function loadDocument() {
    try {
        // Load plan info
        plan = await api(`/api/plans/${planId}`);

        // Find file
        file = plan.files.find(f => f.name === fileName);
        if (!file) {
            throw new Error('File not found');
        }

        // Update UI
        document.title = `${file.name} — Blaze`;
        setupBackLink();
        planTitleEl.textContent = plan.title;
        fileNameEl.textContent = file.name;

        // Render content
        renderMarkdown(file.content);

    } catch (err) {
        docContent.innerHTML = `
            <div class="empty-doc">
                <p>${escapeHtml(err.message)}</p>
                <a href="/plans" class="btn-ghost">Back to Plans</a>
            </div>
        `;
    }
}

async function loadPlanForNewFile() {
    try {
        // Load plan info
        plan = await api(`/api/plans/${planId}`);

        // Update UI for new file mode
        document.title = 'New File — Blaze';
        setupBackLink();
        planTitleEl.textContent = plan.title;
        fileNameEl.textContent = 'New File';

        // Create empty file object
        file = { name: '', content: '' };

        // Go directly into edit mode
        enterEditMode();

    } catch (err) {
        docContent.innerHTML = `
            <div class="empty-doc">
                <p>${escapeHtml(err.message)}</p>
                <a href="/plans" class="btn-ghost">Back to Plans</a>
            </div>
        `;
    }
}

function setupBackLink() {
    backLink.href = '/plans';
    backLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (hasUnsavedChanges && isEditing) {
            if (!confirm('Discard unsaved changes?')) {
                return;
            }
        }
        sessionStorage.setItem('blaze_open_plan', planId);
        window.location.href = '/plans';
    });
}

function renderMarkdown(content) {
    if (!content || content.trim() === '') {
        docContent.innerHTML = '<p class="empty-doc">This document is empty. Click Edit to add content.</p>';
        return;
    }
    
    // Configure marked for safe rendering
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: true,
        mangle: false
    });
    
    docContent.innerHTML = marked.parse(content);
}

// --- Edit Mode ---
function enterEditMode() {
    isEditing = true;
    hasUnsavedChanges = false;
    
    // Populate editor
    filenameInput.value = file.name;
    docEditor.value = file.content || '';
    
    // Show edit view
    docView.style.display = 'none';
    docEdit.style.display = 'flex';
    docPreview.style.display = 'none';
    editBtn.style.display = 'none';
    
    // Focus editor
    docEditor.focus();
}

function cancelEdit() {
    if (hasUnsavedChanges) {
        if (!confirm('Discard unsaved changes?')) {
            return;
        }
    }

    if (isNewFile) {
        // For new files, go back to the plan
        sessionStorage.setItem('blaze_open_plan', planId);
        window.location.href = '/plans';
        return;
    }

    exitEditMode();
}

function exitEditMode() {
    isEditing = false;
    hasUnsavedChanges = false;
    
    // Show view mode
    docView.style.display = 'block';
    docEdit.style.display = 'none';
    docPreview.style.display = 'none';
    editBtn.style.display = 'flex';
}

async function saveDocument() {
    const newName = filenameInput.value.trim();
    const newContent = docEditor.value;

    if (!newName) {
        toast('Filename is required', 'error');
        filenameInput.focus();
        return;
    }

    try {
        if (isNewFile) {
            // Create new file
            await api(`/api/plans/${planId}/files`, {
                method: 'POST',
                body: JSON.stringify({ name: newName, content: newContent })
            });

            // Update state
            isNewFile = false;
            file.name = newName;
            file.content = newContent;
            fileName = newName;
            originalFileName = newName;

            // Update URL to the actual file path
            const newPath = `/doc/${planId}/${encodeURIComponent(newName)}`;
            history.replaceState(null, '', newPath);

            toast('File created', 'success');
        } else {
            // Update existing file
            await api(`/api/plans/${planId}/files/${encodeURIComponent(originalFileName)}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: newName, content: newContent })
            });

            // Update local state
            file.name = newName;
            file.content = newContent;
            fileName = newName;
            originalFileName = newName;

            // Update URL if filename changed
            const newPath = `/doc/${planId}/${encodeURIComponent(newName)}`;
            if (window.location.pathname !== newPath) {
                history.replaceState(null, '', newPath);
            }

            toast('Saved', 'success');
        }

        // Update UI
        fileNameEl.textContent = newName;
        document.title = `${newName} — Blaze`;

        // Re-render and exit edit mode
        renderMarkdown(newContent);
        hasUnsavedChanges = false;
        exitEditMode();

    } catch (err) {
        toast(err.message, 'error');
    }
}

// --- Preview ---
function showPreview() {
    const content = docEditor.value;
    
    // Configure marked
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: true,
        mangle: false
    });
    
    if (!content || content.trim() === '') {
        previewContent.innerHTML = '<p class="empty-doc">Nothing to preview</p>';
    } else {
        previewContent.innerHTML = marked.parse(content);
    }
    
    docEdit.style.display = 'none';
    docPreview.style.display = 'flex';
}

function hidePreview() {
    docPreview.style.display = 'none';
    docEdit.style.display = 'flex';
    docEditor.focus();
}

// --- Delete ---
function deleteDocument() {
    // Not implemented in this view - use plans page
    confirmModal.close();
}

// --- Utilities ---
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function toast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('exiting');
        setTimeout(() => toast.remove(), 150);
    }, 3000);
}
