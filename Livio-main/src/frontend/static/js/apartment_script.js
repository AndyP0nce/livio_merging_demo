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
 */

// ── Config ───────────────────────────────────────────
var DEBUG = true;

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

// ── Data ─────────────────────────────────────────────
var LISTINGS     = [];
var UNIVERSITIES = [];

// ── Module instances ──────────────────────────────────
var mapManager;
var cardRenderer;
var filterManager;
var modal;
var createModal;

// ── Data normalization ────────────────────────────────

/**
 * Convert livio's ApartmentPost JSON to the demo_map shape
 * expected by MapManager, CardRenderer, FilterManager, and ListingModal.
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
  };
}

// ── Distance (Haversine) ──────────────────────────────

function haversineDistanceMi(lat1, lng1, lat2, lng2) {
  var R   = 3958.8;
  var toR = function(d) { return d * Math.PI / 180; };
  var dLat = toR(lat2 - lat1);
  var dLng = toR(lng2 - lng1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toR(lat1)) * Math.cos(toR(lat2)) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function recomputeDistances(targetUni) {
  LISTINGS.forEach(function(listing) {
    if (listing.lat !== null && listing.lng !== null && !isNaN(listing.lat) && !isNaN(listing.lng)) {
      listing._distanceMi = haversineDistanceMi(listing.lat, listing.lng, targetUni.lat, targetUni.lng);
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
          if (l.lat === null || l.lng === null || isNaN(l.lat) || isNaN(l.lng)) {
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

function getFilteredVisibleListings() {
  var visible = mapManager.getVisibleListings();
  return filterManager.applyFilters(visible);
}

function refreshView() {
  var filtered = getFilteredVisibleListings();
  cardRenderer.render(filtered);
  var passingIds = filterManager.getPassingIds();
  mapManager.updateMarkerVisibility(passingIds);
}

function openModal(listingId) {
  var listing = null;
  for (var i = 0; i < LISTINGS.length; i++) {
    if (LISTINGS[i].id === listingId) { listing = LISTINGS[i]; break; }
  }
  if (listing) modal.open(listing);
}

// ── Event wiring ─────────────────────────────────────

function wireEvents() {
  // Map moved → refresh sidebar
  mapManager.onBoundsChange(function() { refreshView(); });

  // Filter changed → refresh
  filterManager.onChange(function() { refreshView(); });

  // Target university changed → recompute distances, pan, refresh
  filterManager.onTargetChange(function(university) {
    recomputeDistances(university);
    mapManager.setTargetUniversity(university.name);
    mapManager.panTo(university.lat, university.lng, 13);
    refreshView();
  });

  // Search (debounced) → pan map + highlight
  filterManager.onSearchChange(function(matchingListings) {
    if (matchingListings.length > 0) {
      mapManager.fitBoundsToListings(matchingListings);
      mapManager.showSearchHighlight(matchingListings);
      if (matchingListings.length === 1) {
        mapManager.showSearchPin(matchingListings[0].lat, matchingListings[0].lng, matchingListings[0].address);
      } else {
        mapManager.clearSearchPin();
      }
    } else {
      var query = filterManager.state.searchQuery;
      if (query) {
        var uniMatch = null;
        for (var i = 0; i < UNIVERSITIES.length; i++) {
          var u = UNIVERSITIES[i];
          if (u.name.toLowerCase().indexOf(query) !== -1 || u.fullName.toLowerCase().indexOf(query) !== -1) {
            uniMatch = u; break;
          }
        }
        if (uniMatch) {
          mapManager.clearSearchHighlight();
          mapManager.clearSearchPin();
          mapManager.panTo(uniMatch.lat, uniMatch.lng, 14);
          return;
        }
        mapManager.clearSearchHighlight();
        mapManager.clearSearchPin();
        mapManager.geocodeQueryAndHighlight(query);
      } else {
        mapManager.clearSearchHighlight();
        mapManager.clearSearchPin();
      }
    }
  });

  // Google Place selected from autocomplete
  filterManager.onPlaceSelect(function(placeId) {
    mapManager.geocodePlaceAndHighlight(placeId);
  });

  // "+ List Your Place" button
  var listBtn = document.getElementById('btn-list-place');
  if (listBtn) {
    listBtn.addEventListener('click', function() {
      if (!localStorage.getItem('access_token')) {
        window.location.href = '/login/?next=' + encodeURIComponent(window.location.pathname);
        return;
      }
      createModal.open();
    });
  }

  // New listing created → normalize + add to map + refresh
  createModal.onSuccess(function(rawListing) {
    var listing = normalizeApartment(rawListing);
    var target  = filterManager.getTargetUniversity();
    if (target && listing.lat !== null && listing.lng !== null && !isNaN(listing.lat) && !isNaN(listing.lng)) {
      listing._distanceMi = haversineDistanceMi(listing.lat, listing.lng, target.lat, target.lng);
      listing._targetName = target.name;
    }
    LISTINGS.push(listing);
    filterManager.listings = LISTINGS;
    if (listing.lat !== null && listing.lng !== null && !isNaN(listing.lat) && !isNaN(listing.lng)) {
      mapManager.addListingMarkers([listing]);
      mapManager.panTo(listing.lat, listing.lng, 15);
    } else {
      warn('New listing has no coordinates — skipping map marker.');
    }
    refreshView();
  });

  // University marker double-clicked → set as target
  mapManager.onUniversityDblClick(function(university) {
    filterManager.setTargetUniversity(university);
    recomputeDistances(university);
    mapManager.setTargetUniversity(university.name);
    refreshView();
  });

  // Marker hovered → highlight sidebar card
  mapManager.onMarkerHover(function(listingId, isHovering) {
    if (isHovering) { cardRenderer.highlightCard(listingId); }
    else            { cardRenderer.clearHighlight(); }
  });

  // Marker clicked → open detail modal
  mapManager.onMarkerClick(function(listingId) { openModal(listingId); });

  // Card hovered → highlight map marker + open info window
  cardRenderer.onCardHover(function(listingId, isHovering) {
    if (isHovering) { mapManager.highlightMarker(listingId); }
    else            { mapManager.unhighlightMarker(); }
  });

  // Card clicked → open detail modal
  cardRenderer.onCardClick(function(listingId) { openModal(listingId); });
}

// ── Init ─────────────────────────────────────────────

function init() {
  log('=== Apartment page init ===');

  Promise.all([fetchListings(), fetchUniversities()])
    .then(function(results) {
      LISTINGS     = results[0];
      UNIVERSITIES = results[1];
      log(LISTINGS.length + ' listings, ' + UNIVERSITIES.length + ' universities');

      mapManager   = new MapManager();
      cardRenderer = new CardRenderer('listings-container', 'listings-count');
      filterManager= new FilterManager('filter-container', LISTINGS, UNIVERSITIES);
      modal        = new ListingModal('detail-modal');
      createModal  = new CreateListingModal('create-listing-modal');

      var defaultTarget = filterManager.getTargetUniversity();
      if (defaultTarget) { recomputeDistances(defaultTarget); }

      var mapCenter = defaultTarget
        ? { lat: defaultTarget.lat, lng: defaultTarget.lng }
        : DEFAULT_CENTER;
      mapManager.init('map-container', mapCenter, MAP_ZOOM);

      UNIVERSITIES.forEach(function(uni) { mapManager.addUniversityMarker(uni); });
      if (defaultTarget) mapManager.setTargetUniversity(defaultTarget.name);

      mapManager.addListingMarkers(LISTINGS);

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
