// config.js
const config = {
    JSONBIN_API_KEY: '$2a$10$m3ykh1NKxmtQDVM140H6TOTqsemkiBEdfdQnG/ApyhjJ1Duj2Ri6W', // jsonbin.io API anahtarınız
    JSONBIN_BIN_ID: '6790041facd3cb34a8d0b6d0',           // jsonbin.io Bin ID'niz
    VERSION: '1.0.0'
};

// Veritabanı işlemleri için API sınıfı
class FaucetAPI {
    constructor() {
        this.baseURL = 'https://api.jsonbin.io/v3/b/';
        this.headers = {
            'X-Master-Key': config.JSONBIN_API_KEY,
            'Content-Type': 'application/json'
        };
    }

    // Tüm verileri getir
    async getData() {
        try {
            const response = await axios.get(`${this.baseURL}${config.JSONBIN_BIN_ID}`, {
                headers: this.headers
            });
            return response.data.record;
        } catch (error) {
            console.error('Veri getirme hatası:', error);
            throw error;
        }
    }

    // Verileri güncelle
    async updateData(data) {
        try {
            await axios.put(`${this.baseURL}${config.JSONBIN_BIN_ID}`, data, {
                headers: this.headers
            });
            return true;
        } catch (error) {
            console.error('Veri güncelleme hatası:', error);
            throw error;
        }
    }

    // Kullanıcı girişi
    async login(email, password) {
        const data = await this.getData();
        
        // Admin girişi kontrolü
        if (email === data.settings.admin.email && password === data.settings.admin.password) {
            return {
                success: true,
                isAdmin: true,
                userData: data.settings.admin
            };
        }

        // Normal kullanıcı girişi
        const user = data.users.find(u => u.email === email && u.password === password);
        if (user) {
            return {
                success: true,
                isAdmin: false,
                userData: user
            };
        }

        return { success: false };
    }

    // Yeni kullanıcı kaydı
    async register(email, password, faucetpay_email) {
        const data = await this.getData();
        
        // Email kontrolü
        if (data.users.some(u => u.email === email)) {
            throw new Error('Bu email zaten kayıtlı!');
        }

        // Yeni kullanıcı oluştur
        const newUser = {
            id: data.users.length + 1,
            email,
            password,
            faucetpay_email,
            balance: 0,
            last_claim: null,
            created_at: new Date().toISOString(),
            transactions: []
        };

        // Kullanıcıyı ekle ve istatistikleri güncelle
        data.users.push(newUser);
        data.statistics.total_users++;

        // Veritabanını güncelle
        await this.updateData(data);
        return newUser;
    }

    // Claim işlemi
    async claim(userId) {
        const data = await this.getData();
        const userIndex = data.users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            throw new Error('Kullanıcı bulunamadı!');
        }

        const user = data.users[userIndex];
        const now = new Date();
        const lastClaim = user.last_claim ? new Date(user.last_claim) : null;

        // Cooldown kontrolü
        if (lastClaim && (now - lastClaim) < (data.settings.cooldown_time * 1000)) {
            throw new Error('Lütfen bir sonraki claim için bekleyin!');
        }

        // Claim işlemini gerçekleştir
        const transaction = {
            id: user.transactions.length + 1,
            type: 'claim',
            amount: data.settings.claim_amount,
            timestamp: now.toISOString(),
            status: 'success'
        };

        user.balance += data.settings.claim_amount;
        user.last_claim = now.toISOString();
        user.transactions.unshift(transaction);

        // İstatistikleri güncelle
        data.statistics.total_claims++;
        data.statistics.total_amount_claimed += data.settings.claim_amount;

        await this.updateData(data);
        return user;
    }

    // Çekim işlemi
    async withdraw(userId) {
        const data = await this.getData();
        const userIndex = data.users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            throw new Error('Kullanıcı bulunamadı!');
        }

        const user = data.users[userIndex];

        if (user.balance < data.settings.min_withdrawal) {
            throw new Error('Yetersiz bakiye!');
        }

        const transaction = {
            id: user.transactions.length + 1,
            type: 'withdraw',
            amount: user.balance,
            timestamp: new Date().toISOString(),
            status: 'success'
        };

        // İstatistikleri güncelle
        data.statistics.total_withdrawals++;
        data.statistics.total_amount_withdrawn += user.balance;

        // Bakiyeyi sıfırla ve işlemi kaydet
        user.transactions.unshift(transaction);
        user.balance = 0;

        await this.updateData(data);
        return user;
    }

    // Admin: Tüm kullanıcıları getir
    async getAllUsers() {
        const data = await this.getData();
        return data.users;
    }

    // Admin: İstatistikleri getir
    async getStatistics() {
        const data = await this.getData();
        return data.statistics;
    }

    // Admin: Ayarları güncelle
    async updateSettings(newSettings) {
        const data = await this.getData();
        data.settings = { ...data.settings, ...newSettings };
        await this.updateData(data);
        return data.settings;
    }
}

// API örneği oluştur
const faucetAPI = new FaucetAPI();

// Global state yönetimi
const state = {
    currentUser: null,
    isAdmin: false
};
