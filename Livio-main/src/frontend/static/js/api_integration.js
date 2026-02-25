/**
 * api_integration.js
 *
 * Favorites management + toast notifications for the apartment page.
 * Called from apartment_script.js after AppState is populated.
 *
 * Globals exposed:
 *   favoritedApartments  Set<number>   – IDs of listings the user has saved
 *   toggleFavorite(id)                 – add / remove a favorite
 *   checkFavoriteStatus()              – populate favoritedApartments on page load
 *   showNotification(msg, type)        – bottom-right toast
 */

let favoritedApartments = new Set();

// ── JWT token helpers ──────────────────────────────────

/**
 * Returns a valid access token, refreshing it first if expired.
 * Returns null if the user is not logged in or the refresh fails.
 */
async function getValidAccessToken() {
  const accessToken = localStorage.getItem('access_token');
  if (!accessToken) return null;

  // Decode the JWT payload and check expiry (no library needed — JWTs are base64)
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp > nowSec) return accessToken;   // still valid
  } catch (_) {
    // malformed token — fall through to refresh attempt
  }

  // Token expired: try refreshing
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/token/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!res.ok) {
      // Refresh token is also expired / invalid — clear storage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      return null;
    }

    const data = await res.json();
    localStorage.setItem('access_token', data.access);
    return data.access;
  } catch (_) {
    return null;
  }
}

// ── Favorites ─────────────────────────────────────────

async function toggleFavorite(apartmentId) {
  try {
    const token = await getValidAccessToken();

    if (!token) {
      // Not logged in (or session fully expired) → send to login
      window.location.href = '/login/?next=' + encodeURIComponent(window.location.pathname);
      return;
    }

    const response = await fetch('/apartments/api/favorites/toggle/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({ apartment_id: apartmentId }),
    });

    if (!response.ok) throw new Error('Failed to toggle favorite');

    const data = await response.json();

    if (data.is_favorited) {
      favoritedApartments.add(apartmentId);
    } else {
      favoritedApartments.delete(apartmentId);
    }

    _updateHeartButton(apartmentId, data.is_favorited);
    showNotification(data.message, 'success');

    // If the saved-tab is active and we just un-favorited, re-render to remove the card
    if (typeof refreshFavoritesView === 'function') refreshFavoritesView();

  } catch (error) {
    console.error('Error toggling favorite:', error);
    showNotification('Error saving favorite', 'error');
  }
}

async function checkFavoriteStatus() {
  try {
    const ids = AppState.listings.map((l) => l.id);
    if (ids.length === 0) return;

    const token = await getValidAccessToken();

    // Build headers — include Authorization only when a valid token exists
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const response = await fetch('/apartments/api/favorites/check/', {
      method: 'POST',
      headers,
      body: JSON.stringify({ apartment_ids: ids }),
    });

    if (!response.ok) return;   // not logged in or server error — silently skip

    const status = await response.json();
    favoritedApartments = new Set(
      Object.keys(status)
        .filter((id) => status[id])
        .map((id) => parseInt(id, 10))
    );
  } catch (error) {
    console.error('Error checking favorites:', error);
  }
}

function _updateHeartButton(apartmentId, isFavorited) {
  const card = document.querySelector('[data-listing-id="' + apartmentId + '"]');
  if (!card) return;
  const btn = card.querySelector('.listing-card__fav');
  if (!btn) return;

  if (isFavorited) {
    btn.textContent = '♥';
    btn.classList.add('listing-card__fav--active');
  } else {
    btn.textContent = '♡';
    btn.classList.remove('listing-card__fav--active');
  }
}

// ── Toast notification ────────────────────────────────

function showNotification(message, type) {
  type = type || 'info';
  const el = document.createElement('div');
  el.className = 'livio-toast livio-toast--' + type;
  el.textContent = message;
  document.body.appendChild(el);

  // Trigger entrance animation on next frame
  requestAnimationFrame(() => el.classList.add('livio-toast--visible'));

  setTimeout(() => {
    el.classList.remove('livio-toast--visible');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}
