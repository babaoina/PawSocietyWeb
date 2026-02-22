const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database');
const bcrypt = require('bcryptjs');

// Middleware to verify admin token
const verifyAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, 'your-secret-key-change-this');
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Apply middleware to all routes
router.use(verifyAdmin);

// Verify token endpoint
router.get('/verify', (req, res) => {
    res.json({ valid: true, user: req.user });
});

// ===== DASHBOARD STATS =====
router.get('/stats', (req, res) => {
    let stats = {
        totalUsers: 0,
        totalPosts: 0,
        lostPets: 0,
        adoptions: 0,
        userGrowth: [0, 0, 0, 0, 0, 0, 0],
        postsByStatus: { lost: 0, found: 0, adoption: 0 },
        recentActivity: []
    };
    
    db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
        stats.totalUsers = result?.count || 0;
        
        db.get('SELECT COUNT(*) as count FROM posts', (err, result) => {
            stats.totalPosts = result?.count || 0;
            
            db.get('SELECT COUNT(*) as count FROM posts WHERE status = "Lost"', (err, result) => {
                stats.lostPets = result?.count || 0;
                stats.postsByStatus.lost = result?.count || 0;
                
                db.get('SELECT COUNT(*) as count FROM posts WHERE status = "Adoption"', (err, result) => {
                    stats.adoptions = result?.count || 0;
                    stats.postsByStatus.adoption = result?.count || 0;
                    
                    db.get('SELECT COUNT(*) as count FROM posts WHERE status = "Found"', (err, result) => {
                        stats.postsByStatus.found = result?.count || 0;
                        
                        // Get recent activity (last 5 posts)
                        db.all('SELECT * FROM posts ORDER BY created_at DESC LIMIT 5', (err, posts) => {
                            if (posts) {
                                stats.recentActivity = posts.map(p => ({
                                    type: p.status === 'Lost' ? 'lost' : p.status === 'Found' ? 'post' : 'adoption',
                                    text: `${p.petName} - ${p.status} post`,
                                    time: new Date(p.created_at).toLocaleDateString(),
                                    status: p.reported ? 'pending' : 'new'
                                }));
                            }
                            res.json(stats);
                        });
                    });
                });
            });
        });
    });
});

// ===== USERS =====
router.get('/users', (req, res) => {
    db.all(`
        SELECT id, username as name, email, role, status, 
               created_at as joined,
               (SELECT COUNT(*) FROM posts WHERE userName = users.username) as posts
        FROM users 
        ORDER BY created_at DESC
    `, (err, users) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(users || []);
    });
});

router.get('/users/:id', (req, res) => {
    db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    });
});

router.post('/users', (req, res) => {
    const { name, email, role, status, password } = req.body;
    
    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email required' });
    }
    
    const hashedPassword = password ? bcrypt.hashSync(password, 10) : bcrypt.hashSync('default123', 10);
    const username = name.toLowerCase().replace(/\s+/g, '_');
    
    db.run(
        'INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
        [username, email, hashedPassword, role || 'user', status || 'Active'],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, success: true });
        }
    );
});

router.put('/users/:id', (req, res) => {
    const { name, email, role, status } = req.body;
    const username = name.toLowerCase().replace(/\s+/g, '_');
    
    db.run(
        'UPDATE users SET username = ?, email = ?, role = ?, status = ? WHERE id = ?',
        [username, email, role, status, req.params.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        }
    );
});

router.delete('/users/:id', (req, res) => {
    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'User deleted', id: req.params.id });
    });
});

// ===== POSTS =====
router.get('/posts', (req, res) => {
    db.all('SELECT * FROM posts ORDER BY created_at DESC', (err, posts) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Format posts for frontend
        const formattedPosts = posts.map(p => ({
            ...p,
            userAvatar: p.userName?.charAt(0).toUpperCase() || '?',
            comments: 0,
            time: new Date(p.created_at).toLocaleDateString()
        }));
        
        res.json(formattedPosts || []);
    });
});

router.get('/posts/:id', (req, res) => {
    db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, post) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json(post);
    });
});

router.put('/posts/:id/flag', (req, res) => {
    db.get('SELECT reported, reportCount FROM posts WHERE id = ?', [req.params.id], (err, post) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        const newReported = !post.reported;
        const newCount = newReported ? (post.reportCount || 0) + 1 : 0;
        
        db.run(
            'UPDATE posts SET reported = ?, reportCount = ? WHERE id = ?',
            [newReported ? 1 : 0, newCount, req.params.id],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, reported: newReported });
            }
        );
    });
});

router.delete('/posts/:id', (req, res) => {
    db.run('DELETE FROM posts WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Post deleted', id: req.params.id });
    });
});

// ===== REPORTS =====
router.get('/reports/summary', (req, res) => {
    const { start, end } = req.query;
    
    db.all(`
        SELECT 
            strftime('%Y-%m', created_at) as month,
            COUNT(CASE WHEN status = 'Lost' THEN 1 END) as lost,
            COUNT(CASE WHEN status = 'Found' THEN 1 END) as found,
            COUNT(CASE WHEN status = 'Adoption' THEN 1 END) as adoption,
            COUNT(*) as total
        FROM posts
        WHERE date(created_at) BETWEEN date(?) AND date(?)
        GROUP BY month
        ORDER BY month DESC
    `, [start || '2024-01-01', end || '2024-12-31'], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows || []);
    });
});

// ===== SETTINGS =====
router.get('/settings', (req, res) => {
    db.get('SELECT * FROM settings WHERE id = 1', (err, settings) => {
        if (err || !settings) {
            // Return default settings
            res.json({
                siteName: 'PawSociety',
                siteDescription: 'Because Every Pet Deserves a Home',
                contactEmail: 'admin@pawsociety.com',
                timezone: 'PST',
                allowRegistration: true,
                emailVerification: true,
                defaultRole: 'user',
                twoFactorAuth: false,
                sessionTimeout: 120,
                autoApprovePosts: true,
                profanityFilter: true
            });
        } else {
            res.json(settings);
        }
    });
});

router.put('/settings', (req, res) => {
    const settings = req.body;
    
    db.run(`
        INSERT OR REPLACE INTO settings (id, siteName, siteDescription, contactEmail, timezone, 
            allowRegistration, emailVerification, defaultRole, twoFactorAuth, sessionTimeout, 
            autoApprovePosts, profanityFilter)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        settings.siteName,
        settings.siteDescription,
        settings.contactEmail,
        settings.timezone,
        settings.allowRegistration ? 1 : 0,
        settings.emailVerification ? 1 : 0,
        settings.defaultRole,
        settings.twoFactorAuth ? 1 : 0,
        settings.sessionTimeout,
        settings.autoApprovePosts ? 1 : 0,
        settings.profanityFilter ? 1 : 0
    ], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// Clear all data (danger zone)
router.post('/clear-all-data', (req, res) => {
    db.serialize(() => {
        db.run('DELETE FROM posts');
        db.run('DELETE FROM users WHERE role != "admin"');
    });
    res.json({ message: 'All non-admin data cleared' });
});

module.exports = router;