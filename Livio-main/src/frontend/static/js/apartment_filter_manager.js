/**
 * apartment_filter_manager.js
 * Migrated from demo_map/frontend/js/modules/filters.js
 * Converted from ES-module to regular script (no import/export).
 *
 * Horizontal filter toolbar with:
 *  - Target university selector (distances computed from this school)
 *  - Search bar with autocomplete (city, zip, address, university, Google Places)
 *  - Dropdown filter buttons (Type, Beds, Baths, Price, Sqft, Amenities)
 *  - Active filter chips (with × remove)
 *
 * Architecture
 * ────────────
 *  FilterState   – pure data object; owns all filter values, address parsers,
 *                  filter logic, and chip generation.  Has no DOM dependencies.
 *  FilterManager – owns the DOM; delegates state reads/writes to FilterState.
 *                  Publishes changes to an optional EventBus.
 */

// ─────────────────────────────────────────────────────────────────────────────
// FilterState – pure state + logic (no DOM)
// ─────────────────────────────────────────────────────────────────────────────

class FilterState {
  constructor() {
    this.searchQuery = '';
    this.types       = new Set();
    this.minBeds     = 0;
    this.minBaths    = 0;
    this.priceMin    = 0;
    this.priceMax    = Infinity;
    this.sqftMin     = 0;
    this.sqftMax     = Infinity;
    this.amenities   = new Set();
  }

  /** Reset every filter to its default / cleared value. */
  reset() {
    this.searchQuery = '';
    this.types       = new Set();
    this.minBeds     = 0;
    this.minBaths    = 0;
    this.priceMin    = 0;
    this.priceMax    = Infinity;
    this.sqftMin     = 0;
    this.sqftMax     = Infinity;
    this.amenities   = new Set();
  }

  // ── Address helpers ───────────────────────────────

  /** Extract city from a comma-separated address string. */
  static parseCity(address) {
    const parts = (address || '').split(',');
    return parts.length >= 2 ? parts[1].trim() : '';
  }

  /** Extract zip code from an address string. */
  static parseZip(address) {
    const match = (address || '').match(/\d{5}$/);
    return match ? match[0] : '';
  }

  // ── Filter logic ──────────────────────────────────

  /** Return true if the listing's address matches the current search query. */
  matchesSearch(listing) {
    if (!this.searchQuery) return true;
    const q    = this.searchQuery;
    const city = FilterState.parseCity(listing.address).toLowerCase();
    const zip  = FilterState.parseZip(listing.address);
    const addr = listing.address.toLowerCase();
    return city.includes(q) || zip.includes(q) || addr.includes(q);
  }

  /**
   * Apply all active filters to a listings array.
   * @param {object[]} listings
   * @returns {object[]}
   */
  applyTo(listings) {
    return listings.filter((l) => {
      if (this.searchQuery && !this.matchesSearch(l)) return false;
      if (this.types.size > 0 && !this.types.has(l.type)) return false;
      if (l.bedrooms  < this.minBeds)  return false;
      if (l.bathrooms < this.minBaths) return false;
      if (l.price < this.priceMin)     return false;
      if (l.price > this.priceMax)     return false;
      if ((l.sqft || 0) < this.sqftMin) return false;
      if (this.sqftMax < Infinity && (l.sqft || Infinity) > this.sqftMax) return false;
      if (this.amenities.size > 0) {
        for (const amenity of this.amenities) {
          if (!(l.amenities || []).includes(amenity)) return false;
        }
      }
      return true;
    });
  }

  // ── Chip generation ──────────────────────────────

  /**
   * Build the list of active-filter chip descriptors for the toolbar.
   * @returns {{ label: string, key: string, value?: string }[]}
   */
  getActiveChips() {
    const chips = [];
    for (const type of this.types) chips.push({ label: type, key: 'type', value: type });
    if (this.minBeds > 0)  chips.push({ label: this.minBeds  + '+ Beds',  key: 'beds'  });
    if (this.minBaths > 0) chips.push({ label: this.minBaths + '+ Baths', key: 'baths' });

    if (this.priceMin > 0 && this.priceMax < Infinity) {
      chips.push({ label: '$' + this.priceMin.toLocaleString() + ' – $' + this.priceMax.toLocaleString(), key: 'price' });
    } else if (this.priceMin > 0) {
      chips.push({ label: '$' + this.priceMin.toLocaleString() + '+', key: 'price' });
    } else if (this.priceMax < Infinity) {
      chips.push({ label: 'Up to $' + this.priceMax.toLocaleString(), key: 'price' });
    }

    if (this.sqftMin > 0 && this.sqftMax < Infinity) {
      chips.push({ label: this.sqftMin + ' – ' + this.sqftMax + ' sqft', key: 'sqft' });
    } else if (this.sqftMin > 0) {
      chips.push({ label: this.sqftMin + '+ sqft', key: 'sqft' });
    } else if (this.sqftMax < Infinity) {
      chips.push({ label: 'Up to ' + this.sqftMax + ' sqft', key: 'sqft' });
    }

    for (const amenity of this.amenities) chips.push({ label: amenity, key: 'amenity', value: amenity });
    return chips;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// FilterManager – DOM + UX layer
// ─────────────────────────────────────────────────────────────────────────────

class FilterManager {
  /**
   * @param {string}    containerId  - id of the filter toolbar container element
   * @param {object[]}  listings     - normalized listing objects
   * @param {object[]}  universities - university objects
   * @param {EventBus}  [eventBus]   - optional bus; publishes events when provided
   */
  constructor(containerId, listings, universities, eventBus) {
    this.container    = document.getElementById(containerId);
    this.listings     = listings;
    this.universities = universities || [];
    this._bus         = eventBus || null;

    // Backward-compat callback slots (used when no EventBus is present)
    this._onChange       = null;
    this._onSearchChange = null;
    this._onTargetChange = null;
    this._onPlaceSelect  = null;

    this._searchDebounceTimer = null;
    this._currentPanel    = null;
    this._placesService   = null;
    this._placesRequestId = 0;

    this._targetUniversity =
      this.universities.find((u) => u.name === 'CSUN') ||
      this.universities[0] || null;

    // Pre-compute unique values for suggestions
    this.allTypes     = [...new Set(listings.map((l) => l.type))].sort();
    this.allAmenities = [...new Set(listings.flatMap((l) => l.amenities))].sort();
    this.allCities    = [...new Set(listings.map((l) => FilterState.parseCity(l.address)))].filter(Boolean).sort();
    this.allZips      = [...new Set(listings.map((l) => FilterState.parseZip(l.address)))].filter(Boolean).sort();

    this._suggestions = this._buildSuggestions();

    /** @type {FilterState} */
    this.state = new FilterState();

    this._render();
    this._bindEvents();
  }

  // ── Suggestion building ──────────────────────────

  _buildSuggestions() {
    const suggestions = [];
    this.universities.forEach((uni) => {
      suggestions.push({
        text:        uni.name + ' – ' + uni.fullName,
        type:        'Campus',
        icon:        'M12 3L1 9l4 2.18v6L12 21l7-3.82v-6L23 9l-11-6z',
        searchValue: uni.name.toLowerCase() + ' ' + uni.fullName.toLowerCase(),
        uniName:     uni.name,
      });
    });
    this.allCities.forEach((city) => {
      const count = this.listings.filter((l) => FilterState.parseCity(l.address) === city).length;
      suggestions.push({
        text:        city,
        type:        'City · ' + count + ' listing' + (count !== 1 ? 's' : ''),
        icon:        'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
        searchValue: city.toLowerCase(),
      });
    });
    this.allZips.forEach((zip) => {
      const sample = this.listings.find((l) => FilterState.parseZip(l.address) === zip);
      const city   = sample ? FilterState.parseCity(sample.address) : '';
      suggestions.push({
        text:        zip,
        type:        'Zip Code · ' + city,
        icon:        'M20 6H10v2h10V6zm0 4H10v2h10v-2zm0 4H10v2h10v-2zM4 6h4v12H4z',
        searchValue: zip,
      });
    });
    this.listings.forEach((l) => {
      suggestions.push({
        text:        l.address,
        type:        'Address',
        icon:        'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
        searchValue: l.address.toLowerCase(),
      });
    });
    return suggestions;
  }

  _matchSuggestions(query, limit) {
    if (!query) return [];
    limit = limit || 6;
    const q = query.toLowerCase();
    return this._suggestions
      .filter((s) => s.text.toLowerCase().includes(q) || s.searchValue.includes(q))
      .slice(0, limit);
  }

  // ── Render ───────────────────────────────────────

  _render() {
    const chevron =
      '<svg class="ftb__chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">' +
        '<polyline points="6 9 12 15 18 9"/>' +
      '</svg>';

    const uniOptions = this.universities
      .slice().sort((a, b) => a.name.localeCompare(b.name))
      .map((u) =>
        '<option value="' + u.name + '"' +
          (u.name === (this._targetUniversity ? this._targetUniversity.name : '') ? ' selected' : '') +
        '>' + u.name + '</option>'
      ).join('');

    const renderBtn = (name, label) =>
      '<div class="ftb__btn-wrap" data-panel="' + name + '">' +
        '<button class="ftb__btn" data-panel="' + name + '">' +
          '<span>' + label + '</span>' + chevron +
        '</button>' +
      '</div>';

    const typeChecks = this.allTypes.map((t) =>
      '<label class="ftb__check"><input type="checkbox" value="' + t + '" data-filter="type"/><span>' + t + '</span></label>'
    ).join('');

    const amenityChecks = this.allAmenities.map((a) =>
      '<label class="ftb__check"><input type="checkbox" value="' + a + '" data-filter="amenity"/><span>' + a + '</span></label>'
    ).join('');

    this.container.innerHTML =
      '<div class="ftb">' +

        '<div class="ftb__row ftb__search-row">' +
          '<div class="ftb__target" title="Target university – distances computed from this campus">' +
            '<svg class="ftb__target-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">' +
              '<path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6L23 9l-11-6z"/>' +
            '</svg>' +
            '<select class="ftb__target-select" id="filter-target">' + uniOptions + '</select>' +
          '</div>' +
          '<div class="ftb__search">' +
            '<svg class="ftb__search-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">' +
              '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
            '</svg>' +
            '<input type="text" id="filter-search" class="ftb__search-input"' +
              ' placeholder="Search by city, zip, address, or university..." autocomplete="off" />' +
            '<div class="ftb__autocomplete" id="filter-dropdown" style="display:none;"></div>' +
          '</div>' +
        '</div>' +

        '<div class="ftb__row ftb__buttons">' +
          renderBtn('type',      'Property Type') +
          renderBtn('beds',      'Beds') +
          renderBtn('baths',     'Baths') +
          renderBtn('price',     'Price') +
          renderBtn('sqft',      'Sqft') +
          renderBtn('amenities', 'Amenities') +
        '</div>' +

        '<div class="ftb__panel" id="panel-type">' + typeChecks + '</div>' +

        '<div class="ftb__panel" id="panel-beds">' +
          '<select id="filter-beds" class="ftb__select">' +
            '<option value="0">Any</option><option value="1">1+</option>' +
            '<option value="2">2+</option><option value="3">3+</option>' +
          '</select>' +
        '</div>' +

        '<div class="ftb__panel" id="panel-baths">' +
          '<select id="filter-baths" class="ftb__select">' +
            '<option value="0">Any</option><option value="1">1+</option><option value="2">2+</option>' +
          '</select>' +
        '</div>' +

        '<div class="ftb__panel" id="panel-price">' +
          '<div class="ftb__range">' +
            '<input type="number" id="filter-price-min" class="ftb__num" placeholder="Min $" min="0" step="50"/>' +
            '<span class="ftb__range-sep">&ndash;</span>' +
            '<input type="number" id="filter-price-max" class="ftb__num" placeholder="Max $" min="0" step="50"/>' +
          '</div>' +
        '</div>' +

        '<div class="ftb__panel" id="panel-sqft">' +
          '<div class="ftb__range">' +
            '<input type="number" id="filter-sqft-min" class="ftb__num" placeholder="Min" min="0" step="50"/>' +
            '<span class="ftb__range-sep">&ndash;</span>' +
            '<input type="number" id="filter-sqft-max" class="ftb__num" placeholder="Max" min="0" step="50"/>' +
          '</div>' +
        '</div>' +

        '<div class="ftb__panel ftb__panel--wide" id="panel-amenities">' + amenityChecks + '</div>' +

        '<div class="ftb__chips" id="filter-chips"></div>' +
      '</div>';
  }

  // ── Event binding ────────────────────────────────

  _bindEvents() {
    const self = this;

    // Target university dropdown
    const targetSel = document.getElementById('filter-target');
    if (targetSel) {
      targetSel.addEventListener('change', function(e) {
        const uni = self.universities.find((u) => u.name === e.target.value);
        if (uni) {
          self._targetUniversity = uni;
          self._emitTargetChange(uni);
        }
      });
    }

    // Search input + autocomplete
    const searchInput = document.getElementById('filter-search');
    const acDropdown  = document.getElementById('filter-dropdown');
    this._activeDropdownIndex = -1;

    if (searchInput) {
      searchInput.addEventListener('input', function() {
        self.state.searchQuery = searchInput.value.trim().toLowerCase();
        self._showAutocomplete(searchInput.value.trim());
        self._onFilterChange();
        self._emitSearchChange();
      });

      searchInput.addEventListener('focus', function() {
        self._closeAllPanels();
        if (searchInput.value.trim()) self._showAutocomplete(searchInput.value.trim());
      });

      searchInput.addEventListener('keydown', function(e) {
        const items = acDropdown.querySelectorAll('.ftb__ac-item');
        if (!items.length) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          self._activeDropdownIndex = Math.min(self._activeDropdownIndex + 1, items.length - 1);
          self._highlightAcItem(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          self._activeDropdownIndex = Math.max(self._activeDropdownIndex - 1, 0);
          self._highlightAcItem(items);
        } else if (e.key === 'Enter' && self._activeDropdownIndex >= 0) {
          e.preventDefault();
          items[self._activeDropdownIndex].click();
        } else if (e.key === 'Escape') {
          self._hideAutocomplete();
          searchInput.blur();
        }
      });
    }

    // Filter button toggles
    this.container.querySelectorAll('.ftb__btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        self._hideAutocomplete();
        const name = btn.dataset.panel;
        if (self._currentPanel === name) { self._closeAllPanels(); } else { self._showPanel(name); }
      });
    });

    // Close panels + autocomplete when clicking outside
    document.addEventListener('click', function(e) {
      if (!self.container.contains(e.target)) {
        self._closeAllPanels();
        self._hideAutocomplete();
      }
    });

    // Prevent click inside a panel from bubbling to document
    this.container.querySelectorAll('.ftb__panel').forEach(function(panel) {
      panel.addEventListener('click', function(e) { e.stopPropagation(); });
    });

    // Property type checkboxes
    this.container.querySelectorAll('[data-filter="type"]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        cb.checked ? self.state.types.add(cb.value) : self.state.types.delete(cb.value);
        self._onFilterChange();
      });
    });

    // Amenity checkboxes
    this.container.querySelectorAll('[data-filter="amenity"]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        cb.checked ? self.state.amenities.add(cb.value) : self.state.amenities.delete(cb.value);
        self._onFilterChange();
      });
    });

    // Beds / Baths selects
    const bedsEl  = document.getElementById('filter-beds');
    const bathsEl = document.getElementById('filter-baths');
    if (bedsEl)  bedsEl.addEventListener('change',  function(e) { self.state.minBeds  = parseInt(e.target.value, 10); self._onFilterChange(); });
    if (bathsEl) bathsEl.addEventListener('change', function(e) { self.state.minBaths = parseInt(e.target.value, 10); self._onFilterChange(); });

    // Price range inputs
    const pMin = document.getElementById('filter-price-min');
    const pMax = document.getElementById('filter-price-max');
    if (pMin) pMin.addEventListener('input', function(e) { self.state.priceMin = e.target.value ? parseInt(e.target.value, 10) : 0;       self._onFilterChange(); });
    if (pMax) pMax.addEventListener('input', function(e) { self.state.priceMax = e.target.value ? parseInt(e.target.value, 10) : Infinity; self._onFilterChange(); });

    // Sqft range inputs
    const sMin = document.getElementById('filter-sqft-min');
    const sMax = document.getElementById('filter-sqft-max');
    if (sMin) sMin.addEventListener('input', function(e) { self.state.sqftMin = e.target.value ? parseInt(e.target.value, 10) : 0;       self._onFilterChange(); });
    if (sMax) sMax.addEventListener('input', function(e) { self.state.sqftMax = e.target.value ? parseInt(e.target.value, 10) : Infinity; self._onFilterChange(); });
  }

  // ── Panel management ─────────────────────────────

  _showPanel(name) {
    this._closeAllPanels();
    const panel = document.getElementById('panel-' + name);
    const btn   = this.container.querySelector('.ftb__btn-wrap[data-panel="' + name + '"]');
    if (panel && btn) {
      panel.classList.add('ftb__panel--open');
      btn.querySelector('.ftb__btn').classList.add('ftb__btn--active');
      const btnRect = btn.getBoundingClientRect();
      const cRect   = this.container.getBoundingClientRect();
      panel.style.top  = (btnRect.bottom - cRect.top) + 'px';
      panel.style.left = (btnRect.left - cRect.left) + 'px';
    }
    this._currentPanel = name;
  }

  _closeAllPanels() {
    this.container.querySelectorAll('.ftb__panel').forEach(function(p) { p.classList.remove('ftb__panel--open'); });
    this.container.querySelectorAll('.ftb__btn').forEach(function(b) { b.classList.remove('ftb__btn--active'); });
    this._currentPanel = null;
  }

  // ── Button state & chips ─────────────────────────

  _updateButtonStates() {
    const setActive = (name, active) => {
      const wrap = this.container.querySelector('.ftb__btn-wrap[data-panel="' + name + '"]');
      if (wrap) wrap.querySelector('.ftb__btn').classList.toggle('ftb__btn--has-value', active);
    };
    const s = this.state;
    setActive('type',      s.types.size > 0);
    setActive('beds',      s.minBeds > 0);
    setActive('baths',     s.minBaths > 0);
    setActive('price',     s.priceMin > 0 || s.priceMax < Infinity);
    setActive('sqft',      s.sqftMin > 0 || s.sqftMax < Infinity);
    setActive('amenities', s.amenities.size > 0);
  }

  _updateChips() {
    const chips     = this.state.getActiveChips();
    const container = document.getElementById('filter-chips');
    if (!chips.length) { container.innerHTML = ''; return; }
    const self = this;
    container.innerHTML =
      chips.map((c) =>
        '<span class="ftb__chip" data-key="' + c.key + '" data-value="' + (c.value || '') + '">' +
          c.label +
          '<button class="ftb__chip-x" aria-label="Remove">&times;</button>' +
        '</span>'
      ).join('') +
      '<button class="ftb__chip ftb__chip--reset" id="chip-reset-all">Clear all</button>';

    container.querySelectorAll('.ftb__chip-x').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const chip = btn.parentElement;
        self._removeFilter(chip.dataset.key, chip.dataset.value);
      });
    });

    const resetBtn = document.getElementById('chip-reset-all');
    if (resetBtn) resetBtn.addEventListener('click', function() { self._resetAll(); });
  }

  _removeFilter(key, value) {
    const s = this.state;
    switch (key) {
      case 'type': {
        s.types.delete(value);
        const tc = this.container.querySelector('[data-filter="type"][value="' + value + '"]');
        if (tc) tc.checked = false;
        break;
      }
      case 'beds': {
        s.minBeds = 0;
        const bedsEl = document.getElementById('filter-beds');
        if (bedsEl) bedsEl.value = '0';
        break;
      }
      case 'baths': {
        s.minBaths = 0;
        const bathsEl = document.getElementById('filter-baths');
        if (bathsEl) bathsEl.value = '0';
        break;
      }
      case 'price': {
        s.priceMin = 0; s.priceMax = Infinity;
        const pmn = document.getElementById('filter-price-min');
        const pmx = document.getElementById('filter-price-max');
        if (pmn) pmn.value = ''; if (pmx) pmx.value = '';
        break;
      }
      case 'sqft': {
        s.sqftMin = 0; s.sqftMax = Infinity;
        const smn = document.getElementById('filter-sqft-min');
        const smx = document.getElementById('filter-sqft-max');
        if (smn) smn.value = ''; if (smx) smx.value = '';
        break;
      }
      case 'amenity': {
        s.amenities.delete(value);
        const ac = this.container.querySelector('[data-filter="amenity"][value="' + value + '"]');
        if (ac) ac.checked = false;
        break;
      }
    }
    this._onFilterChange();
  }

  _resetAll() {
    this.state.reset();
    const srch = document.getElementById('filter-search'); if (srch) srch.value = '';
    const beds = document.getElementById('filter-beds');   if (beds) beds.value = '0';
    const bath = document.getElementById('filter-baths');  if (bath) bath.value = '0';
    ['filter-price-min', 'filter-price-max', 'filter-sqft-min', 'filter-sqft-max'].forEach(function(id) {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    this.container.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
    this._onFilterChange();
    this._emitSearchChange();
  }

  // ── Autocomplete ─────────────────────────────────

  _showAutocomplete(query) {
    if (!query || query.length < 2) { this._hideAutocomplete(); return; }
    const dropdown = document.getElementById('filter-dropdown');
    const matches  = this._matchSuggestions(query);
    const self     = this;
    this._activeDropdownIndex = -1;

    dropdown.innerHTML = matches.map(function(s, i) {
      return '<div class="ftb__ac-item" data-index="' + i + '" data-value="' + s.searchValue + '" data-uni="' + (s.uniName || '') + '">' +
        '<svg class="ftb__ac-icon" viewBox="0 0 24 24" width="16" height="16"><path d="' + s.icon + '" fill="currentColor"/></svg>' +
        '<div class="ftb__ac-text">' +
          '<span class="ftb__ac-name">' + self._highlightMatch(s.text, query) + '</span>' +
          '<span class="ftb__ac-type">' + s.type + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.ftb__ac-item').forEach(function(item) {
      item.addEventListener('mousedown', function(e) {
        e.preventDefault();
        const uniName = item.dataset.uni;
        if (uniName) { self._selectUniversitySuggestion(uniName); }
        else         { self._selectSuggestion(item.dataset.value); }
      });
    });

    this._fetchPlacePredictions(query, dropdown);
  }

  _fetchPlacePredictions(query, dropdown) {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) return;
    if (!this._placesService) this._placesService = new google.maps.places.AutocompleteService();
    this._placesRequestId += 1;
    const requestId = this._placesRequestId;
    const self      = this;
    this._placesService.getPlacePredictions({ input: query }, function(predictions, status) {
      if (requestId !== self._placesRequestId) return;  // stale response
      if (dropdown.style.display === 'none') return;
      if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
        if (dropdown.children.length === 0) dropdown.style.display = 'none';
        return;
      }
      if (dropdown.children.length > 0) {
        const sep = document.createElement('div');
        sep.className  = 'ftb__ac-sep';
        sep.textContent = 'More places';
        dropdown.appendChild(sep);
      }
      predictions.slice(0, 4).forEach(function(p) {
        const item = document.createElement('div');
        item.className    = 'ftb__ac-item ftb__ac-item--place';
        item.dataset.placeId = p.place_id;
        item.innerHTML =
          '<svg class="ftb__ac-icon" viewBox="0 0 24 24" width="16" height="16">' +
            '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="currentColor"/>' +
          '</svg>' +
          '<div class="ftb__ac-text">' +
            '<span class="ftb__ac-name">' + self._highlightMatch(p.structured_formatting.main_text, query) + '</span>' +
            '<span class="ftb__ac-type">' + (p.structured_formatting.secondary_text || 'Google Maps') + '</span>' +
          '</div>';
        item.addEventListener('mousedown', function(e) {
          e.preventDefault();
          self._selectPlaceSuggestion(p.place_id, p.description);
        });
        dropdown.appendChild(item);
      });
    });
  }

  _selectPlaceSuggestion(placeId, description) {
    const searchInput = document.getElementById('filter-search');
    if (searchInput) searchInput.value = description;
    this.state.searchQuery = description.toLowerCase();
    this._hideAutocomplete();
    if (this._bus) {
      this._bus.publish('filter:placeSelected', { placeId });
    } else if (this._onPlaceSelect) {
      this._onPlaceSelect(placeId, description);
    }
  }

  _hideAutocomplete() {
    const dropdown = document.getElementById('filter-dropdown');
    if (dropdown) { dropdown.style.display = 'none'; dropdown.innerHTML = ''; }
    this._activeDropdownIndex = -1;
  }

  _highlightAcItem(items) {
    const idx = this._activeDropdownIndex;
    items.forEach(function(el, i) { el.classList.toggle('ftb__ac-item--active', i === idx); });
  }

  _highlightMatch(text, query) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      text.slice(0, idx) +
      '<strong>' + text.slice(idx, idx + query.length) + '</strong>' +
      text.slice(idx + query.length)
    );
  }

  _selectSuggestion(value) {
    const searchInput = document.getElementById('filter-search');
    if (searchInput) searchInput.value = value;
    this.state.searchQuery = value.toLowerCase();
    this._hideAutocomplete();
    this._onFilterChange();
    this._emitSearchChange();
  }

  _selectUniversitySuggestion(uniName) {
    const uni = this.universities.find((u) => u.name === uniName);
    if (!uni) return;
    this._targetUniversity = uni;
    const sel = document.getElementById('filter-target');
    if (sel) sel.value = uni.name;
    const searchInput = document.getElementById('filter-search');
    if (searchInput) searchInput.value = '';
    this.state.searchQuery = '';
    this._hideAutocomplete();
    this._onFilterChange();
    this._emitTargetChange(uni);
  }

  // ── Internal event emitters ──────────────────────

  _onFilterChange() {
    this._updateChips();
    this._updateButtonStates();
    if (this._bus) {
      this._bus.publish('filter:changed');
    } else if (this._onChange) {
      this._onChange();
    }
  }

  _emitTargetChange(uni) {
    if (this._bus) {
      this._bus.publish('filter:targetChanged', { university: uni });
    } else if (this._onTargetChange) {
      this._onTargetChange(uni);
    }
  }

  _emitSearchChange() {
    const self = this;
    clearTimeout(this._searchDebounceTimer);
    this._searchDebounceTimer = setTimeout(function() {
      const matches = self.getSearchMatches();
      if (self._bus) {
        self._bus.publish('filter:searchChanged', { matches });
      } else if (self._onSearchChange) {
        self._onSearchChange(matches);
      }
    }, 400);
  }

  // ── Public API ───────────────────────────────────

  /**
   * Apply current filters to a listings array.
   * Delegates to FilterState.applyTo() so callers don't need to
   * reach into the state object directly.
   * @param {object[]} listings
   * @returns {object[]}
   */
  applyFilters(listings) {
    return this.state.applyTo(listings);
  }

  /**
   * Return the Set of listing IDs that pass all active filters
   * against the full listings array.
   * @returns {Set<number>}
   */
  getPassingIds() {
    return new Set(this.state.applyTo(this.listings).map((l) => l.id));
  }

  /**
   * Return listings that match the current text search query.
   * @returns {object[]}
   */
  getSearchMatches() {
    if (!this.state.searchQuery) return [];
    return this.listings.filter((l) => this.state.matchesSearch(l));
  }

  /** Programmatically set the target university. */
  setTargetUniversity(uni) {
    this._targetUniversity = uni;
    const sel = document.getElementById('filter-target');
    if (sel) sel.value = uni.name;
  }

  getTargetUniversity() { return this._targetUniversity; }

  // Backward-compat callback setters (used when no EventBus is provided)
  onChange(cb)       { this._onChange       = cb; }
  onSearchChange(cb) { this._onSearchChange = cb; }
  onTargetChange(cb) { this._onTargetChange = cb; }
  onPlaceSelect(cb)  { this._onPlaceSelect  = cb; }
}

window.FilterState   = FilterState;
window.FilterManager = FilterManager;
