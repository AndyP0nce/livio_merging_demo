/**
 * apartment_listing_detail.js
 * Migrated from demo_map/frontend/js/modules/listing-detail.js
 * Converted from ES-module to regular script (no import/export).
 *
 * Full-detail listing modal with an image/color gallery.
 * Opens as a centered overlay when the user clicks a price
 * marker or a sidebar card.
 */

class ListingModal {
  constructor(containerId) {
    this.container       = document.getElementById(containerId);
    this._currentListing = null;
    this._currentSlide   = 0;
    this._slides         = [];

    this._render();
    this._bindEvents();
  }

  // ── Public API ──────────────────────────────────

  open(listing) {
    this._currentListing = listing;
    this._slides         = this._generateSlides(listing);
    this._currentSlide   = 0;
    this._populateContent(listing);
    this.container.classList.add('detail-modal--open');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.container.classList.remove('detail-modal--open');
    document.body.style.overflow = '';
    this._currentListing = null;
  }

  isOpen() { return this.container.classList.contains('detail-modal--open'); }

  // ── Slide generation ─────────────────────────────

  /**
   * Build the slide array for the gallery.
   * If the listing has a real image_url (from S3), the first slide shows the
   * actual photo. All remaining slides use the colour-based placeholders.
   */
  _generateSlides(listing) {
    const base = listing.imageColor || '#4A90D9';
    const colorSlides = [
      { color: base, label: 'Living Area', gradient: 'linear-gradient(135deg, rgba(0,0,0,0.15) 0%, transparent 100%)', imageUrl: null },
      { color: base, label: 'Kitchen',     gradient: 'linear-gradient(45deg, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.18) 100%)', imageUrl: null },
      { color: base, label: 'Bedroom',     gradient: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.22) 100%)', imageUrl: null },
      { color: base, label: 'Bathroom',    gradient: 'linear-gradient(0deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.12) 100%)', imageUrl: null },
    ];

    if (listing.image_url) {
      // Real photo goes first; colour slides follow as additional placeholders
      return [
        { color: null, label: 'Main Photo', gradient: 'none', imageUrl: listing.image_url },
        ...colorSlides,
      ];
    }

    // No real photo – show all colour-based slides
    return [
      { color: base, label: 'Main Photo', gradient: 'none', imageUrl: null },
      ...colorSlides,
    ];
  }

  // ── Skeleton render ──────────────────────────────

  _render() {
    this.container.innerHTML =
      '<div class="detail-modal__backdrop" id="modal-backdrop"></div>' +
      '<div class="detail-modal__card" id="modal-card">' +
        '<button class="detail-modal__close" id="modal-close" aria-label="Close">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">' +
            '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
          '</svg>' +
        '</button>' +
        '<div class="detail-modal__gallery" id="modal-gallery">' +
          '<div class="detail-modal__slide" id="modal-slide"></div>' +
          '<button class="detail-modal__arrow detail-modal__arrow--left" id="modal-prev" aria-label="Previous">' +
            '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>' +
          '</button>' +
          '<button class="detail-modal__arrow detail-modal__arrow--right" id="modal-next" aria-label="Next">' +
            '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 6 15 12 9 18"/></svg>' +
          '</button>' +
          '<div class="detail-modal__slide-counter" id="modal-counter"></div>' +
          '<div class="detail-modal__slide-label" id="modal-label"></div>' +
        '</div>' +
        '<div class="detail-modal__body" id="modal-body"></div>' +
      '</div>';
  }

  // ── Content population ───────────────────────────

  _populateContent(listing) {
    this._updateSlide();

    const bedLabel    = LivioUtils.formatBedLabel(listing.bedrooms);
    const sqftStr     = listing.sqft ? listing.sqft.toLocaleString() : '—';
    const distStr     = listing._distanceMi != null
      ? listing._distanceMi.toFixed(1) + ' mi'
      : (listing.distanceFromCSUN || 'N/A');
    const targetName  = listing._targetName || 'CSUN';
    const available   = listing.available === true ? 'Yes' : (listing.available === false ? 'No' : listing.available);
    const ownerInitial = listing.owner.name.charAt(0) || '?';

    const amenityTags = (listing.amenities || [])
      .map((a) => `<span class="detail-modal__tag">${a}</span>`)
      .join('');

    document.getElementById('modal-body').innerHTML = `
      <div class="detail-modal__header">
        <div class="detail-modal__price">
          $${listing.price.toLocaleString()}<span class="detail-modal__price-period">/mo</span>
        </div>
        <span class="detail-modal__type-badge">${listing.type}</span>
      </div>

      <h2 class="detail-modal__title">${listing.title}</h2>

      <div class="detail-modal__specs">
        <span>${bedLabel}</span>
        <span class="detail-modal__dot"></span>
        <span>${listing.bathrooms} ba</span>
        <span class="detail-modal__dot"></span>
        <span>${sqftStr} sqft</span>
      </div>

      <div class="detail-modal__address">${listing.address}</div>

      <div class="detail-modal__section">
        <h3 class="detail-modal__section-title">Description</h3>
        <p class="detail-modal__desc">${listing.description || 'No description provided.'}</p>
      </div>

      ${amenityTags ? `
        <div class="detail-modal__section">
          <h3 class="detail-modal__section-title">Amenities</h3>
          <div class="detail-modal__tags">${amenityTags}</div>
        </div>` : ''}

      <div class="detail-modal__section">
        <h3 class="detail-modal__section-title">Details</h3>
        <div class="detail-modal__details">
          <div class="detail-modal__detail-row">
            <span class="detail-modal__detail-label">Available</span>
            <span class="detail-modal__detail-value">${available}</span>
          </div>
          <div class="detail-modal__detail-row">
            <span class="detail-modal__detail-label">Distance from ${targetName}</span>
            <span class="detail-modal__detail-value">${distStr}</span>
          </div>
          <div class="detail-modal__detail-row">
            <span class="detail-modal__detail-label">Property Type</span>
            <span class="detail-modal__detail-value">${listing.type}</span>
          </div>
          <div class="detail-modal__detail-row">
            <span class="detail-modal__detail-label">Square Footage</span>
            <span class="detail-modal__detail-value">${sqftStr} sqft</span>
          </div>
        </div>
      </div>

      <div class="detail-modal__section">
        <h3 class="detail-modal__section-title">Posted By</h3>
        <div class="detail-modal__owner">
          <div class="detail-modal__owner-avatar">${ownerInitial}</div>
          <div>
            <div class="detail-modal__owner-name">
              ${listing.owner.name}
              ${listing.owner.verified ? '<span class="detail-modal__verified">&#10003; Verified</span>' : ''}
            </div>
            <div class="detail-modal__owner-role">Property Owner</div>
          </div>
        </div>
      </div>`;
  }

  _updateSlide() {
    const slide   = this._slides[this._currentSlide];
    const slideEl = document.getElementById('modal-slide');
    if (slideEl) {
      if (slide.imageUrl) {
        // Real photo: use a background-image so it scales and crops nicely
        slideEl.style.background = `url('${slide.imageUrl}') center/cover no-repeat`;
      } else if (slide.gradient !== 'none') {
        slideEl.style.background = slide.gradient + ', ' + slide.color;
      } else {
        slideEl.style.background = slide.color;
      }
    }
    const counterEl = document.getElementById('modal-counter');
    if (counterEl) counterEl.textContent = (this._currentSlide + 1) + ' / ' + this._slides.length;
    const labelEl = document.getElementById('modal-label');
    if (labelEl) labelEl.textContent = slide.label;
  }

  // ── Events ───────────────────────────────────────

  _bindEvents() {
    const self = this;
    document.getElementById('modal-close').addEventListener('click',    function() { self.close(); });
    document.getElementById('modal-backdrop').addEventListener('click', function() { self.close(); });

    document.addEventListener('keydown', function(e) {
      if (!self.isOpen()) return;
      if (e.key === 'Escape') { self.close(); return; }
      if (e.key === 'ArrowLeft') {
        self._currentSlide = (self._currentSlide - 1 + self._slides.length) % self._slides.length;
        self._updateSlide();
      }
      if (e.key === 'ArrowRight') {
        self._currentSlide = (self._currentSlide + 1) % self._slides.length;
        self._updateSlide();
      }
    });

    document.getElementById('modal-prev').addEventListener('click', function(e) {
      e.stopPropagation();
      self._currentSlide = (self._currentSlide - 1 + self._slides.length) % self._slides.length;
      self._updateSlide();
    });
    document.getElementById('modal-next').addEventListener('click', function(e) {
      e.stopPropagation();
      self._currentSlide = (self._currentSlide + 1) % self._slides.length;
      self._updateSlide();
    });
  }
}

window.ListingModal = ListingModal;
