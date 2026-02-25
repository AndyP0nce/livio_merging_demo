// Edited by Andrew Ponce on 10/12/2025

document.addEventListener('DOMContentLoaded', () => {
    
    /* ---------------------------------------------------------
       1. DROPDOWN LOGIC
       --------------------------------------------------------- */
    window.toggleDropdown = function(id) {
        document.querySelectorAll('.dropdown-content').forEach(content => {
            if (content.parentElement.id !== id) {
                content.classList.remove('show');
                content.parentElement.classList.remove('active');
            }
        });
        const dropdown = document.getElementById(id);
        const content = dropdown.querySelector('.dropdown-content');
        content.classList.toggle('show');
        dropdown.classList.toggle('active');
    };

    window.onclick = function(event) {
        if (!event.target.matches('.dropdown-btn') && !event.target.closest('.dropdown-content')) {
            document.querySelectorAll('.dropdown-content').forEach(content => {
                content.classList.remove('show');
                content.parentElement.classList.remove('active');
            });
        }
    };

    /* ---------------------------------------------------------
       2. FILTERING LOGIC
       --------------------------------------------------------- */
    const checkboxes = document.querySelectorAll('.filter-bar input[type="checkbox"]');
    const noResultsMsg = document.getElementById('noResults');

    function filterListings() {
        // Query DOM again to include newly added items
        const currentListingItems = document.querySelectorAll('.listing-item');
        
        const checkedFilters = {
            price: Array.from(document.querySelectorAll('input[name="price"]:checked')).map(cb => cb.value),
            roomType: Array.from(document.querySelectorAll('input[name="roomType"]:checked')).map(cb => cb.value),
            amenities: Array.from(document.querySelectorAll('input[name="amenities"]:checked')).map(cb => cb.value),
            bedrooms: Array.from(document.querySelectorAll('input[name="bedrooms"]:checked')).map(cb => cb.value),
            bathrooms: Array.from(document.querySelectorAll('input[name="bathrooms"]:checked')).map(cb => cb.value)
        };

        let visibleCount = 0;

        currentListingItems.forEach(item => {
            const price = parseInt(item.dataset.price);
            const type = item.dataset.roomtype;
            const beds = item.dataset.bedrooms;
            const baths = item.dataset.bathrooms;
            const amenities = item.dataset.amenities.split(' ');

            let isMatch = true;

            // 1. Price
            if (checkedFilters.price.length > 0) {
                const priceMatch = checkedFilters.price.some(range => {
                    if (range === 'under800') return price < 800;
                    if (range === '800to1200') return price >= 800 && price <= 1200;
                    if (range === '1200to1600') return price >= 1200 && price <= 1600;
                    if (range === '1600to2000') return price >= 1600 && price <= 2000;
                    if (range === 'over2000') return price > 2000;
                    return false;
                });
                if (!priceMatch) isMatch = false;
            }

            // 2. Room Type
            if (isMatch && checkedFilters.roomType.length > 0) {
                if (!checkedFilters.roomType.includes(type)) isMatch = false;
            }

            // 3. Amenities (AND logic)
            if (isMatch && checkedFilters.amenities.length > 0) {
                const hasAllAmenities = checkedFilters.amenities.every(a => amenities.includes(a));
                if (!hasAllAmenities) isMatch = false;
            }

            // 4. Bedrooms
            if (isMatch && checkedFilters.bedrooms.length > 0) {
                if (!checkedFilters.bedrooms.includes(beds)) isMatch = false;
            }

            // 5. Bathrooms
            if (isMatch && checkedFilters.bathrooms.length > 0) {
                if (!checkedFilters.bathrooms.includes(baths)) isMatch = false;
            }

            if (isMatch) {
                item.style.display = 'block';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });

        noResultsMsg.style.display = visibleCount === 0 ? 'block' : 'none';
    }

    checkboxes.forEach(cb => cb.addEventListener('change', filterListings));
    window.clearAllFilters = function() {
        checkboxes.forEach(cb => cb.checked = false);
        filterListings();
    };

    /* ---------------------------------------------------------
       3. ADD POSTING LOGIC (NEW)
       --------------------------------------------------------- */
    const addPostModal = document.getElementById('addPostModal');
    
    // Open Modal
    window.addPosting = function() {
        addPostModal.classList.add('active');
    };

    // Close Modal
    window.closeAddPostModal = function() {
        addPostModal.classList.remove('active');
    };

    // Handle Form Submit
    document.getElementById('addPostForm').addEventListener('submit', function(e) {
        e.preventDefault();

        // Get Values
        const imgUrl = document.getElementById('postImage').value || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'; 
        const location = document.getElementById('postLocation').value;
        const price = document.getElementById('postPrice').value;
        const beds = document.getElementById('postBeds').value;
        const baths = document.getElementById('postBaths').value;
        const type = document.getElementById('postType').value;
        const desc = document.getElementById('postDesc').value;
        
        // Get Amenities
        const selectedAmenities = Array.from(document.getElementById('postAmenities').selectedOptions).map(opt => opt.value);
        const amenitiesString = selectedAmenities.join(' '); 
        const amenitiesDisplay = selectedAmenities.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ');

        const bedDisplay = beds === '3bed' ? '3 Bed' : beds.replace('bed', ' Bed');
        const bathDisplay = baths === '2bath' ? '2 Bath' : '1 Bath';
        const typeDisplay = type.charAt(0).toUpperCase() + type.slice(1);

        // CREATE HTML STRUCTURE
        const newCardHTML = `
            <div class="card" tabindex="0">
                <div class="card-front">
                    <div class="image-gallery">
                        <img src="${imgUrl}" alt="Apartment" class="apartment-image active" />
                        <div class="image-dots">
                            <span class="dot active"></span>
                        </div>
                    </div>
                    <div class="details">
                        <div class="user-info">
                            <img src="https://randomuser.me/api/portraits/lego/1.jpg" class="user-pic" alt="User" />
                            <span class="username">You</span>
                        </div>
                        <div class="apartment-details">
                            <p><strong>Location:</strong> ${location}</p>
                            <p><strong>Apartment:</strong> ${bedDisplay}, ${bathDisplay} | ${typeDisplay}</p>
                            <p><strong>Rent:</strong> <span class="price">$${Number(price).toLocaleString()}</span></p>
                            <p><strong>Amenities:</strong> ${amenitiesDisplay || 'None'}</p>
                        </div>
                        <button class="choose-button">View Details</button>
                    </div>
                </div>
                <div class="card-back">
                    <h2>About this listing</h2>
                    <p>${desc}</p>
                    <h3>Details</h3>
                    <ul>
                        <li>${bedDisplay} / ${bathDisplay}</li>
                        <li>${amenitiesDisplay}</li>
                    </ul>
                </div>
            </div>
        `;

        // Create Wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper listing-item';
        wrapper.setAttribute('data-price', price);
        wrapper.setAttribute('data-roomtype', type);
        wrapper.setAttribute('data-bedrooms', beds);
        wrapper.setAttribute('data-bathrooms', baths);
        wrapper.setAttribute('data-amenities', amenitiesString);
        wrapper.innerHTML = newCardHTML;

        // Add to DOM
        const container = document.getElementById('listingsContainer');
        container.insertBefore(wrapper, document.getElementById('noResults'));

        // Attach Event Listeners to New Card
        attachEventsToCard(wrapper);

        // Reset and Close
        document.getElementById('addPostForm').reset();
        closeAddPostModal();
        
        // Re-run filters
        filterListings();
    });

    /* ---------------------------------------------------------
       4. IMAGE GALLERY & CARD INTERACTIONS (Helper)
       --------------------------------------------------------- */
    
    // Function to attach listeners to a specific card wrapper
    function attachEventsToCard(wrapper) {
        const gallery = wrapper.querySelector('.image-gallery');
        const card = wrapper.querySelector('.card');

        // Gallery Logic
        if (gallery) {
            const images = gallery.querySelectorAll('.apartment-image');
            const dots = gallery.querySelectorAll('.dot');
            let currentIndex = 0;

            gallery.addEventListener('click', (e) => {
                e.stopPropagation();
                if(images.length <= 1) return; 

                images[currentIndex].classList.remove('active');
                if(dots[currentIndex]) dots[currentIndex].classList.remove('active');
                
                currentIndex = (currentIndex + 1) % images.length;
                
                images[currentIndex].classList.add('active');
                if(dots[currentIndex]) dots[currentIndex].classList.add('active');
            });
        }

        // Flip Logic
        if (card) {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.image-gallery') || 
                    e.target.closest('.choose-button') || 
                    e.target.closest('.user-info')) {
                    return;
                }
                card.classList.toggle('flipped');
            });
        }
    }

    // Initialize existing cards
    document.querySelectorAll('.listing-item').forEach(item => {
        attachEventsToCard(item);
    });

    // Popup Logic for User Profile
    const userPopup = document.getElementById('userPopup');
    const userPopupContent = userPopup.querySelector('.popup-content');
    const userPopupClose = userPopup.querySelector('.popup-close');

    // Use event delegation for User Info clicks (handles new posts properly)
    document.getElementById('listingsContainer').addEventListener('click', function(e) {
        const userInfo = e.target.closest('.user-info');
        if (userInfo) {
            e.stopPropagation();
            const name = userInfo.querySelector('.username').textContent;
            userPopupContent.innerHTML = `
                <h3>${name}</h3>
                <p><strong>Verified User:</strong> Yes</p>
                <p><strong>Response Rate:</strong> 100%</p>
                <p>Looking for a respectful roommate.</p>
            `;
            userPopup.classList.add('active');
        }
    });

    userPopupClose.addEventListener('click', () => userPopup.classList.remove('active'));
    window.addEventListener('click', (e) => {
        if (e.target === userPopup) userPopup.classList.remove('active');
        if (e.target === addPostModal) addPostModal.classList.remove('active');
    });

});

/* ---------------------------------------------------------
   GOOGLE MAPS INITIALIZATION
   --------------------------------------------------------- */
window.initMap = function() {
    const map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 34.0522, lng: -118.2437 }, // LA Center
        zoom: 10,
        mapId: "DEMO_MAP_ID", 
        disableDefaultUI: false,
    });
};