// =================================================================
// PROFILE PAGE - JAVASCRIPT
// Handles profile CRUD, roommate post creation, and authentication
// =================================================================

(async function () {
  "use strict";

  // API Base URL
  const API_BASE = "http://127.0.0.1:8000";

  // =================================================================
  // TOKEN MANAGEMENT
  // =================================================================
  function getAccessToken() {
    return localStorage.getItem("access_token");
  }

  function getRefreshToken() {
    return localStorage.getItem("refresh_token");
  }

  function setTokens(access, refresh) {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  }

  function clearTokens() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_data");
  }

  function isLoggedIn() {
    return !!getAccessToken();
  }

  // Refresh token if expired
  async function refreshAccessToken() {
    const refresh = getRefreshToken();
    if (!refresh) return false;

    try {
      const response = await fetch(`${API_BASE}/api/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refresh }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("access_token", data.access);
        return true;
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
    }
    return false;
  }

  // Make authenticated API request
  async function apiRequest(url, options = {}) {
    const token = getAccessToken();

    if (!token) {
      window.location.href = "/login/";
      return null;
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    };

    try {
      let response = await fetch(url, { ...options, headers });

      // If unauthorized, try refreshing token
      if (response.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          headers["Authorization"] = `Bearer ${getAccessToken()}`;
          response = await fetch(url, { ...options, headers });
        } else {
          clearTokens();
          window.location.href = "/login/";
          return null;
        }
      }

      return response;
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  // =================================================================
  // UI HELPERS
  // =================================================================
  function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  function setLoading(element, loading) {
    if (loading) {
      element.classList.add("loading");
      element.disabled = true;
    } else {
      element.classList.remove("loading");
      element.disabled = false;
    }
  }

  // =================================================================
  // PROFILE DATA MANAGEMENT
  // =================================================================
  let currentProfile = null;
  let hasProfile = false;
  let isEditing = false;

  async function loadProfile() {
    try {
      const response = await apiRequest(`${API_BASE}/profiles/current`);

      if (response && response.ok) {
        currentProfile = await response.json();
        hasProfile = true;
        displayProfile(currentProfile);
        displayProfile(currentProfile);
        updateUIForExistingProfile();
        loadAccountInfo(); // Update account info with data from API
      } else if (response && response.status === 404) {
        // No profile exists yet
        hasProfile = false;
        enableProfileCreation();
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      // Assume no profile, enable creation mode
      enableProfileCreation();
    }
  }

  function displayProfile(profile) {
    // Update header
    document.getElementById(
      "profileDisplayName"
    ).textContent = `${profile.firstName} ${profile.lastName}`;
    document.getElementById(
      "profileTagline"
    ).textContent = `${profile.gradeLevel} • ${profile.nationality}`;

    // Update avatar
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      profile.firstName + " " + profile.lastName
    )}&background=2a2a2a&color=4ade80&size=200&bold=true`;
    document.getElementById("profileAvatar").src = avatarUrl;

    // Update form fields
    document.getElementById("firstName").value = profile.firstName || "";
    document.getElementById("lastName").value = profile.lastName || "";
    document.getElementById("age").value = profile.age || "";
    document.getElementById("bio").value = profile.bio || "";

    // Set select values
    setSelectValue(
      "gender",
      profile.gender === "Male" ? "M" : profile.gender === "Female" ? "F" : ""
    );
    setSelectValue("gradeLevel", profile.gradeLevel);
    setSelectValue("nationality", profile.nationality);

    // Update roommate post button visibility
    if (profile.has_roommate_post) {
      document.getElementById("createRoommatePostBtn").style.display = "none";
      document.getElementById("viewRoommatePostBtn").style.display = "flex";
    } else {
      document.getElementById("createRoommatePostBtn").style.display = "flex";
      document.getElementById("viewRoommatePostBtn").style.display = "none";
    }
  }

  function setSelectValue(selectId, value) {
    const select = document.getElementById(selectId);
    if (!select || !value) return;

    for (let option of select.options) {
      if (option.value === value || option.textContent === value) {
        select.value = option.value;
        break;
      }
    }
  }

  function updateUIForExistingProfile() {
    // Disable form fields
    const formFields = document.querySelectorAll(
      "#profileForm input, #profileForm select, #profileForm textarea"
    );
    formFields.forEach((field) => (field.disabled = true));

    // Hide form actions
    document.getElementById("formActions").style.display = "none";

    // Show edit button
    document.getElementById("editProfileBtn").style.display = "flex";
  }

  function enableProfileCreation() {
    // Enable form fields
    const formFields = document.querySelectorAll(
      "#profileForm input, #profileForm select, #profileForm textarea"
    );
    formFields.forEach((field) => (field.disabled = false));

    // Show form actions with create button
    document.getElementById("formActions").style.display = "flex";
    document.getElementById("saveProfileBtn").innerHTML =
      '<i class="fa-solid fa-plus"></i> Create Profile';

    // Hide edit button
    document.getElementById("editProfileBtn").style.display = "none";

    // Update header
    document.getElementById("profileDisplayName").textContent = "Welcome!";
    document.getElementById("profileTagline").textContent =
      "Complete your profile to get started";

    isEditing = true;
  }

  // =================================================================
  // PROFILE EDITING
  // =================================================================
  function enableEditing() {
    isEditing = true;

    // Enable form fields
    const formFields = document.querySelectorAll(
      "#profileForm input, #profileForm select, #profileForm textarea"
    );
    formFields.forEach((field) => (field.disabled = false));

    // Show form actions
    document.getElementById("formActions").style.display = "flex";
    document.getElementById("saveProfileBtn").innerHTML =
      '<i class="fa-solid fa-save"></i> Save Changes';

    // Update edit button
    const editBtn = document.getElementById("editProfileBtn");
    editBtn.classList.add("active");
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Editing...';
  }

  function disableEditing() {
    isEditing = false;

    // Disable form fields
    const formFields = document.querySelectorAll(
      "#profileForm input, #profileForm select, #profileForm textarea"
    );
    formFields.forEach((field) => (field.disabled = true));

    // Hide form actions
    document.getElementById("formActions").style.display = "none";

    // Reset edit button
    const editBtn = document.getElementById("editProfileBtn");
    editBtn.classList.remove("active");
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Edit';

    // Restore original values if cancelled
    if (currentProfile) {
      displayProfile(currentProfile);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    const saveBtn = document.getElementById("saveProfileBtn");
    setLoading(saveBtn, true);

    // Collect form data
    const formData = {
      firstName: document.getElementById("firstName").value.trim(),
      lastName: document.getElementById("lastName").value.trim(),
      age: parseInt(document.getElementById("age").value),
      gender: document.getElementById("gender").value,
      gradeLevel: document.getElementById("gradeLevel").value,
      nationality: document.getElementById("nationality").value,
      bio: document.getElementById("bio").value.trim(),
    };

    // Validate
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.age ||
      !formData.gender ||
      !formData.gradeLevel ||
      !formData.nationality ||
      !formData.bio
    ) {
      showToast("Please fill in all required fields", "error");
      setLoading(saveBtn, false);
      return;
    }

    try {
      const url = hasProfile
        ? `${API_BASE}/profiles/update`
        : `${API_BASE}/profiles/profile`;
      const method = hasProfile ? "PUT" : "POST";

      const response = await apiRequest(url, {
        method: method,
        body: JSON.stringify(formData),
      });

      if (response && response.ok) {
        const data = await response.json();
        currentProfile = data;
        hasProfile = true;

        displayProfile(currentProfile);
        disableEditing();
        updateUIForExistingProfile();

        showToast(
          hasProfile
            ? "Profile updated successfully!"
            : "Profile created successfully!",
          "success"
        );
      } else {
        const errorData = await response.json();
        showToast(errorData.message || "Failed to save profile", "error");
      }
    } catch (error) {
      console.error("Save profile error:", error);
      showToast("An error occurred. Please try again.", "error");
    }

    setLoading(saveBtn, false);
  }

  // =================================================================
  // ROOMMATE POST MANAGEMENT
  // =================================================================
  window.openRoommateModal = function () {
    if (!hasProfile) {
      showToast("Please create your profile first", "error");
      return;
    }

    document.getElementById("roommatePostModal").classList.add("active");
    document.body.classList.add("modal-open");

    // Pre-fill move-in date with 2 weeks from now
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
    document.getElementById("postMoveIn").value = twoWeeksLater
      .toISOString()
      .split("T")[0];
  };

  window.closeRoommateModal = function () {
    document.getElementById("roommatePostModal").classList.remove("active");
    document.body.classList.remove("modal-open");
    document.getElementById("roommatePostForm").reset();
  };

  async function createRoommatePost(event) {
    event.preventDefault();

    const submitBtn = event.target.querySelector('button[type="submit"]');
    setLoading(submitBtn, true);

    // Collect selected features
    const features = Array.from(
      document.querySelectorAll(
        '#roommatePostForm input[name="features"]:checked'
      )
    ).map((cb) => cb.value);

    const postData = {
      title: document.getElementById("postTitle").value.trim(),
      description: document.getElementById("postDescription").value.trim(),
      budget: parseFloat(document.getElementById("postBudget").value),
      moveInDate: document.getElementById("postMoveIn").value,
      funFact: document.getElementById("postFunFact").value.trim(),
      features: features,
    };

    // Validate
    if (
      !postData.title ||
      !postData.description ||
      !postData.budget ||
      !postData.moveInDate ||
      !postData.funFact
    ) {
      showToast("Please fill in all required fields", "error");
      setLoading(submitBtn, false);
      return;
    }

    try {
      const response = await apiRequest(`${API_BASE}/roommates/create/`, {
        method: "POST",
        body: JSON.stringify(postData),
      });

      if (response && response.ok) {
        closeRoommateModal();
        showToast("Roommate post created successfully!", "success");

        // Update UI
        document.getElementById("createRoommatePostBtn").style.display = "none";
        document.getElementById("viewRoommatePostBtn").style.display = "flex";

        // Update profile state
        if (currentProfile) {
          currentProfile.has_roommate_post = true;
        }

        // Update stats
        document.getElementById("statPosts").textContent = "1";
      } else {
        const errorData = await response.json();
        showToast(errorData.message || "Failed to create post", "error");
      }
    } catch (error) {
      console.error("Create roommate post error:", error);
      showToast("An error occurred. Please try again.", "error");
    }

    setLoading(submitBtn, false);
  }

  // View Roommate Post
  window.openViewRoommateModal = async function () {
    try {
      const response = await apiRequest(`${API_BASE}/roommates/current`);

      if (response && response.ok) {
        const post = await response.json();
        displayRoommatePost(post);
        document
          .getElementById("viewRoommatePostModal")
          .classList.add("active");
        document.body.classList.add("modal-open");
      } else {
        showToast("Failed to load roommate post", "error");
      }
    } catch (error) {
      console.error("Load roommate post error:", error);
      showToast("An error occurred. Please try again.", "error");
    }
  };

  window.closeViewRoommateModal = function () {
    document.getElementById("viewRoommatePostModal").classList.remove("active");
    document.body.classList.remove("modal-open");
  };

  function displayRoommatePost(post) {
    const content = document.getElementById("roommatePostContent");

    const moveInDate = new Date(post.moveInDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const features = (post.features || [])
      .map((f) => `<span class="post-tag">${f.name || f}</span>`)
      .join("");

    content.innerHTML = `
            <h4>${post.title}</h4>
            <p>${post.description}</p>
            
            <div class="post-meta">
                <div class="meta-item">
                    <div class="meta-label">Budget</div>
                    <div class="meta-value">$${post.budget}/month</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Move-in Date</div>
                    <div class="meta-value">${moveInDate}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">People Interested</div>
                    <div class="meta-value">${
                      post.numberOfPeopleInterested || 0
                    }</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Posted</div>
                    <div class="meta-value">${new Date(
                      post.originalPostDateTime
                    ).toLocaleDateString()}</div>
                </div>
            </div>
            
            <h4>Fun Fact</h4>
            <p>${post.funFact}</p>
            
            ${
              features
                ? `<h4>Lifestyle</h4><div class="post-tags">${features}</div>`
                : ""
            }
            
            <div class="modal-actions" style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 20px;">
                <button onclick="deleteRoommatePost()" class="btn btn-danger" style="width: 100%; background: #ef4444; color: white; border: none;">
                    <i class="fa-solid fa-trash"></i> Delete Post
                </button>
            </div>
        `;
  }

  // window.deleteRoommatePost = async function() {
  //     if (!confirm('Are you sure you want to delete your roommate post? This action cannot be undone.')) {
  //         return;
  //     }

  //     try {
  //         const response = await apiRequest(`${API_BASE}/roommates/delete/`, {
  //             method: 'DELETE'
  //         });

  //         if (response && response.ok) {
  //             showToast('Roommate post deleted successfully', 'success');
  //             closeViewRoommateModal();

  //             // Update UI
  //             document.getElementById('createRoommatePostBtn').style.display = 'flex';
  //             document.getElementById('viewRoommatePostBtn').style.display = 'none';

  //             // Update profile state
  //             if (currentProfile) {
  //                 currentProfile.has_roommate_post = false;
  //             }

  //             // Update stats
  //             document.getElementById('statPosts').textContent = '0';
  //         } else {
  //             showToast('Failed to delete post', 'error');
  //         }
  //     } catch (error) {
  //         console.error('Delete post error:', error);
  //         showToast('An error occurred. Please try again.', 'error');
  //     }
  // };

  // =================================================================
  // LOGOUT
  // =================================================================
  function logout() {
    clearTokens();
    showToast("Logged out successfully", "success");
    setTimeout(() => {
      window.location.href = "/login/";
    }, 1000);
  }

  // will be used to populate the dropdown menu with the nationalitys from the backend
  async function nationalityDropdown() {
    nationalityDropDown = document.getElementById("nationality");

    // get the data from the backend with the natioanlities
    const response = await fetch("http://127.0.0.1:8000/nationalities/all");

    const nationalities = await response.json(); // gets the JS object representation of the data which was returned back

    console.log("All nationaltiies", nationalities);
  }

  async function gradeLevelDropDown() {
    gradeLevelDropDown = document.getElementById("gradeLevel");

    // get the data from the backend with the grade levels

    const response = await fetch("http");
  }

  // =================================================================
  // EVENT LISTENERS & INITIALIZATION
  // =================================================================
  document.addEventListener("DOMContentLoaded", function () {
    // Check if logged in
    if (!isLoggedIn()) {
      window.location.href = "/login/";
      return;
    }

    // Load profile
    loadProfile();

    // add the options for nationality from the db into the dropdown
    nationalityDropDown();

    // Edit button
    document
      .getElementById("editProfileBtn")
      .addEventListener("click", function () {
        if (isEditing) {
          disableEditing();
        } else {
          enableEditing();
        }
      });

    // Cancel edit button
    document
      .getElementById("cancelEditBtn")
      .addEventListener("click", disableEditing);

    // Profile form submit
    document
      .getElementById("profileForm")
      .addEventListener("submit", saveProfile);

    // Create roommate post button
    document
      .getElementById("createRoommatePostBtn")
      .addEventListener("click", openRoommateModal);

    // View roommate post button
    document
      .getElementById("viewRoommatePostBtn")
      .addEventListener("click", openViewRoommateModal);

    // Roommate post form submit
    document
      .getElementById("roommatePostForm")
      .addEventListener("submit", createRoommatePost);

    // Logout button
    document.getElementById("logoutBtn").addEventListener("click", logout);

    // Avatar upload
    document
      .getElementById("avatarInput")
      .addEventListener("change", handleAvatarUpload);

    // Close modals on overlay click
    document.querySelectorAll(".profile-modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", function () {
        this.closest(".profile-modal").classList.remove("active");
        document.body.classList.remove("modal-open");
      });
    });

    // Close modals on Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        document.querySelectorAll(".profile-modal.active").forEach((modal) => {
          modal.classList.remove("active");
        });
        document.body.classList.remove("modal-open");
      }
    });

    // Load user account info
    loadAccountInfo();
  });

  // Load account info from stored data or API
  async function loadAccountInfo() {
    // Prefer data from API if available (loaded via loadProfile)
    if (currentProfile) {
      document.getElementById("accountEmail").textContent =
        currentProfile.email || "-";
      document.getElementById("accountUsername").textContent =
        currentProfile.username || "-";
      document.getElementById("accountJoinDate").textContent =
        currentProfile.joinDate || "Recently";
      return;
    }

    // Fallback to local storage
    const userData = localStorage.getItem("user_data");
    if (userData) {
      const user = JSON.parse(userData);
      document.getElementById("accountEmail").textContent = user.email || "-";
      document.getElementById("accountUsername").textContent =
        user.username || "-";
      document.getElementById("accountJoinDate").textContent =
        user.joinDate || "Recently";
    }
  }

  // Handle avatar upload
  async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById("profileAvatar").src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Get presigned URL from backend
    try {
      const response = await apiRequest(`${API_BASE}/profiles/uploadurl`, {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          expiration: 3600,
        }),
      });

      if (response && response.ok) {
        const { presignedURL } = await response.json();

        // Upload to S3
        const uploadResponse = await fetch(presignedURL, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (uploadResponse.ok) {
          showToast("Profile picture uploaded!", "success");
        } else {
          showToast("Failed to upload image", "error");
        }
      }
    } catch (error) {
      console.error("Avatar upload error:", error);
      showToast("Failed to upload image", "error");
    }
  }
})();
