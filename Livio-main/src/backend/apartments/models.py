"""
Module: apartments.models
Date: November 25, 2025
Programmer: Andrew Ponce

Description:
    Models for apartment listings and user favorites.
    Includes geocoding support for map markers.
"""

from django.db import models
from django.contrib.auth import get_user_model
User = get_user_model()
from decimal import Decimal


class ApartmentPost(models.Model):
    """
    Main apartment listing model.
    Stores all apartment information including location coordinates.
    """
    
    # Basic Info
    title = models.CharField(max_length=200, default="Apartment Listing")
    description = models.TextField()
    
    # Location
    location = models.CharField(max_length=200, help_text="e.g., Downtown LA")
    address = models.CharField(max_length=300, blank=True, null=True)
    city = models.CharField(max_length=100, default="Los Angeles")
    state = models.CharField(max_length=40, default="CA")
    zip_code = models.CharField(max_length=10, blank=True, null=True)
    
    # Map Coordinates (for Google Maps markers)
    latitude = models.DecimalField(
        max_digits=9, 
        decimal_places=6, 
        null=True, 
        blank=True,
        help_text="Latitude for map marker"
    )
    longitude = models.DecimalField(
        max_digits=9, 
        decimal_places=6, 
        null=True, 
        blank=True,
        help_text="Longitude for map marker"
    )
    
    # Property Details
    monthly_rent = models.DecimalField(max_digits=8, decimal_places=2)
    bedrooms = models.CharField(
        max_length=20,
        choices=[
            ('1bed', '1 Bedroom'),
            ('2bed', '2 Bedrooms'),
            ('3bed', '3 Bedrooms'),
            ('4bed', '4+ Bedrooms'),
        ],
        default='1bed'
    )
    bathrooms = models.CharField(
        max_length=20,
        choices=[
            ('1bath', '1 Bathroom'),
            ('2bath', '2 Bathrooms'),
            ('3bath', '3+ Bathrooms'),
        ],
        default='1bath'
    )
    square_feet = models.PositiveIntegerField(null=True, blank=True)
    
    # Room Type
    room_type = models.CharField(
        max_length=50,
        choices=[
            ('private', 'Private Room'),
            ('shared', 'Shared Room'),
            ('entire', 'Entire Place'),
        ],
        default='private'
    )
    
    # Amenities (stored as comma-separated string for simplicity)
    amenities = models.CharField(
        max_length=500,
        blank=True,
        help_text="Comma-separated: parking,gym,pool,laundry,ac"
    )
    
    # Images
    image_url = models.URLField(
        max_length=500,
        default='https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'
    )
    
    # Owner Info
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='apartment_listings'
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    available_from = models.DateField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Apartment Post"
        verbose_name_plural = "Apartment Posts"
    
    def __str__(self):
        return f"{self.title} - {self.location} - ${self.monthly_rent}"
    
    def save(self, *args, **kwargs):
        """
        Auto-geocode address if coordinates not provided.
        """
        if not self.latitude or not self.longitude:
            self.geocode_address()
        super().save(*args, **kwargs)
    
    def geocode_address(self):
        """
        Convert location to lat/lng using Google Geocoding API.
        Falls back to default LA coordinates if geocoding fails.
        """
        try:
            from django.conf import settings
            import requests
            
            api_key = getattr(settings, "GOOGLE_MAPS_API_KEY", None)
            if not api_key:
                # Default to CSUN Northridge coordinates
                self.latitude = Decimal('34.2413')
                self.longitude = Decimal('-118.5290')
                return
            
            # Build geocoding query
            query = self.location
            if self.city:
                query += f", {self.city}, {self.state}"
            
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                'address': query,
                'key': api_key
            }
            
            response = requests.get(url, params=params, timeout=5)
            data = response.json()
            
            if data['status'] == 'OK':
                location = data['results'][0]['geometry']['location']
                self.latitude = Decimal(str(location['lat']))
                self.longitude = Decimal(str(location['lng']))
            else:
                # Default to LA
                self.latitude = Decimal('34.0522')
                self.longitude = Decimal('-118.2437')
                
        except Exception as e:
            print(f"Geocoding error: {e}")
            # Default to LA coordinates
            self.latitude = Decimal('34.0522')
            self.longitude = Decimal('-118.2437')
    
    def get_coordinates(self):
        """Return coordinates in Google Maps format."""
        return {
            'lat': float(self.latitude) if self.latitude else 34.0522,
            'lng': float(self.longitude) if self.longitude else -118.2437
        }
    
    def get_amenities_list(self):
        """Return amenities as list."""
        if not self.amenities:
            return []
        return [a.strip() for a in self.amenities.split(',')]
    
    def get_bedrooms_display(self):
        """Return formatted bedroom count."""
        return self.get_bedrooms_display()
    
    def get_bathrooms_display(self):
        """Return formatted bathroom count."""
        return self.get_bathrooms_display()


class FavoriteApartment(models.Model):
    """
    Stores which users have favorited which apartments.
    
    Example:
        user_id=5, apartment_id=123  → User #5 favorited apartment #123
    
    Features:
        - User can favorite multiple apartments
        - Apartment can be favorited by multiple users
        - Prevents duplicate favorites (unique_together)
    """
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='favorite_apartments',
        help_text="The user who favorited this apartment"
    )
    
    apartment = models.ForeignKey(
        ApartmentPost,
        on_delete=models.CASCADE,
        related_name='favorited_by',
        help_text="The apartment that was favorited"
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When the apartment was favorited"
    )
    
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Optional notes about why user likes this apartment"
    )
    
    class Meta:
        unique_together = ('user', 'apartment')
        ordering = ['-created_at']
        verbose_name = "Favorite Apartment"
        verbose_name_plural = "Favorite Apartments"
    
    def __str__(self):
        return f"{self.user.username} ♥ {self.apartment.title}"
