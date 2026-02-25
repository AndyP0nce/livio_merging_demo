from django.urls import path
from django.shortcuts import render
from django.conf import settings
from .views import (
    ApartmentListAPI,
    ApartmentDetailAPI,
    ToggleFavoriteAPI,
    CheckFavoriteStatusAPI,
    GetUserFavoritesAPI,
    UniversityListView,
    apartment_presigned_url,
)

# Page view
def apartment_list_view(request):
    """Render the apartment listings page."""
    return render(request, 'apartment_page.html', {
         'GOOGLE_MAPS_API_KEY': settings.GOOGLE_MAPS_API_KEY 
    })
    
    

urlpatterns = [
    # HTML Page(rendered template)
    path('', apartment_list_view, name='apartment'),
    
    # API endpoints
    path('api/apartments/', ApartmentListAPI.as_view(), name='apartment-list'),
    path('api/apartments/<int:apartment_id>/', ApartmentDetailAPI.as_view(), name='apartment-detail'),
    path('api/favorites/toggle/', ToggleFavoriteAPI.as_view(), name='toggle-favorite'),
    path('api/favorites/check/', CheckFavoriteStatusAPI.as_view(), name='check-favorites'),
    path('api/favorites/', GetUserFavoritesAPI.as_view(), name='user-favorites'),
    path('api/universities/', UniversityListView.as_view(), name='university-list'),
    path('api/upload-url/',   apartment_presigned_url,      name='apartment-upload-url'),
]