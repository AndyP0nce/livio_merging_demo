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
 * The three mapping helpers (_mapRoomType, _mapBedrooms, _mapBathrooms)
 * are now static class methods rather than module-level functions, keeping
 * implementation details inside the class.
 */

var AMENITY_OPTIONS = [
  'WiFi', 'Parking', 'Laundry', 'AC', 'Pool', 'Gym',
  'Furnished', 'Pet Friendly', 'Utilities Included',
  'Bike Storage', 'Backyard', 'Doorman',
];

class CreateListingModal {
  constructor(containerId) {
    this.container        = document.getElementById(containerId);
    this._onSuccess       = null;
    this._onEditSuccess   = null;
    this._submitting      = false;
    this._autocomplete    = null;
    this._selectedPlace   = null;
    this._uploadedImageUrl = null; // S3 URL set after a successful image upload
    this._editingId       = null;  // non-null when editing an existing listing

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

    // Update header/button labels
    document.querySelector('.create-modal__title').textContent = 'Edit Your Listing';
    document.getElementById('create-submit').textContent = 'Save Changes';

    // Pre-fill form fields
    const form = document.getElementById('create-listing-form');
    form.title.value       = listing.title || '';
    form.description.value = listing.description || '';
    form.price.value       = listing.price || '';
    if (listing.sqft) form.sqft.value = listing.sqft;

    // Address — split address string back into parts (best-effort)
    const addrParts = (listing.address || '').split(',').map(function(s) { return s.trim(); });
    form.address.value  = addrParts[0] || '';
    if (addrParts[1]) { const cityEl = document.getElementById('cl-city');   if (cityEl)  cityEl.value  = addrParts[1]; }
    if (addrParts[2]) { const stateEl = document.getElementById('cl-state'); if (stateEl) stateEl.value = addrParts[2]; }

    // Type reverse-map (display label → form option value)
    const typeReverseMap = {
      'Private Room': 'Private Room',
      'Shared Room':  'Shared Room',
      'Studio':       'Studio',
      'Entire Place': 'Apartment',
      'Apartment':    'Apartment',
    };
    const typeEl = document.getElementById('cl-type');
    if (typeEl) typeEl.value = typeReverseMap[listing.type] || 'Apartment';

    // Bedrooms reverse-map ('1bed' → '1', etc.)
    const bedsEl = document.getElementById('cl-beds');
    if (bedsEl) {
      if (listing.bedrooms === 0) bedsEl.value = 'Studio';
      else if (listing.bedrooms >= 4) bedsEl.value = '4';
      else bedsEl.value = String(listing.bedrooms || 1);
    }

    // Bathrooms reverse-map
    const bathsEl = document.getElementById('cl-baths');
    if (bathsEl) bathsEl.value = String(listing.bathrooms || 1);

    // Amenities — check matching checkboxes
    const checkedAmenities = new Set((listing.amenities || []).map(function(a) { return a.toLowerCase(); }));
    form.querySelectorAll('input[name="amenities"]').forEach(function(cb) {
      cb.checked = checkedAmenities.has(cb.value.toLowerCase());
    });

    // Show existing image if present
    if (listing.image_url) {
      this._uploadedImageUrl = listing.image_url;
      const previewImg    = document.getElementById('cl-preview-img');
      const previewBox    = document.getElementById('cl-image-preview');
      const uploadLabel   = document.getElementById('cl-upload-label');
      const statusEl      = document.getElementById('cl-upload-status');
      if (previewImg)  previewImg.src = listing.image_url;
      if (previewBox)  previewBox.style.display = 'flex';
      if (uploadLabel) uploadLabel.style.display = 'none';
      if (statusEl)    statusEl.textContent = 'Current photo';
    }
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
  //   Previously module-level functions; now co-located with the class.

  /** Map form "type" dropdown value → Livio room_type API value. */
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

  /** Map form "bedrooms" value → Livio bedrooms API value. */
  static _mapBedrooms(beds) {
    if (beds === 'Studio' || beds === '0') return '1bed'; // closest Livio option
    const n = parseInt(beds, 10) || 1;
    if (n >= 4) return '4bed';
    return n + 'bed';
  }

  /** Map form "bathrooms" value → Livio bathrooms API value. */
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
              '<label class="create-modal__label" for="cl-image">Listing Photo (optional)</label>' +
              '<div class="create-modal__upload" id="cl-upload-area">' +
                '<input type="file" id="cl-image" name="image" accept="image/jpeg,image/png,image/webp" class="create-modal__file-input" />' +
                '<label for="cl-image" class="create-modal__upload-label" id="cl-upload-label">' +
                  '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:6px">' +
                    '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>' +
                    '<polyline points="17 8 12 3 7 8"/>' +
                    '<line x1="12" y1="3" x2="12" y2="15"/>' +
                  '</svg>' +
                  '<span id="cl-upload-text">Click to choose a photo</span>' +
                '</label>' +
                '<div id="cl-image-preview" class="create-modal__img-preview" style="display:none;">' +
                  '<img id="cl-preview-img" src="" alt="Preview" class="create-modal__preview-img" />' +
                  '<button type="button" id="cl-remove-image" class="create-modal__remove-img" aria-label="Remove photo">&times;</button>' +
                  '<span id="cl-upload-status" class="create-modal__upload-status"></span>' +
                '</div>' +
              '</div>' +
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

    // Image file input
    document.getElementById('cl-image').addEventListener('change', function(e) {
      self._handleImageSelect(e.target.files[0]);
    });
    document.getElementById('cl-remove-image').addEventListener('click', function() {
      self._clearImageUpload();
    });
  }

  // ── Image upload ─────────────────────────────────

  _handleImageSelect(file) {
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    const self = this;
    reader.onload = function(e) {
      document.getElementById('cl-preview-img').src = e.target.result;
      document.getElementById('cl-image-preview').style.display = 'flex';
      document.getElementById('cl-upload-label').style.display = 'none';
      document.getElementById('cl-upload-status').textContent = 'Ready to upload';
      document.getElementById('cl-upload-status').className = 'create-modal__upload-status';
      self._uploadedImageUrl = null; // reset until upload completes
    };
    reader.readAsDataURL(file);
  }

  _clearImageUpload() {
    document.getElementById('cl-image').value = '';
    document.getElementById('cl-preview-img').src = '';
    document.getElementById('cl-image-preview').style.display = 'none';
    document.getElementById('cl-upload-label').style.display = 'flex';
    document.getElementById('cl-upload-status').textContent = '';
    this._uploadedImageUrl = null;
  }

  async _uploadImageToS3(file) {
    const statusEl = document.getElementById('cl-upload-status');
    statusEl.textContent = 'Uploading…';
    statusEl.className = 'create-modal__upload-status create-modal__upload-status--uploading';

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/apartments/api/upload-url/', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'X-CSRFToken':   LivioUtils.getCsrfToken(),
          'Authorization': 'Bearer ' + token,
        },
        credentials: 'include',
        body: JSON.stringify({
          fileName:   file.name,
          fileType:   file.type,
          expiration: 300,
        }),
      });

      if (!res.ok) throw new Error('Could not get upload URL (HTTP ' + res.status + ')');

      const { presignedURL, imageURL } = await res.json();

      // Upload directly to S3 (no Django in the loop)
      const s3Res = await fetch(presignedURL, {
        method:  'PUT',
        headers: { 'Content-Type': file.type },
        body:    file,
      });

      if (!s3Res.ok) throw new Error('S3 upload failed (HTTP ' + s3Res.status + ')');

      this._uploadedImageUrl = imageURL;
      statusEl.textContent = 'Photo uploaded ✓';
      statusEl.className = 'create-modal__upload-status create-modal__upload-status--done';
      return imageURL;

    } catch (err) {
      statusEl.textContent = 'Upload failed: ' + err.message;
      statusEl.className = 'create-modal__upload-status create-modal__upload-status--error';
      throw err;
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
    this._uploadedImageUrl = null;
    this._clearImageUpload();
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

    // Upload image to S3 first (if user selected a file and it hasn't been uploaded yet)
    const imageFile = document.getElementById('cl-image').files[0];
    if (imageFile && !this._uploadedImageUrl) {
      try {
        await this._uploadImageToS3(imageFile);
      } catch (uploadErr) {
        // Non-fatal: warn but continue without image
        console.warn('[CreateListing] Image upload failed:', uploadErr.message, '— posting without photo.');
      }
    }

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

    // Map form values → Livio DRF serializer field names
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
    };
    if (lat !== null)  body.latitude    = lat;
    if (lng !== null)  body.longitude   = lng;
    if (sqft !== null) body.square_feet = sqft;
    if (this._uploadedImageUrl) body.image_url = this._uploadedImageUrl;

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
