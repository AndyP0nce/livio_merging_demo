from django.urls import path
from . import views 
from django.shortcuts import render

"""
Module Name: profiles.urls 
Date of Code: October 30, 2025
Description: Specifies the URL endpoints which will be used for each purpose, and the acompanying functions which will be used in response to the endpoint 
Important Functions:
Data Structures:
    urlpatterns - Django specific naming so it can be used by the main project folder to create all the endpoints
Important Functions: N/A
Algorithms: N/A
"""



app_name = 'profiles'


def profile(request):
    return render(request, "profile_page.html")

urlpatterns = [
    path('', profile, name="profile_page"),
    path('profile', views.createProfile, name="create_profile"), # the route to create the profile 
    path('all', views.getProfile, name="get_profiles"),
    path('current', views.getCurrentUserProfile, name='current_profile'),
    path('update', views.editProfile, name="update_profile"), # will be used to update the profile, if the user chooses to edit their stuff,
    path('profile/<int:id>',views.specificProfile, name="specific_profile"), # will be used to get the profile of that specified id
    path('uploadurl', views.presignedURL, name="S3-presigned-url") # sends the presigned url which will be needed for sending profile images to S3 bucket to be stored
]