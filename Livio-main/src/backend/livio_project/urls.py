"""
URL configuration for livio_project project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.shortcuts import render
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

def home(request):
    return render(request, "home_page.html")

def login_view(request):
    return render(request, "login_page.html")

def signup(request):
    return render(request, "signup_page.html")

def profile(request):
    return render(request, "profile_page.html")

def apartment_map(request):
    return render(request, "aprt_map_api.html")

def roommates(request):
    return render(request, "roommates_page.html")

def profile_creation(request):
    return render(request, 'profile_creation.html')

def newProfilePage(request):
    return render(request, 'profile.html')

def marketplace(request):
    return render(request, "marketplace.html")


urlpatterns = [
    path('admin/', admin.site.urls),
    path('', home, name='home'),
    path('login/', login_view, name='login'),
    path('signup/', signup, name='signup'),
 
    # apartments/ is now handled by the apartments app (includes page view + API endpoints)
    path('apartments/', include('apartments.urls')),
    path('apartment_map/', apartment_map, name='apartment_map'),
    path('users/', include('users.urls')),
    path('profile/', profile, name='profile'),
    path('marketplace/', marketplace, name='marketplace'),
    path('roommates/', roommates, name='roommates'),
    path('nationalities/', include('nationalities.urls')),
    path('gradeLevels/', include('gradeLevels.urls')),
    path('profiles/', include('profiles.urls'), name="profiles"), # this will be used for making a request to the backend apis
    path('roommate/', include('roommates.urls')),
    path('creation/', profile_creation),
    path('genders/', include('genders.urls')),

    path('api/token/', TokenObtainPairView.as_view(), name="jwt"),
    path('api/token/refresh/', TokenRefreshView.as_view(), name="jwt_refresh"),

    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    
    path('features/', include('features.urls')),
    path('newProfile/', newProfilePage, name="newProfile")
]

# added all of the urls from the roommates app urls.py to the main one, so it is able to go to the proper place