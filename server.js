const express = require('express');
const fs = require('fs');
const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.static('./'));

// DB işlemleri
function readDB() {
    return JSON.parse(fs.readFileSync('db.json'));
}

function writeDB(data) {
    fs.writeFileSync('db.json', JSON.stringify(data, null, 2));
}

// CORS için
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

// Routes
app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    const db = readDB();
    
    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Bu email zaten kayıtlı' });
    }

    db.users.push({ email, password });
    db.balances[email] = 0;
    db.miningTimes[email] = 0;
    db.stats.totalUsers++;
    
    writeDB(db);
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const db = readDB();

    if (email === db.ADMIN_USER.email && password === db.ADMIN_USER.password) {
        return res.json({ success: true, isAdmin: true });
    }

    const user = db.users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(400).json({ error: 'Geçersiz email veya şifre' });
    }

    res.json({
        success: true,
        balance: db.balances[email],
        lastMining: db.miningTimes[email]
    });
});

app.post('/api/mine', (req, res) => {
    const { email } = req.body;
    const db = readDB();
    const now = Date.now();
    const lastMining = db.miningTimes[email] || 0;

    if (now - lastMining < 7 * 60 * 60 * 1000) {
        return res.status(400).json({ error: 'Mining için bekleme süresi dolmamış' });
    }

    const reward = Math.floor(Math.random() * 10) + 1;
    db.balances[email] = (db.balances[email] || 0) + reward;
    db.miningTimes[email] = now;
    db.stats.totalTokens += reward;
    
    writeDB(db);
    res.json({ success: true, reward, balance: db.balances[email] });
});

app.post('/api/redeem', (req, res) => {
    const { email, code } = req.body;
    const db = readDB();

    const coupon = db.coupons.find(c => c.code === code && !c.used);
    if (!coupon) {
        return res.status(400).json({ error: 'Geçersiz veya kullanılmış kupon' });
    }

    coupon.used = true;
    db.balances[email] = (db.balances[email] || 0) + coupon.amount;
    db.stats.totalTokens += coupon.amount;
    
    writeDB(db);
    res.json({ success: true, amount: coupon.amount, balance: db.balances[email] });
});

app.post('/api/admin/create-coupons', (req, res) => {
    const { email, amount, count } = req.body;
    const db = readDB();

    if (email !== db.ADMIN_USER.email) {
        return res.status(403).json({ error: 'Yetkisiz erişim' });
    }

    const newCoupons = Array(count).fill().map(() => ({
        code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        amount,
        used: false
    }));

    db.coupons.push(...newCoupons);
    writeDB(db);
    res.json({ success: true, coupons: newCoupons });
});

app.get('/api/admin/stats', (req, res) => {
    const db = readDB();
    res.json({
        totalUsers: db.stats.totalUsers,
        totalTokens: db.stats.totalTokens,
        activeMining: Object.values(db.balances).filter(b => b > 0).length,
        users: db.users.map(u => ({
            email: u.email,
            balance: db.balances[u.email] || 0,
            lastMining: db.miningTimes[u.email] || 0
        }))
    });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
