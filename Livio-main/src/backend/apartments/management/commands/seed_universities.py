"""
Management command: seed_universities
Usage: python manage.py seed_universities

Populates the University table with California college campuses
that are relevant to the San Fernando Valley / LA area.

Data matches the seed data from demo_map/backend/api/management/commands/seed_universities.py
so that the same university markers appear on the map.
"""

from django.core.management.base import BaseCommand
from apartments.models import University


UNIVERSITIES = [
    # San Fernando Valley / primary campuses
    {"name": "CSUN",    "fullName": "California State University, Northridge",  "lat": 34.2413,  "lng": -118.5290},
    {"name": "UCLA",    "fullName": "University of California, Los Angeles",     "lat": 34.0689,  "lng": -118.4452},
    {"name": "USC",     "fullName": "University of Southern California",         "lat": 34.0224,  "lng": -118.2851},
    {"name": "Caltech", "fullName": "California Institute of Technology",        "lat": 34.1377,  "lng": -118.1253},
    {"name": "CSULA",   "fullName": "California State University, Los Angeles",  "lat": 34.0668,  "lng": -118.1693},
    {"name": "CSULB",   "fullName": "California State University, Long Beach",   "lat": 33.7838,  "lng": -118.1141},
    {"name": "CSUDH",   "fullName": "California State University, Dominguez Hills","lat": 33.8641, "lng": -118.2576},
    {"name": "CSUF",    "fullName": "California State University, Fullerton",    "lat": 33.8818,  "lng": -117.8853},
    {"name": "CSUCI",   "fullName": "California State University, Channel Islands","lat": 34.1774,"lng": -119.0763},
    {"name": "CSUSB",   "fullName": "California State University, San Bernardino","lat": 34.1825, "lng": -117.3214},
    {"name": "CSUPOMONA","fullName":"California State Polytechnic University, Pomona","lat": 34.0567,"lng": -117.8218},
    {"name": "UCR",     "fullName": "University of California, Riverside",       "lat": 33.9737,  "lng": -117.3281},
    {"name": "UCSB",    "fullName": "University of California, Santa Barbara",   "lat": 34.4140,  "lng": -119.8489},
    {"name": "UCI",     "fullName": "University of California, Irvine",          "lat": 33.6405,  "lng": -117.8443},
    {"name": "UCSD",    "fullName": "University of California, San Diego",       "lat": 32.8800,  "lng": -117.2340},
    {"name": "LMU",     "fullName": "Loyola Marymount University",               "lat": 33.9693,  "lng": -118.4170},
    {"name": "Pepperdine","fullName":"Pepperdine University",                    "lat": 34.0358,  "lng": -118.6923},
    {"name": "Occidental","fullName":"Occidental College",                       "lat": 34.1200,  "lng": -118.2095},
    {"name": "Pierce",  "fullName": "Pierce College",                            "lat": 34.1879,  "lng": -118.5774},
    {"name": "Valley",  "fullName": "Los Angeles Valley College",                "lat": 34.1771,  "lng": -118.4013},
    {"name": "LACC",    "fullName": "Los Angeles City College",                  "lat": 34.0826,  "lng": -118.2982},
    {"name": "LAVC",    "fullName": "Los Angeles Valley College",                "lat": 34.1771,  "lng": -118.4013},
    {"name": "ELAC",    "fullName": "East Los Angeles College",                  "lat": 34.0619,  "lng": -118.1571},
    {"name": "SMC",     "fullName": "Santa Monica College",                      "lat": 34.0230,  "lng": -118.4783},
    {"name": "Glendale","fullName": "Glendale Community College",                "lat": 34.1665,  "lng": -118.2497},
]


class Command(BaseCommand):
    help = 'Seed the University table with California college campuses'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing universities before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            count = University.objects.count()
            University.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Cleared {count} existing universities'))

        created = 0
        updated = 0

        for data in UNIVERSITIES:
            obj, was_created = University.objects.update_or_create(
                name=data['name'],
                defaults={
                    'fullName': data['fullName'],
                    'lat':      data['lat'],
                    'lng':      data['lng'],
                }
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Done — {created} universities created, {updated} updated '
                f'({University.objects.count()} total)'
            )
        )
