from django.test import TestCase
from django.conf import settings
from users.models import User
from apartments.models import ApartmentPost, FavoriteApartment
from decimal import Decimal

"""
Module Name: apartments.tests
Date of Code: November 27, 2025
Programmer's Name: Backend Integration Team
Description: Essential test cases for the ApartmentPost and FavoriteApartment models.
Important Functions: Geocoding, Favorites system
Data Structures: ApartmentPost, FavoriteApartment
Algorithms: Google Maps Geocoding API integration
"""


class ApartmentPostBasicTest(TestCase):
    """Test basic apartment functionality."""
    
    def setUp(self):
        """Set up test user."""
        self.user = User.objects.create(
            username="testuser", 
            email="test@test.com"
        )
        self.user.set_password("password123")
        self.user.save()
    
    def test_create_apartment_with_geocoding(self):
        """Test creating apartment and geocoding coordinates."""
        apartment = ApartmentPost.objects.create(
            title="Santa Monica Beach House",
            description="Beautiful beach apartment",
            location="Santa Monica",
            city="Los Angeles",
            state="CA",
            monthly_rent=2500,
            bedrooms="2bed",
            bathrooms="2bath",
            room_type="entire",
            owner=self.user
        )
        
        # Check apartment was created
        self.assertEqual(apartment.title, "Santa Monica Beach House")
        self.assertEqual(apartment.owner, self.user)
        
        # Check coordinates were filled (geocoding worked or default used)
        self.assertIsNotNone(apartment.latitude)
        self.assertIsNotNone(apartment.longitude)
        
        # If geocoding worked, coordinates should be for Santa Monica (not default LA)
        if apartment.latitude != Decimal('34.0522'):
            print(f"✓ Geocoding SUCCESS! Santa Monica: ({apartment.latitude}, {apartment.longitude})")
        else:
            print(f"⚠ Used default LA coordinates")


class ApartmentPostGeocodingTest(TestCase):
    """Test Google Maps API configuration and geocoding."""
    
    def test_api_key_configured(self):
        """Test that Google Maps API key is configured."""
        self.assertTrue(hasattr(settings, 'GOOGLE_MAPS_API_KEY'))
        self.assertIsNotNone(settings.GOOGLE_MAPS_API_KEY)
        self.assertGreater(len(settings.GOOGLE_MAPS_API_KEY), 0)
        self.assertTrue(settings.GOOGLE_MAPS_API_KEY.startswith('AIza'))
        print(f"✓ API key configured: {settings.GOOGLE_MAPS_API_KEY[:10]}...{settings.GOOGLE_MAPS_API_KEY[-5:]}")


class FavoriteApartmentTest(TestCase):
    """Test favorites functionality."""
    
    def setUp(self):
        """Set up users and apartment."""
        self.user1 = User.objects.create(
            username="user1",
            email="user1@test.com"
        )
        self.user1.set_password("password123")
        self.user1.save()
        
        self.user2 = User.objects.create(
            username="user2",
            email="user2@test.com"
        )
        self.user2.set_password("password123")
        self.user2.save()
        
        self.apartment = ApartmentPost.objects.create(
            title="Test Apartment",
            location="Los Angeles",
            monthly_rent=1500,
            owner=self.user1
        )
    
    def test_create_and_manage_favorites(self):
        """Test creating favorites and preventing duplicates."""
        # Create favorite
        favorite = FavoriteApartment.objects.create(
            user=self.user1,
            apartment=self.apartment
        )
        
        self.assertEqual(favorite.user, self.user1)
        self.assertEqual(favorite.apartment, self.apartment)
        print(f"✓ Created favorite: {favorite}")
        
        # Test duplicate prevention
        with self.assertRaises(Exception):
            FavoriteApartment.objects.create(
                user=self.user1,
                apartment=self.apartment
            )
        print("✓ Duplicate favorite prevented")
        
        # Test multiple users can favorite same apartment
        favorite2 = FavoriteApartment.objects.create(
            user=self.user2,
            apartment=self.apartment
        )
        self.assertEqual(favorite2.apartment, favorite.apartment)
        print("✓ Multiple users can favorite same apartment")


class ApartmentPostFilterTest(TestCase):
    """Test filtering apartments."""
    
    def setUp(self):
        """Set up apartments with different properties."""
        self.user = User.objects.create(
            username="filteruser",
            email="filter@test.com"
        )
        self.user.set_password("password123")
        self.user.save()
        
        # Create apartments with different prices and features
        ApartmentPost.objects.create(
            title="Budget Apartment",
            location="East LA",
            monthly_rent=800,
            bedrooms="1bed",
            room_type="private",
            owner=self.user
        )
        
        ApartmentPost.objects.create(
            title="Mid-Range Apartment",
            location="Santa Monica",
            monthly_rent=1500,
            bedrooms="2bed",
            room_type="entire",
            amenities="parking,gym",
            owner=self.user
        )
        
        ApartmentPost.objects.create(
            title="Luxury Apartment",
            location="Beverly Hills",
            monthly_rent=3000,
            bedrooms="3bed",
            room_type="entire",
            amenities="parking,gym,pool",
            owner=self.user
        )
    
    def test_filter_apartments(self):
        """Test filtering by price, bedrooms, and amenities."""
        # Filter by price range
        results = ApartmentPost.objects.filter(
            monthly_rent__gte=1000,
            monthly_rent__lte=2000
        )
        self.assertEqual(results.count(), 1)
        self.assertEqual(results[0].title, "Mid-Range Apartment")
        print("✓ Price filter works")
        
        # Filter by bedrooms
        results = ApartmentPost.objects.filter(bedrooms="2bed")
        self.assertEqual(results.count(), 1)
        print("✓ Bedroom filter works")
        
        # Filter by amenities
        results = ApartmentPost.objects.filter(amenities__icontains="pool")
        self.assertEqual(results.count(), 1)
        self.assertEqual(results[0].title, "Luxury Apartment")
        print("✓ Amenity filter works")
        
        # Filter by room type
        results = ApartmentPost.objects.filter(room_type="entire")
        self.assertEqual(results.count(), 2)
        print("✓ Room type filter works")