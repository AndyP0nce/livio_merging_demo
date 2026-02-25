from django.urls import path
from . import views

app_name = 'gradeLevels'

urlpatterns = [
    path('all', views.allGradeLevels, name="all_gradeLevels")
]