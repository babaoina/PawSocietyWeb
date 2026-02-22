// ===== API CONFIGURATION =====
const API_BASE_URL = 'http://localhost:3000/api';
let authToken = localStorage.getItem('adminToken');

// ===== API REQUEST HELPER =====
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('adminToken');
    
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });
        
        if (response.status === 401) {
            // Token expired
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            if (!window.location.pathname.includes('index.html')) {
                window.location.href = 'index.html';
            }
            throw new Error('Session expired');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ===== INITIALIZE ON LOAD =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin panel loaded with API connection');
    
    // Check if we're on a protected page (not login)
    const path = window.location.pathname;
    if (!path.includes('index.html') && !localStorage.getItem('adminToken')) {
        window.location.href = 'index.html';
        return;
    }
    
    // Load page-specific data
    if (path.includes('dashboard.html')) {
        loadDashboardData();
    } else if (path.includes('users.html')) {
        loadUsersData();
    } else if (path.includes('posts.html')) {
        loadPostsData();
    } else if (path.includes('reports.html')) {
        loadReportsData();
    } else if (path.includes('settings.html')) {
        loadSettingsData();
    }
});

// ===== DASHBOARD FUNCTIONS =====
async function loadDashboardData() {
    try {
        const stats = await apiRequest('/admin/stats');
        
        // Update stats cards
        document.getElementById('total-users').textContent = stats.totalUsers;
        document.getElementById('total-posts').textContent = stats.totalPosts;
        document.getElementById('lost-pets').textContent = stats.lostPets;
        document.getElementById('adoptions').textContent = stats.adoptions;
        
        // Update activity feed
        const activityContainer = document.getElementById('activity-container');
        if (activityContainer) {
            if (stats.recentActivity.length === 0) {
                activityContainer.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No recent activity</p>';
            } else {
                activityContainer.innerHTML = stats.recentActivity.map(activity => `
                    <div class="activity-item">
                        <div class="activity-icon">${activity.type === 'user' ? '👤' : activity.type === 'lost' ? '🔍' : '📝'}</div>
                        <div class="activity-details">
                            <div class="text">${activity.text}</div>
                            <div class="time">${activity.time}</div>
                        </div>
                        <div class="activity-status ${activity.status === 'pending' ? 'status-pending' : 'status-new'}">${activity.status}</div>
                    </div>
                `).join('');
            }
        }
        
        // Animate numbers
        animateNumbers();
        
    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

// ===== USERS FUNCTIONS =====
async function loadUsersData() {
    try {
        const users = await apiRequest('/admin/users');
        displayUsers(users);
        updateUserStats(users);
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 50px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">👥</div>
                    <div style="font-size: 18px; color: #666;">No users found</div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(user => {
        const avatar = user.name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || '?';
        const colors = ['#7A4F2B', '#B88B4A', '#2196F3', '#4CAF50', '#9C27B0'];
        const color = colors[user.id % colors.length];
        
        return `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 35px; height: 35px; background: ${color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${avatar}</div>
                    <div>${user.name || ''}</div>
                </div>
            </td>
            <td>${user.email || ''}</td>
            <td>${user.role || 'user'}</td>
            <td><span class="user-status ${user.status === 'Active' ? 'status-active' : 'status-suspended'}">${user.status || 'Active'}</span></td>
            <td>${user.joined ? new Date(user.joined).toLocaleDateString() : ''}</td>
            <td>${user.posts || 0}</td>
            <td>
                <div class="action-icons">
                    <span title="Edit" onclick="editUser(${user.id})">✏️</span>
                    ${user.status === 'Active' 
                        ? '<span title="Suspend" onclick="updateUserStatus(' + user.id + ', \'Suspended\')">⛔</span>' 
                        : '<span title="Activate" onclick="updateUserStatus(' + user.id + ', \'Active\')">✅</span>'}
                    ${user.role !== 'admin' ? '<span title="Delete" onclick="deleteUser(' + user.id + ')">🗑️</span>' : ''}
                </div>
            </td>
        </tr>
    `}).join('');
}

function updateUserStats(users) {
    const totalUsers = document.getElementById('totalUsers');
    if (totalUsers) {
        totalUsers.textContent = users.length;
    }
}

async function updateUserStatus(id, status) {
    if (confirm(`${status} this user?`)) {
        try {
            // Get current user data
            const users = await apiRequest('/admin/users');
            const user = users.find(u => u.id === id);
            
            if (user) {
                await apiRequest(`/admin/users/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        status: status
                    })
                });
                loadUsersData();
            }
        } catch (error) {
            console.error('Failed to update user:', error);
            alert('Failed to update user');
        }
    }
}

async function deleteUser(id) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        try {
            await apiRequest(`/admin/users/${id}`, { method: 'DELETE' });
            loadUsersData();
            alert('User deleted successfully');
        } catch (error) {
            console.error('Failed to delete user:', error);
            alert('Failed to delete user');
        }
    }
}

// ===== POSTS FUNCTIONS =====
async function loadPostsData() {
    try {
        const posts = await apiRequest('/admin/posts');
        displayPosts(posts);
        updatePostStats(posts);
    } catch (error) {
        console.error('Failed to load posts:', error);
    }
}

function displayPosts(posts) {
    const postsGrid = document.getElementById('postsGrid');
    if (!postsGrid) return;

    if (posts.length === 0) {
        postsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 50px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📝</div>
                <div style="font-size: 18px; color: #666;">No posts found</div>
            </div>
        `;
        return;
    }

    postsGrid.innerHTML = posts.map(post => {
        const statusClass = post.status === 'Lost' ? 'status-lost' : post.status === 'Found' ? 'status-found' : 'status-adoption';
        const reportedBadge = post.reported ? 
            `<div class="reported-badge" style="margin-bottom: 10px;">
                <span>🚩</span> Reported (${post.reportCount || 0} flags)
            </div>` : '';

        return `
        <div class="post-card">
            <div class="post-image">
                ${post.petName?.charAt(0) || '?'}
                <span class="post-status-badge ${statusClass}">${post.status?.toUpperCase() || ''}</span>
            </div>
            <div class="post-content">
                <div class="post-header">
                    <span class="post-title">${post.petName || ''}</span>
                    <div class="post-user">
                        <div class="post-user-avatar">${post.userAvatar || '?'}</div>
                        <span>${post.userName || ''}</span>
                    </div>
                </div>
                ${reportedBadge}
                <div class="post-meta">
                    <div class="meta-item">📍 ${post.location || ''}</div>
                    <div class="meta-item">⏱️ ${post.time || ''}</div>
                </div>
                <div class="post-description">
                    ${post.description || ''}
                </div>
                <div class="post-actions">
                    <button class="action-btn btn-view" onclick="viewPost(${post.id})">
                        <span>👁️</span> View
                    </button>
                    <button class="action-btn btn-flag" onclick="flagPost(${post.id})">
                        <span>🚩</span> ${post.reported ? 'Unflag' : 'Flag'}
                    </button>
                    <button class="action-btn btn-delete" onclick="deletePost(${post.id})">
                        <span>🗑️</span> Delete
                    </button>
                </div>
            </div>
        </div>
    `}).join('');
}

function updatePostStats(posts) {
    const totalPosts = document.getElementById('totalPosts');
    const reportedPosts = document.getElementById('reportedPosts');
    
    if (totalPosts) totalPosts.textContent = posts.length;
    if (reportedPosts) reportedPosts.textContent = posts.filter(p => p.reported).length;
}

async function viewPost(id) {
    try {
        const post = await apiRequest(`/admin/posts/${id}`);
        
        const modalContent = document.getElementById('modalContent');
        if (modalContent) {
            let statusColor = '#F44336';
            if (post.status === 'Found') statusColor = '#4CAF50';
            else if (post.status === 'Adoption') statusColor = '#2196F3';

            modalContent.innerHTML = `
                <div class="post-detail-item">
                    <div class="detail-label">Pet Name</div>
                    <div class="detail-value">${post.petName || ''}</div>
                </div>
                <div class="post-detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value" style="color: ${statusColor}">${post.status || ''}</div>
                </div>
                <div class="post-detail-item">
                    <div class="detail-label">Posted By</div>
                    <div class="detail-value">${post.userName || ''}</div>
                </div>
                <div class="post-detail-item">
                    <div class="detail-label">Location</div>
                    <div class="detail-value">${post.location || ''}</div>
                </div>
                <div class="post-detail-item">
                    <div class="detail-label">Posted</div>
                    <div class="detail-value">${post.time || ''}</div>
                </div>
                <div class="post-detail-item">
                    <div class="detail-label">Description</div>
                    <div class="detail-value">${post.description || ''}</div>
                </div>
                <div class="post-detail-item">
                    <div class="detail-label">Contact</div>
                    <div class="detail-value">${post.contact || ''}</div>
                </div>
                ${post.reported ? `
                <div class="post-detail-item">
                    <div class="detail-label">Reports</div>
                    <div class="detail-value" style="color: #FF9800;">${post.reportCount || 0} flags</div>
                </div>
                ` : ''}
            `;
        }
        openModal('viewPostModal');
    } catch (error) {
        console.error('Failed to load post:', error);
    }
}

async function flagPost(id) {
    if (confirm('Flag/unflag this post?')) {
        try {
            await apiRequest(`/admin/posts/${id}/flag`, { method: 'PUT' });
            loadPostsData();
        } catch (error) {
            console.error('Failed to flag post:', error);
        }
    }
}

async function deletePost(id) {
    if (confirm('Are you sure you want to delete this post?')) {
        try {
            await apiRequest(`/admin/posts/${id}`, { method: 'DELETE' });
            loadPostsData();
            closeModal('deleteModal');
        } catch (error) {
            console.error('Failed to delete post:', error);
        }
    }
}

// ===== REPORTS FUNCTIONS =====
async function loadReportsData() {
    try {
        const stats = await apiRequest('/admin/stats');
        
        // Update stats numbers
        document.getElementById('total-users').textContent = stats.totalUsers;
        document.getElementById('total-posts').textContent = stats.totalPosts;
        document.getElementById('active-users').textContent = Math.floor(stats.totalUsers * 0.7); // Estimate
        document.getElementById('engagement-rate').textContent = '65%';
        
        // Load report table
        const today = new Date();
        const startDate = document.getElementById('startDate')?.value || '2024-01-01';
        const endDate = document.getElementById('endDate')?.value || today.toISOString().split('T')[0];
        
        const summary = await apiRequest(`/admin/reports/summary?start=${startDate}&end=${endDate}`);
        updateReportTable(summary);
        
    } catch (error) {
        console.error('Failed to load reports:', error);
    }
}

function updateReportTable(data) {
    const tbody = document.getElementById('report-table-body');
    if (!tbody) return;
    
    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 30px; color: #999;">
                    No data available for this period
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = data.map((row, index) => `
        <tr>
            <td>${row.month}</td>
            <td>${Math.floor(Math.random() * 20) + 5}</td> <!-- New users -->
            <td>${row.total}</td>
            <td>${row.lost}</td>
            <td>${row.found}</td>
            <td>${row.adoption}</td>
            <td>${Math.floor(Math.random() * 20) + 60}%</td>
        </tr>
    `).join('');
}

// ===== SETTINGS FUNCTIONS =====
async function loadSettingsData() {
    try {
        const settings = await apiRequest('/admin/settings');
        
        // Apply settings to form fields
        const siteName = document.getElementById('siteName');
        if (siteName) siteName.value = settings.siteName;
        
        const siteDesc = document.getElementById('siteDescription');
        if (siteDesc) siteDesc.value = settings.siteDescription;
        
        const contactEmail = document.getElementById('contactEmail');
        if (contactEmail) contactEmail.value = settings.contactEmail;
        
        const timezone = document.getElementById('timezone');
        if (timezone) timezone.value = settings.timezone;
        
        const defaultRole = document.getElementById('defaultRole');
        if (defaultRole) defaultRole.value = settings.defaultRole;
        
        const sessionTimeout = document.getElementById('sessionTimeout');
        if (sessionTimeout) sessionTimeout.value = settings.sessionTimeout;
        
        const flagThreshold = document.getElementById('flagThreshold');
        if (flagThreshold) flagThreshold.value = 3;
        
        const apiKey = document.getElementById('apiKey');
        if (apiKey) apiKey.value = 'pk_live_xxxxxxxxxxxxx';
        
        const rateLimit = document.getElementById('rateLimit');
        if (rateLimit) rateLimit.value = 60;
        
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

async function saveSettings() {
    const settings = {
        siteName: document.getElementById('siteName')?.value || 'PawSociety',
        siteDescription: document.getElementById('siteDescription')?.value || '',
        contactEmail: document.getElementById('contactEmail')?.value || '',
        timezone: document.getElementById('timezone')?.value || 'PST',
        allowRegistration: true,
        emailVerification: true,
        defaultRole: document.getElementById('defaultRole')?.value || 'user',
        twoFactorAuth: false,
        sessionTimeout: parseInt(document.getElementById('sessionTimeout')?.value) || 120,
        autoApprovePosts: true,
        profanityFilter: true
    };
    
    try {
        await apiRequest('/admin/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
        alert('Settings saved successfully!');
    } catch (error) {
        console.error('Failed to save settings:', error);
        alert('Failed to save settings');
    }
}

async function clearAllData() {
    if (confirm('⚠️ WARNING: This will delete ALL non-admin data. Are you sure?')) {
        const confirmText = prompt('Type "DELETE" to confirm:');
        if (confirmText === 'DELETE') {
            try {
                await apiRequest('/admin/clear-all-data', { method: 'POST' });
                alert('All non-admin data has been cleared.');
            } catch (error) {
                console.error('Failed to clear data:', error);
                alert('Failed to clear data');
            }
        }
    }
}

// ===== UTILITY FUNCTIONS =====
function animateNumbers() {
    document.querySelectorAll('.stat-card .number').forEach(el => {
        const target = parseInt(el.textContent.replace(/,/g, ''));
        if (!isNaN(target)) {
            animateNumber(el, target);
        }
    });
}

function animateNumber(element, target) {
    let current = 0;
    const increment = Math.ceil(target / 50);
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target.toLocaleString();
            clearInterval(timer);
        } else {
            element.textContent = current.toLocaleString();
        }
    }, 20);
}

function openModal(modalId) {
    document.getElementById(modalId)?.classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        window.location.href = 'index.html';
    }
}

// ===== FILTER FUNCTIONS =====
function applyUserFilters() {
    // This will be handled by the API with query params in a real implementation
    loadUsersData();
}

function applyPostFilters() {
    // This will be handled by the API with query params in a real implementation
    loadPostsData();
}

// ===== MODAL CLICK OUTSIDE =====
window.onclick = function(event) {
    const modals = ['userModal', 'viewPostModal', 'deleteModal', 'flagModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal && event.target == modal) {
            modal.classList.remove('active');
        }
    });
};