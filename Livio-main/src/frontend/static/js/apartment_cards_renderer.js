/**
 * apartment_cards_renderer.js
 *
 * Renders Zillow-style listing cards inside the sidebar panel.
 * Re-renders when the map viewport changes (only visible listings shown).
 *
 * Events published via EventBus:
 *   'card:hovered'  { listingId, isHovering }
 *   'card:clicked'  { listingId }
 */

class CardRenderer {
  /**
   * @param {string}   containerId  - id of the card list container element
   * @param {string}   countId      - id of the listing-count element
   * @param {EventBus} eventBus     - pub/sub hub for inter-module communication
   */
  constructor(containerId, countId, eventBus) {
    this.container    = document.getElementById(containerId);
    this.countEl      = document.getElementById(countId);
    this._bus         = eventBus;
    this.activeCardId = null;
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

  // ── Card creation ────────────────────────────────

  _createCard(listing) {
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.dataset.listingId = listing.id;

    const bedLabel  = LivioUtils.formatBedLabel(listing.bedrooms);
    const sqft      = listing.sqft ? listing.sqft.toLocaleString() : '—';
    const distLabel = listing._distanceMi != null
      ? listing._distanceMi.toFixed(1) + ' mi'
      : (listing.distanceFromCSUN || '');
    const targetName = listing._targetName || 'CSUN';

    const amenityHTML = (listing.amenities || [])
      .slice(0, 3)
      .map((a) => `<span class="listing-card__amenity">${a}</span>`)
      .join('');

    // Favorite state — reads from the global set managed by api_integration.js
    const isFav     = window.favoritedApartments && window.favoritedApartments.has(listing.id);
    const heartIcon = isFav ? '♥' : '♡';
    const heartMod  = isFav ? ' listing-card__fav--active' : '';

    // Image — real S3 photo if available, otherwise coloured placeholder
    const imgSection = listing.image_url
      ? `<div class="listing-card__img listing-card__img--photo" style="background:url('${listing.image_url}') center/cover no-repeat;">`
      : `<div class="listing-card__img" style="background:${listing.imageColor};">`;

    const ownerActionsHTML = listing.is_owner ? `
      <div class="listing-card__owner-actions">
        <button class="listing-card__owner-btn listing-card__owner-btn--edit" data-id="${listing.id}" aria-label="Edit listing">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button class="listing-card__owner-btn listing-card__owner-btn--delete" data-id="${listing.id}" aria-label="Delete listing">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          Delete
        </button>
      </div>` : '';

    card.innerHTML = `
      ${imgSection}
        <span class="listing-card__price">$${listing.price.toLocaleString()}/mo</span>
        <span class="listing-card__type">${listing.type}</span>
        <button class="listing-card__fav${heartMod}" data-id="${listing.id}"
                aria-label="Save listing" title="Save">
          ${heartIcon}
        </button>
      </div>
      <div class="listing-card__body">
        <div class="listing-card__title">${LivioUtils.escapeHtml(listing.title)}</div>
        <div class="listing-card__specs">${bedLabel} | ${listing.bathrooms} ba | ${sqft} sqft</div>
        <div class="listing-card__address">${LivioUtils.escapeHtml(listing.address)}</div>
        <div class="listing-card__desc">${LivioUtils.escapeHtml(listing.description || '')}</div>
        <div class="listing-card__amenities">${amenityHTML}</div>
        <div class="listing-card__meta">
          <span class="listing-card__available">Available: ${listing.available ? 'Yes' : 'No'}</span>
        </div>
        <div class="listing-card__footer">
          <span class="listing-card__owner">
            ${LivioUtils.escapeHtml(listing.owner.name)}
            ${listing.owner.verified ? '<span class="listing-card__verified">&#10003; Verified</span>' : ''}
          </span>
          ${distLabel ? `<span class="listing-card__distance">${distLabel} from ${targetName}</span>` : ''}
        </div>
        ${ownerActionsHTML}
      </div>`;

    // Heart button — stop propagation so it doesn't open the detail modal
    card.querySelector('.listing-card__fav').addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof toggleFavorite === 'function') toggleFavorite(listing.id);
    });

    // Owner edit/delete buttons
    const editBtn = card.querySelector('.listing-card__owner-btn--edit');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._bus.publish('listing:edit', { listingId: listing.id });
      });
    }
    const deleteBtn = card.querySelector('.listing-card__owner-btn--delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._bus.publish('listing:delete', { listingId: listing.id });
      });
    }

    card.addEventListener('mouseenter', () =>
      this._bus.publish('card:hovered', { listingId: listing.id, isHovering: true }));
    card.addEventListener('mouseleave', () =>
      this._bus.publish('card:hovered', { listingId: listing.id, isHovering: false }));
    card.addEventListener('click', () =>
      this._bus.publish('card:clicked', { listingId: listing.id }));

    return card;
  }
}

window.CardRenderer = CardRenderer;
