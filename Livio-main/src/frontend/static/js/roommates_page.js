document.addEventListener('DOMContentLoaded', async (event) =>{
    
    document.querySelector('.search-box').style.display = 'none';
    
    // if there is nothing logged in from the user
    if (localStorage.getItem('access_token') === null)
    {
        // prompt user to sign in or sign up

    }
    else
    {
        // make request to backend to get profile of this user to see if they have a roommate_post
        console.log(localStorage.getItem('access_token'));

        
        const userProfileRequestData = {
        method: 'GET',
        headers: {
            'Authorization' : `Bearer ${localStorage.getItem('access_token')}`
        }
        }

        const userProfile = await fetch('http://127.0.0.1:8000/profiles/current', userProfileRequestData);
        const userProfileObject = await userProfile.json(); 

        console.log(userProfileObject);

        // if the user does not have a roommate_post, then just display something like make a roommate post to get access to this portion of the website
        if (userProfileObject.has_roommate_post === false)
        {
            // add a message here
            document.querySelector('#hidden_creation').style.display = "block";
            // change it so that this is displaying and the rest is hidden
            
        }
        else // if they have a roommate post, so therefore they can view the whole part of the page
        {
            document.querySelector('#hidden').style.display = "none";
            initialRoommatePage(userProfileObject);
            currentUserInterestedRoommates();
        }

    }


});

// will be used to get info from the backend for the purposes of getting all of the roommate posts from the backend
async function initialRoommatePage(currentUserProfile)
{
    // make request to backend to get the roommate post
    const userProfileRequestData = {
        method: 'GET',
        headers: {
            'Authorization' : `Bearer ${localStorage.getItem('access_token')}`
        }
    }

    // will call the pagination api for the roommate post (send the limit initially)
    const roommatePost = await fetch('http://127.0.0.1:8000/roommate/posts?' + new URLSearchParams({limit:10}).toString(),userProfileRequestData); 
    const roommatePostObject = await roommatePost.json();
    
    const postList = document.querySelector('#post_list');
    
    for (const roommatePost of roommatePostObject.data)
    {
        
        // use the id for the profile in the roommate post to get some of the other info 
        const posterProfile = await fetch(`http://127.0.0.1:8000/profiles/profile/${roommatePost.profile.id}`, userProfileRequestData);
        const posterProfileObject = await posterProfile.json(); // create an object from it

        // makes sure to not show the current user's roommate psot to them (not sure why this is working)
        if (roommatePost.profile.id === currentUserProfile.id)
        {
            continue;
        }

        const newPost = document.createElement('div'); // the actual post itself 
        newPost.className = "post";

        const newPostMain = document.createElement('div'); // main portion of the post
        newPostMain.className = "post_main";

        const identification = document.createElement('div'); // the part of the post with the identification
        identification.className = 'indentification';

        const profilePictureFlex = document.createElement('div');
        profilePictureFlex.className = "profile_picture_flex";

        const profilePicture = document.createElement('img');
        profilePicture.className = "profile_picture";
        profilePicture.src = posterProfileObject.profilePicture;

        profilePictureFlex.append(profilePicture); 

        const namesDiv = document.createElement('div');
        namesDiv.className = "names";
        // h1 for the name 
        const name = document.createElement('h1');
        name.innerText = posterProfileObject.firstName + " " + posterProfileObject.lastName;
        
        namesDiv.append(name);

        const personalInfoDiv = document.createElement('div');
        personalInfoDiv.className = "personal_info";
        // h6 for personal info 
        const personalInfo = document.createElement('h3');
        personalInfo.innerText = posterProfileObject.age +  " • " + posterProfileObject.gender + " • " + posterProfileObject.nationality + " • " + posterProfileObject.gradeLevel; 
        
        personalInfoDiv.append(personalInfo);

        identification.append(profilePictureFlex);
        identification.append(namesDiv);
        identification.append(personalInfoDiv);
        newPostMain.append(identification);
        
        //

        const title_descriptionDiv = document.createElement('div');
        title_descriptionDiv.className = "title_description";

        const titleFlex = document.createElement('div');
        titleFlex.style.display="flex";
        titleFlex.style.justifyContent = "center";
        titleFlex.style.alignItems = "center";

        const title = document.createElement('h1');
        title.className = "title";
        title.innerText = roommatePost.title;

        titleFlex.append(title);

        title_descriptionDiv.append(titleFlex);

        const description = document.createElement('p');
        description.className = "description"; 
        description.innerText = roommatePost.description;

        title_descriptionDiv.append(description);
        newPostMain.append(title_descriptionDiv);

        //

        const funFactDiv = document.createElement('div');
        funFactDiv.className = "fun_fact";

        const funFact = document.createElement('div');
        funFact.className = "funFact";

        const funfactTitle = document.createElement('h4');
        funfactTitle.className = "funFact_title";
        funfactTitle.innerText = "Fun Fact";

        funFact.append(funfactTitle);
        funFactDiv.append(funFact);

        const funFactMessage = document.createElement('p');
        funFactMessage.className = "funFact_message";
        funFactMessage.innerText = roommatePost.funFact;

        funFactDiv.append(funFactMessage);

        newPostMain.append(funFactDiv);

        //

        const otherinfoDiv = document.createElement('div');
        otherinfoDiv.className = "other_info";
        const features_boxDIv = document.createElement('div');
        features_boxDIv.className = "features_box"; 

        otherinfoDiv.append(features_boxDIv);


        const budget = document.createElement('h5');
        budget.innerText = "Budget: $" + roommatePost.budget;
        budget.className = "budget"; 

        otherinfoDiv.append(budget);

        const moveInDate = document.createElement('h5');
        moveInDate.innerText = "Move In Date: " + roommatePost.moveInDate; 
        moveInDate.className = "moveInDate";

        otherinfoDiv.append(moveInDate);

        newPostMain.append(otherinfoDiv);

        newPost.append(newPostMain);

        
        // bottom portion of the post with some of the insights

        const post_bottom = document.createElement('div');
        post_bottom.className = "post_bottom";
        const count = document.createElement('span');
        count.className = "interested_count";
        count.innerText = roommatePost.numberOfPeopleInterested; 

        post_bottom.append(count);

        const message = document.createElement('p');
        message.className = "interested_message";
        message.innerText = " people are interested in " + posterProfileObject.firstName + " " + posterProfileObject.lastName; // first and last name of the post here

        post_bottom.append(message);

        const interestButton = document.createElement('button');
        interestButton.className = "interestButton"; 
        interestButton.innerText = "Show Interest";

        post_bottom.append(interestButton);

        newPost.append(post_bottom);
        
        // add the profile id (hidden so we can get it when we need it)
        const id = document.createElement('h6');
        id.className = "id";
        id.style.display = "none";
        id.innerText = roommatePost.profile.id;

        newPost.append(id);



        // add the whole new post to the post list
        postList.append(newPost);
    }

   






    // let post = document.getElementById('post');
    // post.querySelector('#profile_picture').src = profile.profilePicture; 
    // post.querySelector('#fullName').innerText = `${profile.firstName} ${profile.lastName}`;
    // post.querySelector('#personal_identifying').innerText = `${profile.age} · ${profile.gender} · ${profile.nationality} · ${profile.gradeLevel}`; 
    // post.querySelector('#funFact_message').innerText = roommatePostObject.funFact;
    // post.querySelector('#title').innerText = roommatePostObject.title;
    // post.querySelector('#description').innerText = roommatePostObject.description;
    // post.querySelector('#interested_count').innerText = roommatePostObject.numberOfPeopleInterested; 
    // post.querySelector('#interested_message').style.display = 'inline';
    // post.querySelector('#interested_message').innerText = post.querySelector('#interested_message').innerText + " " +  profile.firstName + " " + profile.lastName;

    // post.querySelector('#budget').innerText = post.querySelector('#budget').innerText + " $" + roommatePostObject.budget;
    // post.querySelector('#moveInDate').innerText = post.querySelector('#moveInDate').innerText + " " + roommatePostObject.moveInDate;

    // const featureBox = post.querySelector('#features_box');   

    // // display each of the traits 
    // roommatePostObject.features.forEach((feature) =>{
    //     const newTrait = document.createElement('h5');
    //     newTrait.innerText = feature.name; 
    //     featureBox.append(newTrait);
    // }
    // )

    // make the page visible again (unhide everything at the end, so that it looks cleaner)
    document.getElementById('hidden').style.display = 'block';
    

}

// // will be used for the current user's people they are interested in
// async function currentUserInterestedRoommates(profile)
// { 
//         const userProfileRequestData = {
//         method: 'GET',
//         headers: {
//             'Authorization' : `Bearer ${localStorage.getItem('access_token')}`
//         }
//         }
//     // get the interested roommate buffer of the current user
//     const interestedRoommates = await fetch('http://127.0.0.1:8000/roommate/current/interested', userProfileRequestData); 
//     const interestedRoommatesObject = await interestedRoommates.json();
    
//     const interestedBuffer = document.querySelector('#interested_buffer2');  

//     if (interestedRoommatesObject.bufferCount === 0)
//     {
//         // display a message saying, that there is nothing here and they should save some people
//         const message = document.createElement('p');

//         message.innerText = "You don't have any saved roommate you were interested in. Once you save a roommate post, you will see them here!";

//         interestedBuffer.append(message);
        

//     }
//     else // if there is stuff, then display normally (add to DOM)
//     {
//         // add each of the interested people to the DOM

//         interestedRoommatesObject.interestedProfiles.forEach((profile) => {
//             const newInterested = document.createElement('div');
//             newInterested.className = 'interested_entry';
//             const interestedImg = document.createElement('img');
//             interestedImg.className = 'interested_picture';
//             interestedImg.src = profile.profilePicture;
//             const interestedName = document.createElement('h3');
//             interestedName.innerText = `${profile.firstName} ${profile.lastName}`; 

//             newInterested.append(interestedImg);
//             newInterested.append(interestedName);
            
//             interestedBuffer.append(newInterested);

//         })


//     }

    


// }

async function currentUserInterestedRoommates(){
     const userProfileRequestData = {
        method: 'GET',
        headers: {
            'Authorization' : `Bearer ${localStorage.getItem('access_token')}`
        }
        }
    // get the interested roommate buffer of the current user
    const interestedRoommates = await fetch('http://127.0.0.1:8000/roommate/current/interested', userProfileRequestData); 
    const interestedRoommatesObject = await interestedRoommates.json();
    
    // check if the buffer count is empty, if so, then it will just display a message
    if (interestedRoommatesObject.bufferCount === 0)
    {
        const interestedBuffer = document.querySelector('#interested_buffer'); 

        const div = document.createElement('div');
        div.style.display = "flex";
        div.style.justifyContent = "center";
        div.style.alignItems = "center";

        const message = document.createElement('p');
        message.innerText = "Start saving some roommate posts to see them here!";
        message.style.textAlign = "center";
        message.style.margin = "40px";
        div.append(message);
        interestedBuffer.append(div);

    }
    else // there is something saved from this user
    {
        const interestedPosts = document.querySelector('#interested_posts');
        
        for (const profile of interestedRoommatesObject.interestedProfiles)
        {
            const interestedEntry = document.createElement('div');
            interestedEntry.className = "interested_entry";

            const interestedImage = document.createElement('img');
            interestedImage.className = "interested_image";
            interestedImage.src = profile.profilePicture;

            const interestedName = document.createElement('h3');
            interestedName.className = "interested_name"; 
            interestedName.innerText = profile.firstName + " " + profile.lastName;

            interestedEntry.append(interestedImage);
            interestedEntry.append(interestedName); 

            interestedPosts.append(interestedEntry);
        }

       
    }

}

// when the roommate post to be created, and the form is submitted 
document.querySelector('#roommatePostCreationForm').addEventListener('submit', async (event)=>{
    event.preventDefault();// does not do default form behavior

    const postCreationForm = new FormData(event.target);
    const postCreationFormObject = Object.fromEntries(postCreationForm.entries());

    postCreationFormObject.budget = parseFloat(postCreationFormObject.budget) // convert it to a float/double which is what the backend expects
    postCreationFormObject.features = []; 

    // headers for the request 
    const roommatePostHeaders = {
        method: 'POST',
        headers: {
            'Authorization' : `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type' : 'application/json'
        },
        body: JSON.stringify(postCreationFormObject)
    }

    const roommatePost = await fetch('http://127.0.0.1:8000/roommate/create/', roommatePostHeaders); 
    const roommatePostObject = await roommatePost.json();


    // redirect to the roommates page 
    window.location.href = "http://127.0.0.1:8000/roommates/";


});

document.addEventListener('click', async (event) =>{

    // if the show interest button is clicked, 
    if (event.target.classList.contains( 'interestButton'))
    {
        // get the profile id of the person we are adding to our saved roommates 
        const buttonParentElement = event.target.parentElement.parentElement; 

        // get the id which is hidden 
        const idElement = buttonParentElement.querySelector('.id');

        // create an object 
        const idObject = {
            id: idElement.innerText
        }
        
        // send the id to the backend, and add it to this current user's interested buffer. 

        const addInterestedRequest = {
            method: 'POST',
            headers: {
                'Authorization' : `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type' : 'application/json'
            },
            body: JSON.stringify(idObject) 
        }

        const currentUserBuffer = await fetch('http://127.0.0.1:8000/roommate/current/interested/add',addInterestedRequest);
        const currentUserBufferObj = await currentUserBuffer.json();

        // get the profile of the person we just added 
        const addingProfile = currentUserBufferObj.interestedProfiles.find((profile) => {return profile.id === parseInt(idElement.innerText)})

        console.log(addingProfile);

        // get rid of the roommate post that we liked, so it is not going to be added again
        buttonParentElement.remove();

        // // add the proper element to the interetsed buffer
        const interestedPosts = document.querySelector('#interested_posts');
        
        const interestedEntry = document.createElement('div');
        interestedEntry.className = "interested_entry";

        const interestedImage = document.createElement('img');
        interestedImage.className = "interested_image";
        interestedImage.src = addingProfile.profilePicture;

        const interestedName = document.createElement('h3');
        interestedName.className = "interested_name"; 
        interestedName.innerText = addingProfile.firstName + " " + addingProfile.lastName;

        interestedEntry.append(interestedImage);
        interestedEntry.append(interestedName); 

        interestedPosts.append(interestedEntry);


    }

});