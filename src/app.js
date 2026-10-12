import { SAMPLE_IMAGES } from './images-data.js';

const UNSPLASH_API_KEY = 'KpaPQhBjXsaKjtiQOPZPK7Iwzcs6W3mdtH9i5gIbpNA';

// App State Management with Registered-Only Downloads & MongoDB Authentication
class ImageApp {
  constructor() {
    this.images = SAMPLE_IMAGES;
    this.selectedImageId = null;
    this.searchQuery = '';
    this.selectedCategory = 'All';
    this.activeFilter = 'all'; // 'all' | 'all-saved' | 'likes' | 'favourite'
    this.currentPage = 1;
    this.isLoading = false;
    this.isLoadingMore = false;
    this.hasMoreImages = true;
    this.theme = localStorage.getItem('img_theme') || 'modern-dark';
    
    // Auth state: check token & user
    this.authToken = localStorage.getItem('auth_token') || null;
    this.currentUser = JSON.parse(localStorage.getItem('auth_user') || 'null');
    
    // Initial view: LOGIN FIRST if not authenticated!
    this.currentView = this.authToken ? 'grid' : 'login';

    this.likes = new Set(JSON.parse(localStorage.getItem('img_likes') || '[]'));
    this.favourites = new Set(JSON.parse(localStorage.getItem('img_favs') || '[]'));

    // Persistent cache of liked & favorited image objects so they never disappear on query/page changes
    let savedCache = {};
    try {
      savedCache = JSON.parse(localStorage.getItem('img_saved_cache') || '{}');
    } catch (e) {
      savedCache = {};
    }
    this.savedImagesMap = new Map(Object.entries(savedCache));
    SAMPLE_IMAGES.forEach(img => {
      if (this.likes.has(img.id) || this.favourites.has(img.id)) {
        this.savedImagesMap.set(img.id, img);
      }
    });

    this.initElements();
    this.initEventListeners();
    this.applyTheme(this.theme);

    if (this.authToken) {
      this.fetchUserDataFromMongoDB();
      this.loadImages(1, false);
    } else {
      this.render();
    }
  }

  // Persist cached liked & favorite images to localStorage
  persistSavedImages() {
    const obj = {};
    for (const [id, img] of this.savedImagesMap.entries()) {
      obj[id] = img;
    }
    localStorage.setItem('img_saved_cache', JSON.stringify(obj));
  }

  // Find image across current images, saved images map, or sample dataset
  findImageById(id) {
    return this.images.find(img => img.id === id) || 
           this.savedImagesMap.get(id) || 
           SAMPLE_IMAGES.find(img => img.id === id) || 
           null;
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

      this.activeFilter = 'all';
      this.currentPage = 1;
      this.hasMoreImages = true;

      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = setTimeout(() => {
        this.loadImages(1, false);
      }, 400);
    });

    // Clear search button
    this.searchClearBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.searchQuery = '';
      this.searchClearBtn.style.display = 'none';
      this.activeFilter = 'all';
      this.currentPage = 1;
      this.hasMoreImages = true;
      if (this.authToken) this.loadImages(1, false);
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
      } else if (action === 'all') {
        if (!this.authToken) {
          this.showToast('Please log in first');
          return;
        }
        this.activeFilter = 'all';
        this.currentView = 'grid';
        this.renderSidebar();
        this.renderMainContent();
      } else if (action === 'all-saved') {
        if (!this.authToken) {
          this.showToast('Please log in to view your Saved images');
          return;
        }
        this.activeFilter = 'all-saved';
        this.currentView = 'grid';
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
      const loadMoreBtn = e.target.closest('#loadMoreBtn');
      const galleryFilterBtn = e.target.closest('.gallery-filter-btn');
      const savedSummaryBtn = e.target.closest('.saved-summary-btn');
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

      if (loadMoreBtn) {
        this.loadMoreImages();
        return;
      }

      if (galleryFilterBtn) {
        const filter = galleryFilterBtn.dataset.filter;
        if (filter) {
          this.activeFilter = filter;
          this.renderSidebar();
          this.renderMainContent();
        }
        return;
      }

      if (savedSummaryBtn) {
        this.activeFilter = 'all-saved';
        this.renderSidebar();
        this.renderMainContent();
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
        this.activeFilter = 'all';
        this.currentPage = 1;
        this.hasMoreImages = true;
        this.loadImages(1, false);
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

  // UNSPLASH LIVE API FETCHING WITH PAGINATION & LOAD MORE
  async loadImages(page = 1, append = false) {
    if (!this.authToken) return;

    if (!append) {
      this.isLoading = true;
      this.currentPage = 1;
      this.hasMoreImages = true;
      this.renderMainContent();
    } else {
      this.isLoadingMore = true;
    }

    try {
      let query = this.searchQuery;
      if (!query && this.selectedCategory !== 'All') {
        query = this.selectedCategory;
      }

      let url = '';
      if (query) {
        url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=30&client_id=${UNSPLASH_API_KEY}`;
      } else {
        url = `https://api.unsplash.com/photos?page=${page}&per_page=30&order_by=popular&client_id=${UNSPLASH_API_KEY}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const rawPhotos = Array.isArray(data) ? data : (data.results || []);

        if (rawPhotos.length > 0) {
          const mappedPhotos = rawPhotos.map(photo => ({
            id: photo.id,
            title: photo.alt_description || photo.description || `${photo.user?.name || 'Unsplash'}'s Photo`,
            category: query || 'Unsplash',
            url: photo.urls?.full || photo.urls?.regular,
            thumbUrl: photo.urls?.small || photo.urls?.thumb,
            photographer: {
              name: photo.user?.name || 'Photographer',
              handle: `@${photo.user?.username || 'photographer'}`,
              avatar: photo.user?.profile_image?.medium || photo.user?.profile_image?.small || 'https://images.unsplash.com/placeholder-avatars/extra-large.jpg'
            },
            tags: photo.tags ? photo.tags.map(t => t.title) : ['unsplash', 'photography', 'art'],
            likesCount: photo.likes || 120,
            viewsCount: (photo.likes || 100) * 14,
            downloadsCount: (photo.likes || 50) * 4,
            resolution: `${photo.width || 4000} × ${photo.height || 3000}`,
            colorPalette: [photo.color || '#F59E0B', '#111827', '#64748B', '#10B981'],
            description: photo.description || photo.alt_description || `High resolution photo taken by ${photo.user?.name || 'an artist'} on Unsplash.`
          }));

          // Cache any photo that the user had previously liked or favorited
          mappedPhotos.forEach(p => {
            if (this.likes.has(p.id) || this.favourites.has(p.id)) {
              this.savedImagesMap.set(p.id, p);
            }
          });
          this.persistSavedImages();

          if (append) {
            const existingIds = new Set(this.images.map(img => img.id));
            const uniqueNew = mappedPhotos.filter(img => !existingIds.has(img.id));
            if (uniqueNew.length === 0) {
              this.hasMoreImages = false;
            } else {
              this.images = [...this.images, ...uniqueNew];
              this.hasMoreImages = mappedPhotos.length >= 20;
            }
          } else {
            this.images = mappedPhotos;
            this.hasMoreImages = mappedPhotos.length >= 20;
          }
        } else {
          if (append) {
            this.hasMoreImages = false;
          } else {
            this.images = [];
            this.hasMoreImages = false;
          }
        }
      } else {
        console.warn('Unsplash API notice:', res.statusText);
        this.handleFallbackImages(page, append, query);
      }
    } catch (err) {
      console.warn('Network error fetching Unsplash API:', err.message);
      this.handleFallbackImages(page, append);
    } finally {
      this.isLoading = false;
      this.isLoadingMore = false;
      this.render();
    }
  }

  // Graceful fallback for offline & rate-limited environments
  handleFallbackImages(page = 1, append = false, query = '') {
    let pool = SAMPLE_IMAGES;
    if (query) {
      const q = query.toLowerCase();
      pool = SAMPLE_IMAGES.filter(img => 
        img.title.toLowerCase().includes(q) || 
        img.category.toLowerCase().includes(q) || 
        img.tags.some(t => t.toLowerCase().includes(q))
      );
      if (pool.length === 0) pool = SAMPLE_IMAGES;
    } else if (this.selectedCategory !== 'All') {
      const cat = this.selectedCategory.toLowerCase();
      pool = SAMPLE_IMAGES.filter(img => img.category.toLowerCase() === cat);
      if (pool.length === 0) pool = SAMPLE_IMAGES;
    }

    const pageSize = 12;
    const startIndex = (page - 1) * pageSize;
    const pagedItems = pool.slice(startIndex, startIndex + pageSize);

    if (append) {
      if (pagedItems.length === 0) {
        this.hasMoreImages = false;
      } else {
        const existingIds = new Set(this.images.map(img => img.id));
        const unique = pagedItems.filter(img => !existingIds.has(img.id));
        this.images = [...this.images, ...unique];
        if (startIndex + pageSize >= pool.length) {
          this.hasMoreImages = false;
        }
      }
    } else {
      this.images = pagedItems.length > 0 ? pagedItems : pool;
      this.hasMoreImages = pool.length > pageSize;
    }
  }

  // Load next batch of images on demand
  async loadMoreImages() {
    if (this.isLoadingMore || !this.hasMoreImages) return;
    this.isLoadingMore = true;

    const btn = document.getElementById('loadMoreBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="load-more-spinner"></span> Loading More Photos...`;
    }

    this.currentPage += 1;
    await this.loadImages(this.currentPage, true);
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

    const img = this.findImageById(id);

    if (this.likes.has(id)) {
      this.likes.delete(id);
      this.showToast('Removed from Likes');
    } else {
      this.likes.add(id);
      this.showToast('Added to Likes ❤️');
      if (img) this.savedImagesMap.set(id, img);
    }

    if (!this.likes.has(id) && !this.favourites.has(id)) {
      this.savedImagesMap.delete(id);
    }
    this.persistSavedImages();

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

    const img = this.findImageById(id);

    if (this.favourites.has(id)) {
      this.favourites.delete(id);
      this.showToast('Removed from Favourites');
    } else {
      this.favourites.add(id);
      this.showToast('Saved to Favourites ⭐');
      if (img) this.savedImagesMap.set(id, img);
    }

    if (!this.likes.has(id) && !this.favourites.has(id)) {
      this.savedImagesMap.delete(id);
    }
    this.persistSavedImages();

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
    this.activeFilter = 'all';
    this.currentPage = 1;
    this.hasMoreImages = true;
    this.loadImages(1, false);
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

    const img = this.findImageById(id);
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
    const allSaved = Array.from(this.savedImagesMap.values());

    if (this.activeFilter === 'likes') {
      const map = new Map();
      allSaved.filter(img => this.likes.has(img.id)).forEach(img => map.set(img.id, img));
      this.images.filter(img => this.likes.has(img.id)).forEach(img => map.set(img.id, img));
      return Array.from(map.values());
    }

    if (this.activeFilter === 'favourite') {
      const map = new Map();
      allSaved.filter(img => this.favourites.has(img.id)).forEach(img => map.set(img.id, img));
      this.images.filter(img => this.favourites.has(img.id)).forEach(img => map.set(img.id, img));
      return Array.from(map.values());
    }

    if (this.activeFilter === 'all-saved') {
      const map = new Map();
      allSaved.filter(img => this.likes.has(img.id) || this.favourites.has(img.id)).forEach(img => map.set(img.id, img));
      this.images.filter(img => this.likes.has(img.id) || this.favourites.has(img.id)).forEach(img => map.set(img.id, img));
      return Array.from(map.values());
    }

    // Default 'all' filter:
    // Display all loaded images, plus guarantee any saved images matching the category or all are visible
    const map = new Map();
    this.images.forEach(img => map.set(img.id, img));
    allSaved.forEach(img => {
      if (this.selectedCategory === 'All' || img.category.toLowerCase() === this.selectedCategory.toLowerCase()) {
        if (!map.has(img.id)) {
          map.set(img.id, img);
        }
      }
    });

    return Array.from(map.values());
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
        this.activeFilter = 'all'; // Reset to All images so chosen category is immediately visible!
        this.currentPage = 1;
        this.hasMoreImages = true;
        if (!this.authToken) {
          this.showToast('Please log in first');
          this.currentView = 'login';
          this.render();
          return;
        }
        if (this.currentView !== 'detail') this.currentView = 'grid';
        this.loadImages(1, false);
      });
    });
  }

  /* RENDER SIDEBAR */
  renderSidebar() {
    const isAllActive = this.activeFilter === 'all' && this.currentView === 'grid';
    const isSavedActive = this.activeFilter === 'all-saved';
    const isLikesActive = this.activeFilter === 'likes';
    const isFavActive = this.activeFilter === 'favourite';
    const totalSaved = new Set([...this.likes, ...this.favourites]).size;
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
      <button class="sidebar-pill-btn ${isAllActive ? 'active' : ''}" data-action="all">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
        All Images
      </button>
      <button class="sidebar-pill-btn ${isSavedActive ? 'active' : ''}" data-action="all-saved">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        All Saved ${totalSaved > 0 ? `<span class="badge" style="background:#8b5cf6;">${totalSaved}</span>` : ''}
      </button>
      <button class="sidebar-pill-btn ${isLikesActive ? 'active' : ''}" data-action="likes">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLikesActive ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        Likes ${this.likes.size > 0 ? `<span class="badge">${this.likes.size}</span>` : ''}
      </button>
      <button class="sidebar-pill-btn ${isFavActive ? 'active' : ''}" data-action="favourite">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFavActive ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
        Favourite ${this.favourites.size > 0 ? `<span class="badge" style="background:#f59e0b;">${this.favourites.size}</span>` : ''}
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
    const totalSaved = new Set([...this.likes, ...this.favourites]).size;

    if (filtered.length === 0) {
      this.mainCanvas.innerHTML = `
        <div class="empty-state">
          <h3>No Images Found</h3>
          <p>${this.activeFilter === 'likes' 
              ? "You haven't liked any images yet. Click the ❤️ icon on any photo to like it!" 
              : this.activeFilter === 'favourite' 
              ? "You haven't added any favourites yet. Click the ⭐ icon on any photo to favourite it!" 
              : this.activeFilter === 'all-saved' 
              ? "No saved images in your collection yet. Like or favourite images to see them here!" 
              : `No results match your search "${this.searchQuery}" or selected category.`}</p>
          <button class="sidebar-pill-btn" style="max-width: 200px; margin: 16px auto 0;" id="resetFilterBtn">View All Images</button>
        </div>
      `;
      document.getElementById('resetFilterBtn')?.addEventListener('click', () => {
        this.searchQuery = '';
        this.selectedCategory = 'All';
        this.activeFilter = 'all';
        this.searchInput.value = '';
        this.searchClearBtn.style.display = 'none';
        this.currentPage = 1;
        this.loadImages(1, false);
      });
      return;
    }

    const cardsHtml = filtered.map(img => {
      const isLiked = this.likes.has(img.id);
      const isFav = this.favourites.has(img.id);

      let badgesHtml = '';
      if (isLiked || isFav) {
        badgesHtml = `
          <div class="card-badges-container">
            ${isLiked ? '<span class="status-badge status-badge-like">❤️ Liked</span>' : ''}
            ${isFav ? '<span class="status-badge status-badge-fav">⭐ Favorite</span>' : ''}
          </div>
        `;
      }

      return `
        <div class="image-card" data-id="${img.id}" title="${img.title}">
          ${badgesHtml}
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

    // Summary ribbon when viewing All and user has saved collections
    let ribbonHtml = '';
    if (this.activeFilter === 'all' && totalSaved > 0) {
      ribbonHtml = `
        <div class="saved-summary-ribbon">
          <div class="saved-summary-left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span>Your Collection: <strong>${this.likes.size} Liked</strong> and <strong>${this.favourites.size} Favorited</strong> photos are highlighted in this gallery!</span>
          </div>
          <button class="saved-summary-btn">View All Saved (${totalSaved})</button>
        </div>
      `;
    }

    // Load more button section
    let loadMoreHtml = '';
    if (this.activeFilter === 'all') {
      if (this.hasMoreImages) {
        loadMoreHtml = `
          <div class="load-more-section">
            <button class="load-more-btn" id="loadMoreBtn" ${this.isLoadingMore ? 'disabled' : ''}>
              ${this.isLoadingMore 
                ? '<span class="load-more-spinner"></span> Loading More Photos...' 
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Load More Images`}
            </button>
            <span class="load-more-info">Page ${this.currentPage} • Showing ${filtered.length} photos</span>
          </div>
        `;
      } else {
        loadMoreHtml = `
          <div class="load-more-section">
            <div class="load-more-info">🎉 You've reached the end of the collection (${filtered.length} photos displayed)</div>
          </div>
        `;
      }
    }

    this.mainCanvas.innerHTML = `
      <div class="gallery-header-toolbar">
        <div class="gallery-filters-group">
          <button class="gallery-filter-btn ${this.activeFilter === 'all' ? 'active' : ''}" data-filter="all">
            🖼️ All Images (${this.images.length})
          </button>
          <button class="gallery-filter-btn ${this.activeFilter === 'all-saved' ? 'active' : ''}" data-filter="all-saved">
            ✨ All Saved (${totalSaved})
          </button>
          <button class="gallery-filter-btn ${this.activeFilter === 'likes' ? 'active' : ''}" data-filter="likes">
            ❤️ Likes (${this.likes.size})
          </button>
          <button class="gallery-filter-btn ${this.activeFilter === 'favourite' ? 'active' : ''}" data-filter="favourite">
            ⭐ Favourites (${this.favourites.size})
          </button>
        </div>

        <div class="gallery-stats-info">
          <span>Category: <strong style="color:var(--accent-gold);">${this.selectedCategory}</strong></span>
          <span>Showing <strong class="gallery-stats-count">${filtered.length}</strong> photo${filtered.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      ${ribbonHtml}

      <div class="image-grid-container">
        ${cardsHtml}
      </div>

      ${loadMoreHtml}
    `;
  }

  /* RENDER SINGLE DETAIL VIEW (DOWNLOAD OPTION EXCLUSIVELY FOR REGISTERED USERS) */
  renderSingleDetailView() {
    const img = this.findImageById(this.selectedImageId);
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
          this.activeFilter = 'all';
          this.currentPage = 1;
          this.hasMoreImages = true;
          this.loadImages(1, false);
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
          this.activeFilter = 'all';
          this.currentPage = 1;
          this.hasMoreImages = true;
          this.loadImages(1, false);
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
