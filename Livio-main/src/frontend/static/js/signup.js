(function() {
    'use strict';

    const API_BASE = 'http://127.0.0.1:8000';

    // Handle signup form submission
    document.getElementById('signupForm').addEventListener('submit', async function(event) {
        event.preventDefault();

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account...';

        // Collect form data
        const formData = new FormData(this);
        const signupData = {
            username: formData.get('username').trim(),
            email: formData.get('email').trim(),
            password: formData.get('password')
        };

        // Validate passwords match
        const confirmPassword = document.getElementById('confirmPassword').value;
        if (signupData.password !== confirmPassword) {
            showError('Passwords do not match!');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }

        // Validate password strength
        if (signupData.password.length < 8) {
            showError('Password must be at least 8 characters long');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(signupData.email)) {
            showError('Please enter a valid email address');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }

        try {
            // will proceed with making backend request to sign up, and will get returned the refresh and access tokens needed for the user
            const response = await fetch(`${API_BASE}/users/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(signupData)
            });

            const data = await response.json(); // returns the two tokens (and should return the data)

            if (response.ok && data.access && data.refresh) {
                // Store tokens
                localStorage.setItem('access_token', data.access);
                localStorage.setItem('refresh_token', data.refresh);

                localStorage.setItem('username', data.username);
                localStorage.setItem('email', data.email);
                localStorage.setItem('join_date', String(data.join_date));

                
                // Store user data for profile page (should get this data from the backend)
                localStorage.setItem('user_data', JSON.stringify({
                    username: signupData.username,
                    email: signupData.email,
                    joinDate: new Date(data.join_date) // CHANGED THIS
                }));

                // Show success and redirect to profile page
                showSuccess('Account created successfully! Redirecting to profile setup...');
                
                setTimeout(() => {
                    window.location.href = '/creation/'; // relative url to the URL that it is currently on
                }, 1500);
            } else {
                // Handle errors
                if (data.username) {
                    showError('Username is already taken');
                } else if (data.email) {
                    showError('Email is already registered');
                } else if (data.password) {
                    showError('Password does not meet requirements');
                } else {
                    showError(data.message || 'Registration failed. Please try again.');
                }
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        } catch (error) {
            console.error('Signup error:', error);
            showError('Network error. Please check your connection and try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });

    // Show error message
    function showError(message) {
        // Remove existing error
        const existingError = document.querySelector('.error-message');
        if (existingError) existingError.remove();

        // Create error element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            background: rgba(255, 80, 80, 0.1);
            border: 1px solid rgba(255, 80, 80, 0.3);
            color: #ff6b6b;
            padding: 12px 16px;
            border-radius: 8px;
            margin: 10px 0;
            font-size: 0.9rem;
            text-align: center;
            width: 90%;
        `;
        errorDiv.textContent = message;

        // Insert before the submit button
        const submitBtn = document.querySelector('.signup-button');
        submitBtn.parentNode.insertBefore(errorDiv, submitBtn);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) errorDiv.remove();
        }, 5000);
    }

    // Show success message
    function showSuccess(message) {
        // Remove existing messages
        const existingMsg = document.querySelector('.error-message, .success-message');
        if (existingMsg) existingMsg.remove();

        // Create success element
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.style.cssText = `
            background: rgba(74, 222, 128, 0.1);
            border: 1px solid rgba(74, 222, 128, 0.3);
            color: #4ade80;
            padding: 12px 16px;
            border-radius: 8px;
            margin: 10px 0;
            font-size: 0.9rem;
            text-align: center;
            width: 90%;
        `;
        successDiv.textContent = message;

        // Insert before the submit button
        const submitBtn = document.querySelector('.signup-button');
        submitBtn.parentNode.insertBefore(successDiv, submitBtn);
    }

    // Password visibility toggle
    const toggles = document.querySelectorAll(".toggle-password-btn, .toggle-password-icon");
    toggles.forEach(el => {
        el.addEventListener("click", function() {
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

    // Real-time password match validation
    const passwordField = document.getElementById('password');
    const confirmField = document.getElementById('confirmPassword');

    if (confirmField) {
        confirmField.addEventListener('input', function() {
            if (this.value && passwordField.value !== this.value) {
                this.style.borderColor = 'rgba(255, 80, 80, 0.5)';
            } else if (this.value) {
                this.style.borderColor = 'rgba(74, 222, 128, 0.5)';
            } else {
                this.style.borderColor = '';
            }
        });
    }

})();