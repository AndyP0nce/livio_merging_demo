/**
 * apartment_cards_renderer.js
 * Migrated from demo_map/frontend/js/modules/cards.js
 * Converted from ES-module to regular script.
 *
 * Renders Zillow-style listing cards inside the sidebar panel.
 * Re-renders when the map viewport changes (only visible listings shown).
 *
 * Events (published via EventBus when provided, otherwise via callbacks):
 *   'card:hovered'  { listingId, isHovering }
 *   'card:clicked'  { listingId }
 */

class CardRenderer {
  /**
   * @param {string}   containerId  - id of the card list container element
   * @param {string}   countId      - id of the listing-count element
   * @param {EventBus} [eventBus]   - optional; publishes card events to the bus
   */
  constructor(containerId, countId, eventBus) {
    this.container    = document.getElementById(containerId);
    this.countEl      = document.getElementById(countId);
    this._bus         = eventBus || null;
    this.activeCardId = null;

    // Backward-compat callbacks (used when no EventBus is provided)
    this._onCardHover = null;
    this._onCardClick = null;
  }

  // ── Public API ──────────────────────────────────

  render(listings) {
    this.countEl.textContent =
      listings.length + ' Rental' + (listings.length !== 1 ? 's' : '');

    this.container.innerHTML = '';

    if (listings.length === 0) {
      this.container.innerHTML =
        '<p class="listings-panel__empty">No listings in this area. Try zooming out or panning the map.</p>';
      return;
    }

    const sorted = [...listings].sort((a, b) => a.price - b.price);
    sorted.forEach((listing) => this.container.appendChild(this._createCard(listing)));
  }

  highlightCard(listingId) {
    this.clearHighlight();
    const card = this.container.querySelector('[data-listing-id="' + listingId + '"]');
    if (card) {
      card.classList.add('listing-card--active');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      this.activeCardId = listingId;
    }
  }

  clearHighlight() {
    if (this.activeCardId !== null) {
      const card = this.container.querySelector('[data-listing-id="' + this.activeCardId + '"]');
      if (card) card.classList.remove('listing-card--active');
      this.activeCardId = null;
    }
  }

  // Backward-compat callback setters
  onCardHover(cb) { this._onCardHover = cb; }
  onCardClick(cb) { this._onCardClick = cb; }

  // ── Card creation ────────────────────────────────

  _createCard(listing) {
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.dataset.listingId = listing.id;

    const bedLabel = LivioUtils.formatBedLabel(listing.bedrooms);
    const sqft     = listing.sqft ? listing.sqft.toLocaleString() : '—';
    const distLabel = listing._distanceMi != null
      ? listing._distanceMi.toFixed(1) + ' mi'
      : (listing.distanceFromCSUN || '');
    const targetName = listing._targetName || 'CSUN';

    const amenityHTML = (listing.amenities || [])
      .slice(0, 3)
      .map((a) => `<span class="listing-card__amenity">${a}</span>`)
      .join('');

    card.innerHTML = `
      <div class="listing-card__img" style="background:${listing.imageColor};">
        <span class="listing-card__price">$${listing.price.toLocaleString()}/mo</span>
        <span class="listing-card__type">${listing.type}</span>
      </div>
      <div class="listing-card__body">
        <div class="listing-card__title">${listing.title}</div>
        <div class="listing-card__specs">${bedLabel} | ${listing.bathrooms} ba | ${sqft} sqft</div>
        <div class="listing-card__address">${listing.address}</div>
        <div class="listing-card__desc">${listing.description || ''}</div>
        <div class="listing-card__amenities">${amenityHTML}</div>
        <div class="listing-card__meta">
          <span class="listing-card__available">Available: ${listing.available ? 'Yes' : 'No'}</span>
        </div>
        <div class="listing-card__footer">
          <span class="listing-card__owner">
            ${listing.owner.name}
            ${listing.owner.verified ? '<span class="listing-card__verified">&#10003; Verified</span>' : ''}
          </span>
          ${distLabel ? `<span class="listing-card__distance">${distLabel} from ${targetName}</span>` : ''}
        </div>
      </div>`;

    card.addEventListener('mouseenter', () => this._emit('card:hovered', listing.id, true,  this._onCardHover));
    card.addEventListener('mouseleave', () => this._emit('card:hovered', listing.id, false, this._onCardHover));
    card.addEventListener('click',      () => this._emitClick(listing.id));

    return card;
  }

  // ── Event helpers ────────────────────────────────

  _emit(event, listingId, isHovering, legacyCb) {
    if (this._bus) {
      this._bus.publish(event, { listingId, isHovering });
    } else if (legacyCb) {
      legacyCb(listingId, isHovering);
    }
  }

  _emitClick(listingId) {
    if (this._bus) {
      this._bus.publish('card:clicked', { listingId });
    } else if (this._onCardClick) {
      this._onCardClick(listingId);
    }
  }
}

window.CardRenderer = CardRenderer;
