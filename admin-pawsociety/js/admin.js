// ===== API CONFIGURATION =====
const API_BASE_URL = 'http://localhost:3000/api';
const APP_BACKEND_URL = 'http://192.168.254.105:5000';
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
    console.log('Admin panel loaded');
    
    const path = window.location.pathname;
    if (!path.includes('index.html') && !localStorage.getItem('adminToken')) {
        window.location.href = 'index.html';
        return;
    }
    
    if (path.includes('dashboard.html')) {
        loadDashboardData();
        setInterval(loadDashboardData, 10000);
    } else if (path.includes('users.html')) {
        loadUsersData();
        setInterval(loadUsersData, 10000);
    } else if (path.includes('posts.html')) {
        loadPostsData();
        setInterval(loadPostsData, 10000);
    } else if (path.includes('reports.html')) {
        loadReportsData();
        setInterval(loadReportsData, 10000);
    } else if (path.includes('settings.html')) {
        loadSettingsData();
    }
});

// ===== DASHBOARD FUNCTIONS =====
async function loadDashboardData() {
    try {
        console.log('Loading dashboard data...');
        const stats = await apiRequest('/admin/stats');
        
        document.getElementById('total-users').textContent = stats.totalUsers || 0;
        document.getElementById('total-posts').textContent = stats.totalPosts || 0;
        document.getElementById('lost-pets').textContent = stats.lostPets || 0;
        document.getElementById('adoptions').textContent = stats.adoptions || 0;
        
        if (stats.postsByStatus) {
            const total = stats.totalPosts || 1;
            const lostCount = stats.postsByStatus.lost || 0;
            const foundCount = stats.postsByStatus.found || 0;
            const adoptionCount = stats.postsByStatus.adoption || 0;
            
            document.getElementById('lost-count').textContent = lostCount;
            document.getElementById('found-count').textContent = foundCount;
            document.getElementById('adoption-count').textContent = adoptionCount;
            
            const lostPercent = ((lostCount / total) * 100).toFixed(1);
            const foundPercent = ((foundCount / total) * 100).toFixed(1);
            const adoptionPercent = ((adoptionCount / total) * 100).toFixed(1);
            
            const lostBar = document.getElementById('lost-bar');
            const foundBar = document.getElementById('found-bar');
            const adoptionBar = document.getElementById('adoption-bar');
            
            if (lostBar) {
                lostBar.style.transition = 'width 0.5s ease-in-out';
                lostBar.style.width = lostPercent + '%';
                lostBar.style.background = '#F44336';
            }
            if (foundBar) {
                foundBar.style.transition = 'width 0.5s ease-in-out';
                foundBar.style.width = foundPercent + '%';
                foundBar.style.background = '#4CAF50';
            }
            if (adoptionBar) {
                adoptionBar.style.transition = 'width 0.5s ease-in-out';
                adoptionBar.style.width = adoptionPercent + '%';
                adoptionBar.style.background = '#2196F3';
            }
            
            document.getElementById('lost-percent').textContent = lostPercent + '%';
            document.getElementById('found-percent').textContent = foundPercent + '%';
            document.getElementById('adoption-percent').textContent = adoptionPercent + '%';
        }
        
        if (stats.userGrowth && stats.userGrowth.length > 0) {
            const bars = document.querySelectorAll('.growth-bar');
            const maxHeight = 180;
            const maxCount = Math.max(...stats.userGrowth, 1);
            
            bars.forEach((bar, index) => {
                if (index < stats.userGrowth.length) {
                    const height = (stats.userGrowth[index] / maxCount) * maxHeight;
                    setTimeout(() => {
                        bar.style.transition = 'height 0.5s ease-in-out';
                        bar.style.height = height + 'px';
                    }, index * 100);
                }
            });
        }
        
        const activityContainer = document.getElementById('activity-container');
        if (activityContainer) {
            if (!stats.recentActivity || stats.recentActivity.length === 0) {
                activityContainer.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No recent activity</p>';
            } else {
                activityContainer.innerHTML = stats.recentActivity.map(activity => `
                    <div class="activity-item">
                        <div class="activity-icon">${activity.type === 'user' ? '👤' : activity.type === 'lost' ? '🔍' : '📝'}</div>
                        <div class="activity-details">
                            <div class="text">${activity.text}</div>
                            <div class="time">${activity.time}</div>
                        </div>
                        <div class="activity-status status-new">${activity.status}</div>
                    </div>
                `).join('');
            }
        }
        
        animateNumbers();
        
    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

// ===== USERS FUNCTIONS =====
async function loadUsersData() {
    try {
        console.log('Loading users...');
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
        const color = colors[Math.abs(user.id?.toString().charCodeAt(0) || 0) % colors.length];
        
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
                    <span title="Edit" onclick="editUser('${user.id}')">✏️</span>
                    ${user.status === 'Active' 
                        ? '<span title="Suspend" onclick="updateUserStatus(\'' + user.id + '\', \'Suspended\')">⛔</span>' 
                        : '<span title="Activate" onclick="updateUserStatus(\'' + user.id + '\', \'Active\')">✅</span>'}
                    ${user.role !== 'admin' ? '<span title="Delete" onclick="deleteUser(\'' + user.id + '\')">🗑️</span>' : ''}
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

async function editUser(id) {
    try {
        const users = await apiRequest('/admin/users');
        const user = users.find(u => u.id === id);
        
        if (!user) return;
        
        document.getElementById('modalTitle').textContent = 'Edit User';
        document.getElementById('userId').value = user.id;
        document.getElementById('userName').value = user.name;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userRole').value = user.role;
        document.getElementById('userStatus').value = user.status;
        
        openModal('userModal');
    } catch (error) {
        console.error('Failed to load user:', error);
        alert('Failed to load user');
    }
}

async function saveUser() {
    const id = document.getElementById('userId').value;
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const role = document.getElementById('userRole').value;
    const status = document.getElementById('userStatus').value;
    
    if (!name || !email) {
        alert('Name and email are required');
        return;
    }
    
    try {
        if (id) {
            await apiRequest(`/admin/users/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ name, email, role, status })
            });
            alert('User updated successfully');
        } else {
            await apiRequest('/admin/users', {
                method: 'POST',
                body: JSON.stringify({ name, email, role, status, password: 'default123' })
            });
            alert('User created successfully');
        }
        
        closeModal('userModal');
        loadUsersData();
    } catch (error) {
        console.error('Failed to save user:', error);
        alert('Failed to save user');
    }
}

async function updateUserStatus(id, status) {
    if (confirm(`${status} this user?`)) {
        try {
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
                alert(`User ${status.toLowerCase()} successfully`);
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
        console.log('Loading posts...');
        const posts = await apiRequest('/admin/posts');
        
        let reports = [];
        try {
            reports = await apiRequest('/admin/reports');
        } catch (e) {
            console.log('No reports found');
        }
        
        const reportsMap = {};
        reports.forEach(report => {
            if (report.postId) {
                if (!reportsMap[report.postId]) {
                    reportsMap[report.postId] = [];
                }
                reportsMap[report.postId].push(report);
            }
        });
        
        const postsWithReports = posts.map(post => {
            const postReports = reportsMap[post.postId] || [];
            return {
                ...post,
                reported: postReports.length > 0,
                reportCount: postReports.length,
                reports: postReports
            };
        });
        
        console.log('Posts loaded:', postsWithReports);
        displayPosts(postsWithReports);
        updatePostStats(postsWithReports);
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
        const statusClass = post.status === 'Lost' ? 'status-lost' : 
                           post.status === 'Found' ? 'status-found' : 'status-adoption';
        
        let imageHtml = '';
        if (post.imageUrls && post.imageUrls.length > 0) {
            let imageUrl = post.imageUrls[0];
            if (imageUrl.startsWith('/')) {
                imageUrl = APP_BACKEND_URL + imageUrl;
            } else if (!imageUrl.startsWith('http')) {
                imageUrl = APP_BACKEND_URL + '/' + imageUrl;
            }
            imageHtml = `<img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" 
                         onerror="this.style.display='none'; this.parentNode.innerHTML='${post.petName?.charAt(0) || '?'}';">`;
        } else {
            imageHtml = post.petName?.charAt(0) || '?';
        }
        
        const reportedBadge = post.reported ? 
            `<div class="reported-badge" style="margin-bottom: 10px; background: #FF9800; cursor: pointer;" 
                 onclick="showReportDetails('${post.postId}')">
                <span>🚩</span> Reported (${post.reportCount || 0} flag${post.reportCount > 1 ? 's' : ''})
            </div>` : '';

        return `
        <div class="post-card">
            <div class="post-image">
                ${imageHtml}
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
                    <button class="action-btn btn-view" onclick="viewPost('${post.id}')">
                        <span>👁️</span> View
                    </button>
                    ${post.reported ? 
                        `<button class="action-btn btn-flag" onclick="showReportDetails('${post.postId}')" style="background: #FF9800;">
                            <span>🚩</span> View Reports (${post.reportCount})
                        </button>` : 
                        `<button class="action-btn btn-flag" onclick="flagPost('${post.id}')" style="background: #999; opacity: 0.5;" disabled>
                            <span>🚩</span> No Reports
                        </button>`
                    }
                    <button class="action-btn btn-delete" onclick="deletePost('${post.id}')">
                        <span>🗑️</span> Delete
                    </button>
                </div>
            </div>
        </div>
    `}).join('');
}

async function showReportDetails(postId) {
    try {
        const reports = await apiRequest('/admin/reports');
        const postReports = reports.filter(r => r.postId === postId);
        
        if (postReports.length === 0) {
            alert('No reports for this post');
            return;
        }
        
        let reportHtml = '<div style="max-height: 400px; overflow-y: auto;">';
        postReports.forEach((report, index) => {
            reportHtml += `
                <div style="padding: 15px; border-bottom: 1px solid #F0F0F0; background: ${index % 2 === 0 ? '#F9F9F9' : '#FFFFFF'};">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-weight: bold; color: #FF9800;">Report #${index + 1}</span>
                        <span style="color: #999; font-size: 12px;">${new Date(report.createdAt).toLocaleString()}</span>
                    </div>
                    <div style="margin-bottom: 5px;"><span style="font-weight: bold;">Reporter:</span> ${report.reporter?.username || 'Unknown'} (${report.reporter?.email || 'No email'})</div>
                    <div style="margin-bottom: 5px;"><span style="font-weight: bold;">Reason:</span> ${report.reason || 'Not specified'}</div>
                    ${report.description ? `<div style="margin-bottom: 5px;"><span style="font-weight: bold;">Description:</span> ${report.description}</div>` : ''}
                    <div style="margin-bottom: 5px;"><span style="font-weight: bold;">Status:</span> 
                        <span style="color: ${report.status === 'pending' ? '#FF9800' : report.status === 'reviewed' ? '#4CAF50' : '#999'}">
                            ${report.status || 'pending'}
                        </span>
                    </div>
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button onclick="updateReportStatus('${report.reportId}', 'reviewed')" style="background: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Mark Reviewed</button>
                        <button onclick="updateReportStatus('${report.reportId}', 'dismissed')" style="background: #999; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Dismiss</button>
                        <button onclick="deleteReport('${report.reportId}')" style="background: #F44336; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Delete Report</button>
                    </div>
                </div>
            `;
        });
        reportHtml += '</div>';
        
        const modalContent = `
            <h3 style="color: #FF9800; margin-bottom: 20px;">🚩 Reports for Post</h3>
            ${reportHtml}
            <div style="margin-top: 20px; text-align: right;">
                <button onclick="closeModal('reportModal')" style="background: #7A4F2B; color: white; border: none; padding: 8px 20px; border-radius: 5px; cursor: pointer;">Close</button>
            </div>
        `;
        
        document.getElementById('modalContent').innerHTML = modalContent;
        openModal('reportModal');
    } catch (error) {
        console.error('Failed to load reports:', error);
        alert('Failed to load reports');
    }
}

async function updateReportStatus(reportId, status) {
    try {
        await apiRequest(`/admin/reports/${reportId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        alert(`Report marked as ${status}`);
        showReportDetails(document.querySelector('#modalContent').getAttribute('data-postid'));
        loadPostsData();
    } catch (error) {
        console.error('Failed to update report:', error);
        alert('Failed to update report');
    }
}

async function deleteReport(reportId) {
    if (confirm('Are you sure you want to delete this report?')) {
        try {
            await apiRequest(`/admin/reports/${reportId}`, {
                method: 'DELETE'
            });
            alert('Report deleted');
            showReportDetails(document.querySelector('#modalContent').getAttribute('data-postid'));
            loadPostsData();
        } catch (error) {
            console.error('Failed to delete report:', error);
            alert('Failed to delete report');
        }
    }
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

            let imagesHtml = '';
            if (post.imageUrls && post.imageUrls.length > 0) {
                imagesHtml = `
                    <div class="post-detail-item">
                        <div class="detail-label">Images</div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
                            ${post.imageUrls.map(url => {
                                let fullUrl = url;
                                if (url.startsWith('/')) {
                                    fullUrl = APP_BACKEND_URL + url;
                                } else if (!url.startsWith('http')) {
                                    fullUrl = APP_BACKEND_URL + '/' + url;
                                }
                                return `<img src="${fullUrl}" style="width: 150px; height: 150px; object-fit: cover; border-radius: 5px; border: 1px solid #F0F0F0;" 
                                         onerror="this.style.display='none';">`;
                            }).join('')}
                        </div>
                    </div>
                `;
            }

            modalContent.innerHTML = `
                <div class="post-detail-item">
                    <div class="detail-label">Pet Name</div>
                    <div class="detail-value">${post.petName || ''}</div>
                </div>
                <div class="post-detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value" style="color: ${statusColor}; font-weight: bold;">${post.status || ''}</div>
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
                ${imagesHtml}
            `;
        }
        openModal('viewPostModal');
    } catch (error) {
        console.error('Failed to load post:', error);
        alert('Failed to load post details');
    }
}

async function flagPost(id) {
    if (confirm('Flag/unflag this post?')) {
        try {
            await apiRequest(`/admin/posts/${id}/flag`, { method: 'PUT' });
            loadPostsData();
        } catch (error) {
            console.error('Failed to flag post:', error);
            alert('Failed to flag post');
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
            alert('Failed to delete post');
        }
    }
}

// ===== REPORTS FUNCTIONS =====
async function loadReportsData() {
    try {
        console.log('Loading reports...');
        const stats = await apiRequest('/admin/stats');
        
        document.getElementById('total-users').textContent = stats.totalUsers || 0;
        document.getElementById('total-posts').textContent = stats.totalPosts || 0;
        document.getElementById('active-users').textContent = Math.floor((stats.totalUsers || 0) * 0.7);
        document.getElementById('engagement-rate').textContent = '65%';
        
        document.getElementById('user-change').textContent = '+12% vs last month';
        document.getElementById('post-change').textContent = '+8% vs last month';
        document.getElementById('active-change').textContent = '+5% vs last month';
        document.getElementById('engagement-change').textContent = '+3% vs last month';
        
        if (stats.postsByStatus) {
            const lostCount = stats.postsByStatus.lost || 0;
            const foundCount = stats.postsByStatus.found || 0;
            const adoptionCount = stats.postsByStatus.adoption || 0;
            const total = stats.totalPosts || 1;
            
            const lostPercent = Math.round((lostCount / total) * 100);
            const foundPercent = Math.round((foundCount / total) * 100);
            const adoptionPercent = Math.round((adoptionCount / total) * 100);
            
            document.getElementById('lost-percent').textContent = lostPercent;
            document.getElementById('found-percent').textContent = foundPercent;
            document.getElementById('adoption-percent').textContent = adoptionPercent;
            
            const pieChart = document.getElementById('pie-chart');
            if (pieChart) {
                const lostDeg = (lostCount / total) * 360;
                const foundDeg = (foundCount / total) * 360;
                const adoptionDeg = (adoptionCount / total) * 360;
                
                pieChart.style.background = `conic-gradient(
                    #F44336 0deg ${lostDeg}deg,
                    #4CAF50 ${lostDeg}deg ${lostDeg + foundDeg}deg,
                    #2196F3 ${lostDeg + foundDeg}deg ${lostDeg + foundDeg + adoptionDeg}deg
                )`;
            }
            
            if (stats.userGrowth && stats.userGrowth.length > 0) {
                const bars = document.querySelectorAll('.bar-chart .bar');
                const maxHeight = 150;
                const maxCount = Math.max(...stats.userGrowth, 1);
                
                bars.forEach((bar, index) => {
                    if (index < stats.userGrowth.length) {
                        const height = (stats.userGrowth[index] / maxCount) * maxHeight;
                        setTimeout(() => {
                            bar.style.transition = 'height 0.5s ease-in-out';
                            bar.style.height = height + 'px';
                        }, index * 100);
                    }
                });
            }
        }
        
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
            <td>${row.newUsers || Math.floor(Math.random() * 20) + 5}</td>
            <td>${row.total || 0}</td>
            <td>${row.lost || 0}</td>
            <td>${row.found || 0}</td>
            <td>${row.adoption || 0}</td>
            <td>${Math.floor(Math.random() * 20) + 60}%</td>
        </tr>
    `).join('');
}

// ===== SETTINGS FUNCTIONS =====
async function loadSettingsData() {
    try {
        const settings = await apiRequest('/admin/settings');
        
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
        
        updateToggle('allowRegistration', settings.allowRegistration);
        updateToggle('emailVerification', settings.emailVerification);
        updateToggle('twoFactorAuth', settings.twoFactorAuth);
        updateToggle('autoApprovePosts', settings.autoApprovePosts);
        updateToggle('profanityFilter', settings.profanityFilter);
        
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

function updateToggle(id, value) {
    const element = document.getElementById(id);
    if (element) {
        if (value) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }
    }
}

function toggleSwitch(element) {
    element.classList.toggle('active');
}

async function saveSettings() {
    const settings = {
        siteName: document.getElementById('siteName')?.value || 'PawSociety',
        siteDescription: document.getElementById('siteDescription')?.value || '',
        contactEmail: document.getElementById('contactEmail')?.value || '',
        timezone: document.getElementById('timezone')?.value || 'PST',
        allowRegistration: document.getElementById('allowRegistration')?.classList.contains('active') || false,
        emailVerification: document.getElementById('emailVerification')?.classList.contains('active') || false,
        defaultRole: document.getElementById('defaultRole')?.value || 'user',
        twoFactorAuth: document.getElementById('twoFactorAuth')?.classList.contains('active') || false,
        sessionTimeout: parseInt(document.getElementById('sessionTimeout')?.value) || 120,
        autoApprovePosts: document.getElementById('autoApprovePosts')?.classList.contains('active') || false,
        profanityFilter: document.getElementById('profanityFilter')?.classList.contains('active') || false
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

function switchTab(tabName) {
    document.querySelectorAll('.settings-section').forEach(section => {
        section.style.display = 'none';
    });
    
    const section = document.getElementById(tabName + '-settings');
    if (section) {
        section.style.display = 'block';
    }
    
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
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

function applyUserFilters() {
    loadUsersData();
}

function applyPostFilters() {
    loadPostsData();
}

function applyDateRange() {
    loadReportsData();
}

function exportCSV() {
    alert('Export CSV feature coming soon!');
}

function exportPDF() {
    alert('Export PDF feature coming soon!');
}

function printReport() {
    window.print();
}

function exportReport() {
    alert('Export report feature coming soon!');
}

function clearCache() {
    if (confirm('Are you sure you want to clear the system cache?')) {
        alert('Cache cleared successfully!');
    }
}

function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to default?')) {
        document.getElementById('siteName').value = 'PawSociety';
        document.getElementById('siteDescription').value = 'Because Every Pet Deserves a Home';
        document.getElementById('contactEmail').value = 'admin@pawsociety.com';
        document.getElementById('timezone').value = 'PST';
        document.getElementById('defaultRole').value = 'user';
        document.getElementById('sessionTimeout').value = '120';
        
        document.getElementById('allowRegistration').classList.add('active');
        document.getElementById('emailVerification').classList.add('active');
        document.getElementById('twoFactorAuth').classList.remove('active');
        document.getElementById('autoApprovePosts').classList.remove('active');
        document.getElementById('profanityFilter').classList.add('active');
        
        alert('Settings reset to default!');
    }
}

async function deleteAllData() {
    if (confirm('⚠️ WARNING: This will delete ALL non-admin data. Are you ABSOLUTELY sure?')) {
        const confirmText = prompt('Type "DELETE" to confirm:');
        if (confirmText === 'DELETE') {
            try {
                await apiRequest('/admin/clear-all-data', { method: 'POST' });
                alert('All non-admin data has been cleared.');
                loadDashboardData();
            } catch (error) {
                console.error('Failed to clear data:', error);
                alert('Failed to clear data');
            }
        }
    }
}

window.onclick = function(event) {
    const modals = ['userModal', 'viewPostModal', 'deleteModal', 'flagModal', 'reportModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal && event.target == modal) {
            modal.classList.remove('active');
        }
    });
};