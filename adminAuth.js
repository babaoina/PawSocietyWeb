const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied. Please login.' });
    }
    
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user is admin
        if (verified.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access only' });
        }
        
        req.admin = verified;
        next();
    } catch (err) {
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};

module.exports = adminAuth;