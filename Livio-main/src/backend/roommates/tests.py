from django.test import TestCase
from users.models import User
from profiles.models import Profile
from genders.models import Gender
from nationalities.models import Nationality
from gradeLevels.models import GradeLevel
from roommates.models import RoommatePost, Filter
from datetime import date
from features.models import Feature

"""
Module Name: roommates.tests
Date of Code: October 15, 2025
Programmer's Name: Arthur Lazaryan
Description: Will have the test cases which will be used in relation with the RoommatePost class. 
Important Functions: N/A
Data Structures: N/A
Algorithms: N/A
"""


class RoommatePostFilterTest(TestCase):
    """Will test the filter of the roommate post based on the different criteria."""

    # will setUp the data that is needed for the (will set up a temp db for the testing purposes)
    def setUp(self):
        """Set's up the data which will be used to setup data for the filtering method"""

        # features (perferences for the roommate posts)
        # petFriendly = Feature.objects.create(name="pet-friendly")
        # vegan = Feature.objects.create(name="vegan")
        # nonSmoker = Feature.objects.create(name="non-smoker")


        # genders for the profile 
        male = Gender.objects.create(name="M")
        female = Gender.objects.create(name="F")

        # gradeLevels for the profile 
        senior = GradeLevel.objects.create(name="senior")
        junior = GradeLevel.objects.create(name="junior")
        freshman = GradeLevel.objects.create(name="freshman")

        # nationality for the profiles 
        armenian = Nationality.objects.create(name="armenian")
        indian = Nationality.objects.create(name="indian")

        # create users for the testing purposes 
        user1 = User.objects.create(username="user1", password="user1", email="user1@user1.com")
        user2 = User.objects.create(username="user2", password="user2", email="user2@user2.com")
        user3 = User.objects.create(username="user3", password="user3", email="user3@user3.com")

        # create the profiles for the testing purposes 
        profile1 = Profile.objects.create(firstName="Profile", lastName="1", age=25, gender=male, gradeLevel=senior, nationality=armenian, bio="Hi, my name is Arthur", profile_user=user1, has_roommate_post=True, profilePicture="")
        profile2 = Profile.objects.create(firstName="Profile", lastName="2", age=52, gender=female, gradeLevel=freshman, nationality=indian, bio="Hi, my name is Jane", profile_user=user2, has_roommate_post=True, profilePicture="")
        profile3 = Profile.objects.create(firstName="Profile", lastName="3", age=30, gender=male, gradeLevel=junior, nationality=armenian, bio="Hi my name is", profile_user=user3, has_roommate_post=True, profilePicture="")

        # create the roommate posts for testing purposes   
        post1 = RoommatePost.objects.create(title="Roomie1", description="Roomie1DESC", profile=profile1, funFact="I am ROOMIE1", budget=1500, moveInDate=date(2025, 12, 15), numberOfPeopleInterested=0)
        post2 = RoommatePost.objects.create(title="Roomie2", description="Roomie2DESC", profile=profile2, funFact="I am ROOMIE2", budget=2000, moveInDate=date(2026, 1, 5), numberOfPeopleInterested=0)
        post3 = RoommatePost.objects.create(title="Roomie3", description="Roomie3DESC", profile=profile3, funFact="I am ROOMIE3", budget=500, moveInDate=date(2025, 12, 5), numberOfPeopleInterested=0)


    def test_budget_filter(self):
        """Will Filter the roommate posts based on their budget"""
        lowerBudget = 600
        upperBudget = 1700
        results = Filter.budgetFilter(lowerBudget, upperBudget)
        self.assertQuerySetEqual(results, ["Profile 1's Roommate Post"],transform=str,ordered=False) # will make sure the queryset returned by the filter is what it is supposed to be 


    def test_moveInDate_filter(self):
        """Will filter the roommate posts based on thier move in date"""
        earliestDate = date(2025, 11, 30)
        latestDate = date(2026, 1,10)
        results = Filter.moveInDateFilter(earliestDate, latestDate)
        self.assertQuerySetEqual(results,["Profile 1's Roommate Post", "Profile 2's Roommate Post", "Profile 3's Roommate Post"],transform=str, ordered=False)

    def test_age_filter(self):
        """Will filter the roommate posts based on thier age, of the poster""" 
        lowerAge = 21
        upperAge = 42
        results = Filter.ageFilter(lowerAge, upperAge)
        self.assertQuerySetEqual(results, ["Profile 1's Roommate Post", "Profile 3's Roommate Post"], transform=str,ordered=False)

    def test_nationality_filter(self):
        """Will filter roommate posts based on their nationality, of the poster"""
        nationality="armenian"
        results = Filter.nationalityFilter(nationality)
        self.assertQuerySetEqual(results, ["Profile 1's Roommate Post", "Profile 3's Roommate Post"], transform=str,ordered=False)

    def test_gender_filter(self):
        """Will filter roommate posts based on their gender, of the poster"""
        gender="F"
        results = Filter.genderFilter(gender)
        self.assertQuerySetEqual(results, [ "Profile 2's Roommate Post"], transform=str,ordered=False)



