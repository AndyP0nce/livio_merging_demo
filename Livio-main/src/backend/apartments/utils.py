"""
utils.py
--------
Server-side filter helpers for the apartments app.

apply_listing_filters mirrors the frontend FilterManager.applyFilters() logic
from the old demo map (filters.js / app.js), ported to Python so the database
does the work instead of the browser.

Original JS locations:
  haversine_distance_mi  →  app.js      haversineDistanceMi()
  apply_listing_filters  →  filters.js  applyFilters()
"""

import math
from decimal import Decimal
from django.db.models import Q


# ── Distance calculation ───────────────────────────────────────────────────────

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


# ── Server-side listing filter (mirrors filters.js applyFilters) ───────────────

def apply_listing_filters(queryset, params: dict):
    """
    Apply query-parameter filters to an ApartmentPost queryset.

    This is the Python equivalent of FilterManager.applyFilters() in filters.js.
    Instead of filtering a JS array in the browser, we filter the Django queryset
    before it ever leaves the database — faster and uses less bandwidth.

    Param names match livio's existing API contract (see views.py ApartmentListAPI):

        location        – location or city name, partial match
        min_rent        – minimum monthly rent
        max_rent        – maximum monthly rent
        bedrooms        – exact bedroom value ('1bed', '2bed', '3bed', '4bed')
        min_beds        – minimum bedroom count as int (1, 2, 3, 4)
        bathrooms       – exact bathroom value ('1bath', '2bath', '3bath')
        min_baths       – minimum bathroom count as int (1, 2, 3)
        room_type       – exact room type ('private', 'shared', 'entire')
        amenities       – comma-separated amenity names (?amenities=parking,gym)
        sqft_min        – minimum square feet
        sqft_max        – maximum square feet
        search          – text search across title / description / location / city
        uni_lat         – university latitude  ┐ all three required for
        uni_lng         – university longitude ┘ distance filtering
        max_distance_mi – max distance from campus in miles

    Note on bedrooms / bathrooms:
        Pass `bedrooms` for an exact match (e.g. ?bedrooms=2bed).
        Pass `min_beds` for a minimum threshold (e.g. ?min_beds=2).
        If both are sent, exact match takes priority and min_beds is ignored.
        Same rule applies to `bathrooms` vs `min_baths`.

    Returns:
        A (possibly filtered) queryset — or a plain list when distance filtering
        is active (distance cannot be computed inside the DB without PostGIS).
    """
    # ── Location (searches both location and city fields) ──────────────────────
    location = params.get('location')
    if location:
        queryset = queryset.filter(
            Q(location__icontains=location) | Q(city__icontains=location)
        )

    # ── Price range ────────────────────────────────────────────────────────────
    min_rent = params.get('min_rent')
    if min_rent:
        try:
            queryset = queryset.filter(monthly_rent__gte=Decimal(min_rent))
        except Exception:
            pass

    max_rent = params.get('max_rent')
    if max_rent:
        try:
            queryset = queryset.filter(monthly_rent__lte=Decimal(max_rent))
        except Exception:
            pass

    # ── Square feet ────────────────────────────────────────────────────────────
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

    # ── Room type ──────────────────────────────────────────────────────────────
    room_type = params.get('room_type')
    if room_type:
        queryset = queryset.filter(room_type__iexact=room_type)

    # ── Amenities (comma-separated string in DB, e.g. "parking,gym,pool") ──────
    # Frontend sends as a single comma-separated param: ?amenities=parking,gym
    amenities_raw = params.get('amenities')
    if amenities_raw:
        for amenity in [a.strip() for a in amenities_raw.split(',') if a.strip()]:
            queryset = queryset.filter(amenities__icontains=amenity)

    # ── Bedrooms (DB choices: '1bed', '2bed', '3bed', '4bed') ─────────────────
    # Exact match takes priority over the min_beds threshold.
    bedrooms = params.get('bedrooms')
    if bedrooms:
        queryset = queryset.filter(bedrooms=bedrooms)
    else:
        min_beds_raw = params.get('min_beds')
        if min_beds_raw:
            try:
                min_beds = int(min_beds_raw)
                # Ladder matches the model choices in ascending order.
                bed_ladder = ['1bed', '2bed', '3bed', '4bed']
                # Slice off every value that falls below the minimum.
                beds_to_exclude = bed_ladder[:min_beds - 1]
                if beds_to_exclude:
                    queryset = queryset.exclude(bedrooms__in=beds_to_exclude)
            except ValueError:
                pass

    # ── Bathrooms (DB choices: '1bath', '2bath', '3bath') ─────────────────────
    # Exact match takes priority over the min_baths threshold.
    bathrooms = params.get('bathrooms')
    if bathrooms:
        queryset = queryset.filter(bathrooms=bathrooms)
    else:
        min_baths_raw = params.get('min_baths')
        if min_baths_raw:
            try:
                min_baths = int(min_baths_raw)
                # Ladder matches the model choices in ascending order.
                bath_ladder = ['1bath', '2bath', '3bath']
                # Slice off every value that falls below the minimum.
                baths_to_exclude = bath_ladder[:min_baths - 1]
                if baths_to_exclude:
                    queryset = queryset.exclude(bathrooms__in=baths_to_exclude)
            except ValueError:
                pass

    # ── General text search (title / description / location / city) ────────────
    search = params.get('search')
    if search:
        queryset = queryset.filter(
            Q(title__icontains=search)
            | Q(description__icontains=search)
            | Q(location__icontains=search)
            | Q(city__icontains=search)
        )

    # ── Distance filter (Python post-processing — no PostGIS required) ─────────
    # Django ORM cannot compute haversine distance without PostGIS, so we
    # materialise the queryset and filter the results in Python.
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
