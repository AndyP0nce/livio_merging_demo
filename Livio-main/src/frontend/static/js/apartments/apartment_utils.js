/**
 * apartment_utils.js
 * Shared utility functions for all Livio apartment modules.
 * Must be loaded before all other apartment_*.js scripts.
 */

const LivioUtils = Object.freeze({

  /**
   * Read the Django CSRF token from cookies.
   * Replaces the duplicate getCookie / _getCsrfToken helpers that
   * previously appeared in both api_integration.js and
   * apartment_create_modal.js.
   * @returns {string}
   */
  getCsrfToken() {
    const name = 'csrftoken';
    for (const cookie of document.cookie.split(';')) {
      const c = cookie.trim();
      if (c.startsWith(name + '=')) return decodeURIComponent(c.slice(name.length + 1));
    }
    return '';
  },

  /**
   * Format a normalized bedroom count to a short display label.
   * Replaces the 3+ copies of inline `bedrooms === 0 ? 'Studio' : bedrooms + ' bd'`
   * scattered across cards_renderer, listing_detail, and map_manager.
   * @param {number} bedrooms - 0 = Studio, 1+ = number of bedrooms
   * @returns {string} e.g. 'Studio', '2 bd'
   */
  formatBedLabel(bedrooms) {
    return bedrooms === 0 ? 'Studio' : bedrooms + ' bd';
  },

  /**
   * Check whether a lat/lng pair is usable for map placement.
   * Replaces the 4+ repeated null/NaN guard expressions in apartment_script.js.
   * @param {*} lat
   * @param {*} lng
   * @returns {boolean}
   */
  isValidCoords(lat, lng) {
    return lat !== null && lat !== undefined &&
           lng !== null && lng !== undefined &&
           !isNaN(lat) && !isNaN(lng);
  },

  /**
   * Haversine great-circle distance in miles.
   * Extracted from apartment_script.js so it can be shared with
   * any future module that needs it.
   * @param {number} lat1
   * @param {number} lng1
   * @param {number} lat2
   * @param {number} lng2
   * @returns {number}
   */
  haversineDistanceMi(lat1, lng1, lat2, lng2) {
    const R   = 3958.8;
    const rad = (d) => d * Math.PI / 180;
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  /**
   * Escape a string for safe insertion into innerHTML, preventing XSS.
   * @param {*} value - any value; null/undefined become empty string
   * @returns {string} HTML-escaped string
   */
  escapeHtml(value) {
    const el = document.createElement('span');
    el.textContent = String(value == null ? '' : value);
    return el.innerHTML;
  },

  /**
   * Redirect to login if no JWT access token is present.
   * @returns {boolean} true if user is authenticated, false if redirected
   */
  requireLogin() {
    if (!localStorage.getItem('access_token')) {
      window.location.href = '/login/?next=' + encodeURIComponent(window.location.pathname);
      return false;
    }
    return true;
  },

});

window.LivioUtils = LivioUtils;
