// =================================================================
// ROOMMATES PAGE - JAVASCRIPT
// Fully self-contained with prefixed functions
// =================================================================

(function() {
  'use strict';

  // Constants
  const STORE_KEY = "livio_roommates_v3";
  const SLIDER_MIN = 0;
  const SLIDER_MAX = 10000;
  const SLIDER_GAP = 100;

  // Seed data
  const SEED = [
    {
      id: crypto.randomUUID(),
      name: "Aisha K.",
      age: 21,
      school: "CSUN",
      gender: "Female",
      city: "Northridge, CA",
      moveIn: addDays(14),
      budgetMin: 800,
      budgetMax: 1200,
      budgetType: "per",
      bio: "Film major, quiet, prefers clean shared spaces. Looking for cat-friendly roommates near campus.",
      lifestyle: ["Student", "Quiet", "Pet-friendly", "Early bird"],
      contact: "aisha@example.com",
      avatar: null,
    },
    {
      id: crypto.randomUUID(),
      name: "Leo M.",
      age: 24,
      school: "Software Intern",
      gender: "Male",
      city: "Van Nuys, CA",
      moveIn: addDays(30),
      budgetMin: 900,
      budgetMax: 1400,
      budgetType: "per",
      bio: "Gym after 7pm, night owl coder. I cook 2–3x/week, no smoking.",
      lifestyle: ["Gym", "No-smoking", "Night owl"],
      contact: "(818) 555-0111",
      avatar: null,
    },
    {
      id: crypto.randomUUID(),
      name: "Sam T.",
      age: 22,
      school: "CSUN",
      gender: "Other",
      city: "Reseda, CA",
      moveIn: addDays(7),
      budgetMin: 700,
      budgetMax: 1100,
      budgetType: "per",
      bio: "Studio art student. I'm tidy, chill, and love weekend hikes.",
      lifestyle: ["Student", "Quiet", "Vegetarian"],
      contact: "sam@example.com",
      avatar: null,
    },
    {
      id: crypto.randomUUID(),
      name: "Jordan W.",
      age: 23,
      school: "UCLA",
      gender: "Male",
      city: "Westwood, CA",
      moveIn: addDays(21),
      budgetMin: 1200,
      budgetMax: 1800,
      budgetType: "per",
      bio: "Grad student in engineering. Early bird, gym-goer, and clean freak.",
      lifestyle: ["Student", "Gym", "Early bird", "No-smoking"],
      contact: "jordan@example.com",
      avatar: null,
    },
    {
      id: crypto.randomUUID(),
      name: "Maya R.",
      age: 20,
      school: "CSUN",
      gender: "Female",
      city: "Northridge, CA",
      moveIn: addDays(5),
      budgetMin: 600,
      budgetMax: 900,
      budgetType: "per",
      bio: "Psychology major. I have a small dog and love cooking vegetarian meals.",
      lifestyle: ["Student", "Pet-friendly", "Vegetarian", "Night owl", "Quiet"],
      contact: "maya@example.com",
      avatar: null,
    },
  ];

  function addDays(d) {
    const dt = new Date();
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().substring(0, 10);
  }

  // Storage
  function loadProfiles() {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      localStorage.setItem(STORE_KEY, JSON.stringify(SEED));
      return SEED.slice();
    }
    try { return JSON.parse(raw); } 
    catch { return SEED.slice(); }
  }

  function saveProfiles(arr) {
    localStorage.setItem(STORE_KEY, JSON.stringify(arr));
  }

  let profiles = loadProfiles();

  // =================================================================
  // DROPDOWN TOGGLE
  // =================================================================
  window.toggleRmDropdown = function(id) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;
    
    // Close other dropdowns
    document.querySelectorAll('.rm-dropdown').forEach(d => {
      if (d.id !== id) {
        d.classList.remove('active');
        d.querySelector('.rm-dropdown-content')?.classList.remove('show');
      }
    });
    
    // Toggle current
    dropdown.classList.toggle('active');
    dropdown.querySelector('.rm-dropdown-content')?.classList.toggle('show');
  };

  // Close dropdowns on outside click
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
      
      const minPercent = (min / SLIDER_MAX) * 100;
      const maxPercent = (max / SLIDER_MAX) * 100;
      
      if (range) {
        range.style.left = minPercent + '%';
        range.style.width = (maxPercent - minPercent) + '%';
      }
      
      if (minVal) minVal.textContent = min;
      if (maxVal) maxVal.textContent = max;
      if (inputMin) inputMin.value = min;
      if (inputMax) inputMax.value = max;
    }

    // Slider min change
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

    // Slider max change
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

    // Input min change
    if (inputMin) {
      inputMin.addEventListener('input', function() {
        let val = parseInt(this.value) || 0;
        let max = parseInt(inputMax.value) || SLIDER_MAX;
        
        val = Math.max(0, Math.min(val, max - SLIDER_GAP));
        sliderMin.value = val;
        updateRange();
      });
      
      inputMin.addEventListener('blur', function() {
        let val = parseInt(this.value) || 0;
        let max = parseInt(inputMax.value) || SLIDER_MAX;
        val = Math.max(0, Math.min(val, max - SLIDER_GAP));
        this.value = val;
        sliderMin.value = val;
        updateRange();
        render();
      });
    }

    // Input max change
    if (inputMax) {
      inputMax.addEventListener('input', function() {
        let val = parseInt(this.value) || SLIDER_MAX;
        let min = parseInt(inputMin.value) || 0;
        
        val = Math.max(min + SLIDER_GAP, Math.min(val, SLIDER_MAX));
        sliderMax.value = val;
        updateRange();
      });
      
      inputMax.addEventListener('blur', function() {
        let val = parseInt(this.value) || SLIDER_MAX;
        let min = parseInt(inputMin.value) || 0;
        val = Math.max(min + SLIDER_GAP, Math.min(val, SLIDER_MAX));
        this.value = val;
        sliderMax.value = val;
        updateRange();
        render();
      });
    }

    // Initial update
    updateRange();
  }

  // =================================================================
  // DRAG & DROP IMAGE
  // =================================================================
  let uploadedImageData = null;

  function initDropzone() {
    const dropzone = document.getElementById('rmDropzone');
    const input = document.getElementById('fAvatar');
    const preview = document.getElementById('rmDropzonePreview');
    const previewImg = document.getElementById('rmPreviewImg');
    const content = document.getElementById('rmDropzoneContent');

    if (!dropzone || !input) return;

    // Drag events
    ['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    // Handle drop
    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('image/')) {
        handleImageFile(files[0]);
      }
    });

    // Handle file input change
    input.addEventListener('change', function() {
      if (this.files.length > 0) {
        handleImageFile(this.files[0]);
      }
    });

    function handleImageFile(file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        uploadedImageData = e.target.result;
        if (previewImg) previewImg.src = uploadedImageData;
        dropzone.classList.add('has-preview');
      };
      reader.readAsDataURL(file);
    }
  }

  window.removeRmImage = function() {
    uploadedImageData = null;
    const dropzone = document.getElementById('rmDropzone');
    const input = document.getElementById('fAvatar');
    const previewImg = document.getElementById('rmPreviewImg');
    
    if (dropzone) dropzone.classList.remove('has-preview');
    if (input) input.value = '';
    if (previewImg) previewImg.src = '';
  };

  // =================================================================
  // MODAL
  // =================================================================
  window.openRmModal = function() {
    const modal = document.getElementById('rmModal');
    if (modal) {
      modal.classList.add('active');
      document.body.classList.add('rm-modal-open');
    }
  };

  window.closeRmModal = function() {
    const modal = document.getElementById('rmModal');
    const form = document.getElementById('rmForm');
    if (modal) {
      modal.classList.remove('active');
      document.body.classList.remove('rm-modal-open');
    }
    if (form) form.reset();
    removeRmImage();
  };

  // Close on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeRmModal();
  });

  // =================================================================
  // FILTERING & RENDERING
  // =================================================================
  function getFilters() {
    const location = document.getElementById('rmLocation')?.value.trim().toLowerCase() || '';
    const minBudget = parseInt(document.getElementById('rmSliderMin')?.value) || 0;
    const maxBudget = parseInt(document.getElementById('rmSliderMax')?.value) || SLIDER_MAX;
    const moveIn = document.getElementById('rmMoveIn')?.value || '';
    const gender = document.querySelector('input[name="gender"]:checked')?.value || 'Any';
    const rentMode = document.querySelector('input[name="rentMode"]:checked')?.value || 'per';
    const lifestyle = Array.from(document.querySelectorAll('#lifestyleDropdown input[type="checkbox"]:checked'))
      .map(cb => cb.value);

    return { location, minBudget, maxBudget, moveIn, gender, rentMode, lifestyle };
  }

  function matchesFilters(profile, filters) {
    // Location
    if (filters.location && !(profile.city || '').toLowerCase().includes(filters.location)) {
      return false;
    }

    // Budget
    const pMin = profile.budgetMin || 0;
    const pMax = profile.budgetMax || pMin;
    
    if (filters.minBudget && pMax < filters.minBudget) return false;
    if (filters.maxBudget && pMin > filters.maxBudget) return false;

    // Move-in
    if (filters.moveIn && profile.moveIn) {
      if (new Date(profile.moveIn) > new Date(filters.moveIn)) return false;
    }

    // Gender
    if (filters.gender !== 'Any' && profile.gender !== filters.gender) {
      return false;
    }

    // Lifestyle
    if (filters.lifestyle.length > 0) {
      const pLifestyle = new Set(profile.lifestyle || []);
      for (const tag of filters.lifestyle) {
        if (!pLifestyle.has(tag)) return false;
      }
    }

    return true;
  }

  function sortProfiles(arr, mode) {
    const sorted = arr.slice();
    switch (mode) {
      case 'budgetLow':
        sorted.sort((a, b) => (a.budgetMin || 0) - (b.budgetMin || 0));
        break;
      case 'budgetHigh':
        sorted.sort((a, b) => (b.budgetMax || 0) - (a.budgetMax || 0));
        break;
      case 'moveIn':
        sorted.sort((a, b) => new Date(a.moveIn || '2100-01-01') - new Date(b.moveIn || '2100-01-01'));
        break;
      default:
        sorted.sort((a, b) => (b._ts || 0) - (a._ts || 0));
    }
    return sorted;
  }

  function renderCard(p) {
    const budget = p.budgetMin === p.budgetMax 
      ? `$${p.budgetMin}` 
      : `$${p.budgetMin || 0}–$${p.budgetMax || p.budgetMin || 0}`;
    const budgetType = p.budgetType === 'total' ? 'total' : 'per person';
    const avatar = p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=2a2a2a&color=4ade80&size=128&bold=true`;
    const moveIn = p.moveIn ? new Date(p.moveIn).toLocaleDateString() : 'Flexible';
    const tags = (p.lifestyle || []).map(t => `<span class="rm-card-tag">${t}</span>`).join('');

    return `
      <article class="rm-card" data-id="${p.id}">
        <div class="rm-card-top">
          <img class="rm-card-avatar" src="${avatar}" alt="${p.name}" loading="lazy" />
          <div class="rm-card-info">
            <h4 class="rm-card-name">${p.name}</h4>
            <div class="rm-card-meta">${p.gender || ''} ${p.age ? '• ' + p.age : ''} ${p.school ? '• ' + p.school : ''}</div>
            <div class="rm-card-meta">${p.city || ''}</div>
            <div class="rm-card-meta">Budget: ${budget} (${budgetType}) • Move-in: ${moveIn}</div>
          </div>
        </div>
        <div class="rm-card-tags">${tags}</div>
        <p class="rm-card-bio">${p.bio || ''}</p>
        <div class="rm-card-footer">
          <button class="rm-card-btn rm-card-btn-primary rm-contact-btn" type="button">Contact</button>
          <button class="rm-card-btn rm-card-btn-secondary rm-save-btn" type="button">Save</button>
        </div>
      </article>
    `;
  }

  function render() {
    const grid = document.getElementById('rmGrid');
    if (!grid) return;

    const filters = getFilters();
    const sortMode = document.getElementById('rmSort')?.value || 'recent';
    
    const enriched = profiles.map(p => ({ ...p, _ts: p._ts || Date.now() }));
    const filtered = enriched.filter(p => matchesFilters(p, filters));
    const sorted = sortProfiles(filtered, sortMode);

    if (sorted.length === 0) {
      grid.innerHTML = `
        <div class="rm-no-results">
          <i class="fa-solid fa-users-slash"></i>
          <p>No roommates match your filters</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = sorted.map(renderCard).join('');
    attachCardListeners();
  }

  function attachCardListeners() {
    // Contact buttons
    document.querySelectorAll('.rm-contact-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const card = this.closest('.rm-card');
        const id = card?.dataset.id;
        const profile = profiles.find(p => p.id === id);
        
        if (profile?.contact) {
          if (profile.contact.includes('@')) {
            window.location.href = `mailto:${profile.contact}`;
          } else {
            window.location.href = `tel:${profile.contact.replace(/[^+\d]/g, '')}`;
          }
        } else {
          alert('No contact information available.');
        }
      });
    });

    // Save buttons
    document.querySelectorAll('.rm-save-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const isSaved = this.classList.contains('rm-card-btn-saved');
        
        if (isSaved) {
          this.classList.remove('rm-card-btn-saved');
          this.textContent = 'Save';
        } else {
          this.classList.add('rm-card-btn-saved');
          this.textContent = 'Saved ✓';
        }
      });
    });
  }

  // Debounced render
  let renderTimeout;
  function debouncedRender() {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(render, 150);
  }

  // =================================================================
  // CLEAR FILTERS
  // =================================================================
  window.clearRmFilters = function() {
    // Location
    const location = document.getElementById('rmLocation');
    if (location) location.value = '';

    // Sliders
    const sliderMin = document.getElementById('rmSliderMin');
    const sliderMax = document.getElementById('rmSliderMax');
    const inputMin = document.getElementById('rmBudgetMin');
    const inputMax = document.getElementById('rmBudgetMax');
    
    if (sliderMin) sliderMin.value = 0;
    if (sliderMax) sliderMax.value = SLIDER_MAX;
    if (inputMin) inputMin.value = 0;
    if (inputMax) inputMax.value = SLIDER_MAX;

    // Update range display
    const minVal = document.getElementById('rmMinVal');
    const maxVal = document.getElementById('rmMaxVal');
    const range = document.getElementById('rmSliderRange');
    
    if (minVal) minVal.textContent = '0';
    if (maxVal) maxVal.textContent = SLIDER_MAX;
    if (range) {
      range.style.left = '0%';
      range.style.width = '100%';
    }

    // Move-in
    const moveIn = document.getElementById('rmMoveIn');
    if (moveIn) moveIn.value = '';

    // Gender
    const anyGender = document.querySelector('input[name="gender"][value="Any"]');
    if (anyGender) anyGender.checked = true;

    // Rent mode
    const perRent = document.querySelector('input[name="rentMode"][value="per"]');
    if (perRent) perRent.checked = true;

    // Lifestyle
    document.querySelectorAll('#lifestyleDropdown input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });

    // Sort
    const sort = document.getElementById('rmSort');
    if (sort) sort.value = 'recent';

    render();
  };

  // =================================================================
  // FORM SUBMISSION
  // =================================================================
  function initForm() {
    const form = document.getElementById('rmForm');
    if (!form) return;

    form.addEventListener('submit', function(e) {
      e.preventDefault();

      const name = document.getElementById('fName')?.value.trim();
      const bio = document.getElementById('fBio')?.value.trim();

      if (!name || !bio) {
        alert('Please fill in your name and bio.');
        return;
      }

      const lifestyle = Array.from(document.querySelectorAll('#rmForm .rm-form-checkboxes input:checked'))
        .map(cb => cb.value);

      const newProfile = {
        id: crypto.randomUUID(),
        _ts: Date.now(),
        name: name,
        age: parseInt(document.getElementById('fAge')?.value) || null,
        school: document.getElementById('fSchool')?.value.trim() || '',
        gender: document.getElementById('fGender')?.value || 'Prefer not to say',
        city: document.getElementById('fCity')?.value.trim() || '',
        moveIn: document.getElementById('fMoveIn')?.value || null,
        budgetMin: parseInt(document.getElementById('fBudgetMin')?.value) || 0,
        budgetMax: parseInt(document.getElementById('fBudgetMax')?.value) || 0,
        budgetType: document.getElementById('fBudgetType')?.value || 'per',
        bio: bio,
        lifestyle: lifestyle,
        contact: document.getElementById('fContact')?.value.trim() || '',
        avatar: uploadedImageData
      };

      profiles.unshift(newProfile);
      saveProfiles(profiles);
      closeRmModal();
      render();

      // Success feedback
      const postBtn = document.querySelector('.rm-post-btn');
      if (postBtn) {
        const originalHTML = postBtn.innerHTML;
        postBtn.innerHTML = '<i class="fa-solid fa-check"></i> Posted!';
        postBtn.style.borderColor = 'rgba(74, 222, 128, 0.8)';
        postBtn.style.color = '#4ade80';
        
        setTimeout(() => {
          postBtn.innerHTML = originalHTML;
          postBtn.style.borderColor = '';
          postBtn.style.color = '';
        }, 2000);
      }
    });
  }

  // =================================================================
  // AUTO-FILTER ON CHANGE
  // =================================================================
  function initAutoFilter() {
    // Location input
    const location = document.getElementById('rmLocation');
    if (location) {
      location.addEventListener('input', debouncedRender);
    }

    // Move-in
    const moveIn = document.getElementById('rmMoveIn');
    if (moveIn) {
      moveIn.addEventListener('change', render);
    }

    // Gender radios
    document.querySelectorAll('input[name="gender"]').forEach(radio => {
      radio.addEventListener('change', render);
    });

    // Rent mode
    document.querySelectorAll('input[name="rentMode"]').forEach(radio => {
      radio.addEventListener('change', render);
    });

    // Lifestyle checkboxes
    document.querySelectorAll('#lifestyleDropdown input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', render);
    });

    // Sort
    const sort = document.getElementById('rmSort');
    if (sort) {
      sort.addEventListener('change', render);
    }
  }

  // =================================================================
  // INITIALIZATION
  // =================================================================
  document.addEventListener('DOMContentLoaded', function() {
    initSlider();
    initDropzone();
    initForm();
    initAutoFilter();
    render();
  });

})();