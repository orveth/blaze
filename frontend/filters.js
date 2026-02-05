// Blaze Filters Module

const Filters = (function() {
    // State
    const activeFilters = {
        priorities: new Set(),
        tags: new Set()
    };

    // DOM Elements (cached on init)
    let filterContent;
    let filterToggle;
    let filterCount;
    let clearFiltersBtn;
    let tagFiltersContainer;
    let priorityFiltersContainer;

    /**
     * Initialize the filters module
     * Call this after DOM is ready
     */
    function init() {
        // Cache DOM elements
        filterContent = document.getElementById('filterContent');
        filterToggle = document.getElementById('filterToggle');
        filterCount = document.getElementById('filterCount');
        clearFiltersBtn = document.getElementById('clearFiltersBtn');
        tagFiltersContainer = document.getElementById('tagFilters');
        priorityFiltersContainer = document.getElementById('priorityFilters');

        // Set up event listeners
        filterToggle.addEventListener('click', togglePanel);
        clearFiltersBtn.addEventListener('click', clear);
        priorityFiltersContainer.addEventListener('change', handleChange);
        tagFiltersContainer.addEventListener('change', handleChange);
    }

    /**
     * Toggle filter panel (mobile)
     */
    function togglePanel() {
        const isExpanded = filterContent.classList.toggle('expanded');
        filterToggle.setAttribute('aria-expanded', isExpanded);
    }

    /**
     * Update filter UI state (count badge, clear button visibility)
     */
    function updateUI() {
        const totalActive = activeFilters.priorities.size + activeFilters.tags.size;
        
        if (totalActive > 0) {
            filterCount.textContent = totalActive;
            filterCount.classList.add('active');
            clearFiltersBtn.classList.add('visible');
        } else {
            filterCount.classList.remove('active');
            clearFiltersBtn.classList.remove('visible');
        }
    }

    /**
     * Handle filter checkbox change
     */
    function handleChange(e) {
        if (!e.target.matches('input[type="checkbox"]')) return;
        
        const filterType = e.target.dataset.filter;
        const value = e.target.value;
        
        if (filterType === 'priority') {
            if (e.target.checked) {
                activeFilters.priorities.add(value);
            } else {
                activeFilters.priorities.delete(value);
            }
        } else if (filterType === 'tag') {
            if (e.target.checked) {
                activeFilters.tags.add(value);
            } else {
                activeFilters.tags.delete(value);
            }
        }
        
        apply();
        updateUI();
    }

    /**
     * Apply current filters to cards
     */
    function apply() {
        const hasPriorityFilter = activeFilters.priorities.size > 0;
        const hasTagFilter = activeFilters.tags.size > 0;
        
        document.querySelectorAll('.card').forEach(card => {
            let visible = true;
            
            // Check priority filter
            if (hasPriorityFilter) {
                const cardPriority = card.dataset.priority;
                if (!activeFilters.priorities.has(cardPriority)) {
                    visible = false;
                }
            }
            
            // Check tag filter
            if (visible && hasTagFilter) {
                const cardTags = card.dataset.tags ? card.dataset.tags.split(',') : [];
                const hasMatchingTag = cardTags.some(tag => activeFilters.tags.has(tag.trim()));
                if (!hasMatchingTag) {
                    visible = false;
                }
            }
            
            // Apply visibility
            if (visible) {
                card.classList.remove('filtered-out');
            } else {
                card.classList.add('filtered-out');
            }
        });
        
    }

    /**
     * Clear all active filters
     */
    function clear() {
        activeFilters.priorities.clear();
        activeFilters.tags.clear();
        
        // Uncheck all filter checkboxes
        document.querySelectorAll('#filterContent input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        apply();
        updateUI();
    }

    /**
     * Populate tag filter chips based on current cards
     * Call this after rendering cards
     */
    function populateTags() {
        // Collect all unique tags from all cards
        const allTags = new Set();
        document.querySelectorAll('.card').forEach(card => {
            const tags = card.dataset.tags;
            if (tags) {
                tags.split(',').forEach(tag => {
                    if (tag.trim()) allTags.add(tag.trim());
                });
            }
        });

        // Clear and repopulate tag filters
        tagFiltersContainer.innerHTML = '';
        
        if (allTags.size === 0) {
            tagFiltersContainer.innerHTML = '<span style="color: var(--text-3); font-size: 12px;">No tags</span>';
            return;
        }

        const sortedTags = Array.from(allTags).sort();
        sortedTags.forEach(tag => {
            const label = document.createElement('label');
            label.className = 'filter-chip';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = tag;
            checkbox.dataset.filter = 'tag';
            
            // Restore checked state if this tag was previously selected
            if (activeFilters.tags.has(tag)) {
                checkbox.checked = true;
            }
            
            const span = document.createElement('span');
            span.textContent = tag;
            
            label.appendChild(checkbox);
            label.appendChild(span);
            tagFiltersContainer.appendChild(label);
        });
        
        // Update filter UI to reflect any restored filters
        updateUI();
    }

    /**
     * Check if any filters are active
     */
    function hasActiveFilters() {
        return activeFilters.priorities.size > 0 || activeFilters.tags.size > 0;
    }

    // Public API
    return {
        init,
        apply,
        clear,
        populateTags,
        hasActiveFilters
    };
})();
