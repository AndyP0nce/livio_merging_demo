/**
 * apartment_create_modal.js
 * Migrated from demo_map/frontend/js/modules/create-listing.js
 * Converted from ES-module to regular script.
 *
 * Adapted for Livio's Django REST Framework API:
 *  - POST to /apartments/api/apartments/ (not /api/listings/)
 *  - Django CSRF token sent via X-CSRFToken header
 *  - Field names mapped to Livio's serializer format:
 *      price        → monthly_rent
 *      type         → room_type ('entire', 'private', 'shared', 'studio')
 *      bedrooms     → bedrooms  ('1bed', '2bed', etc.)
 *      bathrooms    → bathrooms ('1bath', '2bath', etc.)
 *      amenities[]  → amenities  (comma-separated string)
 *      address      → location   (street address)
 *      sqft         → square_feet
 *  - Response normalized back to demo-map shape by apartment_script.js
 */

var AMENITY_OPTIONS = [
  'WiFi', 'Parking', 'Laundry', 'AC', 'Pool', 'Gym',
  'Furnished', 'Pet Friendly', 'Utilities Included',
  'Bike Storage', 'Backyard', 'Doorman',
];

// Helper: read Django CSRF token from cookie
function _getCsrfToken() {
  const name = 'csrftoken';
  const cookies = document.cookie.split(';');
  for (var i = 0; i < cookies.length; i++) {
    var c = cookies[i].trim();
    if (c.startsWith(name + '=')) return decodeURIComponent(c.slice(name.length + 1));
  }
  return '';
}

// Map the form's "type" dropdown value to Livio's room_type choices
function _mapRoomType(type) {
  var map = {
    'Apartment':    'entire',
    'House':        'entire',
    'Studio':       'studio',
    'Condo':        'entire',
    'Private Room': 'private',
    'Shared Room':  'shared',
  };
  return map[type] || 'private';
}

// Map the form's "bedrooms" value to Livio's bedrooms choices
function _mapBedrooms(beds) {
  if (beds === 'Studio' || beds === '0') return '1bed'; // closest Livio option
  var n = parseInt(beds, 10) || 1;
  if (n >= 4) return '4bed';
  return n + 'bed';
}

// Map the form's "bathrooms" value to Livio's bathrooms choices
function _mapBathrooms(baths) {
  var n = parseFloat(baths) || 1;
  if (n >= 3) return '3bath';
  if (n >= 2) return '2bath';
  return '1bath';
}

class CreateListingModal {
  constructor(containerId) {
    this.container     = document.getElementById(containerId);
    this._onSuccess    = null;
    this._submitting   = false;
    this._autocomplete = null;
    this._selectedPlace = null;

    this._render();
    this._bindEvents();

    // Defer address autocomplete init until Google Maps is ready
    var self = this;
    var waitForMaps = setInterval(function() {
      if (window.google && window.google.maps && window.google.maps.places) {
        clearInterval(waitForMaps);
        self._initAddressAutocomplete();
      }
    }, 200);
  }

  open() {
    this.container.classList.add('create-modal--open');
    document.body.style.overflow = 'hidden';
    this._resetForm();
  }

  close() {
    this.container.classList.remove('create-modal--open');
    document.body.style.overflow = '';
  }

  isOpen() { return this.container.classList.contains('create-modal--open'); }

  onSuccess(cb) { this._onSuccess = cb; }

  _render() {
    var amenityChecks = AMENITY_OPTIONS.map(function(a) {
      return '<label class="create-modal__check">' +
               '<input type="checkbox" name="amenities" value="' + a + '"/>' +
               '<span>' + a + '</span>' +
             '</label>';
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

            '<div id="create-error" class="create-modal__error" style="display:none;"></div>' +

            '<div class="create-modal__actions">' +
              '<button type="button" id="create-cancel" class="create-modal__btn create-modal__btn--ghost">Cancel</button>' +
              '<button type="submit" id="create-submit" class="create-modal__btn create-modal__btn--primary">Post Listing</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';
  }

  _bindEvents() {
    var self = this;
    document.getElementById('create-close').addEventListener('click',    function() { self.close(); });
    document.getElementById('create-backdrop').addEventListener('click', function() { self.close(); });
    document.getElementById('create-cancel').addEventListener('click',   function() { self.close(); });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && self.isOpen()) self.close();
    });

    document.getElementById('create-listing-form').addEventListener('submit', function(e) {
      self._handleSubmit(e);
    });
  }

  _initAddressAutocomplete() {
    var addressInput = document.getElementById('cl-address');
    if (!addressInput) return;
    var self = this;

    this._autocomplete = new google.maps.places.Autocomplete(addressInput, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'geometry', 'formatted_address'],
    });

    this._autocomplete.addListener('place_changed', function() {
      var place = self._autocomplete.getPlace();
      if (!place.geometry) return;

      self._selectedPlace = {
        lat: Math.round(place.geometry.location.lat() * 1000000) / 1000000,
        lng: Math.round(place.geometry.location.lng() * 1000000) / 1000000,
      };

      var streetNumber = '', route = '', city = '', state = '', zip = '';
      for (var i = 0; i < place.address_components.length; i++) {
        var comp = place.address_components[i];
        var type = comp.types[0];
        if (type === 'street_number') streetNumber = comp.long_name;
        if (type === 'route')         route        = comp.long_name;
        if (type === 'locality')      city         = comp.long_name;
        if (type === 'administrative_area_level_1') state = comp.short_name;
        if (type === 'postal_code')   zip          = comp.long_name;
      }

      addressInput.value = (streetNumber + ' ' + route).trim();
      var cityEl  = document.getElementById('cl-city');  if (cityEl)  cityEl.value  = city;
      var stateEl = document.getElementById('cl-state'); if (stateEl) stateEl.value = state || 'CA';
      var zipEl   = document.getElementById('cl-zip');   if (zipEl)   zipEl.value   = zip;
    });

    addressInput.addEventListener('input', function() { self._selectedPlace = null; });
  }

  _resetForm() {
    var form = document.getElementById('create-listing-form');
    if (form) form.reset();
    var stateEl = document.getElementById('cl-state'); if (stateEl) stateEl.value = 'CA';
    this._selectedPlace = null;
    this._setError('');
    this._setSubmitting(false);
  }

  _setSubmitting(loading) {
    this._submitting = loading;
    var btn = document.getElementById('create-submit');
    if (btn) { btn.disabled = loading; btn.textContent = loading ? 'Posting...' : 'Post Listing'; }
  }

  _setError(msg) {
    var el = document.getElementById('create-error');
    if (!el) return;
    if (msg) { el.textContent = msg; el.style.display = 'block'; }
    else      { el.style.display = 'none'; el.textContent = ''; }
  }

  async _handleSubmit(e) {
    e.preventDefault();
    if (this._submitting) return;

    var form     = document.getElementById('create-listing-form');
    var title    = form.title.value.trim();
    var type     = form.type.value;
    var bedrooms = form.bedrooms.value;
    var bathrooms = form.bathrooms.value;
    var price    = parseFloat(form.price.value);
    var sqft     = form.sqft.value ? parseInt(form.sqft.value, 10) : null;
    var address  = form.address.value.trim();
    var city     = form.city.value.trim();
    var state    = form.state.value.trim() || 'CA';
    var zip_code = form.zip_code.value.trim();
    var description = form.description.value.trim();
    var amenities = Array.from(form.querySelectorAll('input[name="amenities"]:checked')).map(function(cb) { return cb.value; });

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

    var lat = null, lng = null;
    if (this._selectedPlace) {
      lat = this._selectedPlace.lat;
      lng = this._selectedPlace.lng;
    } else {
      try {
        var coords = await this._geocode(address + ', ' + city + ', ' + state + ' ' + zip_code);
        lat = Math.round(coords.lat * 1000000) / 1000000;
        lng = Math.round(coords.lng * 1000000) / 1000000;
      } catch (geocodeErr) {
        console.warn('[CreateListing] Geocoding failed:', geocodeErr.message);
      }
    }

    // Map to Livio's DRF serializer field names
    var body = {
      title:        title,
      location:     address,          // Livio uses 'location' for street address
      city:         city,
      state:        state,
      zip_code:     zip_code,
      description:  description,
      monthly_rent: price,            // Livio's field name
      room_type:    _mapRoomType(type),
      bedrooms:     _mapBedrooms(bedrooms),
      bathrooms:    _mapBathrooms(bathrooms),
      amenities:    amenities.join(','),  // Livio stores as comma-separated string
      is_active:    true,
    };
    if (lat !== null)  body.latitude    = lat;
    if (lng !== null)  body.longitude   = lng;
    if (sqft !== null) body.square_feet = sqft;

    try {
      var token = localStorage.getItem('access_token');
      var response = await fetch('/apartments/api/apartments/', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'X-CSRFToken':   _getCsrfToken(),
          'Authorization': token ? ('Bearer ' + token) : '',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        var errData = await response.json().catch(function() { return {}; });
        var msg = this._formatApiError(errData) || ('HTTP ' + response.status);
        throw new Error(msg);
      }

      var newListing = await response.json();
      this.close();
      if (this._onSuccess) this._onSuccess(newListing);

    } catch (err) {
      this._setError('Failed to post listing: ' + err.message);
    } finally {
      this._setSubmitting(false);
    }
  }

  _formatApiError(errData) {
    if (!errData || typeof errData !== 'object') return '';
    var lines = [];
    for (var field in errData) {
      var msgs = errData[field];
      var text = Array.isArray(msgs) ? msgs.join(' ') : String(msgs);
      lines.push(field === 'non_field_errors' ? text : field + ': ' + text);
    }
    return lines.join(' | ');
  }

  _geocode(address) {
    return new Promise(function(resolve, reject) {
      var geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: address }, function(results, status) {
        if (status === 'OK' && results.length > 0) {
          var loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
        } else {
          reject(new Error('Geocoder status: ' + status));
        }
      });
    });
  }
}

window.CreateListingModal = CreateListingModal;
