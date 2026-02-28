// =================================================================
// LOGIN PAGE - JAVASCRIPT
// Handles user authentication and redirects
// =================================================================

(function() {
    'use strict';

    const API_BASE = 'http://127.0.0.1:8000';

    // Check if already logged in with a *valid* (non-expired) token
    document.addEventListener('DOMContentLoaded', function() {
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const nowSec = Math.floor(Date.now() / 1000);
                if (payload.exp > nowSec) {
                    // Token is still valid — redirect to profile
                    window.location.href = '/profile/';
                    return;
                }
            } catch (_) {
                // Malformed token — let them log in fresh
            }
            // Token exists but is expired — don't redirect, let them log in
        }
    });

    // Handle login form submission
    document.getElementById('loginForm').addEventListener('submit', async function(event) {
        event.preventDefault();

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';

        // Collect form data
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        // Validate
        if (!username || !password) {
            showError('Please enter both username and password');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }

        try {
            // FIXED: Changed from /user/signin to /users/signin (plural)
            const response = await fetch(`${API_BASE}/users/signin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            // Log response for debugging
            console.log('Login response status:', response.status);
            
            const data = await response.json();
            console.log('Login response data:', data);

            if (response.ok && data.access && data.refresh) {
                // Store tokens
                localStorage.setItem('access_token', data.access);
                localStorage.setItem('refresh_token', data.refresh);
                
                // store the account summary info 
                localStorage.setItem('username', data.username);
                localStorage.setItem('email', data.email);
                localStorage.setItem('join_date', String(data.join_date));

                // Store username
                localStorage.setItem('user_data', JSON.stringify({
                    username: username
                }));

                // Show success
                showSuccess('Login successful! Redirecting...');

                // Check if user has a profile and redirect accordingly
                setTimeout(async () => {
                    try {
                        const profileResponse = await fetch(`${API_BASE}/profiles/current`, {
                            headers: {
                                'Authorization': `Bearer ${data.access}`
                            }
                        });

                        if (profileResponse.ok) {
                            // Has profile, go to home
                            window.location.href = 'http://127.0.0.1:8000/newProfile/';
                        } else {
                            // No profile, go to profile creation
                            window.location.href = 'http://127.0.0.1:8000/newProfile/';
                        }
                    } catch (error) {
                        // Default to profile page
                        window.location.href = 'http://127.0.0.1:8000/newProfile/';
                    }
                }, 1000);
            } else {
                // Handle errors from API
                if (data.password === 'incorrect') {
                    showError('Incorrect password');
                } else if (data.data === 'invalid') {
                    showError('Invalid username');
                } else if (data.detail) {
                    showError(data.detail);
                } else if (data.error) {
                    showError(data.error);
                } else if (data.message) {
                    showError(data.message);
                } else {
                    showError('Login failed. Please check your credentials.');
                }
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        } catch (error) {
            console.error('Login error:', error);
            
            // More specific error messages
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                showError('Cannot connect to server. Make sure Django is running on port 8000.');
            } else {
                showError('Network error. Please check your connection and try again.');
            }
            
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
        const submitBtn = document.querySelector('.login-button');
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
        const submitBtn = document.querySelector('.login-button');
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

})();