// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const app = express();
const port = 3000;

// Şifreleme anahtarı
const ENCRYPTION_KEY = crypto.randomBytes(32);
const IV_LENGTH = 16;

// Veritabanı bağlantısı
const db = new sqlite3.Database('faucet.db');

// Tablo oluşturma
db.serialize(() => {
    // Kullanıcılar tablosu
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Bakiyeler tablosu
    db.run(`CREATE TABLE IF NOT EXISTS balances (
        user_id INTEGER,
        amount INTEGER DEFAULT 0,
        last_mining DATETIME,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Kuponlar tablosu
    db.run(`CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        amount INTEGER,
        used INTEGER DEFAULT 0,
        used_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(used_by) REFERENCES users(id)
    )`);

    // Mining geçmişi tablosu
    db.run(`CREATE TABLE IF NOT EXISTS mining_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        amount INTEGER,
        mined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Kupon kullanım geçmişi
    db.run(`CREATE TABLE IF NOT EXISTS coupon_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coupon_id INTEGER,
        user_id INTEGER,
        used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(coupon_id) REFERENCES coupons(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

// Şifreleme fonksiyonları
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// Middleware
app.use(express.json());
app.use(express.static('public'));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

// Kayıt ol
app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    const encryptedPassword = encrypt(password);

    db.run('INSERT INTO users (email, password) VALUES (?, ?)', 
        [email, encryptedPassword], function(err) {
            if (err) {
                return res.status(400).json({ error: 'Bu email zaten kayıtlı' });
            }

            db.run('INSERT INTO balances (user_id, amount, last_mining) VALUES (?, 0, 0)',
                [this.lastID]);

            res.json({ success: true });
    });
});

// Giriş yap
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'Kullanıcı bulunamadı' });
        }

        const decryptedPassword = decrypt(user.password);
        if (password !== decryptedPassword) {
            return res.status(400).json({ error: 'Geçersiz şifre' });
        }

        db.get('SELECT amount, last_mining FROM balances WHERE user_id = ?',
            [user.id], (err, balance) => {
                res.json({
                    success: true,
                    isAdmin: email === 'admin@example.com',
                    userId: user.id,
                    balance: balance.amount,
                    lastMining: balance.last_mining
                });
        });
    });
});

// Mining
app.post('/api/mine', (req, res) => {
    const { userId } = req.body;
    const now = Date.now();

    db.get('SELECT last_mining FROM balances WHERE user_id = ?', [userId], 
        (err, balance) => {
            if (now - balance.last_mining < 7 * 60 * 60 * 1000) {
                return res.status(400).json({ error: 'Mining için bekleme süresi dolmamış' });
            }

            const reward = Math.floor(Math.random() * 10) + 1;

            db.run(`UPDATE balances 
                   SET amount = amount + ?, last_mining = ? 
                   WHERE user_id = ?`, 
                [reward, now, userId]);

            db.run(`INSERT INTO mining_history (user_id, amount) 
                   VALUES (?, ?)`, [userId, reward]);

            db.get('SELECT amount FROM balances WHERE user_id = ?', 
                [userId], (err, newBalance) => {
                    res.json({
                        success: true,
                        reward,
                        balance: newBalance.amount
                    });
            });
    });
});

// Kupon kullan
app.post('/api/redeem', (req, res) => {
    const { userId, code } = req.body;

    db.get('SELECT * FROM coupons WHERE code = ? AND used = 0', [code],
        (err, coupon) => {
            if (err || !coupon) {
                return res.status(400).json({ error: 'Geçersiz veya kullanılmış kupon' });
            }

            db.run('BEGIN TRANSACTION');

            db.run('UPDATE coupons SET used = 1, used_by = ? WHERE id = ?',
                [userId, coupon.id]);

            db.run('UPDATE balances SET amount = amount + ? WHERE user_id = ?',
                [coupon.amount, userId]);

            db.run(`INSERT INTO coupon_history (coupon_id, user_id) 
                   VALUES (?, ?)`, [coupon.id, userId]);

            db.run('COMMIT');

            db.get('SELECT amount FROM balances WHERE user_id = ?',
                [userId], (err, balance) => {
                    res.json({
                        success: true,
                        amount: coupon.amount,
                        balance: balance.amount
                    });
            });
    });
});

// Admin: Kupon oluştur
app.post('/api/admin/create-coupons', (req, res) => {
    const { amount, count } = req.body;

    const coupons = [];
    let query = 'INSERT INTO coupons (code, amount) VALUES ';
    const values = [];

    for (let i = 0; i < count; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        coupons.push({ code, amount });
        query += '(?, ?),';
        values.push(code, amount);
    }

    query = query.slice(0, -1); // Son virgülü kaldır

    db.run(query, values, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Kupon oluşturma hatası' });
        }
        res.json({ success: true, coupons });
    });
});

// Admin: İstatistikler
app.get('/api/admin/stats', (req, res) => {
    db.get(`SELECT 
            COUNT(DISTINCT u.id) as totalUsers,
            SUM(b.amount) as totalTokens,
            COUNT(CASE WHEN b.amount > 0 THEN 1 END) as activeMining
            FROM users u
            LEFT JOIN balances b ON u.id = b.user_id`,
        (err, stats) => {
            if (err) {
                return res.status(500).json({ error: 'İstatistik hatası' });
            }
            res.json(stats);
    });
});

// Admin: Detaylı kullanıcı listesi
app.get('/api/admin/users', (req, res) => {
    db.all(`SELECT 
            u.email,
            u.created_at,
            b.amount as balance,
            b.last_mining,
            COUNT(DISTINCT m.id) as total_mining,
            COUNT(DISTINCT c.id) as total_coupons
            FROM users u
            LEFT JOIN balances b ON u.id = b.user_id
            LEFT JOIN mining_history m ON u.id = m.user_id
            LEFT JOIN coupon_history c ON u.id = c.user_id
            GROUP BY u.id`,
        (err, users) => {
            if (err) {
                return res.status(500).json({ error: 'Kullanıcı listesi hatası' });
            }
            res.json(users);
    });
});

// Sunucuyu başlat
app.listen(port, () => {
    console.log(`Server çalışıyor: http://localhost:${port}`);
});
