"""
Module: apartments.admin
Date: November 25, 2025

Django Admin Configuration for Livio Apartments
"""

from django.contrib import admin
from .models import ApartmentPost, FavoriteApartment


@admin.register(ApartmentPost)
class ApartmentPostAdmin(admin.ModelAdmin):
    """
    Admin interface for apartment listings.
    """
    
    list_display = [
        'id',
        'title',
        'location',
        'monthly_rent',
        'bedrooms',
        'bathrooms',
        'room_type',
        'owner',
        'is_active',
        'created_at'
    ]
    
    list_filter = [
        'is_active',
        'room_type',
        'bedrooms',
        'bathrooms',
        'created_at'
    ]
    
    search_fields = [
        'title',
        'description',
        'location',
        'city',
        'owner__username'
    ]
    
    readonly_fields = ['created_at', 'updated_at', 'latitude', 'longitude']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'description', 'owner', 'is_active')
        }),
        ('Location', {
            'fields': ('location', 'city', 'state', 'zip_code', 'latitude', 'longitude')
        }),
        ('Property Details', {
            'fields': ('monthly_rent', 'bedrooms', 'bathrooms', 'square_feet', 'room_type')
        }),
        ('Amenities & Images', {
            'fields': ('amenities', 'image_url')
        }),
        ('Availability', {
            'fields': ('available_from',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        """
        Auto-set owner to current user if creating new listing.
        """
        if not change:  # Creating new object
            if not obj.owner_id:
                obj.owner = request.user
        super().save_model(request, obj, form, change)


@admin.register(FavoriteApartment)
class FavoriteApartmentAdmin(admin.ModelAdmin):
    """
    Admin interface for favorite apartments.
    """
    
    list_display = [
        'id',
        'user',
        'apartment',
        'created_at'
    ]
    
    list_filter = ['created_at']
    
    search_fields = [
        'user__username',
        'apartment__title',
        'apartment__location'
    ]
    
    readonly_fields = ['created_at']
    
    def has_add_permission(self, request):
        """
        Users should favorite through the frontend, not admin.
        """
        return False
