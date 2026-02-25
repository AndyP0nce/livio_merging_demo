document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault(); // Prevent the default form submission  

    const signInData = new FormData(this); // converts the form to a key value pair object 
    const signInDataObject  = Object.fromEntries(signupData.entries());   

    // Send the login/sign in infromation to the backend 
    fetch('http://127.0.0.1:8000/users/signup', { method: 'POST', 
                headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(signInDataObject) 
    }).then(response => response.json()).then(data => console.log(data)).then(window.location.href = 'http://127.0.0.1:8000/')

});

const toggles = document.querySelectorAll(".toggle-password-btn, .toggle-password-icon");
      toggles.forEach(el => {
        el.addEventListener("click", function () {
          const targetId = this.getAttribute("data-target") || this.querySelector("img")?.getAttribute("data-target");
          const field = document.getElementById(targetId);
          const img = this.classList.contains("toggle-password-btn") ? this.querySelector("img") : this;
          if (!field) return;
          if (field.type === "password") {
            field.type = "text";
            if (img) img.src = "../static/images/eye.png";
          } else {
            field.type = "password";
            if (img) img.src = "../static/images/eye-slash.png";
          }
        });
      });
