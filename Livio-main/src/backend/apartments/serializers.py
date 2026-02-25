"""
Module: apartments.serializers
Date: November 25, 2025

Description:
    Serializers convert Django models to JSON for API responses.
"""

from rest_framework import serializers
from .models import ApartmentPost, FavoriteApartment, University
from django.contrib.auth import get_user_model
User = get_user_model()


class UniversitySerializer(serializers.ModelSerializer):
    """
    Serializer for University campus markers.
    Returns lat/lng as floats so the JS map manager can use them directly.
    """
    lat = serializers.SerializerMethodField()
    lng = serializers.SerializerMethodField()

    class Meta:
        model  = University
        fields = ['name', 'fullName', 'lat', 'lng']

    def get_lat(self, obj):
        return float(obj.lat)

    def get_lng(self, obj):
        return float(obj.lng)


class UserSerializer(serializers.ModelSerializer):
    """Simple user serializer for apartment owner info."""

    class Meta:
        model = User
        fields = ['id', 'username']


class ApartmentPostSerializer(serializers.ModelSerializer):
    """
    Main serializer for apartment listings.
    Includes coordinates for map markers.
    """
    
    coordinates = serializers.SerializerMethodField()
    owner_info = UserSerializer(source='owner', read_only=True)
    amenities_list = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = ApartmentPost
        fields = [
            'id',
            'title',
            'description',
            'location',
            'city',
            'state',
            'zip_code',
            'latitude',
            'longitude',
            'coordinates',
            'monthly_rent',
            'bedrooms',
            'bathrooms',
            'square_feet',
            'room_type',
            'amenities',
            'amenities_list',
            'image_url',
            'owner',
            'owner_info',
            'is_active',
            'available_from',
            'created_at',
            'updated_at',
            'is_favorited',
            'is_owner',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'owner']

    def get_coordinates(self, obj):
        """Return coordinates in Google Maps format."""
        return obj.get_coordinates()

    def get_amenities_list(self, obj):
        """Return amenities as array."""
        return obj.get_amenities_list()

    def get_is_favorited(self, obj):
        """Check if current user has favorited this apartment."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return FavoriteApartment.objects.filter(
                user=request.user,
                apartment=obj
            ).exists()
        return False

    def get_is_owner(self, obj):
        """Check if the requesting user is the owner of this apartment."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.owner_id == request.user.id
        return False


class ApartmentPostCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating new apartment listings.
    Simpler than the GET serializer.
    """
    
    class Meta:
        model = ApartmentPost
        fields = [
            'title',
            'description',
            'location',
            'city',
            'state',
            'zip_code',
            'monthly_rent',
            'bedrooms',
            'bathrooms',
            'square_feet',
            'room_type',
            'amenities',
            'image_url',
            'available_from',
        ]
    
    def create(self, validated_data):
        """
        Create apartment with current user as owner.
        """
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['owner'] = request.user
        return super().create(validated_data)


class FavoriteApartmentSerializer(serializers.ModelSerializer):
    """Serializer for favorite apartments."""
    
    apartment = ApartmentPostSerializer(read_only=True)
    
    class Meta:
        model = FavoriteApartment
        fields = ['id', 'apartment', 'created_at']
        read_only_fields = ['id', 'created_at']
