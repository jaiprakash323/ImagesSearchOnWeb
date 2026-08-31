import { SAMPLE_IMAGES } from './images-data.js';

const UNSPLASH_API_KEY = 'KpaPQhBjXsaKjtiQOPZPK7Iwzcs6W3mdtH9i5gIbpNA';

// App State Management with Registered-Only Downloads & MongoDB Authentication
class ImageApp {
  constructor() {
    this.images = SAMPLE_IMAGES;
    this.selectedImageId = null;
    this.searchQuery = '';
    this.selectedCategory = 'All';
    this.activeFilter = 'all'; // 'all' | 'likes' | 'favourite'
    this.isLoading = false;
    this.theme = localStorage.getItem('img_theme') || 'modern-dark';
    
    // Auth state: check token & user
    this.authToken = localStorage.getItem('auth_token') || null;
    this.currentUser = JSON.parse(localStorage.getItem('auth_user') || 'null');
    
    // Initial view: LOGIN FIRST if not authenticated!
    this.currentView = this.authToken ? 'grid' : 'login';

    this.likes = new Set(JSON.parse(localStorage.getItem('img_likes') || '[]'));
    this.favourites = new Set(JSON.parse(localStorage.getItem('img_favs') || '[]'));

    this.initElements();
    this.initEventListeners();
    this.applyTheme(this.theme);

    if (this.authToken) {
      this.fetchUserDataFromMongoDB();
      this.loadImages();
    } else {
      this.render();
    }
  }

  // Check if current user is a fully registered MongoDB account
  isRegisteredUser() {
    return !!(this.authToken && this.currentUser && !this.currentUser.isDemo);
  }

  initElements() {
    this.appEl = document.getElementById('app');
    this.searchInput = document.getElementById('searchInput');
    this.searchClearBtn = document.getElementById('searchClearBtn');
    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.categoriesBar = document.getElementById('categoriesBar');
    this.sidebarNav = document.getElementById('sidebarNav');
    this.mainCanvas = document.getElementById('mainCanvas');
    this.toastContainer = document.getElementById('toastContainer');
    this.authModal = document.getElementById('authModal');
  }

  initEventListeners() {
    // Search input live debounce
    let searchDebounceTimeout = null;
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim();
      this.searchClearBtn.style.display = this.searchQuery ? 'flex' : 'none';

      if (!this.authToken) {
        this.showToast('Please log in first to search images');
        return;
      }

      if (this.currentView === 'detail' || this.currentView === 'login' || this.currentView === 'register') {
        this.currentView = 'grid';
      }

      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = setTimeout(() => {
        this.loadImages();
      }, 400);
    });

    // Clear search button
    this.searchClearBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.searchQuery = '';
      this.searchClearBtn.style.display = 'none';
      if (this.authToken) this.loadImages();
    });

    // Theme Toggle
    this.themeToggleBtn.addEventListener('click', () => {
      this.theme = this.theme === 'modern-dark' ? 'wireframe' : 'modern-dark';
      this.applyTheme(this.theme);
      this.showToast(`Switched to ${this.theme === 'wireframe' ? 'Wireframe Classic' : 'Obsidian Gold'} Theme`);
    });

    // Delegated sidebar button clicks
    this.sidebarNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.sidebar-pill-btn');
      if (!btn) return;

      const action = btn.dataset.action;

      if (action === 'logout') {
        this.handleLogout();
      } else if (action === 'login') {
        this.currentView = 'login';
        this.renderSidebar();
        this.renderMainContent();
      } else if (action === 'register') {
        this.currentView = 'register';
        this.renderSidebar();
        this.renderMainContent();
      } else if (action === 'likes') {
        if (!this.authToken) {
          this.showToast('Please log in to view your Likes');
          return;
        }
        this.activeFilter = this.activeFilter === 'likes' ? 'all' : 'likes';
        this.currentView = 'grid';
        this.renderSidebar();
        this.renderMainContent();
      } else if (action === 'favourite') {
        if (!this.authToken) {
          this.showToast('Please log in to view your Favourites');
          return;
        }
        this.activeFilter = this.activeFilter === 'favourite' ? 'all' : 'favourite';
        this.currentView = 'grid';
        this.renderSidebar();
        this.renderMainContent();
      } else if (action === 'back') {
        this.currentView = 'grid';
        this.renderSidebar();
        this.renderMainContent();
      }
    });

    // Delegated card & action clicks
    this.mainCanvas.addEventListener('click', (e) => {
      const likeBtn = e.target.closest('.card-action-like');
      const favBtn = e.target.closest('.card-action-fav');
      const card = e.target.closest('.image-card');
      const tagChip = e.target.closest('.detail-tag-chip');
      const colorSwatch = e.target.closest('.color-swatch');
      const detailLikeBtn = e.target.closest('.detail-btn-like');
      const detailFavBtn = e.target.closest('.detail-btn-fav');
      const detailDownloadBtn = e.target.closest('.detail-btn-download');
      const detailLockedBtn = e.target.closest('.detail-btn-locked');
      const authSwitchLink = e.target.closest('.auth-footer-link');
      const demoAccessBtn = e.target.closest('#demoAccessBtn');

      if (demoAccessBtn) {
        this.executeDemoLogin();
        return;
      }

      if (likeBtn) {
        e.stopPropagation();
        const imgId = likeBtn.dataset.id;
        this.toggleLike(imgId);
        return;
      }

      if (favBtn) {
        e.stopPropagation();
        const imgId = favBtn.dataset.id;
        this.toggleFav(imgId);
        return;
      }

      if (card && this.currentView === 'grid') {
        const imgId = card.dataset.id;
        this.openDetailView(imgId);
        return;
      }

      if (tagChip) {
        const tag = tagChip.dataset.tag;
        this.searchInput.value = tag;
        this.searchQuery = tag;
        this.searchClearBtn.style.display = 'flex';
        this.currentView = 'grid';
        this.loadImages();
        return;
      }

      if (colorSwatch) {
        const hex = colorSwatch.dataset.hex;
        navigator.clipboard.writeText(hex);
        this.showToast(`Color ${hex} copied to clipboard!`);
        return;
      }

      if (detailLikeBtn) {
        const imgId = detailLikeBtn.dataset.id;
        this.toggleLike(imgId);
        this.renderMainContent();
        return;
      }

      if (detailFavBtn) {
        const imgId = detailFavBtn.dataset.id;
        this.toggleFav(imgId);
        this.renderMainContent();
        return;
      }

      if (detailDownloadBtn) {
        const imgId = detailDownloadBtn.dataset.id;
        this.downloadImage(imgId);
        return;
      }

      if (detailLockedBtn) {
        this.showToast('🔒 Registration Required: Please register an account to download high-resolution photos!');
        this.currentView = 'register';
        this.renderSidebar();
        this.renderMainContent();
        return;
      }

      if (authSwitchLink) {
        const targetView = authSwitchLink.dataset.view;
        if (targetView) {
          this.currentView = targetView;
          this.renderSidebar();
          this.renderMainContent();
        }
      }
    });

    // Close Auth Modal
    document.getElementById('modalCloseBtn')?.addEventListener('click', () => {
      this.authModal.classList.remove('open');
    });
    document.getElementById('modalAuthActionBtn')?.addEventListener('click', () => {
      this.executeLogout();
    });
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('img_theme', theme);
    if (this.themeToggleBtn) {
      this.themeToggleBtn.innerHTML = theme === 'wireframe' 
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg> Obsidian Gold Theme`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg> Classic Warm Theme`;
    }
  }

  // UNSPLASH LIVE API FETCHING
  async loadImages() {
    if (!this.authToken) return;

    this.isLoading = true;
    this.renderMainContent();

    try {
      let query = this.searchQuery;
      if (!query && this.selectedCategory !== 'All') {
        query = this.selectedCategory;
      }

      let url = '';
      if (query) {
        url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=30&client_id=${UNSPLASH_API_KEY}`;
      } else {
        url = `https://api.unsplash.com/photos?per_page=30&order_by=popular&client_id=${UNSPLASH_API_KEY}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const rawPhotos = Array.isArray(data) ? data : (data.results || []);

        if (rawPhotos.length > 0) {
          this.images = rawPhotos.map(photo => ({
            id: photo.id,
            title: photo.alt_description || photo.description || `${photo.user.name}'s Photo`,
            category: query || 'Unsplash',
            url: photo.urls.full || photo.urls.regular,
            thumbUrl: photo.urls.small || photo.urls.thumb,
            photographer: {
              name: photo.user.name,
              handle: `@${photo.user.username}`,
              avatar: photo.user.profile_image.medium || photo.user.profile_image.small
            },
            tags: photo.tags ? photo.tags.map(t => t.title) : ['unsplash', 'photography', 'art'],
            likesCount: photo.likes || 120,
            viewsCount: (photo.likes || 100) * 14,
            downloadsCount: (photo.likes || 50) * 4,
            resolution: `${photo.width} × ${photo.height}`,
            colorPalette: [photo.color || '#F59E0B', '#111827', '#64748B', '#10B981'],
            description: photo.description || photo.alt_description || `High resolution photo taken by ${photo.user.name} on Unsplash.`
          }));
        } else {
          this.images = [];
        }
      } else {
        console.warn('Unsplash API notice:', res.statusText);
        this.images = SAMPLE_IMAGES;
      }
    } catch (err) {
      console.warn('Network error fetching Unsplash API:', err.message);
      this.images = SAMPLE_IMAGES;
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  // MongoDB User Data Sync
  async fetchUserDataFromMongoDB() {
    if (!this.authToken) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        
        if (Array.isArray(data.user.likes)) {
          this.likes = new Set(data.user.likes);
          localStorage.setItem('img_likes', JSON.stringify(data.user.likes));
        }
        if (Array.isArray(data.user.favourites)) {
          this.favourites = new Set(data.user.favourites);
          localStorage.setItem('img_favs', JSON.stringify(data.user.favourites));
        }
        this.renderSidebar();
      }
    } catch (err) {
      console.warn('MongoDB Sync Notice:', err.message);
    }
  }

  async syncUserDataToMongoDB() {
    if (!this.authToken) return;
    try {
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          likes: Array.from(this.likes),
          favourites: Array.from(this.favourites)
        })
      });
    } catch (err) {
      console.warn('Failed to sync to MongoDB:', err.message);
    }
  }

  toggleLike(id) {
    if (!this.authToken) {
      this.showToast('Please log in first to like images');
      this.currentView = 'login';
      this.render();
      return;
    }

    if (this.likes.has(id)) {
      this.likes.delete(id);
      this.showToast('Removed from Likes');
    } else {
      this.likes.add(id);
      this.showToast('Added to Likes ❤️');
    }
    localStorage.setItem('img_likes', JSON.stringify(Array.from(this.likes)));
    this.syncUserDataToMongoDB();
    this.renderSidebar();
    this.renderMainContent();
  }

  toggleFav(id) {
    if (!this.authToken) {
      this.showToast('Please log in first to save favourites');
      this.currentView = 'login';
      this.render();
      return;
    }

    if (this.favourites.has(id)) {
      this.favourites.delete(id);
      this.showToast('Removed from Favourites');
    } else {
      this.favourites.add(id);
      this.showToast('Saved to Favourites ⭐');
    }
    localStorage.setItem('img_favs', JSON.stringify(Array.from(this.favourites)));
    this.syncUserDataToMongoDB();
    this.renderSidebar();
    this.renderMainContent();
  }

  handleLogout() {
    const modalTitle = document.getElementById('modalTitle');
    const modalSubtitle = document.getElementById('modalSubtitle');
    const actionBtn = document.getElementById('modalAuthActionBtn');

    modalTitle.textContent = "Confirm Logout";
    modalSubtitle.textContent = `Are you sure you want to sign out of ${this.currentUser?.username || 'your account'}?`;
    actionBtn.textContent = "Logout";
    actionBtn.style.backgroundColor = "#ef4444";

    this.authModal.classList.add('open');
  }

  executeLogout(notify = true) {
    this.authToken = null;
    this.currentUser = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    this.authModal.classList.remove('open');
    if (notify) this.showToast('Logged out successfully');
    this.currentView = 'login'; // Return to Login Gateway!
    this.renderSidebar();
    this.renderMainContent();
  }

  executeDemoLogin() {
    const demoUser = {
      id: 'demo-user-123',
      username: 'Demo Explorer',
      email: 'demo@example.com',
      isDemo: true // Flagged as Demo
    };
    this.authToken = 'demo_access_token_123';
    this.currentUser = demoUser;
    localStorage.setItem('auth_token', this.authToken);
    localStorage.setItem('auth_user', JSON.stringify(demoUser));

    this.showToast('Signed in as Guest Demo Explorer! (Register account to download photos)');
    this.currentView = 'grid';
    this.loadImages();
  }

  // DOWNLOAD PHOTO ONLY PERMITTED FOR REGISTERED USERS!
  downloadImage(id) {
    if (!this.isRegisteredUser()) {
      this.showToast('🔒 Registration Required: Please register an account to download high-resolution photos!');
      this.currentView = 'register';
      this.renderSidebar();
      this.renderMainContent();
      return;
    }

    const img = this.images.find(i => i.id === id);
    if (!img) return;
    
    const a = document.createElement('a');
    a.href = img.url;
    a.target = '_blank';
    a.download = `${img.title.replace(/\s+/g, '_')}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    this.showToast(`Downloading high-res image: ${img.title}`);
  }

  openDetailView(id) {
    this.selectedImageId = id;
    this.currentView = 'detail';
    this.renderSidebar();
    this.renderMainContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  getFilteredImages() {
    return this.images.filter(img => {
      if (this.activeFilter === 'likes' && !this.likes.has(img.id)) {
        return false;
      }
      if (this.activeFilter === 'favourite' && !this.favourites.has(img.id)) {
        return false;
      }
      return true;
    });
  }

  renderCategories() {
    const categories = ['All', 'Nature', 'Architecture', 'Technology', 'Abstract', 'Minimalist', 'Animals', 'Food', 'Art', 'Travel'];
    this.categoriesBar.innerHTML = categories.map(cat => `
      <button class="category-chip ${this.selectedCategory === cat ? 'active' : ''}" data-cat="${cat}">
        ${cat}
      </button>
    `).join('');

    this.categoriesBar.querySelectorAll('.category-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.selectedCategory = chip.dataset.cat;
        if (!this.authToken) {
          this.showToast('Please log in first');
          this.currentView = 'login';
          this.render();
          return;
        }
        if (this.currentView !== 'detail') this.currentView = 'grid';
        this.loadImages();
      });
    });
  }

  /* RENDER SIDEBAR */
  renderSidebar() {
    const isLikesActive = this.activeFilter === 'likes';
    const isFavActive = this.activeFilter === 'favourite';
    const isLoggedIn = !!this.authToken;

    let html = '';

    if (isLoggedIn) {
      html += `
        <button class="sidebar-pill-btn" data-action="logout" title="Logged in as ${this.currentUser?.username || 'User'}">
          Logout (${this.currentUser?.username || 'User'})
        </button>
      `;
    } else {
      html += `
        <button class="sidebar-pill-btn ${this.currentView === 'login' ? 'active' : ''}" data-action="login">
          Login
        </button>
        <button class="sidebar-pill-btn ${this.currentView === 'register' ? 'active' : ''}" data-action="register">
          Register
        </button>
      `;
    }

    html += `
      <button class="sidebar-pill-btn ${isLikesActive ? 'active' : ''}" data-action="likes">
        Likes ${this.likes.size > 0 ? `<span class="badge">${this.likes.size}</span>` : ''}
      </button>
      <button class="sidebar-pill-btn ${isFavActive ? 'active' : ''}" data-action="favourite">
        Favourite ${this.favourites.size > 0 ? `<span class="badge">${this.favourites.size}</span>` : ''}
      </button>
    `;

    if (this.currentView === 'detail') {
      html += `
        <button class="sidebar-pill-btn sidebar-back-btn" data-action="back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back
        </button>
      `;
    }

    this.sidebarNav.innerHTML = html;
  }

  /* RENDER MAIN CONTENT */
  renderMainContent() {
    if (!this.authToken) {
      if (this.currentView === 'register') {
        this.renderRegisterView();
      } else {
        this.renderLoginView();
      }
      return;
    }

    if (this.isLoading) {
      this.mainCanvas.innerHTML = `
        <div class="loading-spinner-container">
          <div class="spinner"></div>
          <p>Fetching live photos from Unsplash API...</p>
        </div>
      `;
      return;
    }

    if (this.currentView === 'detail' && this.selectedImageId) {
      this.renderSingleDetailView();
    } else if (this.currentView === 'register') {
      this.renderRegisterView();
    } else if (this.currentView === 'login') {
      this.renderLoginView();
    } else {
      this.renderGridView();
    }
  }

  /* RENDER GRID VIEW */
  renderGridView() {
    const filtered = this.getFilteredImages();

    if (filtered.length === 0) {
      this.mainCanvas.innerHTML = `
        <div class="empty-state">
          <h3>No Images Found</h3>
          <p>No results match your search "${this.searchQuery}" or selected filter.</p>
          <button class="sidebar-pill-btn" style="max-width: 180px; margin: 0 auto;" id="resetFilterBtn">Reset Filters</button>
        </div>
      `;
      document.getElementById('resetFilterBtn')?.addEventListener('click', () => {
        this.searchQuery = '';
        this.selectedCategory = 'All';
        this.activeFilter = 'all';
        this.searchInput.value = '';
        this.searchClearBtn.style.display = 'none';
        this.loadImages();
      });
      return;
    }

    const cardsHtml = filtered.map(img => {
      const isLiked = this.likes.has(img.id);
      const isFav = this.favourites.has(img.id);

      return `
        <div class="image-card" data-id="${img.id}" title="${img.title}">
          <img class="image-card-img" src="${img.thumbUrl}" alt="${img.title}" loading="lazy" />
          
          <div class="image-card-overlay">
            <div class="card-top-actions">
              <button class="card-action-btn card-action-like ${isLiked ? 'liked' : ''}" data-id="${img.id}" title="Like">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
              </button>
              <button class="card-action-btn card-action-fav ${isFav ? 'favourited' : ''}" data-id="${img.id}" title="Favourite">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              </button>
            </div>

            <div class="card-bottom-info">
              <div class="card-title">${img.title}</div>
              <div class="card-meta">
                <span>by ${img.photographer.name}</span>
                <span>❤️ ${img.likesCount + (isLiked ? 1 : 0)}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.mainCanvas.innerHTML = `
      <div class="api-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        Powered by Unsplash API Live Feed
      </div>
      <div class="image-grid-container">
        ${cardsHtml}
      </div>
    `;
  }

  /* RENDER SINGLE DETAIL VIEW (DOWNLOAD OPTION EXCLUSIVELY FOR REGISTERED USERS) */
  renderSingleDetailView() {
    const img = this.images.find(i => i.id === this.selectedImageId);
    if (!img) return;

    const isLiked = this.likes.has(img.id);
    const isFav = this.favourites.has(img.id);
    const isRegistered = this.isRegisteredUser();

    this.mainCanvas.innerHTML = `
      <div class="single-detail-view">
        <div class="detail-main-stage">
          <img class="detail-stage-img" src="${img.url}" alt="${img.title}" />

          <div class="detail-toolbar">
            <div class="detail-toolbar-left">
              <img class="photographer-avatar" src="${img.photographer.avatar}" alt="${img.photographer.name}" />
              <div>
                <div class="photographer-name">${img.photographer.name}</div>
                <div class="photographer-handle">${img.photographer.handle}</div>
              </div>
            </div>

            <div class="detail-toolbar-right">
              <button class="detail-btn detail-btn-like ${isLiked ? 'liked' : ''}" data-id="${img.id}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                ${isLiked ? 'Liked' : 'Like'} (${img.likesCount + (isLiked ? 1 : 0)})
              </button>

              <button class="detail-btn detail-btn-fav ${isFav ? 'favourited' : ''}" data-id="${img.id}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                ${isFav ? 'Favourited' : 'Favourite'}
              </button>

              ${isRegistered ? `
                <button class="detail-btn detail-btn-primary detail-btn-download" data-id="${img.id}">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  Download High-Res
                </button>
              ` : `
                <button class="detail-btn detail-btn-locked" title="Register an account to enable photo downloading">
                  🔒 Register to Download
                </button>
              `}
            </div>
          </div>
        </div>

        <div class="detail-info-panel">
          <div>
            <h2 class="detail-title">${img.title}</h2>
            <p class="detail-description">${img.description}</p>
            
            <div class="detail-tags-list">
              ${img.tags.map(tag => `<span class="detail-tag-chip" data-tag="${tag}">#${tag}</span>`).join('')}
            </div>
          </div>

          <div class="meta-stats-card">
            <div class="stat-item">
              <span class="stat-label">Download Access</span>
              <span class="stat-value" style="color: ${isRegistered ? '#10b981' : '#f59e0b'};">
                ${isRegistered ? 'Unlocked (Registered)' : 'Locked (Register Required)'}
              </span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Resolution</span>
              <span class="stat-value">${img.resolution}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Views</span>
              <span class="stat-value">${img.viewsCount.toLocaleString()}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Downloads</span>
              <span class="stat-value">${img.downloadsCount.toLocaleString()}</span>
            </div>

            <div style="margin-top: 8px;">
              <span class="stat-label" style="display: block; margin-bottom: 6px;">Dominant Colors</span>
              <div class="color-palette-swatches">
                ${img.colorPalette.map(hex => `<div class="color-swatch" style="background-color: ${hex};" data-hex="${hex}" title="Click to copy ${hex}"></div>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* IMPROVED LOGIN GATEWAY VIEW */
  renderLoginView() {
    this.mainCanvas.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <div class="auth-badge">Authentication Gateway</div>
            <h2 class="auth-title">Sign In to ImageX</h2>
            <p class="auth-subtitle">Log in to unlock Unsplash image search & sync with MongoDB</p>
          </div>

          <div class="auth-error-banner" id="loginError"></div>

          <form class="auth-form" id="loginForm">
            <div class="form-group">
              <label class="form-label" for="loginEmail">Email Address</label>
              <input type="email" id="loginEmail" class="form-input" placeholder="name@example.com" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="loginPassword">Password</label>
              <input type="password" id="loginPassword" class="form-input" placeholder="Enter password" required />
            </div>

            <button type="submit" class="auth-submit-btn" id="loginSubmitBtn">
              Sign In to Platform
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>

            <button type="button" class="demo-btn" id="demoAccessBtn">
              ⚡ Quick Demo Guest Access
            </button>
          </form>

          <div class="auth-footer">
            Don't have an account yet? <span class="auth-footer-link" data-view="register">Register New Account</span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const errorBanner = document.getElementById('loginError');
      const submitBtn = document.getElementById('loginSubmitBtn');

      errorBanner.style.display = 'none';
      submitBtn.textContent = 'Signing in...';
      submitBtn.disabled = true;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        let data = null;
        try {
          data = await res.json();
        } catch (parseErr) {
          const rawText = await res.text().catch(() => '');
          data = { error: rawText || `Server error (${res.status})` };
        }

        if (res.ok && data?.token) {
          this.authToken = data.token;
          this.currentUser = data.user;
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('auth_user', JSON.stringify(data.user));

          if (Array.isArray(data.user.likes)) {
            this.likes = new Set(data.user.likes);
            localStorage.setItem('img_likes', JSON.stringify(data.user.likes));
          }
          if (Array.isArray(data.user.favourites)) {
            this.favourites = new Set(data.user.favourites);
            localStorage.setItem('img_favs', JSON.stringify(data.user.favourites));
          }

          this.showToast(`Welcome back ${data.user.username}! Download access unlocked.`);
          this.currentView = 'grid';
          this.loadImages();
        } else {
          const errorMsg = data?.error || data?.message || `Login failed (HTTP ${res.status}).`;
          errorBanner.innerHTML = `<div>${errorMsg}</div>`;
          errorBanner.style.display = 'block';
        }
      } catch (err) {
        errorBanner.innerHTML = `<div>Backend connection notice: ${err.message || 'Unable to reach server.'}</div>`;
        errorBanner.style.display = 'block';
      } finally {
        submitBtn.textContent = 'Sign In to Platform';
        submitBtn.disabled = false;
      }
    });
  }

  /* RENDER REGISTRATION VIEW */
  renderRegisterView() {
    this.mainCanvas.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <div class="auth-badge">New User Access</div>
            <h2 class="auth-title">Create Account</h2>
            <p class="auth-subtitle">Register to unlock high-res photo downloads & MongoDB sync</p>
          </div>

          <div class="auth-error-banner" id="registerError"></div>

          <form class="auth-form" id="registerForm">
            <div class="form-group">
              <label class="form-label" for="regUsername">Full Name / Username</label>
              <input type="text" id="regUsername" class="form-input" placeholder="e.g. Alex Johnson" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="regEmail">Email Address</label>
              <input type="email" id="regEmail" class="form-input" placeholder="name@example.com" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="regPassword">Password</label>
              <input type="password" id="regPassword" class="form-input" placeholder="Minimum 6 characters" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="regConfirmPassword">Confirm Password</label>
              <input type="password" id="regConfirmPassword" class="form-input" placeholder="Re-enter password" required />
            </div>

            <button type="submit" class="auth-submit-btn" id="regSubmitBtn">
              Register Account & Unlock Downloads
            </button>
          </form>

          <div class="auth-footer">
            Already have an account? <span class="auth-footer-link" data-view="login">Log In</span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('regUsername').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const confirmPassword = document.getElementById('regConfirmPassword').value;
      const errorBanner = document.getElementById('registerError');
      const submitBtn = document.getElementById('regSubmitBtn');

      errorBanner.style.display = 'none';

      if (password !== confirmPassword) {
        errorBanner.textContent = 'Passwords do not match.';
        errorBanner.style.display = 'block';
        return;
      }

      submitBtn.textContent = 'Registering...';
      submitBtn.disabled = true;

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });

        let data = null;
        try {
          data = await res.json();
        } catch (parseErr) {
          const rawText = await res.text().catch(() => '');
          data = { error: rawText || `Server error (${res.status})` };
        }

        if (res.ok && data?.token) {
          this.authToken = data.token;
          this.currentUser = data.user;
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('auth_user', JSON.stringify(data.user));
          
          this.showToast(`Welcome ${data.user.username}! Registration successful & downloads unlocked.`);
          this.currentView = 'grid';
          this.loadImages();
        } else {
          const errorMsg = data?.error || data?.message || `Registration failed (HTTP ${res.status}).`;
          errorBanner.innerHTML = `<div>${errorMsg}</div>`;
          errorBanner.style.display = 'block';
        }
      } catch (err) {
        errorBanner.innerHTML = `<div>Unable to connect to server: ${err.message || 'Server error.'}</div>`;
        errorBanner.style.display = 'block';
      } finally {
        submitBtn.textContent = 'Register Account & Unlock Downloads';
        submitBtn.disabled = false;
      }
    });
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      <span>${message}</span>
    `;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  render() {
    this.renderCategories();
    this.renderSidebar();
    this.renderMainContent();
  }
}

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ImageApp();
});
