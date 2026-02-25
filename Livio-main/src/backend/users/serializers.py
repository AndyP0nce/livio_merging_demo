from rest_framework.serializers import ModelSerializer, Serializer
from rest_framework import serializers
from .models import User

# will be used to deserialize the input from the user during signup
class UserCreationSerializer(ModelSerializer):

    class Meta:
        model = User
        fields = ['username', 'email', 'password'] # these are the fields which need to be deserialized

    # will create the user object
    def create(self, validated_data):
        
        user = User.objects.create_user(**validated_data) # will pass in the neccesary information to make the user's account

        return user

# will be used to deserialize the data, which is passed in during sign in
class UserSignInSerializer(Serializer):
    username = serializers.CharField(max_length=100)
    password = serializers.CharField(max_length=100)