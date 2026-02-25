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

// ── Favorites ─────────────────────────────────────────

async function toggleFavorite(apartmentId) {
  if (!isUserLoggedIn()) {
    window.location.href = '/login/?next=' + encodeURIComponent(window.location.pathname);
    return;
  }

  try {
    const response = await fetch('/apartments/api/favorites/toggle/', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': LivioUtils.getCsrfToken(),
        'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
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
  if (!isUserLoggedIn()) return;

  try {
    const ids = AppState.listings.map((l) => l.id);
    if (ids.length === 0) return;

    const response = await fetch('/apartments/api/favorites/check/', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': LivioUtils.getCsrfToken(),
        'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
      },
      body: JSON.stringify({ apartment_ids: ids }),
    });

    if (!response.ok) return;

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

// ── Auth helper ───────────────────────────────────────

function isUserLoggedIn() {
  return !!localStorage.getItem('access_token');
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
