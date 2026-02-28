"""
Management command: seed_listings
Usage: python manage.py seed_listings
       python manage.py seed_listings --clear   (wipe existing listings first)
       python manage.py seed_listings --user <username>  (assign to a specific user)

Creates 12 realistic test apartment listings in the Northridge / San Fernando
Valley area (within 0.5 – 2.5 miles of CSUN).  Coordinates are intentionally
spread through surrounding streets so they appear as distinct map markers rather
than sitting on top of the campus pin.

To edit the test data, modify the LISTINGS list below.
Each entry must have: title, description, location, city, state, zip_code,
                      monthly_rent, bedrooms, bathrooms, room_type,
                      latitude, longitude
Optional:  square_feet, amenities (comma-separated string), is_active
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from apartments.models import ApartmentPost

User = get_user_model()

# ── Edit these listings to change the test data ──────────────────────────────
# CSUN is at approximately (34.2413, -118.5290).
# Listings are spread 0.5 – 2.5 miles away in various directions.
LISTINGS = [
    # ── North of campus (~1 mile) ──
    {
        "title":       "Bright 2BR near Roscoe Blvd",
        "description": "Spacious 2-bedroom apartment with in-unit laundry, AC, and covered parking. "
                       "Walking distance to grocery stores and the 118 freeway.",
        "location":    "18340 Roscoe Blvd",
        "city":        "Northridge",
        "state":       "CA",
        "zip_code":    "91324",
        "monthly_rent": 1950,
        "bedrooms":    "2bed",
        "bathrooms":   "1bath",
        "room_type":   "entire",
        "square_feet": 850,
        "amenities":   "Parking,Laundry,AC",
        "latitude":    34.2535,
        "longitude":   -118.5284,
    },
    # ── Northwest of campus (~0.7 mi) ──
    {
        "title":       "Cozy Studio on Plummer St",
        "description": "Fully furnished studio with utilities included. "
                       "Quiet neighborhood, 10-minute bike ride to CSUN.",
        "location":    "18657 Plummer St",
        "city":        "Northridge",
        "state":       "CA",
        "zip_code":    "91325",
        "monthly_rent": 1200,
        "bedrooms":    "1bed",
        "bathrooms":   "1bath",
        "room_type":   "entire",
        "square_feet": 420,
        "amenities":   "Furnished,Utilities Included,WiFi",
        "latitude":    34.2482,
        "longitude":   -118.5365,
    },
    # ── North of campus on Devonshire (~0.9 mi) ──
    {
        "title":       "Modern 1BR on Devonshire",
        "description": "Updated 1-bedroom with new kitchen appliances, hardwood floors, "
                       "and a private patio. Gated complex with pool.",
        "location":    "17500 Devonshire St",
        "city":        "Northridge",
        "state":       "CA",
        "zip_code":    "91325",
        "monthly_rent": 1650,
        "bedrooms":    "1bed",
        "bathrooms":   "1bath",
        "room_type":   "entire",
        "square_feet": 680,
        "amenities":   "Pool,Parking,AC",
        "latitude":    34.2497,
        "longitude":   -118.5270,
    },
    # ── Northeast of campus (~1.5 mi) ──
    {
        "title":       "3BR House in Granada Hills",
        "description": "Large 3-bedroom house with backyard, 2-car garage, and updated bathrooms. "
                       "Great for students splitting rent. 5-min drive to CSUN.",
        "location":    "10511 Zelzah Ave",
        "city":        "Granada Hills",
        "state":       "CA",
        "zip_code":    "91344",
        "monthly_rent": 2800,
        "bedrooms":    "3bed",
        "bathrooms":   "2bath",
        "room_type":   "entire",
        "square_feet": 1400,
        "amenities":   "Parking,Backyard,Laundry,AC",
        "latitude":    34.2600,
        "longitude":   -118.5073,
    },
    # ── East of campus (~0.5 mi) ──
    {
        "title":       "Shared Room near Zelzah Ave",
        "description": "Furnished private room in a 4BR shared house. "
                       "Common areas include a full kitchen, living room, and backyard. "
                       "All utilities and WiFi included.",
        "location":    "8928 Zelzah Ave",
        "city":        "Northridge",
        "state":       "CA",
        "zip_code":    "91325",
        "monthly_rent": 800,
        "bedrooms":    "1bed",
        "bathrooms":   "1bath",
        "room_type":   "private",
        "square_feet": 220,
        "amenities":   "WiFi,Utilities Included,Furnished",
        "latitude":    34.2368,
        "longitude":   -118.5090,
    },
    # ── Southeast of campus (~1 mi) ──
    {
        "title":       "2BR Condo on Corbin Ave",
        "description": "Well-maintained 2-bedroom condo with balcony, gym access, and assigned parking. "
                       "Close to Northridge Fashion Center.",
        "location":    "9337 Corbin Ave",
        "city":        "Northridge",
        "state":       "CA",
        "zip_code":    "91324",
        "monthly_rent": 2100,
        "bedrooms":    "2bed",
        "bathrooms":   "2bath",
        "room_type":   "entire",
        "square_feet": 1050,
        "amenities":   "Gym,Parking,AC,Pool",
        "latitude":    34.2295,
        "longitude":   -118.5183,
    },
    # ── South of campus on Reseda (~0.5 mi) ──
    {
        "title":       "Affordable 1BR on Reseda Blvd",
        "description": "Clean 1-bedroom apartment with on-site laundry and covered parking. "
                       "Walking distance to CSUN main gate and Reseda Blvd bus line.",
        "location":    "9323 Reseda Blvd",
        "city":        "Northridge",
        "state":       "CA",
        "zip_code":    "91324",
        "monthly_rent": 1450,
        "bedrooms":    "1bed",
        "bathrooms":   "1bath",
        "room_type":   "entire",
        "square_feet": 580,
        "amenities":   "Laundry,Parking",
        "latitude":    34.2305,
        "longitude":   -118.5302,
    },
    # ── South of campus (~1.5 mi) ──
    {
        "title":       "Pet-Friendly Apartment on Reseda",
        "description": "Spacious 2BR allowing up to two pets. Hardwood floors, stainless steel kitchen, "
                       "and in-unit washer/dryer.",
        "location":    "8660 Reseda Blvd",
        "city":        "Northridge",
        "state":       "CA",
        "zip_code":    "91324",
        "monthly_rent": 1850,
        "bedrooms":    "2bed",
        "bathrooms":   "1bath",
        "room_type":   "entire",
        "square_feet": 900,
        "amenities":   "Laundry,Parking,AC,Pet Friendly",
        "latitude":    34.2218,
        "longitude":   -118.5298,
    },
    # ── Southwest of campus on Tampa (~2 mi) ──
    {
        "title":       "Studio in Reseda with Pool",
        "description": "Modern studio in a gated community. Resort-style pool, gym, and BBQ area. "
                       "Easy freeway access to the 101.",
        "location":    "8515 Tampa Ave",
        "city":        "Reseda",
        "state":       "CA",
        "zip_code":    "91335",
        "monthly_rent": 1350,
        "bedrooms":    "1bed",
        "bathrooms":   "1bath",
        "room_type":   "entire",
        "square_feet": 450,
        "amenities":   "Pool,Gym,Parking,AC",
        "latitude":    34.2263,
        "longitude":   -118.5540,
    },
    # ── West of campus (~2.5 mi) ──
    {
        "title":       "Spacious 3BR in Canoga Park",
        "description": "3-bedroom, 2-bath home with a large living room, updated kitchen, "
                       "and a two-car driveway. Quiet residential street.",
        "location":    "7821 Canby Ave",
        "city":        "Reseda",
        "state":       "CA",
        "zip_code":    "91335",
        "monthly_rent": 2600,
        "bedrooms":    "3bed",
        "bathrooms":   "2bath",
        "room_type":   "entire",
        "square_feet": 1300,
        "amenities":   "Parking,Backyard,Laundry,AC",
        "latitude":    34.2340,
        "longitude":   -118.6025,
    },
    # ── North-northeast of campus (~1.5 mi) ──
    {
        "title":       "2BR Apartment on Nordhoff St",
        "description": "Recently renovated 2-bedroom. Stainless appliances, granite counters, "
                       "and a private balcony. On-site gym and pool.",
        "location":    "19224 Nordhoff St",
        "city":        "Northridge",
        "state":       "CA",
        "zip_code":    "91330",
        "monthly_rent": 2200,
        "bedrooms":    "2bed",
        "bathrooms":   "2bath",
        "room_type":   "entire",
        "square_feet": 1020,
        "amenities":   "Pool,Gym,Parking,AC,Laundry",
        "latitude":    34.2557,
        "longitude":   -118.5153,
    },
    # ── Northeast (~2.5 mi) ──
    {
        "title":       "Private Room in Granada Hills",
        "description": "Furnished private room in a shared 3BR house. "
                       "Great for grad students. All utilities included, quiet neighborhood.",
        "location":    "17136 Chatsworth St",
        "city":        "Granada Hills",
        "state":       "CA",
        "zip_code":    "91344",
        "monthly_rent": 950,
        "bedrooms":    "1bed",
        "bathrooms":   "1bath",
        "room_type":   "private",
        "square_feet": 200,
        "amenities":   "Furnished,WiFi,Utilities Included,Parking",
        "latitude":    34.2598,
        "longitude":   -118.4998,
    },
]
# ─────────────────────────────────────────────────────────────────────────────


class Command(BaseCommand):
    help = 'Seed the database with test apartment listings near CSUN'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete all existing apartment listings before seeding',
        )
        parser.add_argument(
            '--user',
            type=str,
            default=None,
            help='Username to assign as owner of seeded listings (default: first superuser)',
        )

    def handle(self, *args, **options):
        if options['clear']:
            count = ApartmentPost.objects.count()
            ApartmentPost.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Deleted {count} existing listings'))

        # Determine owner
        if options['user']:
            try:
                owner = User.objects.get(username=options['user'])
            except User.DoesNotExist:
                raise CommandError(f"User '{options['user']}' does not exist")
        else:
            owner = User.objects.filter(is_superuser=True).first()
            if not owner:
                owner = User.objects.first()
            if not owner:
                raise CommandError(
                    'No users found. Create a user first or pass --user <username>.'
                )

        self.stdout.write(f'Seeding listings as owner: {owner.username}')

        created = 0
        for data in LISTINGS:
            obj, was_created = ApartmentPost.objects.update_or_create(
                title=data['title'],
                owner=owner,
                defaults={
                    'description':  data['description'],
                    'location':     data['location'],
                    'city':         data['city'],
                    'state':        data['state'],
                    'zip_code':     data['zip_code'],
                    'monthly_rent': data['monthly_rent'],
                    'bedrooms':     data['bedrooms'],
                    'bathrooms':    data['bathrooms'],
                    'room_type':    data['room_type'],
                    'square_feet':  data.get('square_feet'),
                    'amenities':    data.get('amenities', ''),
                    'latitude':     data['latitude'],
                    'longitude':    data['longitude'],
                    'is_active':    data.get('is_active', True),
                },
            )
            if was_created:
                created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Done — {created} listings created, {len(LISTINGS) - created} already existed '
                f'({ApartmentPost.objects.count()} total listings)'
            )
        )
