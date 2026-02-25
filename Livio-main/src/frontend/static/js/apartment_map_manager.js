/**
 * apartment_map_manager.js
 * Migrated from demo_map/frontend/js/modules/map.js
 * Converted from ES-module to regular script (no import/export).
 *
 * Handles all Google Maps interactions:
 *   - Map initialization centered on CSUN
 *   - Custom overlay price-tag markers (Zillow-style)
 *   - University campus pill markers
 *   - InfoWindow popups on marker hover
 *   - Bounds-change callbacks to sync sidebar cards
 *
 * Events published (via EventBus when provided):
 *   'map:boundsChanged'   (no data)
 *   'map:markerHovered'   { listingId, isHovering }
 *   'map:markerClicked'   { listingId }
 *   'map:uniDblClicked'   { university }
 */

// Overlay classes are initialized lazily after Google Maps loads
let _MarkerOverlay           = null;
let _PriceMarkerOverlay      = null;
let _UniversityMarkerOverlay = null;

function _initOverlayClasses() {
  if (_MarkerOverlay) return;

  // ── Base overlay ─────────────────────────────────

  _MarkerOverlay = class extends google.maps.OverlayView {
    constructor(position) {
      super();
      this.position   = position;
      this.div        = null;
      this.onMouseOver = null;
      this.onMouseOut  = null;
      this.onClick     = null;
    }

    onAdd() {
      this.div = this._createDiv();
      this.div.addEventListener('mouseover', () => { if (this.onMouseOver) this.onMouseOver(); });
      this.div.addEventListener('mouseout',  () => { if (this.onMouseOut)  this.onMouseOut();  });
      this.div.addEventListener('click',     () => { if (this.onClick)     this.onClick();      });
      this.getPanes().overlayMouseTarget.appendChild(this.div);
    }

    draw() {
      const pos = this.getProjection().fromLatLngToDivPixel(this.position);
      if (this.div) {
        this.div.style.left = pos.x + 'px';
        this.div.style.top  = pos.y + 'px';
      }
    }

    onRemove() {
      if (this.div && this.div.parentNode) {
        this.div.parentNode.removeChild(this.div);
        this.div = null;
      }
    }

    setActive(active) {
      if (this.div) this.div.classList.toggle(this._getActiveClass(), active);
    }

    /** Subclasses must implement this to return the marker DOM element. */
    _createDiv()      { throw new Error('Subclass must implement _createDiv'); }
    _getActiveClass() { return 'marker--active'; }
  };

  // ── Price marker (listing) ────────────────────────

  _PriceMarkerOverlay = class extends _MarkerOverlay {
    constructor(position, price, id, map) {
      super(position);
      this.price = price;
      this.id    = id;
      this.setMap(map);
    }

    _createDiv() {
      const div = document.createElement('div');
      div.className = 'price-marker';
      div.dataset.listingId = this.id;
      div.textContent = '$' + this.price.toLocaleString();
      return div;
    }

    _getActiveClass() { return 'price-marker--active'; }
  };

  // ── University marker ─────────────────────────────

  _UniversityMarkerOverlay = class extends _MarkerOverlay {
    constructor(position, name, fullName, map) {
      super(position);
      this.name      = name;
      this.fullName  = fullName;
      this.onDblClick = null;
      this.setMap(map);
    }

    onAdd() {
      super.onAdd();
      this.div.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (this.onDblClick) this.onDblClick();
      });
    }

    _createDiv() {
      const div = document.createElement('div');
      div.className = 'uni-marker';
      div.innerHTML =
        '<svg class="uni-marker__icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">' +
          '<path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6L23 9l-11-6z"/>' +
        '</svg>' +
        '<span class="uni-marker__name">' + this.name + '</span>';
      return div;
    }

    _getActiveClass() { return 'uni-marker--active'; }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// InfoWindowBuilder – centralizes info-window HTML so there is one place
//                     to change styles or content structure.
// ─────────────────────────────────────────────────────────────────────────────

const InfoWindowBuilder = {
  /**
   * Build the info-window HTML for a listing marker.
   * @param {object} listing - normalized listing object
   * @returns {string}
   */
  forListing(listing) {
    const bedLabel = LivioUtils.formatBedLabel(listing.bedrooms);
    const sqft     = listing.sqft ? listing.sqft.toLocaleString() : '—';
    return (
      '<div class="info-window">' +
        '<div class="info-window__img" style="background:' + listing.imageColor + ';">' +
          '<span class="info-window__type">' + listing.type + '</span>' +
        '</div>' +
        '<div class="info-window__body">' +
          '<div class="info-window__price">$' + listing.price.toLocaleString() + '/mo</div>' +
          '<div class="info-window__specs">' + bedLabel + ' | ' + listing.bathrooms + ' ba | ' + sqft + ' sqft</div>' +
          '<div class="info-window__address">' + listing.address + '</div>' +
          '<div class="info-window__owner">Posted by ' + listing.owner.name + (listing.owner.verified ? ' &#10003;' : '') + '</div>' +
        '</div>' +
      '</div>'
    );
  },

  /**
   * Build the info-window HTML for a university marker.
   * @param {object} university - { name, fullName }
   * @returns {string}
   */
  forUniversity(university) {
    return (
      '<div style="padding:10px 12px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">' +
        '<strong style="font-size:14px;color:#2a2a2a;">' + university.fullName + '</strong><br>' +
        '<span style="color:#666;font-size:12px;">' + university.name + ' — Main Campus</span>' +
      '</div>'
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MapManager – public class
// ─────────────────────────────────────────────────────────────────────────────

class MapManager {
  /**
   * @param {EventBus} [eventBus] - optional; publishes map events to the bus
   */
  constructor(eventBus) {
    this.map              = null;
    this.priceMarkers     = []; // { overlay, infoWindow, listing }
    this.activeInfoWindow = null;
    this.activeMarkerId   = null;
    this._searchHighlight = null;
    this._searchPin       = null;
    this._uniMarkers      = []; // { overlay, infoWindow, isOpen, position }
    this._geocoder        = null;
    this._bus             = eventBus || null;

  }

  // ── Initialization ───────────────────────────────

  init(containerId, center, zoom) {
    _initOverlayClasses();

    this.map = new google.maps.Map(document.getElementById(containerId), {
      center,
      zoom,
      mapTypeControl:     false,
      fullscreenControl:  false,
      streetViewControl:  false,
      zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
      styles: [
        { featureType: 'poi',     elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit',                        stylers: [{ visibility: 'off' }] },
      ],
    });

    this.map.addListener('idle', () => {
      if (this._bus) {
        this._bus.publish('map:boundsChanged');
      }
    });
  }

  // ── University markers ───────────────────────────

  addUniversityMarker(university) {
    const pos     = new google.maps.LatLng(university.lat, university.lng);
    const overlay = new _UniversityMarkerOverlay(pos, university.name, university.fullName, this.map);

    const infoWindow = new google.maps.InfoWindow({
      content:        InfoWindowBuilder.forUniversity(university),
      pixelOffset:    new google.maps.Size(0, -44),
      disableAutoPan: true,
    });

    const entry = { overlay, infoWindow, isOpen: false, position: pos };
    this._uniMarkers.push(entry);

    overlay.onMouseOver = () => {
      if (!entry.isOpen) { overlay.setActive(true); infoWindow.setPosition(pos); infoWindow.open(this.map); }
    };
    overlay.onMouseOut  = () => {
      if (!entry.isOpen) { overlay.setActive(false); infoWindow.close(); }
    };
    overlay.onClick     = () => {
      this.hideInfoWindow();
      if (entry.isOpen) {
        infoWindow.close(); overlay.setActive(false); entry.isOpen = false;
      } else {
        this._closeAllUniPopups();
        infoWindow.setPosition(pos); infoWindow.open(this.map);
        overlay.setActive(true); entry.isOpen = true;
      }
    };
    overlay.onDblClick  = () => {
      if (this._bus) {
        this._bus.publish('map:uniDblClicked', { university });
      }
    };
  }

  _closeAllUniPopups() {
    this._uniMarkers.forEach((entry) => {
      if (entry.isOpen) { entry.infoWindow.close(); entry.overlay.setActive(false); entry.isOpen = false; }
    });
  }

  // ── Listing markers ──────────────────────────────

  addListingMarkers(listings) {
    listings.forEach((listing) => {
      const overlay = new _PriceMarkerOverlay(
        new google.maps.LatLng(listing.lat, listing.lng),
        listing.price, listing.id, this.map
      );

      const infoWindow = new google.maps.InfoWindow({
        content:        InfoWindowBuilder.forListing(listing),
        pixelOffset:    new google.maps.Size(0, -40),
        disableAutoPan: true,
      });

      overlay.onMouseOver = () => {
        this.showInfoWindow(listing.id);
        if (this._bus) {
          this._bus.publish('map:markerHovered', { listingId: listing.id, isHovering: true });
        }
      };
      overlay.onMouseOut  = () => {
        this.hideInfoWindow();
        if (this._bus) {
          this._bus.publish('map:markerHovered', { listingId: listing.id, isHovering: false });
        }
      };
      overlay.onClick     = () => {
        if (this._bus) {
          this._bus.publish('map:markerClicked', { listingId: listing.id });
        }
      };

      this.priceMarkers.push({ overlay, infoWindow, listing });
    });
  }

  // ── Info windows ─────────────────────────────────

  showInfoWindow(listingId) {
    this.hideInfoWindow();
    this._closeAllUniPopups();

    const entry = this.priceMarkers.find((m) => m.listing.id === listingId);
    if (!entry) return;

    entry.infoWindow.setPosition({ lat: entry.listing.lat, lng: entry.listing.lng });
    entry.infoWindow.open(this.map);
    entry.overlay.setActive(true);
    this.activeInfoWindow = entry.infoWindow;
    this.activeMarkerId   = listingId;
  }

  hideInfoWindow() {
    if (this.activeInfoWindow) {
      this.activeInfoWindow.close();
      const old = this.priceMarkers.find((m) => m.listing.id === this.activeMarkerId);
      if (old) old.overlay.setActive(false);
      this.activeInfoWindow = null;
      this.activeMarkerId   = null;
    }
  }

  highlightMarker(listingId)  { this.showInfoWindow(listingId); }
  unhighlightMarker()         { this.hideInfoWindow(); }

  // ── Search highlight + geocoding ─────────────────

  fitBoundsToListings(listings) {
    if (!listings.length) return;
    const bounds = new google.maps.LatLngBounds();
    listings.forEach((l) => bounds.extend({ lat: l.lat, lng: l.lng }));
    if (listings.length === 1) {
      this.map.panTo(bounds.getCenter());
      if (this.map.getZoom() < 14) this.map.setZoom(14);
    } else {
      this.map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }
  }

  showSearchHighlight(listings) {
    this.clearSearchHighlight();
    if (!listings.length) return;
    const lats = listings.map((l) => l.lat);
    const lngs = listings.map((l) => l.lng);
    const PAD  = 0.004;
    this._searchHighlight = this._createHighlightRect({
      north: Math.max(...lats) + PAD, south: Math.min(...lats) - PAD,
      east:  Math.max(...lngs) + PAD, west:  Math.min(...lngs) - PAD,
    });
  }

  clearSearchHighlight() {
    if (this._searchHighlight) { this._searchHighlight.setMap(null); this._searchHighlight = null; }
  }

  showSearchPin(lat, lng, title) {
    this.clearSearchPin();
    this._searchPin = new google.maps.Marker({
      position: { lat, lng }, map: this.map, title,
      icon: {
        path: google.maps.SymbolPath.CIRCLE, scale: 9,
        fillColor: '#e53935', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2.5,
      },
      zIndex: 999, animation: google.maps.Animation.DROP,
    });
  }

  clearSearchPin() {
    if (this._searchPin) { this._searchPin.setMap(null); this._searchPin = null; }
  }

  updateMarkerVisibility(passingIds) {
    this.priceMarkers.forEach(({ overlay, listing }) => {
      if (overlay.div) overlay.div.classList.toggle('price-marker--filtered', !passingIds.has(listing.id));
    });
  }

  getVisibleListings() {
    const bounds = this.map.getBounds();
    if (!bounds) return [];
    return this.priceMarkers
      .filter(({ listing }) => bounds.contains(new google.maps.LatLng(listing.lat, listing.lng)))
      .map(({ listing }) => listing);
  }

  panTo(lat, lng, zoom) {
    this.map.panTo({ lat, lng });
    if (zoom && this.map.getZoom() < zoom) this.map.setZoom(zoom);
  }

  setTargetUniversity(name) {
    this._uniMarkers.forEach((entry) => {
      if (entry.overlay.div)
        entry.overlay.div.classList.toggle('uni-marker--target', entry.overlay.name === name);
    });
  }

  // ── Geocoding ────────────────────────────────────

  _getGeocoder() {
    if (!this._geocoder) this._geocoder = new google.maps.Geocoder();
    return this._geocoder;
  }

  async geocodePlaceAndHighlight(placeId) { return this._geocodeAndHighlight({ placeId }); }
  async geocodeQueryAndHighlight(query)   { return this._geocodeAndHighlight({ address: query }); }

  async _geocodeAndHighlight(request) {
    try {
      const { results } = await this._getGeocoder().geocode(request);
      if (results && results[0]) { this._showGeocodedResult(results[0]); return true; }
    } catch (_) { /* ZERO_RESULTS */ }
    return false;
  }

  _showGeocodedResult(result) {
    this.clearSearchHighlight(); this.clearSearchPin();
    const bounds = result.geometry.viewport || result.geometry.bounds;
    if (bounds) {
      this.map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      this._searchHighlight = this._createHighlightRect({
        north: ne.lat(), south: sw.lat(), east: ne.lng(), west: sw.lng(),
      });
    } else {
      const loc = result.geometry.location;
      this.map.panTo(loc);
      if (this.map.getZoom() < 14) this.map.setZoom(14);
      this.showSearchPin(loc.lat(), loc.lng(), result.formatted_address || '');
    }
  }

  _createHighlightRect(bounds) {
    return new google.maps.Rectangle({
      bounds, map: this.map,
      fillColor: '#006aff', fillOpacity: 0.08,
      strokeColor: '#006aff', strokeOpacity: 0.50, strokeWeight: 2,
      clickable: false, zIndex: 0,
    });
  }

}

window.InfoWindowBuilder = InfoWindowBuilder;
window.MapManager        = MapManager;
