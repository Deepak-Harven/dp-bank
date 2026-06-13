const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const userSessions = {};
const agentSessions = {};

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Users Table - Added account_number
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            balance REAL,
            account_number TEXT UNIQUE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            type TEXT,
            amount REAL,
            description TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS contact_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            message TEXT,
            status TEXT DEFAULT 'unread',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

function logTransaction(username, type, amount, description, callback) {
    db.run(
        `INSERT INTO transactions (username, type, amount, description) VALUES (?, ?, ?, ?)`,
        [username, type, amount, description],
        callback
    );
}

// 1. Register
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const startingBalance = 1000.00;
    // Generate a 5-digit account number (10000 to 99999)
    const accountNumber = Math.floor(10000 + Math.random() * 90000).toString();
    
    db.run(`INSERT INTO users (username, password, balance, account_number) VALUES (?, ?, ?, ?)`, 
    [username, password, startingBalance, accountNumber], function(err) {
        if (err) {
            if (err.message.includes('username')) return res.status(400).json({ error: 'Username already exists' });
            if (err.message.includes('account_number')) return res.status(500).json({ error: 'Account number collision, try again' });
            return res.status(500).json({ error: 'Database error' });
        }
        
        logTransaction(username, 'deposit', startingBalance, 'Initial Sign-up Bonus', (err) => {
            res.status(201).json({ message: 'User registered' });
        });
    });
});

// 2. Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(401).json({ error: 'Invalid credentials' });
        // Generate a token
        const token = crypto.randomBytes(32).toString('hex');
        userSessions[token] = row.username;
        // Return account number as well
        res.status(200).json({ token, username: row.username, balance: row.balance, accountNumber: row.account_number });
    });
});

// 2.5 Verify User Session
app.post('/api/verify-session', (req, res) => {
    const { token } = req.body;
    const username = userSessions[token];
    if (!username) return res.status(401).json({ error: 'Invalid token' });
    
    db.get(`SELECT balance, account_number FROM users WHERE username = ?`, [username], (err, row) => {
        if (err || !row) return res.status(401).json({ error: 'User not found' });
        res.status(200).json({ username, balance: row.balance, accountNumber: row.account_number });
    });
});

// 3. Reset Password
app.post('/api/reset-password', (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) return res.status(400).json({ error: 'All fields are required' });

    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(401).json({ error: 'Invalid username' });

        db.run(`UPDATE users SET password = ? WHERE username = ?`, [newPassword, username], function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.status(200).json({ message: 'Password reset successfully' });
        });
    });
});

// 4. Get Transactions
app.get('/api/transactions', (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Username required' });

    db.all(`SELECT * FROM transactions WHERE username = ? ORDER BY timestamp DESC LIMIT 50`, [username], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(200).json(rows);
    });
});

// 4. Deposit
app.post('/api/deposit', (req, res) => {
    const { username, amount } = req.body;
    if (!username || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    db.run(`UPDATE users SET balance = balance + ? WHERE username = ?`, [amount, username], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        logTransaction(username, 'deposit', amount, 'Manual Deposit', (err) => {
            db.get(`SELECT balance FROM users WHERE username = ?`, [username], (err, row) => {
                res.status(200).json({ message: 'Deposit successful', balance: row.balance });
            });
        });
    });
});

// 5. Withdraw
app.post('/api/withdraw', (req, res) => {
    const { username, amount } = req.body;
    if (!username || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    db.get(`SELECT balance FROM users WHERE username = ?`, [username], (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'User not found' });
        if (row.balance < amount) return res.status(400).json({ error: 'Insufficient funds' });

        db.run(`UPDATE users SET balance = balance - ? WHERE username = ?`, [amount, username], function(err) {
            logTransaction(username, 'withdraw', amount, 'Manual Withdrawal', (err) => {
                db.get(`SELECT balance FROM users WHERE username = ?`, [username], (err, row) => {
                    res.status(200).json({ message: 'Withdrawal successful', balance: row.balance });
                });
            });
        });
    });
});

// 6. Transfer (Updated to use toAccount instead of toUser)
app.post('/api/transfer', (req, res) => {
    const { fromUser, toAccount, amount } = req.body;
    if (!fromUser || !toAccount || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid details' });

    // Check sender balance
    db.get(`SELECT * FROM users WHERE username = ?`, [fromUser], (err, sender) => {
        if (err || !sender) return res.status(400).json({ error: 'Sender not found' });
        if (sender.balance < amount) return res.status(400).json({ error: 'Insufficient funds' });
        
        if (sender.account_number === toAccount) return res.status(400).json({ error: 'Cannot transfer to yourself' });

        // Check recipient exists by account number
        db.get(`SELECT * FROM users WHERE account_number = ?`, [toAccount], (err, recipient) => {
            if (err || !recipient) return res.status(400).json({ error: 'Recipient account number not found' });

            // Perform transfer in a transaction
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run(`UPDATE users SET balance = balance - ? WHERE username = ?`, [amount, fromUser]);
                db.run(`UPDATE users SET balance = balance + ? WHERE account_number = ?`, [amount, toAccount]);
                
                logTransaction(fromUser, 'withdraw', amount, `Transfer to A/C: ${toAccount}`, () => {});
                logTransaction(recipient.username, 'deposit', amount, `Transfer from ${fromUser}`, () => {});
                
                db.run('COMMIT', (err) => {
                    if (err) return res.status(500).json({ error: 'Transfer failed' });
                    db.get(`SELECT balance FROM users WHERE username = ?`, [fromUser], (err, newSender) => {
                        res.status(200).json({ message: 'Transfer successful', balance: newSender.balance });
                    });
                });
            });
        });
    });
});

// 7. Agent Login
let agentPassword = 'securepassword';
const AGENT_CODE = 'AGENT007';

app.post('/api/agent-login', (req, res) => {
    const { agentCode, password } = req.body;
    if (agentCode === AGENT_CODE && password === agentPassword) {
        const token = crypto.randomBytes(32).toString('hex');
        agentSessions[token] = agentCode;
        res.status(200).json({ success: true, token });
    } else {
        res.status(401).json({ error: 'Invalid agent credentials' });
    }
});

app.post('/api/agent-verify-session', (req, res) => {
    const { token } = req.body;
    if (agentSessions[token] === AGENT_CODE) {
        res.status(200).json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid token' });
    }
});

app.post('/api/agent-reset-password', (req, res) => {
    const { agentCode, newPassword } = req.body;
    if (agentCode === AGENT_CODE) {
        agentPassword = newPassword;
        res.status(200).json({ message: 'Agent password reset successfully' });
    } else {
        res.status(401).json({ error: 'Invalid agent code' });
    }
});

// 8. Agent Get All Users
app.get('/api/admin/users', (req, res) => {
    db.all(`SELECT id, username, balance, account_number FROM users`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(200).json(rows);
    });
});

// 9. Submit contact message (Public)
app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    db.run(
        `INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)`,
        [name, email, message],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.status(201).json({ message: 'Message sent successfully' });
        }
    );
});

// 10. Get all contact messages (Agent only, protected)
app.get('/api/contact-messages', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token || agentSessions[token] !== AGENT_CODE) {
        return res.status(401).json({ error: 'Unauthorized agent access' });
    }
    db.all(`SELECT * FROM contact_messages ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(200).json(rows);
    });
});

// 11. Mark contact message as read (Agent only, protected)
app.put('/api/contact-messages/:id/read', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token || agentSessions[token] !== AGENT_CODE) {
        return res.status(401).json({ error: 'Unauthorized agent access' });
    }
    const { id } = req.params;
    db.run(
        `UPDATE contact_messages SET status = 'read' WHERE id = ?`,
        [id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.status(200).json({ message: 'Message marked as read' });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
