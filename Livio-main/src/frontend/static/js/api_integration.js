// Livio Apartments - Django API Integration
// Date: November 25, 2025
// Integrates with existing apartment_script.js

/* ===========================================================
   GLOBAL STATE
   =========================================================== */
let apartments = []; // Will load from Django API
let favoritedApartments = new Set();

/* ===========================================================
   1. LOAD APARTMENTS FROM DJANGO API
   =========================================================== */

async function loadApartmentsFromAPI() {
    try {
        // Build query string from current filters
        const params = new URLSearchParams();
        
        // Add filters if implemented
        // const location = document.getElementById('locationFilter')?.value;
        // if (location) params.append('location', location);
        
        const response = await fetch(`/apartments/api/apartments/?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error('Failed to load apartments');
        }
        
        apartments = await response.json();
        
        // Check which are favorited
        if (isUserLoggedIn()) {
            await checkFavoriteStatus();
        }
        
        // Render apartments
        renderApartments();
        
        // Update map markers (if map exists)
        if (window.updateMapMarkers) {
            updateMapMarkers();
        }
        
    } catch (error) {
        console.error('Error loading apartments:', error);
        showNotification('Error loading apartments', 'error');
    }
}

/* ===========================================================
   2. RENDER APARTMENTS TO DOM
   =========================================================== */

function renderApartments() {
    const container = document.getElementById('listingsContainer');
    if (!container) return;
    
    // Clear existing apartments (except no results message)
    const existingCards = container.querySelectorAll('.listing-item');
    existingCards.forEach(card => card.remove());
    
    if (apartments.length === 0) {
        document.getElementById('noResults').style.display = 'block';
        return;
    }
    
    document.getElementById('noResults').style.display = 'none';
    
    apartments.forEach(apartment => {
        const cardHTML = createApartmentCard(apartment);
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper listing-item';
        wrapper.setAttribute('data-apartment-id', apartment.id);
        wrapper.setAttribute('data-price', apartment.monthly_rent);
        wrapper.setAttribute('data-roomtype', apartment.room_type);
        wrapper.setAttribute('data-bedrooms', apartment.bedrooms);
        wrapper.setAttribute('data-bathrooms', apartment.bathrooms);
        wrapper.setAttribute('data-amenities', apartment.amenities || '');
        wrapper.innerHTML = cardHTML;
        
        // Insert before "no results" message
        container.insertBefore(wrapper, document.getElementById('noResults'));
        
        // Attach events
        attachEventsToCard(wrapper);
    });
}

/* ===========================================================
   3. CREATE APARTMENT CARD HTML
   =========================================================== */

function createApartmentCard(apartment) {
    const isFavorited = favoritedApartments.has(apartment.id);
    const heartIcon = isFavorited ? '❤️' : '🤍';
    const favoriteClass = isFavorited ? 'favorited' : '';
    
    // Format display values
    const bedsDisplay = formatBedrooms(apartment.bedrooms);
    const bathsDisplay = formatBathrooms(apartment.bathrooms);
    const typeDisplay = apartment.room_type.charAt(0).toUpperCase() + apartment.room_type.slice(1);
    const amenitiesDisplay = formatAmenities(apartment.amenities_list || []);
    const ownerName = apartment.owner_info?.username || 'Anonymous';
    
    return `
        <div class="card ${favoriteClass}" tabindex="0">
            <!-- FAVORITE BUTTON -->
            <button class="favorite-btn ${favoriteClass}" 
                    onclick="toggleFavorite(${apartment.id}); event.stopPropagation();"
                    aria-label="Favorite this apartment"
                    style="position: absolute; top: 15px; right: 15px; z-index: 10; background: rgba(255,255,255,0.9); border: 2px solid rgba(0,0,0,0.1); border-radius: 50%; width: 50px; height: 50px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <span class="heart-icon" style="font-size: 24px;">${heartIcon}</span>
            </button>
            
            <div class="card-front">
                <div class="image-gallery">
                    <img src="${apartment.image_url}" alt="${apartment.title}" class="apartment-image active" />
                    <div class="image-dots">
                        <span class="dot active"></span>
                    </div>
                </div>
                <div class="details">
                    <div class="user-info">
                        <img src="https://randomuser.me/api/portraits/lego/${apartment.id % 8 + 1}.jpg" class="user-pic" alt="${ownerName}" />
                        <span class="username">${ownerName}</span>
                    </div>
                    <div class="apartment-details">
                        <p><strong>Location:</strong> ${apartment.location}</p>
                        <p><strong>Apartment:</strong> ${bedsDisplay}, ${bathsDisplay} | ${typeDisplay}</p>
                        <p><strong>Rent:</strong> <span class="price">$${Number(apartment.monthly_rent).toLocaleString()}</span></p>
                        <p><strong>Amenities:</strong> ${amenitiesDisplay}</p>
                    </div>
                    <button class="choose-button">View Details</button>
                </div>
            </div>
            <div class="card-back">
                <h2>About this listing</h2>
                <p>${apartment.description}</p>
                <h3>Details</h3>
                <ul>
                    <li>${bedsDisplay} / ${bathsDisplay}</li>
                    <li>${amenitiesDisplay}</li>
                    <li>Available: ${apartment.available_from || 'Now'}</li>
                </ul>
            </div>
        </div>
    `;
}

/* ===========================================================
   4. FAVORITES FUNCTIONALITY
   =========================================================== */

async function toggleFavorite(apartmentId) {
    if (!isUserLoggedIn()) {
        window.location.href = '/login/?next=' + encodeURIComponent(window.location.pathname);
        return;
    }

    try {
        const response = await fetch('/apartments/api/favorites/toggle/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
                'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
            },
            body: JSON.stringify({ apartment_id: apartmentId })
        });
        
        if (!response.ok) {
            throw new Error('Failed to toggle favorite');
        }
        
        const data = await response.json();
        
        // Update local state
        if (data.is_favorited) {
            favoritedApartments.add(apartmentId);
        } else {
            favoritedApartments.delete(apartmentId);
        }
        
        // Update UI
        updateFavoriteButton(apartmentId, data.is_favorited);
        showNotification(data.message, 'success');
        
    } catch (error) {
        console.error('Error toggling favorite:', error);
        showNotification('Error saving favorite', 'error');
    }
}

async function checkFavoriteStatus() {
    if (!isUserLoggedIn()) return;
    
    try {
        const apartmentIds = apartments.map(apt => apt.id);
        
        const response = await fetch('/apartments/api/favorites/check/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ apartment_ids: apartmentIds })
        });
        
        if (!response.ok) return;
        
        const favoriteStatus = await response.json();
        
        favoritedApartments = new Set(
            Object.keys(favoriteStatus)
                .filter(id => favoriteStatus[id])
                .map(id => parseInt(id))
        );
        
    } catch (error) {
        console.log('Error checking favorites:', error);
    }
}

function updateFavoriteButton(apartmentId, isFavorited) {
    const wrapper = document.querySelector(`.listing-item[data-apartment-id="${apartmentId}"]`);
    if (!wrapper) return;
    
    const favoriteBtn = wrapper.querySelector('.favorite-btn');
    const heartIcon = favoriteBtn?.querySelector('.heart-icon');
    const card = wrapper.querySelector('.card');
    
    if (favoriteBtn && heartIcon) {
        if (isFavorited) {
            favoriteBtn.classList.add('favorited');
            heartIcon.textContent = '❤️';
            card?.classList.add('favorited');
        } else {
            favoriteBtn.classList.remove('favorited');
            heartIcon.textContent = '🤍';
            card?.classList.remove('favorited');
        }
    }
}

/* ===========================================================
   5. CREATE NEW APARTMENT (SAVE TO DJANGO)
   =========================================================== */

async function createApartmentAPI(apartmentData) {
    if (!isUserLoggedIn()) {
        showNotification('Please log in to create listings', 'warning');
        window.location.href = '/login/?next=' + encodeURIComponent(window.location.pathname);
        return;
    }
    
    try {
        const response = await fetch('/apartments/api/apartments/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(apartmentData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            throw new Error('Failed to create apartment');
        }
        
        const newApartment = await response.json();
        
        // Reload apartments to include new one
        await loadApartmentsFromAPI();
        
        showNotification('Apartment posted successfully!', 'success');
        
        return newApartment;
        
    } catch (error) {
        console.error('Error creating apartment:', error);
        showNotification('Error creating apartment', 'error');
        throw error;
    }
}

/* ===========================================================
   6. UTILITY FUNCTIONS
   =========================================================== */

function isUserLoggedIn() {
    return !!localStorage.getItem('access_token');
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: ${type === 'error' ? 'rgba(255, 0, 0, 0.9)' : type === 'warning' ? 'rgba(255, 165, 0, 0.9)' : 'rgba(0, 0, 0, 0.9)'};
        color: white;
        padding: 15px 25px;
        border-radius: 12px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 8px 20px rgba(0,0,0,0.4);
        font-weight: 600;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function formatBedrooms(bedrooms) {
    const map = {
        '1bed': '1 Bedroom',
        '2bed': '2 Bedrooms',
        '3bed': '3 Bedrooms',
        '4bed': '4+ Bedrooms'
    };
    return map[bedrooms] || bedrooms;
}

function formatBathrooms(bathrooms) {
    const map = {
        '1bath': '1 Bathroom',
        '2bath': '2 Bathrooms',
        '3bath': '3+ Bathrooms'
    };
    return map[bathrooms] || bathrooms;
}

function formatAmenities(amenitiesList) {
    if (!amenitiesList || amenitiesList.length === 0) return 'None';
    return amenitiesList.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ');
}

/* ===========================================================
   7. INTEGRATE WITH EXISTING FORM SUBMIT
   =========================================================== */

// Override the existing form submit to save to Django
document.addEventListener('DOMContentLoaded', () => {
    const addPostForm = document.getElementById('addPostForm');
    if (addPostForm) {
        // Remove old listener and add new one
        const newForm = addPostForm.cloneNode(true);
        addPostForm.parentNode.replaceChild(newForm, addPostForm);
        
        newForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get form values
            const apartmentData = {
                title: document.getElementById('postLocation')?.value || 'Apartment Listing',
                description: document.getElementById('postDesc')?.value || 'No description provided',
                location: document.getElementById('postLocation')?.value,
                city: 'Los Angeles', // Default, can add form field
                state: 'CA',
                monthly_rent: document.getElementById('postPrice')?.value,
                bedrooms: document.getElementById('postBeds')?.value,
                bathrooms: document.getElementById('postBaths')?.value,
                room_type: document.getElementById('postType')?.value,
                image_url: document.getElementById('postImage')?.value || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267',
                amenities: Array.from(document.getElementById('postAmenities')?.selectedOptions || [])
                    .map(opt => opt.value)
                    .join(',')
            };
            
            try {
                await createApartmentAPI(apartmentData);
                
                // Close modal
                document.getElementById('addPostModal')?.classList.remove('active');
                
                // Reset form
                newForm.reset();
                
            } catch (error) {
                // Error already handled in createApartmentAPI
            }
        });
    }
    
    // Load apartments on page load
    loadApartmentsFromAPI();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .favorite-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(0,0,0,0.3);
    }
    
    .favorite-btn.favorited {
        background: rgba(255, 100, 100, 0.2) !important;
        border-color: #ff6b6b !important;
    }
    
    .card.favorited {
        border-color: rgba(255, 107, 107, 0.5) !important;
    }
`;
document.head.appendChild(style);
