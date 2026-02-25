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
 */

class FilterManager {
  constructor(containerId, listings, universities) {
    this.container    = document.getElementById(containerId);
    this.listings     = listings;
    this.universities = universities || [];
    this._onChange          = null;
    this._onSearchChange    = null;
    this._onTargetChange    = null;
    this._onPlaceSelect     = null;
    this._searchDebounceTimer = null;
    this._currentPanel    = null;
    this._placesService   = null;
    this._placesRequestId = 0;

    this._targetUniversity =
      this.universities.find((u) => u.name === 'CSUN') ||
      this.universities[0] || null;

    this.allTypes     = [...new Set(listings.map((l) => l.type))].sort();
    this.allAmenities = [...new Set(listings.flatMap((l) => l.amenities))].sort();
    this.allCities    = [...new Set(listings.map((l) => this._parseCity(l.address)))].filter(Boolean).sort();
    this.allZips      = [...new Set(listings.map((l) => this._parseZip(l.address)))].filter(Boolean).sort();

    this._suggestions = this._buildSuggestions();

    this.state = {
      searchQuery: '',
      types: new Set(),
      minBeds: 0,
      minBaths: 0,
      priceMin: 0,
      priceMax: Infinity,
      sqftMin: 0,
      sqftMax: Infinity,
      amenities: new Set(),
    };

    this._render();
    this._bindEvents();
  }

  _parseCity(address) {
    const parts = (address || '').split(',');
    return parts.length >= 2 ? parts[1].trim() : '';
  }

  _parseZip(address) {
    const match = (address || '').match(/\d{5}$/);
    return match ? match[0] : '';
  }

  _buildSuggestions() {
    const suggestions = [];
    this.universities.forEach((uni) => {
      suggestions.push({
        text: uni.name + ' – ' + uni.fullName,
        type: 'Campus',
        icon: 'M12 3L1 9l4 2.18v6L12 21l7-3.82v-6L23 9l-11-6z',
        searchValue: uni.name.toLowerCase() + ' ' + uni.fullName.toLowerCase(),
        uniName: uni.name,
      });
    });
    this.allCities.forEach((city) => {
      const count = this.listings.filter((l) => this._parseCity(l.address) === city).length;
      suggestions.push({
        text: city,
        type: 'City · ' + count + ' listing' + (count !== 1 ? 's' : ''),
        icon: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
        searchValue: city.toLowerCase(),
      });
    });
    this.allZips.forEach((zip) => {
      const sample = this.listings.find((l) => this._parseZip(l.address) === zip);
      const city = sample ? this._parseCity(sample.address) : '';
      suggestions.push({
        text: zip,
        type: 'Zip Code · ' + city,
        icon: 'M20 6H10v2h10V6zm0 4H10v2h10v-2zm0 4H10v2h10v-2zM4 6h4v12H4z',
        searchValue: zip,
      });
    });
    this.listings.forEach((l) => {
      suggestions.push({
        text: l.address,
        type: 'Address',
        icon: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
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

  _bindEvents() {
    const self = this;

    const targetSel = document.getElementById('filter-target');
    if (targetSel) {
      targetSel.addEventListener('change', function(e) {
        const uni = self.universities.find((u) => u.name === e.target.value);
        if (uni) { self._targetUniversity = uni; if (self._onTargetChange) self._onTargetChange(uni); }
      });
    }

    const searchInput = document.getElementById('filter-search');
    const acDropdown  = document.getElementById('filter-dropdown');
    this._activeDropdownIndex = -1;

    if (searchInput) {
      searchInput.addEventListener('input', function() {
        self.state.searchQuery = searchInput.value.trim().toLowerCase();
        self._showAutocomplete(searchInput.value.trim());
        self._emitChange();
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

    this.container.querySelectorAll('.ftb__btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        self._hideAutocomplete();
        const name = btn.dataset.panel;
        if (self._currentPanel === name) { self._closeAllPanels(); } else { self._showPanel(name); }
      });
    });

    document.addEventListener('click', function(e) {
      if (!self.container.contains(e.target)) { self._closeAllPanels(); self._hideAutocomplete(); }
    });

    this.container.querySelectorAll('.ftb__panel').forEach(function(panel) {
      panel.addEventListener('click', function(e) { e.stopPropagation(); });
    });

    this.container.querySelectorAll('[data-filter="type"]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        cb.checked ? self.state.types.add(cb.value) : self.state.types.delete(cb.value);
        self._onFilterChange();
      });
    });

    this.container.querySelectorAll('[data-filter="amenity"]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        cb.checked ? self.state.amenities.add(cb.value) : self.state.amenities.delete(cb.value);
        self._onFilterChange();
      });
    });

    ['filter-beds',      function(v) { self.state.minBeds  = parseInt(v, 10); self._onFilterChange(); }].forEach(function(_, i, a) { if (i === 0) { const el = document.getElementById(a[0]); if (el) el.addEventListener('change', function(e) { a[1](e.target.value); }); } });
    ['filter-baths',     function(v) { self.state.minBaths = parseInt(v, 10); self._onFilterChange(); }].forEach(function(_, i, a) { if (i === 0) { const el = document.getElementById(a[0]); if (el) el.addEventListener('change', function(e) { a[1](e.target.value); }); } });

    const bedsEl  = document.getElementById('filter-beds');
    const bathsEl = document.getElementById('filter-baths');
    if (bedsEl)  bedsEl.addEventListener('change',  function(e) { self.state.minBeds  = parseInt(e.target.value, 10); self._onFilterChange(); });
    if (bathsEl) bathsEl.addEventListener('change', function(e) { self.state.minBaths = parseInt(e.target.value, 10); self._onFilterChange(); });

    const pMin = document.getElementById('filter-price-min');
    const pMax = document.getElementById('filter-price-max');
    if (pMin) pMin.addEventListener('input', function(e) { self.state.priceMin = e.target.value ? parseInt(e.target.value, 10) : 0;        self._onFilterChange(); });
    if (pMax) pMax.addEventListener('input', function(e) { self.state.priceMax = e.target.value ? parseInt(e.target.value, 10) : Infinity;  self._onFilterChange(); });

    const sMin = document.getElementById('filter-sqft-min');
    const sMax = document.getElementById('filter-sqft-max');
    if (sMin) sMin.addEventListener('input', function(e) { self.state.sqftMin = e.target.value ? parseInt(e.target.value, 10) : 0;        self._onFilterChange(); });
    if (sMax) sMax.addEventListener('input', function(e) { self.state.sqftMax = e.target.value ? parseInt(e.target.value, 10) : Infinity;  self._onFilterChange(); });
  }

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

  _updateButtonStates() {
    const setActive = (name, active) => {
      const wrap = this.container.querySelector('.ftb__btn-wrap[data-panel="' + name + '"]');
      if (wrap) wrap.querySelector('.ftb__btn').classList.toggle('ftb__btn--has-value', active);
    };
    setActive('type',      this.state.types.size > 0);
    setActive('beds',      this.state.minBeds > 0);
    setActive('baths',     this.state.minBaths > 0);
    setActive('price',     this.state.priceMin > 0 || this.state.priceMax < Infinity);
    setActive('sqft',      this.state.sqftMin > 0 || this.state.sqftMax < Infinity);
    setActive('amenities', this.state.amenities.size > 0);
  }

  _updateChips() {
    const chips = this._getActiveChips();
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

  _getActiveChips() {
    const chips = [];
    for (const type of this.state.types) chips.push({ label: type, key: 'type', value: type });
    if (this.state.minBeds > 0)  chips.push({ label: this.state.minBeds  + '+ Beds',  key: 'beds'  });
    if (this.state.minBaths > 0) chips.push({ label: this.state.minBaths + '+ Baths', key: 'baths' });
    if (this.state.priceMin > 0 && this.state.priceMax < Infinity) {
      chips.push({ label: '$' + this.state.priceMin.toLocaleString() + ' – $' + this.state.priceMax.toLocaleString(), key: 'price' });
    } else if (this.state.priceMin > 0) {
      chips.push({ label: '$' + this.state.priceMin.toLocaleString() + '+', key: 'price' });
    } else if (this.state.priceMax < Infinity) {
      chips.push({ label: 'Up to $' + this.state.priceMax.toLocaleString(), key: 'price' });
    }
    if (this.state.sqftMin > 0 && this.state.sqftMax < Infinity) {
      chips.push({ label: this.state.sqftMin + ' – ' + this.state.sqftMax + ' sqft', key: 'sqft' });
    } else if (this.state.sqftMin > 0) {
      chips.push({ label: this.state.sqftMin + '+ sqft', key: 'sqft' });
    } else if (this.state.sqftMax < Infinity) {
      chips.push({ label: 'Up to ' + this.state.sqftMax + ' sqft', key: 'sqft' });
    }
    for (const amenity of this.state.amenities) chips.push({ label: amenity, key: 'amenity', value: amenity });
    return chips;
  }

  _removeFilter(key, value) {
    switch (key) {
      case 'type':    this.state.types.delete(value);    const tc = this.container.querySelector('[data-filter="type"][value="' + value + '"]'); if (tc) tc.checked = false; break;
      case 'beds':    this.state.minBeds = 0;            const bedsEl = document.getElementById('filter-beds'); if (bedsEl) bedsEl.value = '0'; break;
      case 'baths':   this.state.minBaths = 0;           const bathsEl = document.getElementById('filter-baths'); if (bathsEl) bathsEl.value = '0'; break;
      case 'price':   this.state.priceMin = 0; this.state.priceMax = Infinity; const pmn = document.getElementById('filter-price-min'); const pmx = document.getElementById('filter-price-max'); if (pmn) pmn.value = ''; if (pmx) pmx.value = ''; break;
      case 'sqft':    this.state.sqftMin = 0; this.state.sqftMax = Infinity; const smn = document.getElementById('filter-sqft-min'); const smx = document.getElementById('filter-sqft-max'); if (smn) smn.value = ''; if (smx) smx.value = ''; break;
      case 'amenity': this.state.amenities.delete(value); const ac = this.container.querySelector('[data-filter="amenity"][value="' + value + '"]'); if (ac) ac.checked = false; break;
    }
    this._onFilterChange();
  }

  _resetAll() {
    this.state = { searchQuery: '', types: new Set(), minBeds: 0, minBaths: 0, priceMin: 0, priceMax: Infinity, sqftMin: 0, sqftMax: Infinity, amenities: new Set() };
    const srch = document.getElementById('filter-search'); if (srch) srch.value = '';
    const beds = document.getElementById('filter-beds'); if (beds) beds.value = '0';
    const bath = document.getElementById('filter-baths'); if (bath) bath.value = '0';
    ['filter-price-min','filter-price-max','filter-sqft-min','filter-sqft-max'].forEach(function(id) { const el = document.getElementById(id); if (el) el.value = ''; });
    this.container.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
    this._onFilterChange();
    this._emitSearchChange();
  }

  _showAutocomplete(query) {
    if (!query || query.length < 2) { this._hideAutocomplete(); return; }
    const dropdown = document.getElementById('filter-dropdown');
    const matches = this._matchSuggestions(query);
    const self = this;
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
        if (uniName) { self._selectUniversitySuggestion(uniName); } else { self._selectSuggestion(item.dataset.value); }
      });
    });

    this._fetchPlacePredictions(query, dropdown);
  }

  _fetchPlacePredictions(query, dropdown) {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) return;
    if (!this._placesService) this._placesService = new google.maps.places.AutocompleteService();
    this._placesRequestId += 1;
    const requestId = this._placesRequestId;
    const self = this;
    this._placesService.getPlacePredictions({ input: query }, function(predictions, status) {
      if (requestId !== self._placesRequestId) return;
      if (dropdown.style.display === 'none') return;
      if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
        if (dropdown.children.length === 0) dropdown.style.display = 'none';
        return;
      }
      if (dropdown.children.length > 0) {
        const sep = document.createElement('div');
        sep.className = 'ftb__ac-sep'; sep.textContent = 'More places';
        dropdown.appendChild(sep);
      }
      predictions.slice(0, 4).forEach(function(p) {
        const item = document.createElement('div');
        item.className = 'ftb__ac-item ftb__ac-item--place';
        item.dataset.placeId = p.place_id;
        item.innerHTML =
          '<svg class="ftb__ac-icon" viewBox="0 0 24 24" width="16" height="16"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="currentColor"/></svg>' +
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
    if (this._onPlaceSelect) this._onPlaceSelect(placeId, description);
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
    return text.slice(0, idx) + '<strong>' + text.slice(idx, idx + query.length) + '</strong>' + text.slice(idx + query.length);
  }

  _selectSuggestion(value) {
    const searchInput = document.getElementById('filter-search');
    if (searchInput) searchInput.value = value;
    this.state.searchQuery = value.toLowerCase();
    this._hideAutocomplete();
    this._emitChange();
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
    this._emitChange();
    if (this._onTargetChange) this._onTargetChange(uni);
  }

  _matchesSearch(listing, query) {
    const city = this._parseCity(listing.address).toLowerCase();
    const zip  = this._parseZip(listing.address);
    const addr = listing.address.toLowerCase();
    return city.includes(query) || zip.includes(query) || addr.includes(query);
  }

  applyFilters(listings) {
    const s = this.state;
    return listings.filter((l) => {
      if (s.searchQuery && !this._matchesSearch(l, s.searchQuery)) return false;
      if (s.types.size > 0 && !s.types.has(l.type)) return false;
      if (l.bedrooms < s.minBeds) return false;
      if (l.bathrooms < s.minBaths) return false;
      if (l.price < s.priceMin) return false;
      if (l.price > s.priceMax) return false;
      if ((l.sqft || 0) < s.sqftMin) return false;
      if (s.sqftMax < Infinity && (l.sqft || Infinity) > s.sqftMax) return false;
      if (s.amenities.size > 0) {
        for (const amenity of s.amenities) { if (!(l.amenities || []).includes(amenity)) return false; }
      }
      return true;
    });
  }

  getPassingIds() {
    const passing = this.applyFilters(this.listings);
    return new Set(passing.map((l) => l.id));
  }

  getSearchMatches() {
    if (!this.state.searchQuery) return [];
    const query = this.state.searchQuery;
    return this.listings.filter((l) => this._matchesSearch(l, query));
  }

  _onFilterChange() {
    this._updateChips();
    this._updateButtonStates();
    this._emitChange();
  }

  _emitChange() { if (this._onChange) this._onChange(); }

  _emitSearchChange() {
    const self = this;
    clearTimeout(this._searchDebounceTimer);
    this._searchDebounceTimer = setTimeout(function() {
      if (self._onSearchChange) self._onSearchChange(self.getSearchMatches());
    }, 400);
  }

  setTargetUniversity(uni) {
    this._targetUniversity = uni;
    const sel = document.getElementById('filter-target');
    if (sel) sel.value = uni.name;
  }

  onChange(cb)       { this._onChange       = cb; }
  onSearchChange(cb) { this._onSearchChange = cb; }
  onTargetChange(cb) { this._onTargetChange = cb; }
  onPlaceSelect(cb)  { this._onPlaceSelect  = cb; }
  getTargetUniversity() { return this._targetUniversity; }
}

window.FilterManager = FilterManager;
