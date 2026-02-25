"""
Module: apartments.views
Date: November 25, 2025

Description:
    API views for apartment listings and favorites system.
    
Endpoints:
    - GET  /api/apartments/          - List all apartments
    - POST /api/apartments/          - Create new apartment
    - GET  /api/apartments/<id>/     - Get single apartment
    - POST /api/favorites/toggle/    - Add/remove favorite
    - POST /api/favorites/check/     - Check favorite status
    - GET  /api/favorites/           - Get user's favorites
"""

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.db.models import Q

from .models import ApartmentPost, FavoriteApartment, University
from .serializers import (
    ApartmentPostSerializer,
    ApartmentPostCreateSerializer,
    FavoriteApartmentSerializer,
    UniversitySerializer,
)
from decimal import Decimal
import boto3
import os
from dotenv import load_dotenv


class UniversityListView(APIView):
    """
    GET /apartments/api/universities/
    Returns all university campuses as JSON for the map pill markers.
    No authentication required.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        universities = University.objects.all()
        serializer = UniversitySerializer(universities, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ApartmentListAPI(APIView):
    """
    GET  - List all active apartments with filtering
    POST - Create new apartment listing
    
    Query Parameters for GET:
        - location: Filter by location/city
        - min_rent: Minimum rent
        - max_rent: Maximum rent
        - bedrooms: Bedroom count (1bed, 2bed, etc.)
        - bathrooms: Bathroom count
        - room_type: private, shared, entire
        - amenities: Comma-separated amenities
        - search: General search term
    """
    
    def get_permissions(self):
        """Allow anyone to view, require auth to create."""
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]
    
    def get(self, request):
        """List apartments with optional filtering."""
        
        # Start with all active apartments
        apartments = ApartmentPost.objects.filter(is_active=True)
        
        # Location filter
        location = request.query_params.get('location')
        if location:
            apartments = apartments.filter(
                Q(location__icontains=location) |
                Q(city__icontains=location)
            )
        
        # Price filters
        min_rent = request.query_params.get('min_rent')
        if min_rent:
            apartments = apartments.filter(monthly_rent__gte=Decimal(min_rent))
        
        max_rent = request.query_params.get('max_rent')
        if max_rent:
            apartments = apartments.filter(monthly_rent__lte=Decimal(max_rent))
        
        # Bedroom filter
        bedrooms = request.query_params.get('bedrooms')
        if bedrooms:
            apartments = apartments.filter(bedrooms=bedrooms)
        
        # Bathroom filter
        bathrooms = request.query_params.get('bathrooms')
        if bathrooms:
            apartments = apartments.filter(bathrooms=bathrooms)
        
        # Room type filter
        room_type = request.query_params.get('room_type')
        if room_type:
            apartments = apartments.filter(room_type=room_type)
        
        # Amenities filter (must have ALL specified amenities)
        amenities = request.query_params.get('amenities')
        if amenities:
            amenity_list = [a.strip() for a in amenities.split(',')]
            for amenity in amenity_list:
                apartments = apartments.filter(amenities__icontains=amenity)
        
        # General search
        search = request.query_params.get('search')
        if search:
            apartments = apartments.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(location__icontains=search) |
                Q(city__icontains=search)
            )
        
        # Serialize
        serializer = ApartmentPostSerializer(
            apartments, 
            many=True,
            context={'request': request}
        )
        
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def post(self, request):
        """Create new apartment listing."""
        
        serializer = ApartmentPostCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if serializer.is_valid():
            apartment = serializer.save()
            
            # Return created apartment with full details
            response_serializer = ApartmentPostSerializer(
                apartment,
                context={'request': request}
            )
            
            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )
        
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class ApartmentDetailAPI(APIView):
    """
    GET    - Get single apartment details
    PUT    - Update apartment (owner only)
    DELETE - Delete apartment (owner only)
    """
    
    permission_classes = [AllowAny]
    
    def get(self, request, apartment_id):
        """Get single apartment."""
        
        apartment = get_object_or_404(
            ApartmentPost,
            id=apartment_id,
            is_active=True
        )
        
        serializer = ApartmentPostSerializer(
            apartment,
            context={'request': request}
        )
        
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def put(self, request, apartment_id):
        """Update apartment (owner only)."""
        
        if not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        apartment = get_object_or_404(ApartmentPost, id=apartment_id)
        
        # Check ownership
        if apartment.owner != request.user:
            return Response(
                {"error": "You can only edit your own listings"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = ApartmentPostCreateSerializer(
            apartment,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        
        if serializer.is_valid():
            serializer.save()
            
            response_serializer = ApartmentPostSerializer(
                apartment,
                context={'request': request}
            )
            
            return Response(
                response_serializer.data,
                status=status.HTTP_200_OK
            )
        
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
    
    def delete(self, request, apartment_id):
        """Delete apartment (owner only)."""
        
        if not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        apartment = get_object_or_404(ApartmentPost, id=apartment_id)
        
        # Check ownership
        if apartment.owner != request.user:
            return Response(
                {"error": "You can only delete your own listings"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        apartment.delete()
        
        return Response(
            {"message": "Apartment deleted successfully"},
            status=status.HTTP_204_NO_CONTENT
        )


class ToggleFavoriteAPI(APIView):
    """
    POST - Add or remove apartment from user's favorites.
    
    Request Body:
        {"apartment_id": 123}
    
    Response:
        {"is_favorited": true, "message": "Added to favorites"}
    """
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        apartment_id = request.data.get('apartment_id')
        
        if not apartment_id:
            return Response(
                {"error": "apartment_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        apartment = get_object_or_404(ApartmentPost, id=apartment_id)
        
        # Check if already favorited
        favorite = FavoriteApartment.objects.filter(
            user=request.user,
            apartment=apartment
        ).first()
        
        if favorite:
            # Remove favorite
            favorite.delete()
            return Response({
                "is_favorited": False,
                "message": "Removed from favorites"
            }, status=status.HTTP_200_OK)
        else:
            # Add favorite
            FavoriteApartment.objects.create(
                user=request.user,
                apartment=apartment
            )
            return Response({
                "is_favorited": True,
                "message": "Added to favorites"
            }, status=status.HTTP_201_CREATED)


class CheckFavoriteStatusAPI(APIView):
    """
    POST - Check if apartments are favorited by current user.
    
    Request Body:
        {"apartment_ids": [123, 124, 125]}
    
    Response:
        {"123": true, "124": false, "125": true}
    """
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        apartment_ids = request.data.get('apartment_ids', [])
        
        if not apartment_ids:
            return Response({}, status=status.HTTP_200_OK)
        
        # Get favorited apartment IDs
        favorited_ids = FavoriteApartment.objects.filter(
            user=request.user,
            apartment_id__in=apartment_ids
        ).values_list('apartment_id', flat=True)
        
        # Build response dict
        result = {
            str(apt_id): apt_id in favorited_ids
            for apt_id in apartment_ids
        }
        
        return Response(result, status=status.HTTP_200_OK)


class GetUserFavoritesAPI(APIView):
    """
    GET - Get all apartments the user has favorited.
    
    Response:
        Array of apartment objects with favorite metadata
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        favorites = FavoriteApartment.objects.filter(
            user=request.user
        ).select_related('apartment')
        
        serializer = FavoriteApartmentSerializer(favorites, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def apartment_presigned_url(request):
    """
    POST /apartments/api/upload-url/

    Returns a presigned S3 PUT URL so the browser can upload an apartment
    image directly to S3 without routing the file through Django.

    Request body:
        fileName   (str) – original filename, e.g. "living-room.jpg"
        fileType   (str) – MIME type, e.g. "image/jpeg"
        expiration (int) – seconds until the URL expires (default 300)

    Response:
        presignedURL (str) – PUT URL for direct S3 upload
        imageURL     (str) – permanent public URL of the uploaded image
        expires      (int) – expiration time used
    """
    file_name      = request.data.get('fileName', '')
    file_type      = request.data.get('fileType', 'image/jpeg')
    expiration     = int(request.data.get('expiration', 300))

    if not file_name:
        return Response({'error': 'fileName is required.'}, status=status.HTTP_400_BAD_REQUEST)

    load_dotenv()

    s3_client = boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION'),
    )

    # Store under apartment-images/{user_id}/{filename}
    s3_key = f"apartment-images/{request.user.id}/{file_name}"
    s3_url = f"https://{os.getenv('S3_BUCKET_NAME')}.s3.{os.getenv('AWS_REGION')}.amazonaws.com/{s3_key}"

    presigned = s3_client.generate_presigned_url(
        ClientMethod='put_object',
        Params={
            'Bucket':      os.getenv('S3_BUCKET_NAME'),
            'Key':         s3_key,
            'ContentType': file_type,
        },
        ExpiresIn=expiration,
    )

    s3_client.close()

    return Response(
        {'presignedURL': presigned, 'imageURL': s3_url, 'expires': expiration},
        status=status.HTTP_200_OK,
    )