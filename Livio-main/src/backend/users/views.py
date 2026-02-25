from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .serializers import UserCreationSerializer, UserSignInSerializer
from rest_framework import status
from .models import User
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.hashers import check_password
import smtplib # will be used for sending the email through smtp protocol for email sending
from email.message import EmailMessage # will be used for constructing email 
from dotenv import load_dotenv
import os
from .emailHTML import emailHTML

"""
Module Name: users.views
Date of Code: October 30, 2025
Programmer's Name: Arthur Lazaryan
Description: Has the functions which pertain the endpoints in regards to the User class
Important Functions: 
    getUser - returns the specific user making the endpoint request; does so with the JWT Token used 
Data Structures:
    api_view - Django REST Framework decorator, which allows to specify the HTTP method which the endpoint via this function can be used with 

    permission_classes - Django REST framework decorator, which specifies which authentication/authorization level is needed to access the endpoint via the function
Algorithms: N/A
"""

# Create your views here.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def getUser(request):
    """
    Function Name: getUser
    Date of Code: October 30, 2025
    Description: Returns the current user which is logged in 
        Input:
            request - Django REST framework specific implementation which has all the data from the HTTP request header and body, which includes the JWT token used to identify the user
        Output:
            None
    Data Structures: N/A
    Algorithms: N/A
    """
    pass

# need to create a view that will aid in creating the user during sign up
# send a confirmation email once it is done
# should not need permission classes since want to make it as open as possible to sign up, and they do not need to be authenticated
@api_view(['POST'])
def userSignup(request):
    
    newUserSerializer = UserCreationSerializer(data=request.data, many=False) 

    if newUserSerializer.is_valid(): # once passes validation, can compare to rest of db and to make sure that the unique constraint is upheld
        
        username = newUserSerializer.validated_data['username'] # the username that the user is trying to sign up with 

        # query the db and see if that same username exists 
        usernameExists = User.objects.filter(username=username).exists() # will return true if that usernmae exists already 

        if usernameExists: 
            # throw an error to frontend if it exists 
            print("Username not available")
            pass
        else: # usernmae does not exist
            newUser = newUserSerializer.save() # will save the data, as the new user

            load_dotenv() # loads the env variables 

             # create an email confirmation that it has been made (works but see if can make it better)
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as emailProtocolSender:
                emailProtocolSender.set_debuglevel(1)
                email = os.getenv('EMAIL_USER')
                password = os.getenv('EMAIL_PASSWORD')
                emailProtocolSender.login(email, password) # uses the email and password fields in the environement variables 

                message = EmailMessage()

                message['Subject'] = 'Welcome to Livio!'
                message['From'] = email
                message['To'] = newUser.email # the user's newly signed up email 
                message.set_content(emailHTML, subtype='html')

                emailProtocolSender.send_message(message)


        # have it return the JWT tokens for the response, so it can be saved in the frontend
            refresh = TokenObtainPairSerializer.get_token(newUser)

            tokens = {'refresh' : str(refresh), 'access' : str(refresh.access_token), "username": newUser.username, "email" : newUser.email,'join_date' : newUser.join_date} # should create the token for the specific user
    
    # make sure to fix the control flow and how it will work out

            return Response(tokens, status=status.HTTP_201_CREATED)
        
    print(newUserSerializer.errors)
    
    return Response({"worked" :"no"})

# will be used to send the user the neccesary tokens when they sign in
@api_view(['POST'])
def userSignIn(request):
    
    userSignInSerializer = UserSignInSerializer(data=request.data, many=False)


    if userSignInSerializer.is_valid():
        # check is username is a valid username, if so, get the user which is associated with that username 
        username = userSignInSerializer.validated_data['username']

        validUsername = User.objects.filter(username=username).exists() # return boolean wheter exists or not

        if validUsername: # checks if it is a valid username
            # get the user associated with the username 
            user = User.objects.get(username=username)
            
            # check if password is correct for that username (use check password)

            if check_password(userSignInSerializer.validated_data['password'], user.password): # checks if the password is same as the hashed one, by hashing and comparing, uses default hash algo
                
                refresh = TokenObtainPairSerializer.get_token(user)

                tokens = {'refresh' : str(refresh), 'access' : str(refresh.access_token), "username" : user.username, "email" : user.email, "join_date" : user.join_date} # will create a new JWT token for the frontend

                return Response(tokens, status=status.HTTP_200_OK)
            else:
                return Response({"password" : "incorrect"})
        else: # not a valid username
            return Response({"data" : "invalid"}, status=status.HTTP_401_UNAUTHORIZED)
    else:

        return Response({"done" : "done"})
