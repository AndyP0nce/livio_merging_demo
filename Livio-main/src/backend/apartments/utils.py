"""
utils.py
--------
Pure-Python equivalents of the JavaScript helper functions that previously
lived in the frontend (app.js / filters.js).

Moving these here means:
  - The backend can compute distances and filter listings server-side.
  - The frontend no longer needs to download every listing just to filter them.
  - The same logic can be unit-tested without a browser.

Original JS locations:
  haversine_distance_mi  →  app.js  haversineDistanceMi()
  parse_bedrooms         →  serializers.py  get_bedrooms()  (already existed)
  parse_bathrooms        →  serializers.py  get_bathrooms() (already existed)
  apply_listing_filters  →  filters.js  applyFilters()
"""

import math
import re


# ── Distance calculation ──────────────────────────────────────────────────────

def haversine_distance_mi(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Compute the great-circle distance in miles between two lat/lng points.

    JavaScript original (app.js):
        function haversineDistanceMi(lat1, lng1, lat2, lng2) {
            const R = 3958.8;
            const toRad = (deg) => (deg * Math.PI) / 180;
            const dLat = toRad(lat2 - lat1);
            const dLng = toRad(lng2 - lng1);
            const a = Math.sin(dLat / 2) ** 2 +
                      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

    Usage:
        dist = haversine_distance_mi(34.2381, -118.5285, 34.0522, -118.2437)
        # → roughly 21 miles (CSUN to downtown LA)
    """
    R = 3958.8  # Earth radius in miles

    def to_rad(deg):
        return deg * math.pi / 180

    d_lat = to_rad(lat2 - lat1)
    d_lng = to_rad(lng2 - lng1)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Bedrooms / bathrooms normalisation ───────────────────────────────────────

def parse_bedrooms(value: str) -> int:
    """
    Convert the DB bedrooms string ('Studio', '1', '2', '3', '4+') to an int.
    Studio → 0,  '4+' → 4,  anything invalid → 0.

    JS equivalent (serializers.py already had this, ported here for reuse):
        get_bedrooms(obj): 'studio' → 0, else parseInt(obj.bedrooms)
    """
    if not value:
        return 0
    if value.strip().lower() == 'studio':
        return 0
    try:
        return int(value.replace('+', ''))
    except (ValueError, TypeError):
        return 0


def parse_bathrooms(value: str) -> float:
    """
    Convert the DB bathrooms string ('1', '1.5', '2', '2.5', '3') to a float.
    Anything invalid → 1.0.
    """
    try:
        return float(value)
    except (ValueError, TypeError):
        return 1.0


# ── Address parsing helpers ───────────────────────────────────────────────────

def parse_city_from_address(address: str) -> str:
    """
    Extract city from a combined address string like '123 Main St, Northridge, CA 91324'.

    JavaScript original (filters.js):
        _parseCity(address) {
            const parts = address.split(',');
            return parts.length >= 2 ? parts[1].trim() : '';
        }

    NOTE: The ApartmentPost model now has a dedicated `city` column, so in most
    cases you should use that directly. This helper is kept for edge cases where
    only the combined address string is available.
    """
    parts = address.split(',')
    return parts[1].strip() if len(parts) >= 2 else ''


def parse_zip_from_address(address: str) -> str:
    """
    Extract a 5-digit zip code from a combined address string.

    JavaScript original (filters.js):
        _parseZip(address) {
            const match = address.match(/\\d{5}$/);
            return match ? match[0] : '';
        }
    """
    match = re.search(r'\d{5}$', address)
    return match.group(0) if match else ''


# ── Server-side listing filter (mirrors filters.js applyFilters) ──────────────

def apply_listing_filters(queryset, params: dict):
    """
    Apply query-parameter filters to an ApartmentPost queryset.

    This is the Python equivalent of FilterManager.applyFilters() in filters.js.
    Instead of filtering a JS array in the browser, we filter the Django queryset
    before it ever leaves the database — faster and uses less bandwidth.

    Supported params (all optional):
        type        – exact room type match (e.g. 'Apartment', 'House')
        min_beds    – minimum bedroom count (0 = Studio)
        min_baths   – minimum bathroom count (supports 1, 1.5, 2, …)
        price_min   – minimum monthly rent
        price_max   – maximum monthly rent
        sqft_min    – minimum square feet
        sqft_max    – maximum square feet
        amenity     – amenity name(s); repeat param for multiple
                      (e.g. ?amenity=WiFi&amenity=Pool)
        city        – city name (case-insensitive contains)
        zip         – exact zip code
        uni_lat     – university latitude  ┐ both required for
        uni_lng     – university longitude ┘ distance filtering
        max_distance_mi – max distance from university in miles

    JavaScript original (filters.js applyFilters):
        applyFilters(listings) {
            return listings.filter((listing) => {
                if (state.types.size > 0 && !state.types.has(listing.type)) return false;
                if (listing.bedrooms < state.minBeds) return false;
                if (listing.bathrooms < state.minBaths) return false;
                if (listing.price < state.priceMin) return false;
                if (listing.price > state.priceMax) return false;
                if (listing.sqft < state.sqftMin) return false;
                if (listing.sqft > state.sqftMax) return false;
                ...amenities check...
                return true;
            });
        }

    Returns:
        A (possibly filtered) queryset — or a plain list when distance filtering
        is active (distance cannot be computed inside the DB without PostGIS).
    """
    # ── Property type ─────────────────────────────────────────────────────────
    room_type = params.get('type')
    if room_type:
        queryset = queryset.filter(room_type__iexact=room_type)

    # ── Price range ───────────────────────────────────────────────────────────
    price_min = params.get('price_min')
    if price_min:
        try:
            queryset = queryset.filter(monthly_rent__gte=float(price_min))
        except ValueError:
            pass

    price_max = params.get('price_max')
    if price_max:
        try:
            queryset = queryset.filter(monthly_rent__lte=float(price_max))
        except ValueError:
            pass

    # ── Square feet ───────────────────────────────────────────────────────────
    sqft_min = params.get('sqft_min')
    if sqft_min:
        try:
            queryset = queryset.filter(square_feet__gte=int(sqft_min))
        except ValueError:
            pass

    sqft_max = params.get('sqft_max')
    if sqft_max:
        try:
            queryset = queryset.filter(square_feet__lte=int(sqft_max))
        except ValueError:
            pass

    # ── City / zip ────────────────────────────────────────────────────────────
    city = params.get('city')
    if city:
        queryset = queryset.filter(city__icontains=city)

    zip_code = params.get('zip')
    if zip_code:
        queryset = queryset.filter(zip_code=zip_code)

    # ── Amenities (comma-separated string in DB) ──────────────────────────────
    # Supports repeated param: ?amenity=WiFi&amenity=Pool
    amenities = params.getlist('amenity') if hasattr(params, 'getlist') else (
        [params['amenity']] if params.get('amenity') else []
    )
    for amenity in amenities:
        queryset = queryset.filter(amenities__icontains=amenity)

    # ── Bedrooms (CharField in DB: 'Studio', '1', '2', '3', '4+') ────────────
    # We cannot do numeric >= on a CharField, so we exclude lower values.
    min_beds_raw = params.get('min_beds')
    if min_beds_raw:
        try:
            min_beds = int(min_beds_raw)
            if min_beds >= 1:
                queryset = queryset.exclude(bedrooms__iexact='Studio')
            # Exclude '1', '2', etc. that are below the minimum
            beds_to_exclude = [str(i) for i in range(1, min_beds)]
            if beds_to_exclude:
                queryset = queryset.exclude(bedrooms__in=beds_to_exclude)
        except ValueError:
            pass

    # ── Bathrooms (CharField in DB: '1', '1.5', '2', '2.5', '3') ────────────
    min_baths_raw = params.get('min_baths')
    if min_baths_raw:
        try:
            min_baths = float(min_baths_raw)
            # Known bathroom values in ascending order
            bath_ladder = ['1', '1.5', '2', '2.5', '3']
            baths_to_exclude = [b for b in bath_ladder if float(b) < min_baths]
            if baths_to_exclude:
                queryset = queryset.exclude(bathrooms__in=baths_to_exclude)
        except ValueError:
            pass

    # ── Distance filter (requires in-Python post-processing) ─────────────────
    # Django ORM cannot compute haversine distance without PostGIS.
    # So we materialise the queryset and filter in Python.
    uni_lat = params.get('uni_lat')
    uni_lng = params.get('uni_lng')
    max_dist = params.get('max_distance_mi')

    if uni_lat and uni_lng and max_dist:
        try:
            uni_lat_f = float(uni_lat)
            uni_lng_f = float(uni_lng)
            max_dist_f = float(max_dist)

            result = []
            for listing in queryset:
                if listing.latitude and listing.longitude:
                    dist = haversine_distance_mi(
                        float(listing.latitude), float(listing.longitude),
                        uni_lat_f, uni_lng_f,
                    )
                    if dist <= max_dist_f:
                        result.append(listing)
            return result  # returns a list, not a queryset
        except ValueError:
            pass

    return queryset
