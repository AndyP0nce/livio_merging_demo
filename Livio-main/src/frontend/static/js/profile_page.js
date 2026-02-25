document.addEventListener('DOMContentLoaded', async (event)=>{

    if (!localStorage.getItem('access_token')) {
        window.location.href = '/login/?next=' + encodeURIComponent(window.location.pathname);
        return;
    }

        document.querySelector('.search-box').style.display = 'none'; // hides the search bar for this

    // get the data of the currently logged in user from the backend, so it can populate the profile page

    const userProfileRequestData = {
        method: 'GET',
        headers: {
            'Authorization' : `Bearer ${localStorage.getItem('access_token')}`
        }
    }

    const userProfileData = await fetch('http://127.0.0.1:8000/profiles/current', userProfileRequestData); 
    const userProfileDataObject = await userProfileData.json(); // converts the data which was recieved to the frontend to a JS object 

    // check the current time to give the proper welcome message
    const currentDate = new Date(); 
    const currentTimeHour = currentDate.getHours(); // returns military time hours
    let message; 

    if (currentTimeHour < 12)
    {
        message = "Good morning, ";
    }
    else if (currentTimeHour < 17) // checks if it is before 5
    {
        message = "Good afternoon, ";
    }
    else // anything 5pm or greater it is evening
    {
        message = "Good evening, ";
    }

    // add that message with the name of the user to the DOM
    const welcomeMessage = document.getElementById('welcome_message');
    welcomeMessage.innerText = message + userProfileDataObject.firstName + "!";
    // welcomeMessage.style.display = 'inline-block'; 

    // add the profile image next to the text 
    const profileImage = document.getElementById('profile_image');
    profileImage.src = userProfileDataObject.profilePicture; 

    // if the user has no roommate post, then just have it say a message like "Post a roommate post, to get yourself see on Livio"
    // if the user has a roommate post, then have it just have the info
    const roommateInsights = document.getElementById("roommate_post_insights");

    if (userProfileDataObject.has_roommate_post === false)
    {
        const noRoommateInsightsMessage = document.createElement('p');
        noRoommateInsightsMessage.innerText = "Create a roommate post to get more out of this section!";
        roommateInsights.append(noRoommateInsightsMessage); 
    }
    else // has a roommate post, so can get information from the backend
    {
        const userProfileRequestData = {
        method: 'GET',
        headers: {
            'Authorization' : `Bearer ${localStorage.getItem('access_token')}`
        }
        }

        // first get the roommate post info (which will have info about the number of people interested in this person)
        const roommatePost = await fetch('http://127.0.0.1:8000/roommate/current', userProfileRequestData)
        const roommatePostObject = await roommatePost.json(); 

        let numberOfPeopleInterestedInBeingYourRoommate = roommatePostObject.numberOfPeopleInterested; 

        // now get the number of people you are interested in becoming the roommate
        const currentUserRoommateInterested = await fetch('http://127.0.0.1:8000/roommate/current/interested', userProfileRequestData)
        const currentUserRoommateInterestedObject = await currentUserRoommateInterested.json();

        let numberOfPeopleYourInterestedIn = currentUserRoommateInterestedObject.bufferCount; 

        // make the neccesary additions to the DOM 
        
        const interestedInYouNumber = document.querySelector('#interestedInYouNumber');
        interestedInYouNumber.innerText = numberOfPeopleInterestedInBeingYourRoommate;

        const yourInterestedIn = document.querySelector('#yourInterestedInNumber');
        yourInterestedIn.innerText = numberOfPeopleYourInterestedIn; 


        const interestedDiv = document.querySelector('#interestedInYou');
        const yourInterestedDiv = document.querySelector('#yourInterestedIn');

        const interestedInYouCount = document.createElement('p');
        interestedInYouCount.innerText = String(numberOfPeopleInterestedInBeingYourRoommate);
        const interestedInYouMessage = document.createElement('p');
        interestedInYouMessage.innerText = "People interested in being your roommate!";
        interestedDiv.append(interestedInYouMessage); 

        
        const youInterestedCount = document.createElement('p');
        youInterestedCount.innerText = String(numberOfPeopleYourInterestedIn);
        const yourInterestedMessage = document.createElement('p');
        yourInterestedMessage.innerText = "People your interested in being roommates with!";
        yourInterestedDiv.append(yourInterestedMessage); 



    }

    // add the neccesary things to edit profile section (can maybe make it a form to make the changes later)
    const firstName = userProfileDataObject.firstName;
    const lastName = userProfileDataObject.lastName;
    const age = userProfileDataObject.age;
    const gender = userProfileDataObject.gender;
    const gradeLevel = userProfileDataObject.gradeLevel;
    const nationality = userProfileDataObject.nationality;
    const bio = userProfileDataObject.bio;

    // add the editable form for the profile info
    const editProfileForm = document.querySelector('#editProfileForm');

    const firstNameField = document.createElement('input');
    firstNameField.type = "text";
    firstNameField.placeholder = firstName;
    firstNameField.value = firstName;
    firstNameField.name = "firstName";
    firstNameField.disabled = true;
    firstNameField.id = "firstName"; 
    firstNameField.className = "input-field";


    const lastNameField = document.createElement('input');
    lastNameField.type = "text";
    lastNameField.placeholder = lastName;
    lastNameField.value = lastName;
    lastNameField.name = "lastName";
    lastNameField.disabled = true;
        lastNameField.id = "lastName"; 
    lastNameField.className = "input-field";


    const ageField = document.createElement('input');
    ageField.type = "number";
    ageField.placeholder = age;
    ageField.value = age;
    ageField.name = "age";
    ageField.disabled = true;
        ageField.id = "age"; 
    ageField.className = "input-field";


   const genderField = document.createElement('select');
    genderField.type = "select";
    genderField.placeholder = gender;
    genderField.value = gender;
    genderField.name = "gender";
    genderField.disabled = true;
    genderField.id = "genderField"; 
    genderField.className = "input-field";



    const gradeLevelField = document.createElement('select');
    gradeLevelField.type = "select";
    gradeLevelField.placeholder = gradeLevel;
    gradeLevelField.value = gradeLevel;
    gradeLevelField.name = "gradeLevel";
    gradeLevelField.disabled = true;
    gradeLevelField.id = "gradeLevel"; 
    gradeLevelField.className = "input-field";
    // add the dropdown options

    const nationalityField = document.createElement('select');
    nationalityField.type = "select";
    nationalityField.placeholder = nationality;
    nationalityField.value = nationality;
    nationalityField.name = "nationality";
    nationalityField.disabled = true;
        nationalityField.id = "nationality"; 
    nationalityField.className = "input-field";
     // get the gender data from the backend
    const genders = await fetch("http://127.0.0.1:8000/genders/all");
    const genderObjects = await genders.json(); // gets a list of gender objects

    // get the nationality data from the backend
    const nationalities = await fetch("http://127.0.0.1:8000/nationalities/all"); 
    const nationalityObjects = await nationalities.json(); // gets a list of nationality objects

    // get the gradelevel data from the backend
    const gradeLevels = await fetch("http://127.0.0.1:8000/gradeLevels/all");
    const gradeLevelObjects = await gradeLevels.json(); // gets a list of grade level objects

    // add to the dropdown menu for each by manipulating the DOM 
    genderObjects.forEach((object) => {
        const genderOption = document.createElement('option'); // creates option in the drop down menu
        genderOption.value = object.name;

        if (object.name === "M")
            genderOption.text = "Male";
        else {
            genderOption.text = "Female";
        }

        // append the new option to the gender dropdown 
        genderField.append(genderOption);

    });

    // add to the dropdown menu for each by manipulating the DOM
    nationalityObjects.forEach((object) => {
        const nationalityOption = document.createElement('option');
        nationalityOption.value = object.name;

        // Strings not mutuable in JS so need to do this 
        let capitalized = object.name;
        capitalized = capitalized[0].toUpperCase() + capitalized.slice(1);
        nationalityOption.text = capitalized; 

        // append the nationality
        nationalityField.append(nationalityOption); 
    });

    // add the dropdown menu for each  by manipulating the DOM
    gradeLevelObjects.forEach((object) =>{
        const gradeLevelOption = document.createElement('option');
        gradeLevelOption.value = object.name;

        let capitalized = object.name;
        capitalized = capitalized[0].toUpperCase() + capitalized.slice(1);

        gradeLevelOption.text = capitalized;

        gradeLevelField.append(gradeLevelOption);

    })


    const bioField = document.createElement('input');
    bioField.type = "textarea";
    bioField.placeholder = bio;
    bioField.value = bio;
    bioField.name = "bio";
    bioField.disabled = true;
        bioField.id = "bio"; 
    bioField.className = "input-field";

    editProfileForm.append(firstNameField);
    editProfileForm.append(lastNameField);

    editProfileForm.append(ageField);

    editProfileForm.append(genderField);

    editProfileForm.append(gradeLevelField);

    editProfileForm.append(nationalityField);

    editProfileForm.append(bioField);





    // const editProfileSection = document.getElementById('edit_profile');
    // const fName = document.createElement('h6'); 
    // fName.innerText = firstName;
    // editProfileSection.append(fName);

    // const lName = document.createElement('h6'); 
    // lName.innerText = lastName;
    // editProfileSection.append(lName);
    

    // const ageE = document.createElement('h6'); 
    // ageE.innerText = age;
    // editProfileSection.append(ageE);
    

    // const gndr = document.createElement('h6'); 
    // gndr.innerText = gender;
    // editProfileSection.append(gndr);
    

    // const grade = document.createElement('h6'); 
    // grade.innerText = gradeLevel;
    // editProfileSection.append(grade);
    

    // const nation = document.createElement('h6'); 
    // nation.innerText = nationality;
    // editProfileSection.append(nation);
    

    // const bioE = document.createElement('h6'); 
    // bioE.innerText = bio;
    // editProfileSection.append(bioE);
    
    // add the neccesary account summary information to the DOM
    const accountSummary = document.getElementById('account_summary');
    const email = localStorage.getItem('email');
    const username = localStorage.getItem('username'); 
    let join_date = localStorage.getItem('join_date'); 
    join_date = new Date(join_date)
    join_date = join_date.toLocaleDateString('en-US', {day:'2-digit', month:'2-digit', year:'numeric'}); 

    // create span and put stuff like email in span 



    const emailE = document.createElement('p'); 
    const emailOutline = document.createElement('span');
    emailOutline.innerText = "Email: ";
    emailOutline.style.color = "white";
    emailE.append(emailOutline); // Append span to p, not to accountSummary
    emailE.append(email); // Append text directly or create text node
    emailE.className = "summary_item";
    accountSummary.append(emailE);

    const usernameE = document.createElement('p');
    const usernameOutline = document.createElement('span');
    usernameOutline.innerText = "Username: ";
    usernameOutline.style.color = "white";
    usernameE.append(usernameOutline);
    usernameE.append(username);
    usernameE.className = "summary_item";
    accountSummary.append(usernameE);

    const join_dateE = document.createElement('p');
    const joinDateOutline = document.createElement('span');
    joinDateOutline.innerText = "Join Date: ";
    joinDateOutline.style.color = "white";
    join_dateE.append(joinDateOutline);
    join_dateE.append(join_date);
    join_dateE.className = "summary_item";
    accountSummary.append(join_dateE);



});

document.querySelector('#log_out_button').addEventListener('click', async (event)=>{

    // change the window to home page
    window.location.href = "http://127.0.0.1:8000/";

    // change the header, and maybe get rid of the tokens, so it cannot be used anymore

});


document.addEventListener('click', async (event) => {
    // Handle Edit button click
    if (event.target.id === 'editProfileButton') {
        event.preventDefault();

        // make the form fillable and editable
        document.querySelector('#firstName').disabled = false;
        document.querySelector('#lastName').disabled = false;
        document.querySelector('#age').disabled = false;
        document.querySelector('#genderField').disabled = false;
        document.querySelector('#gradeLevel').disabled = false;
        document.querySelector('#nationality').disabled = false;
        document.querySelector('#bio').disabled = false;

        // add a submit button
        const submitChangeButton = document.createElement('button');
        submitChangeButton.innerText = "Submit";
        submitChangeButton.type = "submit";
        submitChangeButton.id = "submit_edit_button";
        submitChangeButton.style.gridColumn = "1 / 3" // make it span the two columns with the column lines
        document.querySelector('#editProfileForm').append(submitChangeButton);

        // change the edit button to a cancel button
        event.target.innerText = "Cancel";
        event.target.id = "cancel_edit";
    }
    
    // Handle Cancel button click
    else if (event.target.id === 'cancel_edit') {
        event.preventDefault();

        // make the form disabled
        document.querySelector('#firstName').disabled = true;
        document.querySelector('#lastName').disabled = true;
        document.querySelector('#age').disabled = true;
        document.querySelector('#genderField').disabled = true;
        document.querySelector('#gradeLevel').disabled = true;
        document.querySelector('#nationality').disabled = true;
        document.querySelector('#bio').disabled = true;

        const button = document.getElementById('submit_edit_button'); 
        button.remove(); 

        // change back to edit button
        event.target.innerText = "Edit";
        event.target.id = "editProfileButton";
    }

    // when submit button for the edit is clicked
    else if (event.target.id === 'submit_edit_button')
    {
        event.preventDefault();

        // get the data from the form
        const editFormData = new FormData(document.querySelector('#editProfileForm'));
        const editFormObject = Object.fromEntries(editFormData.entries()); 

        // send the info to the backend
        const profileEditHeaders ={
            method: 'PUT',
            headers: {
                'Authorization' : `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type' : 'application/json',
            },
            body: JSON.stringify(editFormObject)
        }

        const newProfileInfo = await fetch('http://127.0.0.1:8000/profiles/update',profileEditHeaders);
        const newProfileObject = await newProfileInfo.json();

        // change the placeholders for each of the values to match the new value, if so 
        document.querySelector('#firstName').placeholder = newProfileObject.firstName;
        document.querySelector('#lastName').placeholder = newProfileObject.lastName;
        document.querySelector('#age').placeholder = newProfileObject.age;
        document.querySelector('#genderField').placeholder = newProfileObject.gender;
        document.querySelector('#gradeLevel').placeholder = newProfileObject.gradeLevel;
        document.querySelector('#nationality').placeholder = newProfileObject.nationality;
        document.querySelector('#bio').placeholder = newProfileObject.bio;


        // get rid of the submit button, and change cancel to edit again
        document.querySelector('#cancel_edit').innerText = 'Edit';
        document.querySelector('#cancel_edit').id = 'editProfileButton';
                const button = document.getElementById('submit_edit_button'); 
        button.remove(); 

                document.querySelector('#firstName').disabled = true;
        document.querySelector('#lastName').disabled = true;
        document.querySelector('#age').disabled = true;
        document.querySelector('#genderField').disabled = true;
        document.querySelector('#gradeLevel').disabled = true;
        document.querySelector('#nationality').disabled = true;
        document.querySelector('#bio').disabled = true;

    }
});
