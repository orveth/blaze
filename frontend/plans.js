/**
 * Blaze Plans UI
 * Grid layout with slide-in detail panel
 */

// --- State ---
let token = localStorage.getItem('blaze_token');
let plans = [];
let selectedPlanId = null;
let pendingDeleteAction = null;

// --- DOM Elements ---
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const planModal = document.getElementById('planModal');
const planForm = document.getElementById('planForm');
const confirmModal = document.getElementById('confirmModal');
const plansGrid = document.getElementById('plansGrid');
const plansCount = document.getElementById('plansCount');
const planDetail = document.getElementById('planDetail');
const detailOverlay = document.getElementById('detailOverlay');
const toastContainer = document.getElementById('toastContainer');

// --- Init ---
document.addEventListener('DOMContentLoaded', init);

async function init() {
    if (!token) {
        showLogin();
        return;
    }

    setupEventListeners();
    await loadPlans();

    // Check if we should auto-open a plan (from back navigation)
    const openPlanId = sessionStorage.getItem('blaze_open_plan');
    if (openPlanId) {
        sessionStorage.removeItem('blaze_open_plan');
        const plan = plans.find(p => p.id === openPlanId);
        if (plan) {
            selectedPlanId = openPlanId;
            renderPlanDetail(plan);
            openDetail();
            renderPlansGrid();
        }
    }
}

function setupEventListeners() {
    // Login
    loginForm.addEventListener('submit', handleLogin);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // New plan
    document.getElementById('newPlanBtn').addEventListener('click', () => openPlanModal());
    
    // Plan modal
    planForm.addEventListener('submit', handlePlanSubmit);
    document.getElementById('cancelPlanBtn').addEventListener('click', () => planModal.close());
    document.getElementById('deletePlanBtn').addEventListener('click', confirmDeletePlan);
    planModal.querySelector('.close-btn').addEventListener('click', () => planModal.close());
    
    
    // Confirm modal
    document.getElementById('confirmCancel').addEventListener('click', () => {
        pendingDeleteAction = null;
        confirmModal.close();
    });
    document.getElementById('confirmDelete').addEventListener('click', executeDelete);
    
    // Status filters
    document.querySelectorAll('[data-filter="status"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleFilterChange);
    });
    
    // Detail overlay (close on click)
    detailOverlay.addEventListener('click', closeDetail);
    
    // Close modals on backdrop click
    [loginModal, planModal, confirmModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.close();
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (planModal.open) planModal.close();
            else if (confirmModal.open) confirmModal.close();
            else if (selectedPlanId) closeDetail();
        }
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
        await loadPlans();
    } catch (err) {
        toast('Login failed', 'error');
    }
}

function handleLogout() {
    token = null;
    localStorage.removeItem('blaze_token');
    plans = [];
    selectedPlanId = null;
    renderPlansGrid();
    closeDetail();
    showLogin();
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
        handleLogout();
        throw new Error('Unauthorized');
    }
    
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(err.detail || 'Request failed');
    }
    
    if (res.status === 204) return null;
    return res.json();
}

// --- Plans ---
async function loadPlans() {
    try {
        plansGrid.innerHTML = '<div class="loading">Loading plans...</div>';
        plans = await api('/api/plans');
        renderPlansGrid();
        
        // Re-select if we had one selected
        if (selectedPlanId) {
            const plan = plans.find(p => p.id === selectedPlanId);
            if (plan) {
                renderPlanDetail(plan);
            } else {
                closeDetail();
            }
        }
    } catch (err) {
        plansGrid.innerHTML = '<div class="plans-empty"><p>Failed to load plans</p></div>';
        toast(err.message, 'error');
    }
}

function renderPlansGrid() {
    // Get active filters
    const activeStatuses = getActiveFilters();
    
    // Filter plans
    let filteredPlans = plans;
    if (activeStatuses.length > 0) {
        filteredPlans = plans.filter(p => activeStatuses.includes(p.status));
    }
    
    // Update count
    const countText = filteredPlans.length === plans.length 
        ? `${plans.length} Plan${plans.length !== 1 ? 's' : ''}`
        : `${filteredPlans.length} of ${plans.length} Plans`;
    plansCount.textContent = countText;
    
    if (filteredPlans.length === 0) {
        plansGrid.innerHTML = `
            <div class="plans-empty">
                <p>${plans.length === 0 ? 'No plans yet. Create one to get started.' : 'No matching plans'}</p>
            </div>
        `;
        return;
    }
    
    plansGrid.innerHTML = filteredPlans.map(plan => `
        <div class="plan-card ${plan.id === selectedPlanId ? 'selected' : ''}"
             data-plan-id="${plan.id}"
             onclick="selectPlan('${plan.id}')">
            <div class="plan-card-header">
                <span class="plan-card-title">${escapeHtml(plan.title)}</span>
                <span class="status-badge ${plan.status}" onclick="openStatusDropdown(event, '${plan.id}')">${plan.status}</span>
            </div>
            ${plan.description ? `<p class="plan-card-description">${escapeHtml(plan.description)}</p>` : ''}
            <div class="plan-card-body">
                ${plan.files.length > 0 ? `
                    <div class="plan-card-files">
                        ${plan.files.slice(0, 3).map(f => `<span class="plan-card-file">${escapeHtml(f.name)}</span>`).join('')}
                        ${plan.files.length > 3 ? `<span class="plan-card-file">+${plan.files.length - 3} more</span>` : ''}
                    </div>
                ` : `<span style="color: var(--text-3)">No files yet</span>`}
            </div>
            <div class="plan-card-meta">
                <span>${plan.files.length} file${plan.files.length !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>Updated ${formatDate(plan.updated_at)}</span>
            </div>
        </div>
    `).join('');
}

function getActiveFilters() {
    const checkboxes = document.querySelectorAll('[data-filter="status"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function handleFilterChange() {
    renderPlansGrid();
}

async function selectPlan(planId) {
    selectedPlanId = planId;
    
    // Update grid selection
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.planId === planId);
    });
    
    // Fetch fresh plan data
    try {
        const plan = await api(`/api/plans/${planId}`);
        renderPlanDetail(plan);
        openDetail();
    } catch (err) {
        toast(err.message, 'error');
    }
}

function renderPlanDetail(plan) {
    planDetail.innerHTML = `
        <header class="sidebar-header">
            <button class="sidebar-close" onclick="closeDetail()" aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="sidebar-title-row">
                <h2 class="sidebar-title">${escapeHtml(plan.title)}</h2>
                <button class="icon-btn" onclick="openPlanModal('${plan.id}')" aria-label="Edit plan" title="Edit plan">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
            <div class="sidebar-meta">
                <span class="status-badge ${plan.status}" data-plan-id="${plan.id}" onclick="openStatusDropdown(event, '${plan.id}')">${plan.status}</span>
                <span class="sidebar-timestamp">Created ${formatDate(plan.created_at)}</span>
                <span class="sidebar-timestamp">Updated ${formatDate(plan.updated_at)}</span>
            </div>
            ${plan.description ? `<p class="sidebar-description">${escapeHtml(plan.description)}</p>` : ''}
        </header>
        
        <section class="sidebar-files">
            <header class="files-header">
                <span class="files-label">Files</span>
                <button class="icon-btn" onclick="openFileModal('${plan.id}')" aria-label="Add file" title="Add file">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
                    </svg>
                </button>
            </header>
            
            <div class="file-list">
                ${plan.files.length === 0 ? `
                    <div class="empty-files">
                        <p>No files yet. Add a file to start documenting this plan.</p>
                    </div>
                ` : plan.files.map(file => `
                    <a class="file-card" href="/doc/${plan.id}/${encodeURIComponent(file.name)}">
                        <div class="file-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="file-info">
                            <div class="file-name">${escapeHtml(file.name)}</div>
                            <div class="file-preview">${getFilePreview(file.content)}</div>
                        </div>
                    </a>
                `).join('')}
            </div>
        </section>
        
        <section class="sidebar-actions">
            <button class="btn-secondary btn-generate-cards" onclick="generateCardsFromPlan('${plan.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M9 12h6M12 9v6"/>
                </svg>
                Generate Cards from Plan
            </button>
        </section>
    `;
}

function getFilePreview(content) {
    if (!content) return 'Empty file';
    const firstLine = content.split('\n').find(line => line.trim()) || '';
    const cleaned = firstLine.replace(/^#+\s*/, '').trim();
    return escapeHtml(cleaned.slice(0, 80)) || 'Empty file';
}

function openDetail() {
    planDetail.classList.add('open');
    detailOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
}

function closeDetail() {
    selectedPlanId = null;
    planDetail.classList.remove('open');
    detailOverlay.classList.remove('visible');
    document.body.style.overflow = '';
    
    // Update grid selection
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('selected');
    });
}

// --- Plan Modal ---
function openPlanModal(planId = null) {
    const plan = planId ? plans.find(p => p.id === planId) : null;

    document.getElementById('planModalTitle').textContent = plan ? 'Edit Plan' : 'New Plan';
    document.getElementById('planId').value = plan?.id || '';
    document.getElementById('planTitle').value = plan?.title || '';
    document.getElementById('planDescription').value = plan?.description || '';
    document.getElementById('planStatus').value = plan?.status || 'draft';

    // Show status field only for editing
    document.getElementById('statusField').style.display = plan ? 'block' : 'none';

    // Show delete button only for editing
    document.getElementById('deletePlanBtn').style.display = plan ? 'block' : 'none';

    // Update submit button text
    document.getElementById('savePlanBtn').textContent = plan ? 'Save' : 'Create';

    planModal.showModal();
    document.getElementById('planTitle').focus();
}

async function handlePlanSubmit(e) {
    e.preventDefault();

    const planId = document.getElementById('planId').value;
    const title = document.getElementById('planTitle').value.trim();
    const description = document.getElementById('planDescription').value.trim() || null;
    const status = document.getElementById('planStatus').value;

    try {
        if (planId) {
            // Update
            await api(`/api/plans/${planId}`, {
                method: 'PATCH',
                body: JSON.stringify({ title, description, status })
            });
            toast('Plan updated', 'success');
        } else {
            // Create
            const newPlan = await api('/api/plans', {
                method: 'POST',
                body: JSON.stringify({ title, description })
            });
            selectedPlanId = newPlan.id;
            toast('Plan created', 'success');
        }

        planModal.close();
        await loadPlans();

        // Show the new/updated plan
        if (selectedPlanId) {
            const plan = plans.find(p => p.id === selectedPlanId);
            if (plan) {
                renderPlanDetail(plan);
                openDetail();
            }
        }
    } catch (err) {
        toast(err.message, 'error');
    }
}

function confirmDeletePlan() {
    const planId = document.getElementById('planId').value;
    if (!planId) return;
    
    document.getElementById('confirmText').textContent = 'Delete this plan and all its files? This can\'t be undone.';
    pendingDeleteAction = { type: 'plan', planId };
    confirmModal.showModal();
}

// --- New File ---
function openFileModal(planId) {
    // Navigate to the new file editor page instead of opening a modal
    window.location.href = `/doc/${planId}/new`;
}

// --- Delete Actions ---
async function executeDelete() {
    if (!pendingDeleteAction) return;
    
    try {
        if (pendingDeleteAction.type === 'plan') {
            await api(`/api/plans/${pendingDeleteAction.planId}`, { method: 'DELETE' });
            toast('Plan deleted', 'success');
            
            if (selectedPlanId === pendingDeleteAction.planId) {
                closeDetail();
            }
            planModal.close();
        }
        
        confirmModal.close();
        pendingDeleteAction = null;
        await loadPlans();
        
    } catch (err) {
        toast(err.message, 'error');
    }
}

// --- Utilities ---
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function toast(message, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = message;
    toastContainer.appendChild(t);
    
    setTimeout(() => {
        t.classList.add('exiting');
        setTimeout(() => t.remove(), 150);
    }, 3000);
}

// --- Status Dropdown ---
let activeStatusDropdown = null;

function openStatusDropdown(event, planId) {
    event.stopPropagation();

    // Close any existing dropdown
    closeStatusDropdown();

    const badge = event.target.closest('.status-badge');
    const currentStatus = badge.textContent.trim();

    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'status-dropdown';
    dropdown.innerHTML = `
        <button class="status-option draft ${currentStatus === 'draft' ? 'active' : ''}" data-status="draft">Draft</button>
        <button class="status-option ready ${currentStatus === 'ready' ? 'active' : ''}" data-status="ready">Ready</button>
        <button class="status-option approved ${currentStatus === 'approved' ? 'active' : ''}" data-status="approved">Approved</button>
    `;

    // Position dropdown
    const rect = badge.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.zIndex = '1000';

    // Handle option clicks
    dropdown.querySelectorAll('.status-option').forEach(option => {
        option.addEventListener('click', async (e) => {
            e.stopPropagation();
            const newStatus = option.dataset.status;
            if (newStatus !== currentStatus) {
                await updatePlanStatus(planId, newStatus);
            }
            closeStatusDropdown();
        });
    });

    document.body.appendChild(dropdown);
    activeStatusDropdown = dropdown;

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', closeStatusDropdown, { once: true });
    }, 0);
}

function closeStatusDropdown() {
    if (activeStatusDropdown) {
        activeStatusDropdown.remove();
        activeStatusDropdown = null;
    }
}

async function updatePlanStatus(planId, newStatus) {
    try {
        await api(`/api/plans/${planId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
        toast('Status updated', 'success');
        await loadPlans();
    } catch (err) {
        toast(err.message, 'error');
    }
}

// --- Generate Cards from Plan ---
let isGeneratingCards = false;

async function generateCardsFromPlan(planId) {
    if (isGeneratingCards) return;
    
    const btn = document.querySelector('.btn-generate-cards');
    if (!btn) return;
    
    // Show loading state
    isGeneratingCards = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `
        <svg class="spinner" width="16" height="16" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="32" stroke-dashoffset="32"/>
        </svg>
        Generating...
    `;
    btn.disabled = true;
    
    try {
        const response = await api('/api/agent/nl/generate-cards', {
            method: 'POST',
            body: JSON.stringify({ plan_id: planId })
        });
        
        toast(`Created ${response.count} card${response.count !== 1 ? 's' : ''}`, 'success');
        
    } catch (err) {
        toast(err.message || 'Failed to generate cards', 'error');
    } finally {
        isGeneratingCards = false;
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// --- Global functions for onclick handlers ---
window.selectPlan = selectPlan;
window.openPlanModal = openPlanModal;
window.openFileModal = openFileModal;
window.closeDetail = closeDetail;
window.openStatusDropdown = openStatusDropdown;
window.generateCardsFromPlan = generateCardsFromPlan;
