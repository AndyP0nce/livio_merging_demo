// will be used to handle the creation of the profile after the user signed up for an account

// first populate the dropdown menu's with the proper stuff 
document.addEventListener('DOMContentLoaded', async (event)=>{

    document.querySelector('.search-box').style.display = 'none'; // hides the search bar for this

    const genderDropDown = document.getElementById('gender_dropdown'); 
    const gradeLevelDropDown = document.getElementById('gradeLevel_dropdown'); 
    const nationalityDropDown = document.getElementById('nationality_dropdown')

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
        genderDropDown.append(genderOption);

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
        nationalityDropDown.append(nationalityOption); 
    });

    // add the dropdown menu for each  by manipulating the DOM
    gradeLevelObjects.forEach((object) =>{
        const gradeLevelOption = document.createElement('option');
        gradeLevelOption.value = object.name;

        let capitalized = object.name;
        capitalized = capitalized[0].toUpperCase() + capitalized.slice(1);

        gradeLevelOption.text = capitalized;

        gradeLevelDropDown.append(gradeLevelOption);

    })

});


// event handler for when the submit button is clicked
document.getElementById('profile_form').addEventListener('submit', async (event) => {
    event.preventDefault(); // prevents the old school way of submitting a form to backend

    // get the data into key value pairs
    const profileForm = new FormData(event.target); // the target of the event is the form, so that is passed into form data 

    // get the image which was uploaded for the profile picture 
    const profilePicture = profileForm.get('profilePicture'); 
    const profilePictureType = profilePicture.type; // returns the type of the profile picture which is needed for the S3 bucket 
    let profilePictureName = profilePicture.name; // the name of the profile picture which will be used for uploading to the S3 bucket

    // get rid of any space that may be present in the name of the profile picture, so when the URL for s3 is created it is right, and the backend can properly validate it
    profilePictureName = profilePictureName.replaceAll(' ', '');


    profileForm.delete('profilePicture'); // deletes the image file so it is not sent to the backend 

    let profileObject = Object.fromEntries(profileForm);

    // run some validation, and transformations to the attributes of the object 

    // trim any whitespace that the user may have put in front and behind their first and last names
    firstName = profileObject.firstName;
    lastName = profileObject.lastName; 

    profileObject.firstName = firstName.trim();
    profileObject.lastName = lastName.trim();

    // add new field which is needed for backend, indicating wheter there is a roommate post, which there is not, since it is a new account and profile being created
    profileObject.has_roommate_post = false; 


    console.log(profileObject)

    // need to fit in the S3 picture upload here 

    // get the fileName, the file

    const imageUploadInformation = {
        fileName: profilePictureName,
        fileType: profilePictureType,
        expiration: 5000
    }

        let requestAdditionalData = {
            method: 'POST',
            headers : {
                'Content-Type' : 'application/json',
                'Authorization' : `Bearer ${localStorage.getItem('access_token')}`
            },
            body: JSON.stringify(imageUploadInformation)
        }

    // get the presigned url for the image upload to S3
    const presignedURLResponse = await fetch("http://127.0.0.1:8000/profiles/uploadurl", requestAdditionalData); 
    const presignedURLObject = await presignedURLResponse.json(); 
    const presignedURL = presignedURLObject.presignedURL; 
    const imageURL = presignedURLObject.imageURL; // the s3 url for the image

    // now make the PUT request to S3 bucket (has the profile picture in the request and the header with the proper type)
    const s3BucketProfilePictureUpload = {
        method: 'PUT',
        headers: {
            'Content-Type' : profilePictureType
        },
        body: profilePicture
    }

    //make a PUT request to the S3 bucket to save that profile image, and get the response back
    await fetch(presignedURL, s3BucketProfilePictureUpload); 

    //send the data to the backend to create the user profile, and then redirect to new page (store the data to local storage prior to redirect so on the new page can access it)

    // add the imageURL to the object which will be used to make the request to the backend
    profileObject.profilePicture = imageURL;
    console.log(profileObject.profilePicture); 
    console.log("S3 Image URL", imageURL);  

    requestAdditionalData = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization' : `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(profileObject)
    }

    // // makes request the backend api for profile creation
    const response = await fetch("http://127.0.0.1:8000/profiles/profile",requestAdditionalData); 

    const profileData = await response.json(); // transform it to JS object 

    console.log(profileData);
    console.log("Access Token", localStorage.getItem('access_token'));
    console.log("S3 Image URL", imageURL); 

    // add to local storage to have it locally

    // redirect to the home page (for now)
    window.location.href = "http://127.0.0.1:8000/newProfile/"


});

window.addEventListener('beforeunload', async (event) =>{
    let confirmXing = "Are you sure you want to click out here? You are in the middle of your profile creation, and this info may be lost!";

    e.returnValue = confirmXing; 

});