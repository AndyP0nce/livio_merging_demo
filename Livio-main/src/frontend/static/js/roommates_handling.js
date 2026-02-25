/* =================================================================
   ROOMMATES PAGE - JAVASCRIPT
   Connected to Django Backend API
   ================================================================= */

(function() {
  'use strict';

  // =================================================================
  // API CONFIGURATION
  // =================================================================
  const API_BASE_URL = "http://127.0.0.1:8000";
  const ENDPOINTS = {
    pagination: `${API_BASE_URL}/roommate/`,
    current: `${API_BASE_URL}/roommate/current`,
    create: `${API_BASE_URL}/roommate/create/`,
    update: `${API_BASE_URL}/roommate/update/`,
    interested: `${API_BASE_URL}/roommate/current/interested`,
    addInterested: `${API_BASE_URL}/roommate/current/interested/add`,
    tokenRefresh: `${API_BASE_URL}/api/token/refresh/`,
  };

  const PAGE_LIMIT = 10;
  const SLIDER_MIN = 0;
  const SLIDER_MAX = 10000;
  const SLIDER_GAP = 100;

  // =================================================================
  // STATE
  // =================================================================
  let profiles = [];
  let currentCursor = null;
  let isLoading = false;
  let hasMoreData = true;
  let uploadedImageFile = null;

  // =================================================================
  // AUTH HELPERS
  // =================================================================
  
  function debugStorage() {
    console.log('=== STORAGE DEBUG ===');
    console.log('localStorage keys:', Object.keys(localStorage));
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key);
      if (val) console.log(`  ${key}:`, val.substring(0, 60) + (val.length > 60 ? '...' : ''));
    }
    console.log('=====================');
  }

  function getAccessToken() {
    const keys = ['access_token', 'accessToken', 'access', 'token', 'jwt', 'auth_token'];
    for (const key of keys) {
      const token = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (token) {
        console.log(`Found token in: ${key}`);
        return token;
      }
    }
    console.warn('No access token found');
    return null;
  }

  function getRefreshToken() {
    const keys = ['refresh_token', 'refreshToken', 'refresh'];
    for (const key of keys) {
      const token = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (token) return token;
    }
    return null;
  }

  function getAuthHeaders() {
    const token = getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await fetch(ENDPOINTS.tokenRefresh, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) throw new Error('Refresh failed');

      const data = await response.json();
      localStorage.setItem('access_token', data.access);
      console.log('Token refreshed successfully');
      return data.access;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  async function authFetch(url, options = {}) {
    console.log(`API: ${options.method || 'GET'} ${url}`);
    
    let response = await fetch(url, {
      ...options,
      headers: { ...getAuthHeaders(), ...options.headers },
    });

    if (response.status === 401) {
      console.log('Token expired, refreshing...');
      const newToken = await refreshAccessToken();
      if (newToken) {
        response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newToken}`,
            ...options.headers,
          },
        });
      }
    }

    return response;
  }

  // =================================================================
  // API FUNCTIONS
  // =================================================================

  async function fetchRoommatePosts(cursor = null) {
    if (isLoading || !hasMoreData) return;
    
    isLoading = true;
    showLoadingIndicator();

    try {
      let url = `${ENDPOINTS.pagination}?limit=${PAGE_LIMIT}`;
      if (cursor) url += `&cursor=${cursor}`;

      console.log('Fetching:', url);
      const response = await authFetch(url, { method: 'GET' });

      if (!response.ok) {
        const text = await response.text();
        console.error(`Error ${response.status}:`, text);
        if (response.status === 401) {
          showError('Please log in to view roommate posts.');
        } else {
          showError(`Failed to load posts (Error ${response.status})`);
        }
        return [];
      }

      const result = await response.json();
      console.log('Response:', result);
      
      const newProfiles = result.data || [];
      currentCursor = result.cursor;

      if (newProfiles.length < PAGE_LIMIT || !result.cursor) {
        hasMoreData = false;
      }

      profiles = [...profiles, ...newProfiles];
      console.log(`Loaded ${profiles.length} total profiles`);
      
      return newProfiles;
    } catch (error) {
      console.error('Fetch error:', error);
      showError('Network error. Please try again.');
      return [];
    } finally {
      isLoading = false;
      hideLoadingIndicator();
    }
  }

  async function createRoommatePost(postData) {
    console.log('Creating post:', postData);
    
    const response = await authFetch(ENDPOINTS.create, {
      method: 'POST',
      body: JSON.stringify(postData),
    });

    const text = await response.text();
    console.log(`Create response (${response.status}):`, text);

    if (!response.ok) {
      let msg = `Error ${response.status}`;
      try {
        const err = JSON.parse(text);
        msg = err.detail || err.message || JSON.stringify(err);
      } catch { msg = text || msg; }
      throw new Error(msg);
    }

    return JSON.parse(text);
  }

  async function addToInterested(profileId) {
    const response = await authFetch(ENDPOINTS.addInterested, {
      method: 'POST',
      body: JSON.stringify({ id: profileId }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  // =================================================================
  // UI HELPERS
  // =================================================================

  function showLoadingIndicator() {
    const grid = document.getElementById('rmGrid');
    if (!grid) return;
    let loader = document.getElementById('rmLoader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'rmLoader';
      loader.style.cssText = 'grid-column:1/-1;text-align:center;padding:40px;color:#4ade80;';
      loader.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
      grid.appendChild(loader);
    }
  }

  function hideLoadingIndicator() {
    document.getElementById('rmLoader')?.remove();
  }

  function showError(message) {
    const grid = document.getElementById('rmGrid');
    if (!grid) return;
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:rgba(255,255,255,0.7);">
        <i class="fa-solid fa-exclamation-circle" style="font-size:3rem;color:#ff6b6b;margin-bottom:16px;display:block;"></i>
        <p style="margin:0;font-size:1.1rem;">${message}</p>
        <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:white;border-radius:8px;cursor:pointer;">
          <i class="fa-solid fa-refresh"></i> Retry
        </button>
      </div>`;
  }

  // =================================================================
  // DROPDOWN TOGGLE
  // =================================================================
  window.toggleRmDropdown = function(id) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;
    
    document.querySelectorAll('.rm-dropdown').forEach(d => {
      if (d.id !== id) {
        d.classList.remove('active');
        d.querySelector('.rm-dropdown-content')?.classList.remove('show');
      }
    });
    
    dropdown.classList.toggle('active');
    dropdown.querySelector('.rm-dropdown-content')?.classList.toggle('show');
  };

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.rm-dropdown')) {
      document.querySelectorAll('.rm-dropdown').forEach(d => {
        d.classList.remove('active');
        d.querySelector('.rm-dropdown-content')?.classList.remove('show');
      });
    }
  });

  // =================================================================
  // DUAL THUMB SLIDER
  // =================================================================
  function initSlider() {
    const sliderMin = document.getElementById('rmSliderMin');
    const sliderMax = document.getElementById('rmSliderMax');
    const inputMin = document.getElementById('rmBudgetMin');
    const inputMax = document.getElementById('rmBudgetMax');
    const minVal = document.getElementById('rmMinVal');
    const maxVal = document.getElementById('rmMaxVal');
    const range = document.getElementById('rmSliderRange');

    if (!sliderMin || !sliderMax) return;

    function updateRange() {
      const min = parseInt(sliderMin.value);
      const max = parseInt(sliderMax.value);
      const minP = (min / SLIDER_MAX) * 100;
      const maxP = (max / SLIDER_MAX) * 100;
      
      if (range) {
        range.style.left = minP + '%';
        range.style.width = (maxP - minP) + '%';
      }
      if (minVal) minVal.textContent = min;
      if (maxVal) maxVal.textContent = max;
      if (inputMin) inputMin.value = min;
      if (inputMax) inputMax.value = max;
    }

    sliderMin.addEventListener('input', function() {
      let min = parseInt(this.value);
      let max = parseInt(sliderMax.value);
      if (min >= max - SLIDER_GAP) {
        min = max - SLIDER_GAP;
        this.value = min;
      }
      updateRange();
      debouncedRender();
    });

    sliderMax.addEventListener('input', function() {
      let min = parseInt(sliderMin.value);
      let max = parseInt(this.value);
      if (max <= min + SLIDER_GAP) {
        max = min + SLIDER_GAP;
        this.value = max;
      }
      updateRange();
      debouncedRender();
    });

    updateRange();
  }

  // =================================================================
  // IMAGE UPLOAD DROPZONE
  // =================================================================
  function initDropzone() {
    const dropzone = document.getElementById('rmDropzone');
    const fileInput = document.getElementById('rmImageUpload');
    const preview = document.getElementById('rmImagePreview');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) handleFile(fileInput.files[0]);
    });

    function handleFile(file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }
      uploadedImageFile = file;
      const reader = new FileReader();
      reader.onload = e => {
        if (preview) {
          preview.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:200px;border-radius:8px;">`;
          preview.style.display = 'block';
          dropzone.style.display = 'none';
        }
      };
      reader.readAsDataURL(file);
    }
  }

  window.rmRemoveImage = function() {
    uploadedImageFile = null;
    const preview = document.getElementById('rmImagePreview');
    const dropzone = document.getElementById('rmDropzone');
    const fileInput = document.getElementById('rmImageUpload');
    if (preview) { preview.innerHTML = ''; preview.style.display = 'none'; }
    if (dropzone) dropzone.style.display = 'flex';
    if (fileInput) fileInput.value = '';
  };

  // =================================================================
  // FORM HANDLING
  // =================================================================
  function initForm() {
    const form = document.getElementById('rmPostForm');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn?.innerHTML;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting...';
      }

      try {
        // Get form values
        const name = document.getElementById('fName')?.value || '';
        const bio = document.getElementById('fBio')?.value || '';
        const budgetMin = parseInt(document.getElementById('fBudgetMin')?.value) || 0;
        const budgetMax = parseInt(document.getElementById('fBudgetMax')?.value) || 0;
        const moveIn = document.getElementById('fMoveIn')?.value || '';
        
        // Get selected lifestyle features
        const features = [];
        document.querySelectorAll('#rmPostForm input[type="checkbox"]:checked').forEach(cb => {
          // Convert to backend format: "Pet-friendly" -> "pet-friendly"
          features.push(cb.value.toLowerCase().replace(/\s+/g, '-'));
        });

        // Build post data matching your serializer
        const postData = {
          title: `${name}'s Roommate Post`,
          description: bio,
          budget: budgetMax || budgetMin || 1000,  // Use max, or min, or default
          funFact: bio,  // Using bio as funFact
          moveInDate: moveIn,
          features: features,
        };

        console.log('Submitting:', postData);
        await createRoommatePost(postData);
        
        // Success
        closeRmModal();
        form.reset();
        
        // Refresh the list
        profiles = [];
        currentCursor = null;
        hasMoreData = true;
        await fetchRoommatePosts();
        render();
        
        alert('Your roommate post has been created!');
      } catch (error) {
        console.error('Submit error:', error);
        alert('Failed to create post: ' + error.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    });
  }

  // =================================================================
  // MODAL CONTROL
  // =================================================================
  window.openRmModal = function() {
    document.getElementById('rmModal')?.classList.add('show');
    document.body.style.overflow = 'hidden';
  };

  window.closeRmModal = function() {
    document.getElementById('rmModal')?.classList.remove('show');
    document.body.style.overflow = '';
  };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeRmModal();
  });

  // =================================================================
  // CLEAR FILTERS
  // =================================================================
  window.clearRmFilters = function() {
    const sliderMin = document.getElementById('rmSliderMin');
    const sliderMax = document.getElementById('rmSliderMax');
    const genderRadios = document.querySelectorAll('input[name="gender"]');
    const lifestyleCheckboxes = document.querySelectorAll('.rm-checkbox-group input[type="checkbox"]');
    const moveInInput = document.getElementById('rmMoveInFilter');
    const sortSelect = document.getElementById('rmSortSelect');

    if (sliderMin) sliderMin.value = SLIDER_MIN;
    if (sliderMax) sliderMax.value = SLIDER_MAX;
    
    genderRadios.forEach(r => { r.checked = r.value === 'any'; });
    lifestyleCheckboxes.forEach(cb => { cb.checked = false; });
    
    if (moveInInput) moveInInput.value = '';
    if (sortSelect) sortSelect.value = 'recent';
    
    initSlider();
    render();
  };

  // =================================================================
  // FILTERING & SORTING
  // =================================================================
  function getFilteredProfiles() {
    let filtered = [...profiles];

    // Budget filter
    const minBudget = parseInt(document.getElementById('rmBudgetMin')?.value) || 0;
    const maxBudget = parseInt(document.getElementById('rmBudgetMax')?.value) || SLIDER_MAX;
    filtered = filtered.filter(p => {
      const budget = p.budget || 0;
      return budget >= minBudget && budget <= maxBudget;
    });

    // Gender filter
    const genderRadio = document.querySelector('input[name="gender"]:checked');
    const selectedGender = genderRadio?.value || 'any';
    if (selectedGender !== 'any') {
      filtered = filtered.filter(p => {
        const profileGender = p.profile?.gender?.name?.toLowerCase() || '';
        return profileGender === selectedGender.toLowerCase();
      });
    }

    // Move-in date filter
    const moveInFilter = document.getElementById('rmMoveInFilter')?.value;
    if (moveInFilter) {
      const filterDate = new Date(moveInFilter);
      filtered = filtered.filter(p => {
        if (!p.moveInDate) return true;
        return new Date(p.moveInDate) <= filterDate;
      });
    }

    // Lifestyle filters
    const selectedLifestyles = [];
    document.querySelectorAll('.rm-checkbox-group input[type="checkbox"]:checked').forEach(cb => {
      selectedLifestyles.push(cb.value.toLowerCase().replace(/\s+/g, '-'));
    });
    if (selectedLifestyles.length > 0) {
      filtered = filtered.filter(p => {
        const postFeatures = (p.features || []).map(f => 
          (f.name || f).toLowerCase().replace(/\s+/g, '-')
        );
        return selectedLifestyles.some(lf => postFeatures.includes(lf));
      });
    }

    // Sorting
    const sortVal = document.getElementById('rmSortSelect')?.value || 'recent';
    switch (sortVal) {
      case 'budgetLow':
        filtered.sort((a, b) => (a.budget || 0) - (b.budget || 0));
        break;
      case 'budgetHigh':
        filtered.sort((a, b) => (b.budget || 0) - (a.budget || 0));
        break;
      case 'moveIn':
        filtered.sort((a, b) => new Date(a.moveInDate || 0) - new Date(b.moveInDate || 0));
        break;
      case 'recent':
      default:
        // Already in order from API
        break;
    }

    return filtered;
  }

  // =================================================================
  // RENDER
  // =================================================================
  function render() {
    const grid = document.getElementById('rmGrid');
    if (!grid) return;

    const filtered = getFilteredProfiles();
    
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="rm-no-results" style="grid-column:1/-1;text-align:center;padding:60px 20px;color:rgba(255,255,255,0.7);">
          <i class="fa-solid fa-users-slash" style="font-size:3rem;margin-bottom:16px;display:block;opacity:0.5;"></i>
          <p style="margin:0;font-size:1.1rem;">No roommates match your filters</p>
        </div>`;
      return;
    }

    grid.innerHTML = filtered.map(p => renderCard(p)).join('');
  }

  function renderCard(profile) {
    const name = profile.profile?.firstName || 'Anonymous';
    const lastName = profile.profile?.lastName || '';
    const fullName = `${name} ${lastName}`.trim();
    const age = profile.profile?.age || '';
    const gender = profile.profile?.gender?.name || '';
    const budget = profile.budget || 0;
    const moveIn = profile.moveInDate || '';
    const bio = profile.description || profile.funFact || '';
    const features = profile.features || [];
    const profileId = profile.profile?.id;
    const interested = profile.numberOfPeopleInterested || 0;
    
    // Avatar
    const avatarUrl = profile.profile?.profilePicture || 
      `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=4ade80&color=fff&size=120`;

    // Format move-in date
    let moveInDisplay = '';
    if (moveIn) {
      const d = new Date(moveIn);
      moveInDisplay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // Feature tags
    const featureTags = features.slice(0, 4).map(f => 
      `<span class="rm-card-tag">${f.name || f}</span>`
    ).join('');

    return `
      <div class="rm-card">
        <div class="rm-card-header">
          <img src="${avatarUrl}" alt="${fullName}" class="rm-card-avatar">
          <div class="rm-card-info">
            <h3 class="rm-card-name">${fullName}${age ? `, ${age}` : ''}</h3>
            <p class="rm-card-gender">${gender}</p>
          </div>
          ${interested > 0 ? `<span class="rm-card-interested" title="${interested} people interested"><i class="fa-solid fa-heart"></i> ${interested}</span>` : ''}
        </div>
        <div class="rm-card-body">
          <div class="rm-card-details">
            <span class="rm-card-budget"><i class="fa-solid fa-dollar-sign"></i> $${budget}/mo</span>
            ${moveInDisplay ? `<span class="rm-card-movein"><i class="fa-solid fa-calendar"></i> ${moveInDisplay}</span>` : ''}
          </div>
          <div class="rm-card-tags">${featureTags}</div>
          <p class="rm-card-bio">${bio.length > 120 ? bio.substring(0, 120) + '...' : bio}</p>
        </div>
        <div class="rm-card-footer">
          <button class="rm-btn rm-btn-outline" onclick="alert('Contact feature coming soon!')">
            <i class="fa-solid fa-message"></i> Contact
          </button>
          <button class="rm-btn rm-btn-primary" onclick="handleSave(${profileId})">
            <i class="fa-solid fa-bookmark"></i> Save
          </button>
        </div>
      </div>`;
  }

  window.handleSave = async function(profileId) {
    if (!profileId) return;
    try {
      await addToInterested(profileId);
      alert('Saved to your interested list!');
    } catch (error) {
      alert('Failed to save: ' + error.message);
    }
  };

  // =================================================================
  // AUTO FILTER & DEBOUNCE
  // =================================================================
  let debounceTimer;
  function debouncedRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(render, 300);
  }

  function initAutoFilter() {
    // Gender radios
    document.querySelectorAll('input[name="gender"]').forEach(r => {
      r.addEventListener('change', debouncedRender);
    });

    // Lifestyle checkboxes
    document.querySelectorAll('.rm-checkbox-group input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', debouncedRender);
    });

    // Move-in date
    document.getElementById('rmMoveInFilter')?.addEventListener('change', debouncedRender);

    // Sort select
    document.getElementById('rmSortSelect')?.addEventListener('change', render);
  }

  // =================================================================
  // INFINITE SCROLL
  // =================================================================
  function initInfiniteScroll() {
    window.addEventListener('scroll', async () => {
      if (isLoading || !hasMoreData) return;
      
      const scrollPos = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 500;
      
      if (scrollPos >= threshold) {
        await fetchRoommatePosts(currentCursor);
        render();
      }
    });
  }

  // =================================================================
  // INITIALIZATION
  // =================================================================
  document.addEventListener('DOMContentLoaded', async function() {
    console.log('Roommates page initializing...');
    debugStorage();

    initSlider();
    initDropzone();
    initForm();
    initAutoFilter();
    initInfiniteScroll();

    await fetchRoommatePosts();
    render();
    
    console.log('Roommates page ready');
  });

})();