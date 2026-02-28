/**
 * apartment_create_modal.js
 * Migrated from demo_map/frontend/js/modules/create-listing.js
 * Converted from ES-module to regular script.
 *
 * Adapted for Livio's Django REST Framework API:
 *  - POST to /apartments/api/apartments/ (not /api/listings/)
 *  - Django CSRF token via X-CSRFToken header (from LivioUtils.getCsrfToken)
 *  - Field names mapped to Livio's serializer format:
 *      price        → monthly_rent
 *      type         → room_type ('entire', 'private', 'shared', 'studio')
 *      bedrooms     → bedrooms  ('1bed', '2bed', etc.)
 *      bathrooms    → bathrooms ('1bath', '2bath', etc.)
 *      amenities[]  → amenities  (comma-separated string)
 *      address      → location   (street address)
 *      sqft         → square_feet
 *  - Response normalized back to demo-map shape by apartment_script.js
 *
 * Supports up to 10 listing photos uploaded individually to S3.
 */

var AMENITY_OPTIONS = [
  'WiFi', 'Parking', 'Laundry', 'AC', 'Pool', 'Gym',
  'Furnished', 'Pet Friendly', 'Utilities Included',
  'Bike Storage', 'Backyard', 'Doorman',
];

var MAX_PHOTOS = 10;

class CreateListingModal {
  constructor(containerId) {
    this.container       = document.getElementById(containerId);
    this._onSuccess      = null;
    this._onEditSuccess  = null;
    this._submitting     = false;
    this._autocomplete   = null;
    this._selectedPlace  = null;
    this._photoItems     = [];  // [{ id, file|null, objectUrl|null, s3Url|null }]
    this._photoIdCounter = 0;
    this._editingId      = null; // non-null when editing an existing listing

    this._render();
    this._bindEvents();

    // Defer address autocomplete init until Google Maps Places is ready
    var self = this;
    var waitForMaps = setInterval(function() {
      if (window.google && window.google.maps && window.google.maps.places) {
        clearInterval(waitForMaps);
        self._initAddressAutocomplete();
      }
    }, 200);
  }

  // ── Public API ──────────────────────────────────

  open() {
    this._editingId = null;
    this.container.classList.add('create-modal--open');
    document.body.style.overflow = 'hidden';
    this._resetForm();
    document.querySelector('.create-modal__title').textContent = 'List Your Place';
    document.getElementById('create-submit').textContent = 'Post Listing';
  }

  /**
   * Open the modal pre-filled with an existing listing for editing.
   * @param {object} listing - normalized listing object from AppState
   */
  openForEdit(listing) {
    this._editingId = listing.id;
    this.container.classList.add('create-modal--open');
    document.body.style.overflow = 'hidden';
    this._resetForm();

    document.querySelector('.create-modal__title').textContent = 'Edit Your Listing';
    document.getElementById('create-submit').textContent = 'Save Changes';

    const form = document.getElementById('create-listing-form');
    form.title.value       = listing.title || '';
    form.description.value = listing.description || '';
    form.price.value       = listing.price || '';
    if (listing.sqft) form.sqft.value = listing.sqft;

    // Address — split address string back into parts (best-effort)
    const addrParts = (listing.address || '').split(',').map(function(s) { return s.trim(); });
    form.address.value = addrParts[0] || '';
    if (addrParts[1]) { const cityEl  = document.getElementById('cl-city');  if (cityEl)  cityEl.value  = addrParts[1]; }
    if (addrParts[2]) { const stateEl = document.getElementById('cl-state'); if (stateEl) stateEl.value = addrParts[2]; }

    // Type reverse-map
    const typeReverseMap = {
      'Private Room': 'Private Room',
      'Shared Room':  'Shared Room',
      'Studio':       'Studio',
      'Entire Place': 'Apartment',
      'Apartment':    'Apartment',
    };
    const typeEl = document.getElementById('cl-type');
    if (typeEl) typeEl.value = typeReverseMap[listing.type] || 'Apartment';

    // Bedrooms reverse-map
    const bedsEl = document.getElementById('cl-beds');
    if (bedsEl) {
      if (listing.bedrooms === 0) bedsEl.value = 'Studio';
      else if (listing.bedrooms >= 4) bedsEl.value = '4';
      else bedsEl.value = String(listing.bedrooms || 1);
    }

    // Bathrooms reverse-map
    const bathsEl = document.getElementById('cl-baths');
    if (bathsEl) bathsEl.value = String(listing.bathrooms || 1);

    // Amenities
    const checkedAmenities = new Set((listing.amenities || []).map(function(a) { return a.toLowerCase(); }));
    form.querySelectorAll('input[name="amenities"]').forEach(function(cb) {
      cb.checked = checkedAmenities.has(cb.value.toLowerCase());
    });

    // Load existing photos from listing.images, falling back to image_url
    const imgs = Array.isArray(listing.images) && listing.images.length > 0
      ? listing.images
      : (listing.image_url ? [listing.image_url] : []);

    imgs.forEach((url) => {
      if (this._photoItems.length < MAX_PHOTOS) {
        this._photoItems.push({ id: ++this._photoIdCounter, file: null, objectUrl: url, s3Url: url });
      }
    });
    this._renderPhotoThumbs();
  }

  close() {
    this.container.classList.remove('create-modal--open');
    document.body.style.overflow = '';
    this._editingId = null;
  }

  isOpen() { return this.container.classList.contains('create-modal--open'); }

  /** @param {Function} cb - called with the raw API response on a successful create */
  onSuccess(cb) { this._onSuccess = cb; }

  /** @param {Function} cb - called with the raw API response on a successful edit */
  onEditSuccess(cb) { this._onEditSuccess = cb; }

  // ── Static field mappers ─────────────────────────

  static _mapRoomType(type) {
    const map = {
      'Apartment':    'entire',
      'House':        'entire',
      'Studio':       'studio',
      'Condo':        'entire',
      'Private Room': 'private',
      'Shared Room':  'shared',
    };
    return map[type] || 'private';
  }

  static _mapBedrooms(beds) {
    if (beds === 'Studio' || beds === '0') return '1bed';
    const n = parseInt(beds, 10) || 1;
    if (n >= 4) return '4bed';
    return n + 'bed';
  }

  static _mapBathrooms(baths) {
    const n = parseFloat(baths) || 1;
    if (n >= 3) return '3bath';
    if (n >= 2) return '2bath';
    return '1bath';
  }

  // ── Render ───────────────────────────────────────

  _render() {
    const amenityChecks = AMENITY_OPTIONS.map(function(a) {
      return (
        '<label class="create-modal__check">' +
          '<input type="checkbox" name="amenities" value="' + a + '"/>' +
          '<span>' + a + '</span>' +
        '</label>'
      );
    }).join('');

    this.container.innerHTML =
      '<div class="create-modal__backdrop" id="create-backdrop"></div>' +
      '<div class="create-modal__card">' +
        '<div class="create-modal__header">' +
          '<h2 class="create-modal__title">List Your Place</h2>' +
          '<button class="create-modal__close" id="create-close" aria-label="Close">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">' +
              '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        '<div class="create-modal__body">' +
          '<form id="create-listing-form" novalidate>' +

            '<div class="create-modal__section">' +
              '<label class="create-modal__label" for="cl-title">Listing Title *</label>' +
              '<input type="text" id="cl-title" name="title" class="create-modal__input" placeholder="e.g. Bright 2BR near CSUN" required />' +
            '</div>' +

            '<div class="create-modal__row">' +
              '<div class="create-modal__field">' +
                '<label class="create-modal__label" for="cl-type">Property Type *</label>' +
                '<select id="cl-type" name="type" class="create-modal__select" required>' +
                  '<option value="">Select type</option>' +
                  '<option value="Apartment">Apartment</option>' +
                  '<option value="House">House</option>' +
                  '<option value="Studio">Studio</option>' +
                  '<option value="Condo">Condo</option>' +
                  '<option value="Private Room">Private Room</option>' +
                  '<option value="Shared Room">Shared Room</option>' +
                '</select>' +
              '</div>' +
              '<div class="create-modal__field">' +
                '<label class="create-modal__label" for="cl-beds">Bedrooms *</label>' +
                '<select id="cl-beds" name="bedrooms" class="create-modal__select" required>' +
                  '<option value="">Select</option>' +
                  '<option value="Studio">Studio</option>' +
                  '<option value="1">1</option>' +
                  '<option value="2">2</option>' +
                  '<option value="3">3</option>' +
                  '<option value="4">4+</option>' +
                '</select>' +
              '</div>' +
            '</div>' +

            '<div class="create-modal__row">' +
              '<div class="create-modal__field">' +
                '<label class="create-modal__label" for="cl-baths">Bathrooms *</label>' +
                '<select id="cl-baths" name="bathrooms" class="create-modal__select" required>' +
                  '<option value="">Select</option>' +
                  '<option value="1">1</option>' +
                  '<option value="1.5">1.5</option>' +
                  '<option value="2">2</option>' +
                  '<option value="2.5">2.5</option>' +
                  '<option value="3">3+</option>' +
                '</select>' +
              '</div>' +
              '<div class="create-modal__field">' +
                '<label class="create-modal__label" for="cl-price">Monthly Rent ($) *</label>' +
                '<input type="number" id="cl-price" name="price" class="create-modal__input" placeholder="e.g. 1800" min="1" step="50" required />' +
              '</div>' +
            '</div>' +

            '<div class="create-modal__section">' +
              '<label class="create-modal__label" for="cl-sqft">Square Feet (optional)</label>' +
              '<input type="number" id="cl-sqft" name="sqft" class="create-modal__input create-modal__input--half" placeholder="e.g. 750" min="1" step="10" />' +
            '</div>' +

            '<div class="create-modal__section">' +
              '<label class="create-modal__label" for="cl-address">Street Address *</label>' +
              '<input type="text" id="cl-address" name="address" class="create-modal__input" placeholder="e.g. 9301 Reseda Blvd" required />' +
            '</div>' +

            '<div class="create-modal__row">' +
              '<div class="create-modal__field create-modal__field--grow">' +
                '<label class="create-modal__label" for="cl-city">City *</label>' +
                '<input type="text" id="cl-city" name="city" class="create-modal__input" placeholder="e.g. Northridge" required />' +
              '</div>' +
              '<div class="create-modal__field create-modal__field--sm">' +
                '<label class="create-modal__label" for="cl-state">State</label>' +
                '<input type="text" id="cl-state" name="state" class="create-modal__input" value="CA" maxlength="2" />' +
              '</div>' +
              '<div class="create-modal__field create-modal__field--sm">' +
                '<label class="create-modal__label" for="cl-zip">Zip Code *</label>' +
                '<input type="text" id="cl-zip" name="zip_code" class="create-modal__input" placeholder="e.g. 91324" maxlength="10" required />' +
              '</div>' +
            '</div>' +

            '<div class="create-modal__section">' +
              '<label class="create-modal__label" for="cl-desc">Description</label>' +
              '<textarea id="cl-desc" name="description" class="create-modal__textarea" rows="3" placeholder="Describe the apartment, highlights, nearby transit, etc."></textarea>' +
            '</div>' +

            '<div class="create-modal__section">' +
              '<label class="create-modal__label">Amenities</label>' +
              '<div class="create-modal__checks">' + amenityChecks + '</div>' +
            '</div>' +

            '<div class="create-modal__section">' +
              '<label class="create-modal__label">' +
                'Listing Photos ' +
                '<span class="create-modal__label-hint" id="cl-photo-count">(0 / ' + MAX_PHOTOS + ')</span>' +
              '</label>' +
              '<div class="create-modal__photo-grid" id="cl-photo-grid">' +
                '<label class="create-modal__photo-add" id="cl-photo-add-label" for="cl-images" title="Add up to ' + MAX_PHOTOS + ' photos">' +
                  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5">' +
                    '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>' +
                    '<polyline points="17 8 12 3 7 8"/>' +
                    '<line x1="12" y1="3" x2="12" y2="15"/>' +
                  '</svg>' +
                  '<span>Add Photos</span>' +
                '</label>' +
                '<input type="file" id="cl-images" accept="image/jpeg,image/png,image/webp" multiple class="create-modal__file-input--hidden" />' +
              '</div>' +
              '<p id="cl-upload-status" class="create-modal__upload-status"></p>' +
            '</div>' +

            '<div id="create-error" class="create-modal__error" style="display:none;"></div>' +

            '<div class="create-modal__actions">' +
              '<button type="button" id="create-cancel" class="create-modal__btn create-modal__btn--ghost">Cancel</button>' +
              '<button type="submit" id="create-submit" class="create-modal__btn create-modal__btn--primary">Post Listing</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';
  }

  // ── Event binding ────────────────────────────────

  _bindEvents() {
    const self = this;
    document.getElementById('create-close').addEventListener('click',    function() { self.close(); });
    document.getElementById('create-backdrop').addEventListener('click', function() { self.close(); });
    document.getElementById('create-cancel').addEventListener('click',   function() { self.close(); });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && self.isOpen()) self.close();
    });

    document.getElementById('create-listing-form').addEventListener('submit', function(e) {
      self._handleSubmit(e);
    });

    // Multi-image file input
    document.getElementById('cl-images').addEventListener('change', function(e) {
      self._handleImageSelect(e.target.files);
      e.target.value = ''; // reset so same file can be re-selected
    });
  }

  // ── Photo management ─────────────────────────────

  _handleImageSelect(files) {
    const remaining = MAX_PHOTOS - this._photoItems.length;
    if (remaining <= 0) return;

    Array.from(files).slice(0, remaining).forEach((file) => {
      const objectUrl = URL.createObjectURL(file);
      this._photoItems.push({ id: ++this._photoIdCounter, file, objectUrl, s3Url: null });
    });
    this._renderPhotoThumbs();
  }

  _removePhoto(photoId) {
    const idx = this._photoItems.findIndex((item) => item.id === photoId);
    if (idx === -1) return;
    const item = this._photoItems[idx];
    // Only revoke object URLs for locally-selected files (not existing S3 URLs used as objectUrl)
    if (item.file && item.objectUrl) URL.revokeObjectURL(item.objectUrl);
    this._photoItems.splice(idx, 1);
    this._renderPhotoThumbs();
  }

  _clearAllPhotos() {
    this._photoItems.forEach((item) => {
      if (item.file && item.objectUrl) URL.revokeObjectURL(item.objectUrl);
    });
    this._photoItems = [];
    this._renderPhotoThumbs();
  }

  _renderPhotoThumbs() {
    const grid     = document.getElementById('cl-photo-grid');
    const countEl  = document.getElementById('cl-photo-count');
    const addLabel = document.getElementById('cl-photo-add-label');
    if (!grid) return;

    // Remove existing thumb elements (preserve add-label and file input)
    Array.from(grid.querySelectorAll('.create-modal__photo-thumb')).forEach((el) => el.remove());

    // Insert thumbnails before the add-label
    const self = this;
    this._photoItems.forEach((item) => {
      const thumb = document.createElement('div');
      thumb.className = 'create-modal__photo-thumb';
      thumb.dataset.photoId = item.id;

      const img = document.createElement('img');
      img.src = item.objectUrl || item.s3Url || '';
      img.alt = 'Photo';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'create-modal__photo-remove';
      removeBtn.setAttribute('aria-label', 'Remove photo');
      removeBtn.textContent = '\u00d7';
      removeBtn.addEventListener('click', function() { self._removePhoto(item.id); });

      thumb.appendChild(img);
      thumb.appendChild(removeBtn);
      grid.insertBefore(thumb, addLabel);
    });

    const count = this._photoItems.length;
    if (countEl)  countEl.textContent = '(' + count + ' / ' + MAX_PHOTOS + ')';
    if (addLabel) addLabel.style.display = count >= MAX_PHOTOS ? 'none' : '';
  }

  // ── S3 upload ────────────────────────────────────

  async _uploadImageToS3(file) {
    const token = localStorage.getItem('access_token');
    const res = await fetch('/apartments/api/upload-url/', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'X-CSRFToken':   LivioUtils.getCsrfToken(),
        'Authorization': 'Bearer ' + token,
      },
      credentials: 'include',
      body: JSON.stringify({ fileName: file.name, fileType: file.type, expiration: 300 }),
    });

    if (!res.ok) throw new Error('Could not get upload URL (HTTP ' + res.status + ')');

    const { presignedURL, imageURL } = await res.json();

    const s3Res = await fetch(presignedURL, {
      method:  'PUT',
      headers: { 'Content-Type': file.type },
      body:    file,
    });

    if (!s3Res.ok) throw new Error('S3 upload failed (HTTP ' + s3Res.status + ')');

    return imageURL;
  }

  async _uploadAllPendingPhotos() {
    const statusEl = document.getElementById('cl-upload-status');
    const pending  = this._photoItems.filter((item) => item.file && !item.s3Url);
    if (pending.length === 0) return;

    if (statusEl) {
      statusEl.textContent = 'Uploading ' + pending.length + ' photo(s)\u2026';
      statusEl.className = 'create-modal__upload-status create-modal__upload-status--uploading';
    }

    let successCount = 0;
    for (const item of pending) {
      try {
        item.s3Url = await this._uploadImageToS3(item.file);
        successCount++;
      } catch (err) {
        console.warn('[CreateListing] Photo upload failed:', err.message);
      }
    }

    if (statusEl) {
      if (successCount === pending.length) {
        statusEl.textContent = successCount + ' photo(s) uploaded \u2713';
        statusEl.className = 'create-modal__upload-status create-modal__upload-status--done';
      } else {
        statusEl.textContent = successCount + '/' + pending.length + ' uploaded. Some photos failed.';
        statusEl.className = 'create-modal__upload-status create-modal__upload-status--error';
      }
    }
  }

  // ── Google Places address autocomplete ───────────

  _initAddressAutocomplete() {
    const addressInput = document.getElementById('cl-address');
    if (!addressInput) return;
    const self = this;

    this._autocomplete = new google.maps.places.Autocomplete(addressInput, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'geometry', 'formatted_address'],
    });

    this._autocomplete.addListener('place_changed', function() {
      const place = self._autocomplete.getPlace();
      if (!place.geometry) return;

      self._selectedPlace = {
        lat: Math.round(place.geometry.location.lat() * 1000000) / 1000000,
        lng: Math.round(place.geometry.location.lng() * 1000000) / 1000000,
      };

      let streetNumber = '', route = '', city = '', state = '', zip = '';
      for (const comp of place.address_components) {
        const type = comp.types[0];
        if (type === 'street_number') streetNumber = comp.long_name;
        if (type === 'route')         route        = comp.long_name;
        if (type === 'locality')      city         = comp.long_name;
        if (type === 'administrative_area_level_1') state = comp.short_name;
        if (type === 'postal_code')   zip          = comp.long_name;
      }

      addressInput.value = (streetNumber + ' ' + route).trim();
      const cityEl  = document.getElementById('cl-city');  if (cityEl)  cityEl.value  = city;
      const stateEl = document.getElementById('cl-state'); if (stateEl) stateEl.value = state || 'CA';
      const zipEl   = document.getElementById('cl-zip');   if (zipEl)   zipEl.value   = zip;
    });

    addressInput.addEventListener('input', function() { self._selectedPlace = null; });
  }

  // ── Form helpers ─────────────────────────────────

  _resetForm() {
    const form = document.getElementById('create-listing-form');
    if (form) form.reset();
    const stateEl = document.getElementById('cl-state'); if (stateEl) stateEl.value = 'CA';
    this._selectedPlace = null;
    this._clearAllPhotos();
    const statusEl = document.getElementById('cl-upload-status');
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'create-modal__upload-status'; }
    this._setError('');
    this._setSubmitting(false);
  }

  _setSubmitting(loading) {
    this._submitting = loading;
    const btn = document.getElementById('create-submit');
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn.textContent = this._editingId ? 'Saving...' : 'Posting...';
    } else {
      btn.textContent = this._editingId ? 'Save Changes' : 'Post Listing';
    }
  }

  _setError(msg) {
    const el = document.getElementById('create-error');
    if (!el) return;
    if (msg) { el.textContent = msg; el.style.display = 'block'; }
    else      { el.style.display = 'none'; el.textContent = ''; }
  }

  // ── Form submission ──────────────────────────────

  async _handleSubmit(e) {
    e.preventDefault();
    if (this._submitting) return;

    const form      = document.getElementById('create-listing-form');
    const title     = form.title.value.trim();
    const type      = form.type.value;
    const bedrooms  = form.bedrooms.value;
    const bathrooms = form.bathrooms.value;
    const price     = parseFloat(form.price.value);
    const sqft      = form.sqft.value ? parseInt(form.sqft.value, 10) : null;
    const address   = form.address.value.trim();
    const city      = form.city.value.trim();
    const state     = form.state.value.trim() || 'CA';
    const zip_code  = form.zip_code.value.trim();
    const description = form.description.value.trim();
    const amenities = Array.from(form.querySelectorAll('input[name="amenities"]:checked'))
      .map((cb) => cb.value);

    if (!title)               return this._setError('Listing title is required.');
    if (!type)                return this._setError('Property type is required.');
    if (!bedrooms)            return this._setError('Bedrooms is required.');
    if (!bathrooms)           return this._setError('Bathrooms is required.');
    if (!price || price <= 0) return this._setError('Monthly rent must be a positive number.');
    if (!address)             return this._setError('Street address is required.');
    if (!city)                return this._setError('City is required.');
    if (!zip_code)            return this._setError('Zip code is required.');

    this._setError('');
    this._setSubmitting(true);

    // Upload any photos that haven't been uploaded to S3 yet
    await this._uploadAllPendingPhotos();

    // Collect all successfully-uploaded S3 URLs
    const imageUrls = this._photoItems.map((item) => item.s3Url).filter(Boolean);

    let lat = null, lng = null;
    if (this._selectedPlace) {
      lat = this._selectedPlace.lat;
      lng = this._selectedPlace.lng;
    } else {
      try {
        const coords = await this._geocode(address + ', ' + city + ', ' + state + ' ' + zip_code);
        lat = Math.round(coords.lat * 1000000) / 1000000;
        lng = Math.round(coords.lng * 1000000) / 1000000;
      } catch (geocodeErr) {
        console.warn('[CreateListing] Geocoding failed:', geocodeErr.message);
      }
    }

    const body = {
      title:        title,
      location:     address,
      city,
      state,
      zip_code,
      description,
      monthly_rent: price,
      room_type:    CreateListingModal._mapRoomType(type),
      bedrooms:     CreateListingModal._mapBedrooms(bedrooms),
      bathrooms:    CreateListingModal._mapBathrooms(bathrooms),
      amenities:    amenities.join(','),
      is_active:    true,
      images:       imageUrls,
    };
    if (lat !== null)          body.latitude    = lat;
    if (lng !== null)          body.longitude   = lng;
    if (sqft !== null)         body.square_feet = sqft;
    if (imageUrls.length > 0) body.image_url   = imageUrls[0]; // backward compat

    const isEdit = this._editingId !== null;
    const url    = isEdit
      ? '/apartments/api/apartments/' + this._editingId + '/'
      : '/apartments/api/apartments/';

    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        window.location.href = '/login/?next=' + encodeURIComponent(window.location.pathname);
        return;
      }

      const response = await fetch(url, {
        method:  isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type':  'application/json',
          'X-CSRFToken':   LivioUtils.getCsrfToken(),
          'Authorization': 'Bearer ' + token,
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('access_token');
          window.location.href = '/login/?next=' + encodeURIComponent(window.location.pathname);
          return;
        }
        const errData = await response.json().catch(function() { return {}; });
        const msg = this._formatApiError(errData) || ('HTTP ' + response.status);
        throw new Error(msg);
      }

      const savedListing = await response.json();
      this.close();
      if (isEdit) {
        if (this._onEditSuccess) this._onEditSuccess(savedListing);
      } else {
        if (this._onSuccess) this._onSuccess(savedListing);
      }

    } catch (err) {
      this._setError((isEdit ? 'Failed to save changes: ' : 'Failed to post listing: ') + err.message);
    } finally {
      this._setSubmitting(false);
    }
  }

  _formatApiError(errData) {
    if (!errData || typeof errData !== 'object') return '';
    const lines = [];
    for (const field in errData) {
      const msgs = errData[field];
      const text = Array.isArray(msgs) ? msgs.join(' ') : String(msgs);
      lines.push(field === 'non_field_errors' ? text : field + ': ' + text);
    }
    return lines.join(' | ');
  }

  _geocode(address) {
    return new Promise(function(resolve, reject) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address }, function(results, status) {
        if (status === 'OK' && results.length > 0) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
        } else {
          reject(new Error('Geocoder status: ' + status));
        }
      });
    });
  }
}

window.CreateListingModal = CreateListingModal;
