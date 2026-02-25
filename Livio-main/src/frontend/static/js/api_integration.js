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
        const params = new URLSearchParams();
        const response = await fetch(`/apartments/api/apartments/?${params.toString()}`);

        if (!response.ok) {
            throw new Error('Failed to load apartments');
        }

        apartments = await response.json();

        if (isUserLoggedIn()) {
            await checkFavoriteStatus();
        }

        renderApartments();

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

    container.querySelectorAll('.listing-item').forEach(card => card.remove());

    if (apartments.length === 0) {
        document.getElementById('noResults').style.display = 'block';
        return;
    }

    document.getElementById('noResults').style.display = 'none';

    apartments.forEach(apartment => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper listing-item';
        wrapper.setAttribute('data-apartment-id', apartment.id);
        wrapper.setAttribute('data-price', apartment.monthly_rent);
        wrapper.setAttribute('data-roomtype', apartment.room_type);
        wrapper.setAttribute('data-bedrooms', apartment.bedrooms);
        wrapper.setAttribute('data-bathrooms', apartment.bathrooms);
        wrapper.setAttribute('data-amenities', apartment.amenities || '');

        // Build card safely to avoid XSS – user-supplied strings are set via
        // textContent or LivioUtils.escapeHtml rather than raw interpolation.
        wrapper.innerHTML = createApartmentCard(apartment);
        container.insertBefore(wrapper, document.getElementById('noResults'));
        attachEventsToCard(wrapper);
    });
}

/* ===========================================================
   3. CREATE APARTMENT CARD HTML
   =========================================================== */

function createApartmentCard(apartment) {
    const isFavorited = favoritedApartments.has(apartment.id);
    const heartIcon   = isFavorited ? '❤️' : '🤍';
    const favoriteClass = isFavorited ? 'favorited' : '';

    // Format display values – use LivioUtils.escapeHtml on user-supplied data
    const e            = LivioUtils.escapeHtml;
    const bedsDisplay  = formatBedrooms(apartment.bedrooms);
    const bathsDisplay = formatBathrooms(apartment.bathrooms);
    const typeDisplay  = e(apartment.room_type.charAt(0).toUpperCase() + apartment.room_type.slice(1));
    const amenitiesDisplay = formatAmenities(apartment.amenities_list || []);
    const ownerName    = e(apartment.owner_info?.username || 'Anonymous');
    const location     = e(apartment.location);
    const title        = e(apartment.title);
    const description  = e(apartment.description);
    const availableFrom = e(apartment.available_from || 'Now');
    const price        = Number(apartment.monthly_rent).toLocaleString();
    // Use the real S3 image if available, otherwise fall back to a generic placeholder
    const mainImageSrc = apartment.image_url ||
        `https://randomuser.me/api/portraits/lego/${apartment.id % 8 + 1}.jpg`;

    return `
        <div class="card ${favoriteClass}" tabindex="0">
            <button class="favorite-btn ${favoriteClass}"
                    onclick="toggleFavorite(${apartment.id}); event.stopPropagation();"
                    aria-label="Favorite this apartment"
                    style="position:absolute;top:15px;right:15px;z-index:10;background:rgba(255,255,255,0.9);border:2px solid rgba(0,0,0,0.1);border-radius:50%;width:50px;height:50px;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                <span class="heart-icon" style="font-size:24px;">${heartIcon}</span>
            </button>

            <div class="card-front">
                <div class="image-gallery">
                    <img src="${mainImageSrc}"
                         class="apartment-image active" alt="${title}"
                         onerror="this.src='https://randomuser.me/api/portraits/lego/${apartment.id % 8 + 1}.jpg'" />
                    <div class="image-dots"><span class="dot active"></span></div>
                </div>
                <div class="details">
                    <div class="user-info">
                        <img src="https://randomuser.me/api/portraits/lego/${apartment.id % 8 + 1}.jpg"
                             class="user-pic" alt="${ownerName}" />
                        <span class="username">${ownerName}</span>
                    </div>
                    <div class="apartment-details">
                        <p><strong>Location:</strong> ${location}</p>
                        <p><strong>Apartment:</strong> ${bedsDisplay}, ${bathsDisplay} | ${typeDisplay}</p>
                        <p><strong>Rent:</strong> <span class="price">$${price}</span></p>
                        <p><strong>Amenities:</strong> ${amenitiesDisplay}</p>
                    </div>
                    <button class="choose-button">View Details</button>
                </div>
            </div>

            <div class="card-back">
                <h2>About this listing</h2>
                <p>${description}</p>
                <h3>Details</h3>
                <ul>
                    <li>${bedsDisplay} / ${bathsDisplay}</li>
                    <li>${amenitiesDisplay}</li>
                    <li>Available: ${availableFrom}</li>
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
                'X-CSRFToken': LivioUtils.getCsrfToken(),
                'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
            },
            body: JSON.stringify({ apartment_id: apartmentId })
        });

        if (!response.ok) throw new Error('Failed to toggle favorite');

        const data = await response.json();

        if (data.is_favorited) {
            favoritedApartments.add(apartmentId);
        } else {
            favoritedApartments.delete(apartmentId);
        }

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
                'X-CSRFToken': LivioUtils.getCsrfToken(),
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
    const heartIcon   = favoriteBtn?.querySelector('.heart-icon');
    const card        = wrapper.querySelector('.card');

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
                'X-CSRFToken': LivioUtils.getCsrfToken(),
            },
            body: JSON.stringify(apartmentData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            throw new Error('Failed to create apartment');
        }

        const newApartment = await response.json();
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

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message; // textContent prevents injection
    notification.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: ${type === 'error' ? 'rgba(255,0,0,0.9)' : type === 'warning' ? 'rgba(255,165,0,0.9)' : 'rgba(0,0,0,0.9)'};
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

/**
 * Format raw API bedroom string (e.g. '2bed') to a display label.
 * Note: this operates on the RAW API format, not the normalized integer
 * used by the map-page modules.  Use LivioUtils.formatBedLabel(n) for
 * normalized (integer) bedroom values.
 */
function formatBedrooms(bedrooms) {
    const map = { '1bed': '1 Bedroom', '2bed': '2 Bedrooms', '3bed': '3 Bedrooms', '4bed': '4+ Bedrooms' };
    return map[bedrooms] || bedrooms;
}

/** Format raw API bathroom string (e.g. '2bath') to a display label. */
function formatBathrooms(bathrooms) {
    const map = { '1bath': '1 Bathroom', '2bath': '2 Bathrooms', '3bath': '3+ Bathrooms' };
    return map[bathrooms] || bathrooms;
}

function formatAmenities(amenitiesList) {
    if (!amenitiesList || amenitiesList.length === 0) return 'None';
    return amenitiesList.map(a => LivioUtils.escapeHtml(a.charAt(0).toUpperCase() + a.slice(1))).join(', ');
}

/* ===========================================================
   7. INTEGRATE WITH EXISTING FORM SUBMIT
   =========================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const addPostForm = document.getElementById('addPostForm');
    if (addPostForm) {
        const newForm = addPostForm.cloneNode(true);
        addPostForm.parentNode.replaceChild(newForm, addPostForm);

        newForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const apartmentData = {
                title:        document.getElementById('postLocation')?.value || 'Apartment Listing',
                description:  document.getElementById('postDesc')?.value || 'No description provided',
                location:     document.getElementById('postLocation')?.value,
                city:         'Los Angeles',
                state:        'CA',
                monthly_rent: document.getElementById('postPrice')?.value,
                bedrooms:     document.getElementById('postBeds')?.value,
                bathrooms:    document.getElementById('postBaths')?.value,
                room_type:    document.getElementById('postType')?.value,
                image_url:    document.getElementById('postImage')?.value || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267',
                amenities:    Array.from(document.getElementById('postAmenities')?.selectedOptions || [])
                                   .map(opt => opt.value).join(','),
            };

            try {
                await createApartmentAPI(apartmentData);
                document.getElementById('addPostModal')?.classList.remove('active');
                newForm.reset();
            } catch (error) {
                // Error already surfaced by createApartmentAPI
            }
        });
    }

    loadApartmentsFromAPI();
});

// CSS animations injected once at load time
const _apiIntegrationStyle = document.createElement('style');
_apiIntegrationStyle.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0);    opacity: 1; }
        to   { transform: translateX(100%); opacity: 0; }
    }
    .favorite-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(0,0,0,0.3);
    }
    .favorite-btn.favorited {
        background: rgba(255,100,100,0.2) !important;
        border-color: #ff6b6b !important;
    }
    .card.favorited {
        border-color: rgba(255,107,107,0.5) !important;
    }
`;
document.head.appendChild(_apiIntegrationStyle);
