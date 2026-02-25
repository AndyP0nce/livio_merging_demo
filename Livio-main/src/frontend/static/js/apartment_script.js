/**
 * apartment_script.js
 * Entry point for the Livio apartment page.
 *
 * Migrated from demo_map/frontend/js/app.js and adapted for
 * Livio's Django REST Framework API endpoints:
 *
 *   GET /apartments/api/apartments/   → listing cards + map markers
 *   GET /apartments/api/universities/ → campus pill markers
 *
 * Livio's API field names differ from demo_map's; this file
 * normalizes the response before passing data to the UI modules.
 *
 * Architecture overview
 * ─────────────────────
 *   AppState        – single source of truth for listings + universities
 *   EventBus (bus)  – pub/sub hub; modules publish events, this file
 *                     subscribes and orchestrates reactions
 *   LivioUtils      – shared pure helpers (coords, distance, escaping…)
 */

// ── Config ────────────────────────────────────────────
var DEBUG = false;

function log()  { if (DEBUG) { var a = Array.prototype.slice.call(arguments); a.unshift('[AptApp]'); console.log.apply(console, a); } }
function warn() { if (DEBUG) { var a = Array.prototype.slice.call(arguments); a.unshift('[AptApp]'); console.warn.apply(console, a); } }
function err()  { var a = Array.prototype.slice.call(arguments); a.unshift('[AptApp ERROR]'); console.error.apply(console, a); }

var DEFAULT_CENTER = { lat: 34.2381, lng: -118.5285 }; // CSUN
var MAP_ZOOM       = 13;

var CARD_COLORS = [
  '#4A90D9', '#50B86C', '#E8825B', '#9B59B6', '#2ECC71',
  '#3498DB', '#E74C3C', '#F39C12', '#1ABC9C', '#8E44AD',
  '#D35400', '#27AE60', '#2980B9', '#C0392B', '#16A085',
];

// ── Application state ─────────────────────────────────
/**
 * AppState replaces the previous bare global variables LISTINGS and
 * UNIVERSITIES, giving one named namespace and a findListing helper
 * to avoid repeated for-loops throughout the codebase.
 */
var AppState = {
  listings:     [],
  universities: [],

  /** @param {number} id @returns {object|null} */
  findListing: function(id) {
    for (var i = 0; i < this.listings.length; i++) {
      if (this.listings[i].id === id) return this.listings[i];
    }
    return null;
  },
};

// ── Module instances ──────────────────────────────────
var bus;          // EventBus – created in init() after data loads
var mapManager;
var cardRenderer;
var filterManager;
var modal;
var createModal;

// ── Data normalization ────────────────────────────────

/**
 * Convert Livio's ApartmentPost JSON to the internal shape expected by
 * MapManager, CardRenderer, FilterManager, and ListingModal.
 */
function normalizeApartment(raw) {
  var price = parseFloat(raw.monthly_rent) || 0;
  var lat   = raw.latitude  != null ? parseFloat(raw.latitude)  : null;
  var lng   = raw.longitude != null ? parseFloat(raw.longitude) : null;

  // bedrooms: '1bed' → 1, '2bed' → 2, '4bed' → 4, 'studio' → 0
  var bedrooms = 1;
  if (raw.bedrooms) {
    var bStr = String(raw.bedrooms).toLowerCase();
    if (bStr === 'studio') {
      bedrooms = 0;
    } else {
      var bMatch = bStr.match(/^(\d+)/);
      bedrooms = bMatch ? parseInt(bMatch[1], 10) : 1;
    }
  }

  // bathrooms: '1bath' → 1, '2bath' → 2, '3bath' → 3
  var bathrooms = 1;
  if (raw.bathrooms) {
    var baMatch = String(raw.bathrooms).match(/^(\d+)/);
    bathrooms = baMatch ? parseInt(baMatch[1], 10) : 1;
  }

  // room_type → display label
  var typeMap = {
    'private': 'Private Room',
    'shared':  'Shared Room',
    'entire':  'Entire Place',
    'studio':  'Studio',
  };
  var type = typeMap[raw.room_type] || 'Apartment';

  // amenities: prefer amenities_list (array) from serializer
  var amenities = [];
  if (Array.isArray(raw.amenities_list) && raw.amenities_list.length > 0) {
    amenities = raw.amenities_list.slice();
  } else if (typeof raw.amenities === 'string' && raw.amenities.trim()) {
    amenities = raw.amenities.split(',').map(function(a) { return a.trim(); }).filter(Boolean);
  }
  amenities = amenities.map(function(a) {
    return a ? a.charAt(0).toUpperCase() + a.slice(1) : a;
  });

  // Build address string from available fields
  var addrParts = [];
  if (raw.location) addrParts.push(raw.location);
  else if (raw.address) addrParts.push(raw.address);
  if (raw.city)     addrParts.push(raw.city);
  if (raw.state)    addrParts.push(raw.state);
  if (raw.zip_code) addrParts.push(raw.zip_code);
  var address = addrParts.filter(Boolean).join(', ');

  // Owner
  var owner = { name: 'Property Owner', verified: false };
  if (raw.owner_info) {
    var fn = (raw.owner_info.first_name || '').trim();
    var ln = (raw.owner_info.last_name  || '').trim();
    var fullName = (fn + ' ' + ln).trim();
    owner.name     = fullName || raw.owner_info.username || 'Property Owner';
    owner.verified = true;
  }

  return {
    id:          raw.id,
    title:       raw.title || 'Apartment Listing',
    description: raw.description || '',
    address:     address,
    price:       price,
    bedrooms:    bedrooms,
    bathrooms:   bathrooms,
    sqft:        raw.square_feet ? parseInt(raw.square_feet, 10) : null,
    lat:         lat,
    lng:         lng,
    type:        type,
    amenities:   amenities,
    owner:       owner,
    available:   raw.is_active !== false,
    imageColor:  CARD_COLORS[raw.id % CARD_COLORS.length],
    image_url:   raw.image_url || null,
  };
}

// ── Distance ─────────────────────────────────────────

function recomputeDistances(targetUni) {
  AppState.listings.forEach(function(listing) {
    if (LivioUtils.isValidCoords(listing.lat, listing.lng)) {
      listing._distanceMi = LivioUtils.haversineDistanceMi(
        listing.lat, listing.lng, targetUni.lat, targetUni.lng
      );
    } else {
      listing._distanceMi = null;
    }
    listing._targetName = targetUni.name;
  });
}

// ── API Fetch ─────────────────────────────────────────

function fetchListings() {
  var url = '/apartments/api/apartments/';
  log('Fetching listings from', url);
  return fetch(url, { credentials: 'include' })
    .then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function(data) {
      log('Raw listings:', data.length);
      var parsed = data
        .map(normalizeApartment)
        .filter(function(l) {
          if (!LivioUtils.isValidCoords(l.lat, l.lng)) {
            warn('Listing id=' + l.id + ' has no coordinates — skipping map marker');
            return false;
          }
          return true;
        });
      log('Listings ready:', parsed.length);
      return parsed;
    })
    .catch(function(e) {
      err('fetchListings failed:', e.message);
      return [];
    });
}

function fetchUniversities() {
  var url = '/apartments/api/universities/';
  log('Fetching universities from', url);
  return fetch(url, { credentials: 'include' })
    .then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function(data) {
      log('Universities raw:', data.length);
      return data.map(function(u) {
        return {
          name:     u.name,
          fullName: u.fullName || u.full_name || u.name,
          lat:      parseFloat(u.lat),
          lng:      parseFloat(u.lng),
        };
      });
    })
    .catch(function(e) {
      err('fetchUniversities failed:', e.message);
      return [];
    });
}

// ── View helpers ─────────────────────────────────────

var _showingFavorites = false;

function getFilteredVisibleListings() {
  return filterManager.applyFilters(mapManager.getVisibleListings());
}

function refreshView() {
  if (_showingFavorites) { refreshFavoritesView(); return; }
  var filtered = getFilteredVisibleListings();
  cardRenderer.render(filtered);
  mapManager.updateMarkerVisibility(filterManager.getPassingIds());
}

// Called when a heart is toggled while the Saved tab is active
function refreshFavoritesView() {
  if (!_showingFavorites) return;
  var saved = AppState.listings.filter(function(l) {
    return favoritedApartments.has(l.id);
  });
  cardRenderer.render(saved);
}

function _setTab(showFavorites) {
  _showingFavorites = showFavorites;
  var tabAll   = document.getElementById('tab-all');
  var tabSaved = document.getElementById('tab-saved');
  var subtitle = document.getElementById('listings-subtitle');

  if (tabAll)   tabAll.classList.toggle('listings-panel__tab--active', !showFavorites);
  if (tabSaved) tabSaved.classList.toggle('listings-panel__tab--active', showFavorites);
  if (subtitle) subtitle.textContent = showFavorites ? 'saved by you' : 'in current map view';

  if (showFavorites) {
    refreshFavoritesView();
  } else {
    refreshView();
  }
}

function openModal(listingId) {
  var listing = AppState.findListing(listingId);
  if (listing) modal.open(listing);
}

// ── Event wiring ─────────────────────────────────────

function wireEvents() {

  // Map moved → refresh sidebar
  bus.subscribe('map:boundsChanged', function() { refreshView(); });

  // Any filter changed → refresh
  bus.subscribe('filter:changed', function() { refreshView(); });

  // Target university changed → recompute distances, pan, refresh
  bus.subscribe('filter:targetChanged', function(data) {
    var university = data.university;
    recomputeDistances(university);
    mapManager.setTargetUniversity(university.name);
    mapManager.panTo(university.lat, university.lng, 13);
    refreshView();
  });

  // Debounced search → pan map + highlight matching results
  bus.subscribe('filter:searchChanged', function(data) {
    var matchingListings = data.matches;
    if (matchingListings.length > 0) {
      mapManager.fitBoundsToListings(matchingListings);
      mapManager.showSearchHighlight(matchingListings);
      if (matchingListings.length === 1) {
        mapManager.showSearchPin(
          matchingListings[0].lat, matchingListings[0].lng, matchingListings[0].address
        );
      } else {
        mapManager.clearSearchPin();
      }
    } else {
      var query = filterManager.state.searchQuery;
      if (query) {
        // Fall back to panning to a matching university
        var uniMatch = null;
        for (var i = 0; i < AppState.universities.length; i++) {
          var u = AppState.universities[i];
          if (u.name.toLowerCase().indexOf(query) !== -1 ||
              u.fullName.toLowerCase().indexOf(query) !== -1) {
            uniMatch = u; break;
          }
        }
        mapManager.clearSearchHighlight();
        mapManager.clearSearchPin();
        if (uniMatch) {
          mapManager.panTo(uniMatch.lat, uniMatch.lng, 14);
        } else {
          mapManager.geocodeQueryAndHighlight(query);
        }
      } else {
        mapManager.clearSearchHighlight();
        mapManager.clearSearchPin();
      }
    }
  });

  // Google Place selected from autocomplete → geocode and highlight
  bus.subscribe('filter:placeSelected', function(data) {
    mapManager.geocodePlaceAndHighlight(data.placeId);
  });

  // Favorites tabs
  var tabAll   = document.getElementById('tab-all');
  var tabSaved = document.getElementById('tab-saved');
  if (tabAll)   tabAll.addEventListener('click',   function() { _setTab(false); });
  if (tabSaved) tabSaved.addEventListener('click',  function() { _setTab(true);  });

  // "+ List Your Place" button
  var listBtn = document.getElementById('btn-list-place');
  if (listBtn) {
    listBtn.addEventListener('click', function() {
      if (!LivioUtils.requireLogin()) return;
      createModal.open();
    });
  }

  // New listing created → normalize, add to AppState, refresh map
  createModal.onSuccess(function(rawListing) {
    var listing = normalizeApartment(rawListing);
    var target  = filterManager.getTargetUniversity();
    if (target && LivioUtils.isValidCoords(listing.lat, listing.lng)) {
      listing._distanceMi = LivioUtils.haversineDistanceMi(
        listing.lat, listing.lng, target.lat, target.lng
      );
      listing._targetName = target.name;
    }
    AppState.listings.push(listing);
    filterManager.listings = AppState.listings;
    if (LivioUtils.isValidCoords(listing.lat, listing.lng)) {
      mapManager.addListingMarkers([listing]);
      mapManager.panTo(listing.lat, listing.lng, 15);
    } else {
      warn('New listing has no coordinates — skipping map marker.');
    }
    refreshView();
  });

  // University marker double-clicked → set as distance target
  bus.subscribe('map:uniDblClicked', function(data) {
    var university = data.university;
    filterManager.setTargetUniversity(university);
    recomputeDistances(university);
    mapManager.setTargetUniversity(university.name);
    refreshView();
  });

  // Map marker hovered → highlight matching sidebar card
  bus.subscribe('map:markerHovered', function(data) {
    if (data.isHovering) cardRenderer.highlightCard(data.listingId);
    else                 cardRenderer.clearHighlight();
  });

  // Map marker clicked → open detail modal
  bus.subscribe('map:markerClicked', function(data) { openModal(data.listingId); });

  // Sidebar card hovered → highlight map marker + open info window
  bus.subscribe('card:hovered', function(data) {
    if (data.isHovering) mapManager.highlightMarker(data.listingId);
    else                 mapManager.unhighlightMarker();
  });

  // Sidebar card clicked → open detail modal
  bus.subscribe('card:clicked', function(data) { openModal(data.listingId); });
}

// ── Init ─────────────────────────────────────────────

function init() {
  log('=== Apartment page init ===');

  Promise.all([fetchListings(), fetchUniversities()])
    .then(function(results) {
      AppState.listings     = results[0];
      AppState.universities = results[1];
      log(AppState.listings.length + ' listings, ' + AppState.universities.length + ' universities');

      bus          = new EventBus();
      mapManager   = new MapManager(bus);
      cardRenderer = new CardRenderer('listings-container', 'listings-count', bus);
      filterManager= new FilterManager('filter-container', AppState.listings, AppState.universities, bus);
      modal        = new ListingModal('detail-modal');
      createModal  = new CreateListingModal('create-listing-modal');

      // Load favorite status once listings are available
      if (typeof checkFavoriteStatus === 'function') checkFavoriteStatus();

      var defaultTarget = filterManager.getTargetUniversity();
      if (defaultTarget) { recomputeDistances(defaultTarget); }

      var mapCenter = defaultTarget
        ? { lat: defaultTarget.lat, lng: defaultTarget.lng }
        : DEFAULT_CENTER;
      mapManager.init('map-container', mapCenter, MAP_ZOOM);

      AppState.universities.forEach(function(uni) { mapManager.addUniversityMarker(uni); });
      if (defaultTarget) mapManager.setTargetUniversity(defaultTarget.name);

      mapManager.addListingMarkers(AppState.listings);

      wireEvents();
      log('=== Init complete ===');
    })
    .catch(function(e) {
      err('Init failed:', e);
    });
}

// ── Wait for Google Maps then start ──────────────────

function waitForGoogleMaps() {
  return new Promise(function(resolve) {
    if (window.google && window.google.maps) { resolve(); return; }
    var interval = setInterval(function() {
      if (window.google && window.google.maps) { clearInterval(interval); resolve(); }
    }, 100);
  });
}

waitForGoogleMaps().then(function() { init(); });
