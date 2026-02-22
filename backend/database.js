const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'pawsociety.db');
const db = new sqlite3.Database(dbPath);

// Create tables
db.serialize(() => {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'user',
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Posts table
    db.run(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            petName TEXT,
            status TEXT,
            userName TEXT,
            location TEXT,
            description TEXT,
            contact TEXT,
            reported INTEGER DEFAULT 0,
            reportCount INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Settings table
    db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY,
            siteName TEXT,
            siteDescription TEXT,
            contactEmail TEXT,
            timezone TEXT,
            allowRegistration INTEGER DEFAULT 1,
            emailVerification INTEGER DEFAULT 1,
            defaultRole TEXT DEFAULT 'user',
            twoFactorAuth INTEGER DEFAULT 0,
            sessionTimeout INTEGER DEFAULT 120,
            autoApprovePosts INTEGER DEFAULT 1,
            profanityFilter INTEGER DEFAULT 1
        )
    `);

    // Create default admin if not exists
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(
        `INSERT OR IGNORE INTO users (username, email, password, role) 
         VALUES (?, ?, ?, ?)`,
        ['admin', 'admin@pawsociety.com', adminPassword, 'admin']
    );

    // Insert default settings if not exists
    db.run(`
        INSERT OR IGNORE INTO settings (id, siteName, siteDescription, contactEmail, timezone)
        VALUES (1, 'PawSociety', 'Because Every Pet Deserves a Home', 'admin@pawsociety.com', 'PST')
    `);
});

console.log('✅ Database connected');
module.exports = db;