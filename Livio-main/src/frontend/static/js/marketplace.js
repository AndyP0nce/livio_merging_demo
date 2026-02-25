/* =================================================================
   MARKETPLACE PAGE - JAVASCRIPT
   Updated to work with new mk- prefixed HTML/CSS structure
   ================================================================= */

const items = [
  // IMPORTANT: All starting items now include the 'category' property.
  { id: 1, title: "240", name: "Vintage Desk Lamp", description: "Classic brass lamp, fully functional. Needs new bulb. Great for late-night studying.", condition: "Used - Good", category: "Home & Garden", img: "/static/images/marketplace_images/image (5).png"  },
  { id: 2, title: "250", name: "Leather Sofa", description: "Three-seater leather sofa, great condition, smoke-free home. Comfortable and spacious for movie nights.", condition: "Used - Good", category: "Home & Garden", img: "/static/images/marketplace_images/image (4).png"  },
  { id: 3, title: "170", name: "Mini Fridge", description: "Compact refrigerator, perfect for dorms or garages. Works great and holds beverages/snacks.", condition: "Used - Good", category: "Electronics & Media", img: src="/static/images/marketplace_images/image (3).png" },
  { id: 4, title: "300", name: "Noise-Cancelling Headphones", description: "Brand new, sealed in box. Excellent sound quality with active noise cancellation, perfect for focus.", condition: "New", category: "Electronics & Media", img: src="/static/images/marketplace_images/image (2).png" },
  { id: 5, title: "220", name: "Mountain Bike (Mens)", description: "Used mountain bike, needs new tires and a quick tune-up. Frame is solid, ready for trails or commute.", condition: "Used - Fair", category: "Sports & Outdoors", img: src="/static/images/marketplace_images/image (1).png"  },
  { id: 6, title: "190", name: "Textbook Bundle", description: "Used psychology and sociology textbooks from Fall semester. Pages are highlighted, but notes are helpful.", condition: "Used - Good", category: "Collectibles & Art", img: src= "/static/images/marketplace_images/image.png" },
];

// --- DOM Element Selection (Updated for new structure) ---
const itemGrid = document.getElementById("mkGrid");
const addItemModal = document.getElementById("mkModal");
const itemDetailModal = document.getElementById("mkDetailModal");
const addItemForm = document.getElementById("mkForm");

// Filter Elements
const categoryCheckboxes = document.querySelectorAll('#categoryFilter input[type="checkbox"]');
const conditionCheckboxes = document.querySelectorAll('#conditionFilter input[type="checkbox"]');
const minPriceInput = document.getElementById('minPrice');
const maxPriceInput = document.getElementById('maxPrice');
const searchInput = document.getElementById('mkSearchInput');
const searchBtn = document.querySelector('.mk-search-btn');
const sortSelect = document.getElementById('mkSort');

// Image upload state
let selectedImageFile = null;


// =================================================================
// DROPDOWN TOGGLE FUNCTIONS
// =================================================================

/**
 * Toggles a dropdown menu open/closed
 * @param {string} dropdownId - The ID of the dropdown element
 */
function toggleMkDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    const content = dropdown.querySelector('.mk-dropdown-content');
    const isOpen = content.classList.contains('show');
    
    // Close all other dropdowns first
    document.querySelectorAll('.mk-dropdown-content.show').forEach(d => {
        d.classList.remove('show');
        d.closest('.mk-dropdown').classList.remove('active');
    });
    
    // Toggle current dropdown
    if (!isOpen) {
        content.classList.add('show');
        dropdown.classList.add('active');
    }
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.mk-dropdown')) {
        document.querySelectorAll('.mk-dropdown-content.show').forEach(d => {
            d.classList.remove('show');
            d.closest('.mk-dropdown').classList.remove('active');
        });
    }
});


// =================================================================
// MODAL HANDLERS: Add Item
// =================================================================

/**
 * Opens the "Post New Listing" modal.
 */
function openMkModal() {
    addItemModal.classList.add('active');
    document.body.classList.add('mk-modal-open');
}

/**
 * Closes the "Post New Listing" modal.
 */
function closeMkModal() {
    addItemModal.classList.remove('active');
    document.body.classList.remove('mk-modal-open');
    
    // Reset form and image
    addItemForm.reset();
    removeMkImage();
}


// =================================================================
// MODAL HANDLERS: Item Details
// =================================================================

/**
 * Opens the item detail modal and populates it with data for the given item ID.
 * @param {number} itemId - The unique ID of the item to display.
 */
function openMkDetailModal(itemId) {
    // Find the item by its ID
    const item = items.find(i => i.id === itemId);

    if (!item) {
        console.error("Item not found for ID:", itemId);
        return;
    }

    // Populate the modal content with all required details
    document.getElementById('detailImg').src = item.img;
    document.getElementById('detailTitle').textContent = item.name;
    document.getElementById('detailPrice').textContent = parseFloat(item.title) ? `$${parseFloat(item.title).toFixed(2)}` : 'Contact for Price';
    document.getElementById('detailCondition').textContent = item.condition;
    document.getElementById('detailCategory').textContent = item.category;
    document.getElementById('detailDescription').textContent = item.description;

    // Show the modal
    itemDetailModal.classList.add('active');
    document.body.classList.add('mk-modal-open');
}

/**
 * Closes the "View Details" modal.
 */
function closeMkDetailModal() {
    itemDetailModal.classList.remove('active');
    document.body.classList.remove('mk-modal-open');
}


// =================================================================
// IMAGE UPLOAD HANDLING
// =================================================================

/**
 * Sets up the drag & drop zone for image uploads
 */
function setupDropzone() {
    const dropzone = document.getElementById('mkDropzone');
    const fileInput = document.getElementById('itemPicture');
    
    if (!dropzone || !fileInput) return;
    
    // Drag enter/over events
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
    });
    
    // Drag leave/drop events
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });
    });
    
    // Handle dropped files
    dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });
    
    // Handle file input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
}

/**
 * Handles the selected image file
 * @param {File} file - The selected image file
 */
function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) {
        console.error('Please select an image file');
        return;
    }
    
    selectedImageFile = file;
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const preview = document.getElementById('mkPreviewImg');
        const dropzone = document.getElementById('mkDropzone');
        
        preview.src = e.target.result;
        dropzone.classList.add('has-preview');
    };
    
    reader.readAsDataURL(file);
}

/**
 * Removes the selected image and resets the dropzone
 */
function removeMkImage() {
    selectedImageFile = null;
    const dropzone = document.getElementById('mkDropzone');
    const fileInput = document.getElementById('itemPicture');
    const preview = document.getElementById('mkPreviewImg');
    
    if (dropzone) dropzone.classList.remove('has-preview');
    if (fileInput) fileInput.value = '';
    if (preview) preview.src = '';
}


// =================================================================
// FILTERING LOGIC
// =================================================================

/**
 * Reads all filter inputs and returns the filtered array of items.
 */
function applyFilters() {
    let filteredItems = [...items];

    // 1. Category Filter Logic
    const selectedCategories = Array.from(categoryCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.filter);
        
    if (selectedCategories.length > 0) {
        filteredItems = filteredItems.filter(item => selectedCategories.includes(item.category));
    }
    
    // 2. Condition Filter Logic
    const selectedConditions = Array.from(conditionCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.filter);
        
    if (selectedConditions.length > 0) {
        filteredItems = filteredItems.filter(item => selectedConditions.includes(item.condition));
    }

    // 3. Price Filter Logic
    const minPrice = parseFloat(minPriceInput?.value);
    const maxPrice = parseFloat(maxPriceInput?.value);
    
    if (!isNaN(minPrice) || !isNaN(maxPrice)) {
        filteredItems = filteredItems.filter(item => {
            const itemPrice = parseFloat(item.title);

            if (isNaN(itemPrice) || itemPrice <= 0) {
                return true; 
            }

            const passesMin = isNaN(minPrice) || itemPrice >= minPrice;
            const passesMax = isNaN(maxPrice) || itemPrice <= maxPrice;

            return passesMin && passesMax;
        });
    }

    // 4. Search Logic
    const searchTerm = searchInput?.value.toLowerCase().trim() || '';
    if (searchTerm) {
        filteredItems = filteredItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm) || 
            item.description.toLowerCase().includes(searchTerm)
        );
    }

    // 5. Sorting
    const sortOrder = sortSelect?.value || 'recent';
    switch (sortOrder) {
        case 'priceLow':
            filteredItems.sort((a, b) => (parseFloat(a.title) || 0) - (parseFloat(b.title) || 0));
            break;
        case 'priceHigh':
            filteredItems.sort((a, b) => (parseFloat(b.title) || 0) - (parseFloat(a.title) || 0));
            break;
        case 'recent':
        default:
            filteredItems.sort((a, b) => b.id - a.id);
            break;
    }

    return filteredItems;
}

/**
 * Clears all filters and resets the marketplace
 */
function clearMkFilters() {
    // Clear category checkboxes
    categoryCheckboxes.forEach(cb => cb.checked = false);
    
    // Clear condition checkboxes
    conditionCheckboxes.forEach(cb => cb.checked = false);
    
    // Clear price inputs
    if (minPriceInput) minPriceInput.value = '';
    if (maxPriceInput) maxPriceInput.value = '';
    
    // Clear search
    if (searchInput) searchInput.value = '';
    
    // Reset sort
    if (sortSelect) sortSelect.value = 'recent';
    
    // Re-render
    updateMarketplace();
}


// =================================================================
// RENDERING LOGIC
// =================================================================

/**
 * Renders the given array of items to the grid.
 * @param {Array} itemsToRender - The array of items to display.
 */
function renderItems(itemsToRender) {
    itemGrid.innerHTML = '';
    
    if (itemsToRender.length === 0) {
        itemGrid.innerHTML = `
            <div class="mk-no-results">
                <i class="fa-solid fa-box-open"></i>
                <p>No items match your current filters</p>
            </div>
        `;
        return;
    }
    
    itemsToRender.forEach(item => {
        const displayName = item.name || `Item (ID: ${item.id})`;
        const priceValue = parseFloat(item.title) ? `$${parseFloat(item.title).toFixed(2)}` : 'Contact for Price';

        const card = document.createElement("div");
        card.classList.add("mk-card");
        card.setAttribute('onclick', `openMkDetailModal(${item.id})`);
        
        card.innerHTML = `
            <img class="mk-card-image" src="${item.img}" alt="${displayName}" 
                 onerror="this.src='https://placehold.co/400x300/222/666?text=No+Image'">
            <div class="mk-card-body">
                <h4 class="mk-card-title">${displayName}</h4>
                <p class="mk-card-price">${priceValue}</p>
                <div class="mk-card-tags">
                    <span class="mk-tag">${item.category}</span>
                    <span class="mk-tag">${item.condition}</span>
                </div>
                <div class="mk-card-footer">
                    <button class="mk-card-btn secondary" onclick="event.stopPropagation(); openMkDetailModal(${item.id})">Details</button>
                    <button class="mk-card-btn primary" onclick="event.stopPropagation()">Offer</button>
                </div>
            </div>
        `;
        
        itemGrid.appendChild(card);
    });
}

/**
 * Main function to apply filters and update the displayed items.
 */
function updateMarketplace() {
    const itemsToDisplay = applyFilters();
    renderItems(itemsToDisplay);
}


// =================================================================
// FORM SUBMISSION
// =================================================================

/**
 * Handles the form submission for a new item listing.
 * @param {Event} e - The form submission event.
 */
function handleAddItemSubmission(e) {
    e.preventDefault();
    
    // 1. Collect Form Data
    const name = document.getElementById('itemTitle').value.trim(); 
    const category = document.getElementById('itemCategory').value; 
    const price = document.getElementById('itemPrice').value;
    const condition = document.getElementById('itemCondition').value;
    const description = document.getElementById('itemDescription').value.trim();

    // Simple validation
    if (!name || !category || !price || !condition || !description) { 
        alert('Please fill in all required fields.');
        return;
    }

    // 2. Determine the image URL
    let imageUrl = 'https://placehold.co/400x300/1e204a/fff?text=NEW+LISTING';
    
    if (selectedImageFile) {
        imageUrl = URL.createObjectURL(selectedImageFile); 
    }

    // 3. Create the new item object with a unique ID
    const newItem = {
        id: Date.now(),
        title: price,   
        name: name,     
        condition: condition,
        category: category, 
        img: imageUrl,  
        description: description 
    };
    
    // 4. Add the new item to the local array (at the beginning)
    items.unshift(newItem); 

    console.log(`Successfully added new listing: ${name} in category: ${category}`);

    // 5. Update the UI
    updateMarketplace();
    
    // 6. Close modal (this also resets form)
    closeMkModal();
}


// =================================================================
// EVENT LISTENERS
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Setup image dropzone
    setupDropzone();
    
    // Form submission
    if (addItemForm) {
        addItemForm.addEventListener('submit', handleAddItemSubmission);
    }
    
    // Search functionality
    if (searchInput) {
        // Search on Enter key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                updateMarketplace();
            }
        });
        
        // Real-time search with debounce
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(updateMarketplace, 300);
        });
    }
    
    if (searchBtn) {
        searchBtn.addEventListener('click', updateMarketplace);
    }
    
    // Sort change
    if (sortSelect) {
        sortSelect.addEventListener('change', updateMarketplace);
    }
    
    // Filter checkboxes - real-time filtering
    categoryCheckboxes.forEach(cb => {
        cb.addEventListener('change', updateMarketplace);
    });
    
    conditionCheckboxes.forEach(cb => {
        cb.addEventListener('change', updateMarketplace);
    });
    
    // Price inputs with debounce
    [minPriceInput, maxPriceInput].forEach(input => {
        if (input) {
            let priceTimeout;
            input.addEventListener('input', () => {
                clearTimeout(priceTimeout);
                priceTimeout = setTimeout(updateMarketplace, 500);
            });
        }
    });
    
    // Initial render
    updateMarketplace();
});

// Keyboard support - close modals with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (addItemModal?.classList.contains('active')) {
            closeMkModal();
        } else if (itemDetailModal?.classList.contains('active')) {
            closeMkDetailModal();
        }
    }
});