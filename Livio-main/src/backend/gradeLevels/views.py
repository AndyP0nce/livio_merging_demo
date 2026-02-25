from django.shortcuts import render
from rest_framework.decorators import api_view
from .models import GradeLevel
from .serializers import GradeLevelSerializer
from rest_framework.response import Response
from rest_framework import status

# Create your views here.
@api_view(['GET'])
def allGradeLevels(request):
    gradeLevels = GradeLevel.objects.all() # returns all of the natioanlities which are saved in the db (in form of models of Django)

    serializer = GradeLevelSerializer(gradeLevels, many=True) # will serialize all of the nationalitiy models 

    return Response(serializer.data, status=status.HTTP_200_OK) # will return a list of json objects 