from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework import status
from .serializers import ProfileGetSerializer, ProfileCreationSerializer
from .models import Profile
from .conversions import convert
import smtplib # will be used for sending the email through smtp protocol for email sending
from email.message import EmailMessage # will be used for constructing email 
from dotenv import load_dotenv
import os
import boto3
from rest_framework import status
from .emailHTML import constructHTML

"""
Module Name: profiles.views 
Date of Code: October 17, 2025 - November 15, 2025
Programmer's Name: Arthur Lazaryan
Description: Has the function which will handdle whenever a certain endpoint is accessed. 
Important Functions:
    getProfile 

    getCurrentUserProfile

    createProfile

    editProfile 
Data Structures: N/A
Algorithms: N/A
"""

# test getting the profile 
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def getProfile(request):
    """
    Function Name: getProfile 
    Date of Code: October 17, 2025
    Programmer's Name: Arthur Lazaryan
    Description: Gets all of the profiles available in the backend, serializes, and sends it to the frontend 

        Input:
           request - Django REST framework object which has all of the data that is sent in the request from the frontend to the backend

        Output:
            Response - Django REST framework implementation, which returns the profiles and the proper HTTP status code
    Data Structures: N/A
    Algorithms: N/A
    """

    profiles = Profile.objects.all() # gets a query set of all of the profiles

    serializer = ProfileGetSerializer(profiles, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)

# get the profile of the current signed in user
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def getCurrentUserProfile(request):
    """
    Function Name: getCurrentUserProfile
    Date of Code: October 22, 2025
    Programmer's Name: Arthur Lazaryan
    Description: Get the profile of the current user who is logged in 
    
        Input:
            request - Django REST framework object which has all of the data that is sent in the request from the frontend to the backend

        Output:
            Response - Django REST framework specific, which will return the current user's profile and the appropriate status code
    Data Structures: N/A
    Algorithms: N/A
    """

    profile = request.user.profile # using the related name, can access the profile of the current user based on the identification that comes from the JWT token

    serializer = ProfileGetSerializer(profile, many=False)

    return Response(serializer.data, status=status.HTTP_200_OK)


# this will create a new profile 
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def createProfile(request):
    """
    Function Name: createProfile 
    Date of Code: November 7, 2025
    Programmer's Name: Arthur Lazaryan
    Description: Will create the profile for the current user making the request, and will save it to the database 
        Input:
            request - Django REST framework object which has all of the data that is sent in the request from the frontend to the backend

        Output:
            Response - Django REST framework specific, which will return the current user's newly created profile and the appropriate status code
    Important Functions: N/A
    Data Structures: N/A
    Algorithms: N/A
    """
    
    # new_data = convert(request.data) # will return a new dictionary with the proper types that can be validated, and to work with is_valid() method

    # seems to have worked
    serializer = ProfileCreationSerializer(data=request.data, context={'request' : request.user}) # additional context is passed, which in this case is just the user which made the request, which is need to link the profile to the user, once created



    # the three other FK attributes are getting lost somehwere in the is_valid 
    if serializer.is_valid():
        # print(serializer.validated_data) # the validated data for some reason is not including the other three things, which have a FK relationship
        # works up until here --------------p
        newProfile = serializer.save() # need to get this to work 

        # send an email confirming their profile has been created

        load_dotenv()

        # done wihhin a context manager, so everything is done and then deallocated/connection endede
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtpSender:
            smtpSender.set_debuglevel(1)
            email = os.getenv('EMAIL_USER')
            password = os.getenv('EMAIL_PASSWORD')
            smtpSender.login(email, password)

            welcomeEmail = EmailMessage()
            welcomeEmail['Subject'] = f"Welcome to the Livio family, {newProfile.firstName}!"
            welcomeEmail['From'] = email
            welcomeEmail['To'] = newProfile.profile_user.email # the email account associated with the newly created profile's user

            welcomeEmail.set_content(constructHTML(newProfile.firstName, newProfile.lastName, newProfile.age, newProfile.gender.name, newProfile.nationality.name, newProfile.gradeLevel.name, newProfile.bio, newProfile.profilePicture), subtype='html')
            smtpSender.send_message(welcomeEmail) # sends the email 

        getProfileSerializer = ProfileGetSerializer(newProfile, many=False) # will serialize for the get portion to send back

    return Response(getProfileSerializer.data, status=status.HTTP_201_CREATED) # returns the data which was used to create the profile

# will be used to edit profile if the user chooses to do so
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def editProfile(request):
    """
    Function Name: editProfile
    Date of Code: November 10, 2025
    Programmer's Name: Arthur Lazaryan
    Description: Will edit/update the profile with the new information passed in from the frontend. Uses the HTTP PUT method to indicate this is the case, just to follow best designs
        Input:
            request - Django REST framework object which has all of the data that is sent in the request from the frontend to the backend

        Output:
            Response - Django REST framework specific, which will return the current user's newly created profile and the appropriate status code
    Important Functions: N/A
    Data Structures: N/A
    Algorithms: N/A
    """
    
    # get the profile of the user making the request, and pass that instance into the serializer
    current_profile = request.user.profile 
    
    serializer = ProfileCreationSerializer(current_profile, data=request.data)

    if serializer.is_valid():
        print("Gets here")
        current_profile = serializer.save() # will call the update method 

    print(serializer.errors)

    getProfileSerializer = ProfileGetSerializer(current_profile, many=False) # will serialize the object with neccesary format for getting the profile


    return Response(getProfileSerializer.data, status=status.HTTP_200_OK) # change this from done to actual data

# will return the presigned url for the S3 bucket to upload the profile pictures
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def presignedURL(request):

    # needed for the S3 key
    fileName = request.data['fileName']
    fileType = request.data['fileType']
    expirationTime = request.data['expiration']

    load_dotenv() # loads in the environement variables, which will have the neccesary AWS credentials 

    s3Client = boto3.client('s3', aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'), aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'), region_name=os.getenv('AWS_REGION')) # sets the s3 client so that it can be used to generate a presigned url

    # build the key (unique identifier of the image in the folder in the bucket)
    s3Key = f"profile-pictures/{request.user.username}/{fileName}"

    # should be the URL which the image will be at after it has been uploaded to the S3
    s3URL = f"https://livio-s3-bucket.s3.us-west-1.amazonaws.com/{s3Key}"

    # generate the presigned URL (works closely with the parameters needed for the put_object function in the S3 bucket)
    presignedURL = s3Client.generate_presigned_url(ClientMethod="put_object", Params={'Bucket' : os.getenv('S3_BUCKET_NAME'), "Key" : s3Key, "ContentType" : fileType}, ExpiresIn=expirationTime)

    s3Client.close() # close the endpoint connection 

    return Response({"presignedURL" : presignedURL, "imageURL" : s3URL,"expires" : expirationTime}, status=status.HTTP_200_OK)    



# will get the speciifc profile of the id that is passed into its profile parameter
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def specificProfile(request, id):
    
    # get the profile from the db 
    profile = Profile.objects.get(id=id)

    # serialize the profile using the profile get serializer 
    serializer = ProfileGetSerializer(profile, many=False)

    return Response(serializer.data, status=status.HTTP_200_OK)
    