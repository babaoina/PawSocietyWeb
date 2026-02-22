const db = require('./database');
const bcrypt = require('bcryptjs');

// Add sample users
const users = [
    ['john_doe', 'john@email.com', bcrypt.hashSync('password123', 10), 'user', 'Active'],
    ['jane_smith', 'jane@email.com', bcrypt.hashSync('password123', 10), 'admin', 'Active'],
    ['mike_brown', 'mike@email.com', bcrypt.hashSync('password123', 10), 'user', 'Suspended']
];

users.forEach(user => {
    db.run(
        'INSERT OR IGNORE INTO users (username, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
        user
    );
});

// Add sample posts
const posts = [
    ['Max', 'Lost', 'john_doe', 'San Carlos', 'Lost Shih Tzu, brown and white', '09123456789', 0, 0],
    ['Luna', 'Lost', 'mary_cruz', 'Davao', 'Lost Siamese cat, blue eyes', '09234567890', 1, 3],
    ['Labrador Puppies', 'Adoption', 'rescueorg', 'Cebu', '3 adorable Labrador puppies', '09123456789', 0, 0]
];

posts.forEach(post => {
    db.run(
        'INSERT OR IGNORE INTO posts (petName, status, userName, location, description, contact, reported, reportCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        post
    );
});

console.log('✅ Sample data added');
process.exit();