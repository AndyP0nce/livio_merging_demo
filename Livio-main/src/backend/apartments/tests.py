"""
Module Name: apartments.tests
Programmer's Name: Backend Integration Team
Description:
    Comprehensive test suite for the apartments app covering:
    - Model creation, validation, and geocoding
    - API endpoint behaviour (list, detail, create, update, delete)
    - Authentication and ownership enforcement
    - Favorites system (toggle, check, list)
    - Filtering logic via API query params
    - University list endpoint
"""

import json
from decimal import Decimal

from django.test import TestCase, Client
from django.urls import reverse
from django.conf import settings

from users.models import User
from apartments.models import ApartmentPost, FavoriteApartment, University


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(username, password="testpass123", email=None):
    email = email or f"{username}@test.com"
    user = User.objects.create(username=username, email=email)
    user.set_password(password)
    user.save()
    return user


def make_apartment(owner, **kwargs):
    defaults = dict(
        title="Test Apartment",
        location="Los Angeles",
        city="Los Angeles",
        state="CA",
        monthly_rent=1500,
        bedrooms="1bed",
        bathrooms="1bath",
        room_type="private",
    )
    defaults.update(kwargs)
    return ApartmentPost.objects.create(owner=owner, **defaults)


# ---------------------------------------------------------------------------
# 1. Model Tests
# ---------------------------------------------------------------------------

class ApartmentPostModelTest(TestCase):
    """Test ApartmentPost model creation and field behaviour."""

    def setUp(self):
        self.user = make_user("modeluser")

    def test_create_minimal_apartment(self):
        apt = make_apartment(self.user)
        self.assertEqual(apt.title, "Test Apartment")
        self.assertEqual(apt.owner, self.user)
        self.assertTrue(apt.is_active)

    def test_coordinates_populated_after_save(self):
        """Geocoding or default fallback must set lat/lng."""
        apt = make_apartment(self.user, location="Santa Monica", city="Santa Monica")
        self.assertIsNotNone(apt.latitude)
        self.assertIsNotNone(apt.longitude)

    def test_str_representation(self):
        apt = make_apartment(self.user, title="My Place")
        self.assertIn("My Place", str(apt))

    def test_default_is_active_true(self):
        apt = make_apartment(self.user)
        self.assertTrue(apt.is_active)

    def test_inactive_apartment_excluded_from_active_query(self):
        make_apartment(self.user, title="Active")
        make_apartment(self.user, title="Inactive", is_active=False)
        active = ApartmentPost.objects.filter(is_active=True)
        self.assertEqual(active.count(), 1)
        self.assertEqual(active.first().title, "Active")


class ApartmentPostGeocodingTest(TestCase):
    """Test Google Maps API configuration."""

    def test_api_key_configured(self):
        self.assertTrue(hasattr(settings, "GOOGLE_MAPS_API_KEY"))
        key = settings.GOOGLE_MAPS_API_KEY
        self.assertIsNotNone(key)
        self.assertGreater(len(key), 0)
        self.assertTrue(key.startswith("AIza"),
                        "API key should start with 'AIza'")


# ---------------------------------------------------------------------------
# 2. Favorites Model Tests
# ---------------------------------------------------------------------------

class FavoriteApartmentModelTest(TestCase):
    """Test FavoriteApartment model constraints."""

    def setUp(self):
        self.user1 = make_user("fav_user1")
        self.user2 = make_user("fav_user2")
        self.apt = make_apartment(self.user1)

    def test_create_favorite(self):
        fav = FavoriteApartment.objects.create(user=self.user1, apartment=self.apt)
        self.assertEqual(fav.user, self.user1)
        self.assertEqual(fav.apartment, self.apt)

    def test_duplicate_favorite_raises(self):
        FavoriteApartment.objects.create(user=self.user1, apartment=self.apt)
        with self.assertRaises(Exception):
            FavoriteApartment.objects.create(user=self.user1, apartment=self.apt)

    def test_multiple_users_can_favorite_same_apartment(self):
        FavoriteApartment.objects.create(user=self.user1, apartment=self.apt)
        FavoriteApartment.objects.create(user=self.user2, apartment=self.apt)
        self.assertEqual(
            FavoriteApartment.objects.filter(apartment=self.apt).count(), 2
        )


# ---------------------------------------------------------------------------
# 3. ORM Filtering Tests
# ---------------------------------------------------------------------------

class ApartmentPostFilterTest(TestCase):
    """Test queryset-level filtering by rent, bedrooms, amenities, room type."""

    def setUp(self):
        self.user = make_user("filteruser")
        make_apartment(self.user, title="Budget", monthly_rent=800,
                       bedrooms="1bed", room_type="private")
        make_apartment(self.user, title="Mid-Range", monthly_rent=1500,
                       bedrooms="2bed", room_type="entire", amenities="parking,gym")
        make_apartment(self.user, title="Luxury", monthly_rent=3000,
                       bedrooms="3bed", room_type="entire", amenities="parking,gym,pool")

    def test_filter_by_price_range(self):
        results = ApartmentPost.objects.filter(monthly_rent__gte=1000, monthly_rent__lte=2000)
        self.assertEqual(results.count(), 1)
        self.assertEqual(results.first().title, "Mid-Range")

    def test_filter_by_bedrooms(self):
        self.assertEqual(ApartmentPost.objects.filter(bedrooms="2bed").count(), 1)

    def test_filter_by_amenity(self):
        results = ApartmentPost.objects.filter(amenities__icontains="pool")
        self.assertEqual(results.count(), 1)
        self.assertEqual(results.first().title, "Luxury")

    def test_filter_by_room_type(self):
        self.assertEqual(ApartmentPost.objects.filter(room_type="entire").count(), 2)


# ---------------------------------------------------------------------------
# 4. University Model Test
# ---------------------------------------------------------------------------

class UniversityModelTest(TestCase):
    """Test University model."""

    def test_create_university(self):
        uni = University.objects.create(
            abbreviation="UCLA",
            full_name="University of California, Los Angeles",
            latitude=34.0689,
            longitude=-118.4452,
        )
        self.assertEqual(uni.abbreviation, "UCLA")
        self.assertIn("UCLA", str(uni))


# ---------------------------------------------------------------------------
# 5. University API Tests
# ---------------------------------------------------------------------------

class UniversityListAPITest(TestCase):
    """GET /apartments/api/universities/ — public, no auth needed."""

    def setUp(self):
        self.client = Client()
        University.objects.create(
            abbreviation="UCLA", full_name="UC Los Angeles",
            latitude=34.0689, longitude=-118.4452
        )
        University.objects.create(
            abbreviation="USC", full_name="University of Southern California",
            latitude=34.0224, longitude=-118.2851
        )

    def test_returns_200(self):
        resp = self.client.get("/apartments/api/universities/")
        self.assertEqual(resp.status_code, 200)

    def test_returns_all_universities(self):
        resp = self.client.get("/apartments/api/universities/")
        data = resp.json()
        self.assertEqual(len(data), 2)

    def test_response_fields(self):
        resp = self.client.get("/apartments/api/universities/")
        uni = resp.json()[0]
        for field in ("abbreviation", "full_name", "latitude", "longitude"):
            self.assertIn(field, uni)

    def test_no_auth_required(self):
        """Unauthenticated clients can reach this endpoint."""
        resp = self.client.get("/apartments/api/universities/")
        self.assertNotEqual(resp.status_code, 403)


# ---------------------------------------------------------------------------
# 6. Apartment List API Tests
# ---------------------------------------------------------------------------

class ApartmentListAPITest(TestCase):
    """GET /apartments/api/apartments/ — filtering & public access."""

    def setUp(self):
        self.client = Client()
        self.owner = make_user("list_owner")
        make_apartment(self.owner, title="Cheap", monthly_rent=700,
                       bedrooms="1bed", room_type="private", location="East LA")
        make_apartment(self.owner, title="Mid", monthly_rent=1400,
                       bedrooms="2bed", room_type="entire",
                       amenities="parking,gym", location="Santa Monica")
        make_apartment(self.owner, title="Pricey", monthly_rent=2800,
                       bedrooms="3bed", room_type="entire",
                       amenities="parking,gym,pool", location="Beverly Hills")
        # Inactive — should never appear
        make_apartment(self.owner, title="Hidden", is_active=False)

    def test_list_returns_200(self):
        resp = self.client.get("/apartments/api/apartments/")
        self.assertEqual(resp.status_code, 200)

    def test_inactive_excluded(self):
        resp = self.client.get("/apartments/api/apartments/")
        titles = [a["title"] for a in resp.json()]
        self.assertNotIn("Hidden", titles)

    def test_total_active_count(self):
        resp = self.client.get("/apartments/api/apartments/")
        self.assertEqual(len(resp.json()), 3)

    def test_filter_min_rent(self):
        resp = self.client.get("/apartments/api/apartments/?min_rent=1000")
        data = resp.json()
        for apt in data:
            self.assertGreaterEqual(float(apt["monthly_rent"]), 1000)

    def test_filter_max_rent(self):
        resp = self.client.get("/apartments/api/apartments/?max_rent=1500")
        data = resp.json()
        for apt in data:
            self.assertLessEqual(float(apt["monthly_rent"]), 1500)

    def test_filter_rent_range(self):
        resp = self.client.get("/apartments/api/apartments/?min_rent=1000&max_rent=2000")
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["title"], "Mid")

    def test_filter_bedrooms(self):
        resp = self.client.get("/apartments/api/apartments/?bedrooms=2bed")
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["title"], "Mid")

    def test_filter_room_type(self):
        resp = self.client.get("/apartments/api/apartments/?room_type=entire")
        data = resp.json()
        self.assertEqual(len(data), 2)

    def test_filter_amenity(self):
        resp = self.client.get("/apartments/api/apartments/?amenities=pool")
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["title"], "Pricey")

    def test_filter_location(self):
        resp = self.client.get("/apartments/api/apartments/?location=Santa+Monica")
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["title"], "Mid")

    def test_filter_search_by_title(self):
        resp = self.client.get("/apartments/api/apartments/?search=Pricey")
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["title"], "Pricey")

    def test_no_results_for_impossible_filter(self):
        resp = self.client.get("/apartments/api/apartments/?min_rent=99999")
        self.assertEqual(resp.json(), [])


# ---------------------------------------------------------------------------
# 7. Apartment Create API Tests
# ---------------------------------------------------------------------------

class ApartmentCreateAPITest(TestCase):
    """POST /apartments/api/apartments/ — auth required."""

    def setUp(self):
        self.client = Client()
        self.user = make_user("creator")

    def _post(self, data, login=True):
        if login:
            self.client.login(username="creator", password="testpass123")
        return self.client.post(
            "/apartments/api/apartments/",
            data=json.dumps(data),
            content_type="application/json",
        )

    def test_unauthenticated_returns_403(self):
        resp = self._post({"title": "X"}, login=False)
        self.assertIn(resp.status_code, [401, 403])

    def test_create_returns_201(self):
        resp = self._post({
            "title": "New Place",
            "location": "Los Angeles",
            "monthly_rent": "1200",
            "bedrooms": "1bed",
            "bathrooms": "1bath",
            "room_type": "private",
        })
        self.assertEqual(resp.status_code, 201)

    def test_created_apartment_belongs_to_user(self):
        self._post({
            "title": "Owned Place",
            "location": "Los Angeles",
            "monthly_rent": "900",
            "bedrooms": "1bed",
            "bathrooms": "1bath",
            "room_type": "private",
        })
        apt = ApartmentPost.objects.get(title="Owned Place")
        self.assertEqual(apt.owner, self.user)

    def test_missing_required_field_returns_400(self):
        resp = self._post({"title": "Incomplete"})
        self.assertEqual(resp.status_code, 400)


# ---------------------------------------------------------------------------
# 8. Apartment Detail API Tests
# ---------------------------------------------------------------------------

class ApartmentDetailAPITest(TestCase):
    """GET/PUT/DELETE /apartments/api/apartments/<id>/"""

    def setUp(self):
        self.client = Client()
        self.owner = make_user("detail_owner")
        self.other = make_user("other_user")
        self.apt = make_apartment(self.owner, title="Detail Test")

    def test_get_returns_200(self):
        resp = self.client.get(f"/apartments/api/apartments/{self.apt.id}/")
        self.assertEqual(resp.status_code, 200)

    def test_get_returns_correct_apartment(self):
        resp = self.client.get(f"/apartments/api/apartments/{self.apt.id}/")
        self.assertEqual(resp.json()["title"], "Detail Test")

    def test_get_nonexistent_returns_404(self):
        resp = self.client.get("/apartments/api/apartments/99999/")
        self.assertEqual(resp.status_code, 404)

    def test_put_by_owner_succeeds(self):
        self.client.login(username="detail_owner", password="testpass123")
        resp = self.client.put(
            f"/apartments/api/apartments/{self.apt.id}/",
            data=json.dumps({"title": "Updated Title"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.apt.refresh_from_db()
        self.assertEqual(self.apt.title, "Updated Title")

    def test_put_by_non_owner_returns_403(self):
        self.client.login(username="other_user", password="testpass123")
        resp = self.client.put(
            f"/apartments/api/apartments/{self.apt.id}/",
            data=json.dumps({"title": "Stolen"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_put_unauthenticated_returns_401(self):
        resp = self.client.put(
            f"/apartments/api/apartments/{self.apt.id}/",
            data=json.dumps({"title": "Stolen"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 401)

    def test_delete_by_owner_succeeds(self):
        self.client.login(username="detail_owner", password="testpass123")
        resp = self.client.delete(f"/apartments/api/apartments/{self.apt.id}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(ApartmentPost.objects.filter(id=self.apt.id).exists())

    def test_delete_by_non_owner_returns_403(self):
        self.client.login(username="other_user", password="testpass123")
        resp = self.client.delete(f"/apartments/api/apartments/{self.apt.id}/")
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(ApartmentPost.objects.filter(id=self.apt.id).exists())

    def test_delete_unauthenticated_returns_401(self):
        resp = self.client.delete(f"/apartments/api/apartments/{self.apt.id}/")
        self.assertEqual(resp.status_code, 401)


# ---------------------------------------------------------------------------
# 9. Toggle Favorite API Tests
# ---------------------------------------------------------------------------

class ToggleFavoriteAPITest(TestCase):
    """POST /apartments/api/favorites/toggle/"""

    def setUp(self):
        self.client = Client()
        self.user = make_user("fav_toggler")
        self.owner = make_user("fav_apt_owner")
        self.apt = make_apartment(self.owner, title="Favable")

    def _post(self, apt_id=None, login=True):
        if login:
            self.client.login(username="fav_toggler", password="testpass123")
        payload = {"apartment_id": apt_id or self.apt.id}
        return self.client.post(
            "/apartments/api/favorites/toggle/",
            data=json.dumps(payload),
            content_type="application/json",
        )

    def test_unauthenticated_returns_403(self):
        resp = self._post(login=False)
        self.assertIn(resp.status_code, [401, 403])

    def test_first_toggle_adds_favorite(self):
        resp = self._post()
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.json()["is_favorited"])

    def test_second_toggle_removes_favorite(self):
        self._post()           # add
        resp = self._post()    # remove
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()["is_favorited"])

    def test_missing_apartment_id_returns_400(self):
        self.client.login(username="fav_toggler", password="testpass123")
        resp = self.client.post(
            "/apartments/api/favorites/toggle/",
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_nonexistent_apartment_returns_404(self):
        resp = self._post(apt_id=99999)
        self.assertEqual(resp.status_code, 404)


# ---------------------------------------------------------------------------
# 10. Check Favorite Status API Tests
# ---------------------------------------------------------------------------

class CheckFavoriteStatusAPITest(TestCase):
    """POST /apartments/api/favorites/check/"""

    def setUp(self):
        self.client = Client()
        self.user = make_user("checker")
        self.owner = make_user("check_owner")
        self.apt1 = make_apartment(self.owner, title="Check1")
        self.apt2 = make_apartment(self.owner, title="Check2")
        FavoriteApartment.objects.create(user=self.user, apartment=self.apt1)

    def _post(self, ids, login=True):
        if login:
            self.client.login(username="checker", password="testpass123")
        return self.client.post(
            "/apartments/api/favorites/check/",
            data=json.dumps({"apartment_ids": ids}),
            content_type="application/json",
        )

    def test_unauthenticated_returns_403(self):
        resp = self._post([self.apt1.id], login=False)
        self.assertIn(resp.status_code, [401, 403])

    def test_correct_status_returned(self):
        resp = self._post([self.apt1.id, self.apt2.id])
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data[str(self.apt1.id)])
        self.assertFalse(data[str(self.apt2.id)])

    def test_empty_list_returns_empty_dict(self):
        resp = self._post([])
        self.assertEqual(resp.json(), {})


# ---------------------------------------------------------------------------
# 11. Get User Favorites API Tests
# ---------------------------------------------------------------------------

class GetUserFavoritesAPITest(TestCase):
    """GET /apartments/api/favorites/"""

    def setUp(self):
        self.client = Client()
        self.user = make_user("get_fav_user")
        self.owner = make_user("get_fav_owner")
        self.apt1 = make_apartment(self.owner, title="Fav A")
        self.apt2 = make_apartment(self.owner, title="Fav B")
        FavoriteApartment.objects.create(user=self.user, apartment=self.apt1)
        FavoriteApartment.objects.create(user=self.user, apartment=self.apt2)

    def test_unauthenticated_returns_403(self):
        resp = self.client.get("/apartments/api/favorites/")
        self.assertIn(resp.status_code, [401, 403])

    def test_returns_only_users_favorites(self):
        self.client.login(username="get_fav_user", password="testpass123")
        resp = self.client.get("/apartments/api/favorites/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 2)

    def test_other_users_favorites_not_included(self):
        other = make_user("intruder")
        other_apt = make_apartment(other, title="Intruder Apt")
        FavoriteApartment.objects.create(user=other, apartment=other_apt)

        self.client.login(username="get_fav_user", password="testpass123")
        resp = self.client.get("/apartments/api/favorites/")
        titles = [f["apartment"]["title"] for f in resp.json()]
        self.assertNotIn("Intruder Apt", titles)

    def test_empty_favorites_returns_empty_list(self):
        empty_user = make_user("no_favs")
        self.client.login(username="no_favs", password="testpass123")
        resp = self.client.get("/apartments/api/favorites/")
        self.assertEqual(resp.json(), [])
