// faucetpay.js

class FaucetPayAPI {
    constructor() {
        this.baseURL = 'https://faucetpay.io/api/v1';
        this.config = {
            API_KEY: '88d438e8b45815b3dd22135ac66abf2c29ff3d6ff6d4c9926ce831b6e364dcaa',
            CURRENCY: 'TARA',
            MIN_WITHDRAWAL: 0.01000000,
            MAX_WITHDRAWAL: 1.00000000
        };
    }

    // API isteği gönderme yardımcı fonksiyonu
    async makeRequest(endpoint, data = {}) {
        try {
            // CORS proxy kullan (local geliştirme için)
            const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
            
            const response = await axios({
                method: 'POST',
                url: `${proxyUrl}${this.baseURL}${endpoint}`,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                },
                data: new URLSearchParams({
                    api_key: this.config.API_KEY,
                    currency: this.config.CURRENCY,
                    ...data
                })
            });

            if (response.data && response.data.status === 200) {
                return {
                    success: true,
                    data: response.data
                };
            } else {
                throw new Error(response.data?.message || 'FaucetPay API hatası');
            }
        } catch (error) {
            console.error('FaucetPay API Error:', error);
            
            // Kullanıcı dostu hata mesajları
            let errorMessage = 'Bir hata oluştu. ';
            
            if (error.response) {
                switch (error.response.status) {
                    case 401:
                        errorMessage += 'API anahtarı geçersiz.';
                        break;
                    case 402:
                        errorMessage += 'Yetersiz bakiye.';
                        break;
                    case 405:
                        errorMessage += 'Geçersiz ödeme miktarı.';
                        break;
                    case 456:
                        errorMessage += 'FaucetPay hesabı bulunamadı.';
                        break;
                    case 457:
                        errorMessage += 'Bu kullanıcı kara listeye alınmış.';
                        break;
                    default:
                        errorMessage += error.message || 'Bilinmeyen bir hata oluştu.';
                }
            } else if (error.request) {
                errorMessage += 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
            }

            return {
                success: false,
                error: errorMessage
            };
        }
    }

    // FaucetPay bakiyesini kontrol et
    async checkBalance() {
        return await this.makeRequest('/balance');
    }

    // FaucetPay adresi/emaili doğrula
    async validateAddress(address) {
        return await this.makeRequest('/checkaddress', { address });
    }

    // Ödeme gönder
    async sendPayment(to, amount) {
        // Miktar kontrolü
        const satoshiAmount = Math.floor(amount * 100000000);
        if (amount < this.config.MIN_WITHDRAWAL) {
            return {
                success: false,
                error: `Minimum çekim miktarı: ${this.config.MIN_WITHDRAWAL} ${this.config.CURRENCY}`
            };
        }

        if (amount > this.config.MAX_WITHDRAWAL) {
            return {
                success: false,
                error: `Maksimum çekim miktarı: ${this.config.MAX_WITHDRAWAL} ${this.config.CURRENCY}`
            };
        }

        // FaucetPay hesabını doğrula
        const validation = await this.validateAddress(to);
        if (!validation.success) {
            return validation;
        }

        // Bakiye kontrolü
        const balance = await this.checkBalance();
        if (!balance.success || balance.data.balance < satoshiAmount) {
            return {
                success: false,
                error: 'Faucet bakiyesi yetersiz. Lütfen daha sonra tekrar deneyin.'
            };
        }

        // Ödemeyi gönder
        return await this.makeRequest('/send', {
            amount: satoshiAmount,
            to: to
        });
    }

    // Son ödemeleri getir
    async getRecentPayments(count = 10) {
        return await this.makeRequest('/payouts', { count });
    }
}

// FaucetPay entegrasyonunu config.js'deki API sınıfına ekleyelim
class FaucetAPI {
    constructor() {
        // ... diğer kodlar ...
        this.faucetpay = new FaucetPayAPI();
    }

    // Çekim işlemini güncelle
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

        // FaucetPay'e ödeme gönder
        const paymentResult = await this.faucetpay.sendPayment(
            user.faucetpay_email,
            user.balance
        );

        if (!paymentResult.success) {
            throw new Error(paymentResult.error);
        }

        const transaction = {
            id: user.transactions.length + 1,
            type: 'withdraw',
            amount: user.balance,
            timestamp: new Date().toISOString(),
            status: 'success',
            txid: paymentResult.data.payout_id,
            faucetpay_hash: paymentResult.data.payout_user_hash
        };

        // İstatistikleri güncelle
        data.statistics.total_withdrawals++;
        data.statistics.total_amount_withdrawn += user.balance;

        // Bakiyeyi sıfırla ve işlemi kaydet
        user.transactions.unshift(transaction);
        user.balance = 0;

        await this.updateData(data);
        return {
            success: true,
            user: user,
            payment: paymentResult.data
        };
    }

    // Yeni kayıt işleminde FaucetPay doğrulaması ekle
    async register(email, password, faucetpay_email) {
        // FaucetPay hesabını doğrula
        const validation = await this.faucetpay.validateAddress(faucetpay_email);
        if (!validation.success) {
            throw new Error('Geçersiz FaucetPay hesabı!');
        }

        // Normal kayıt işlemine devam et
        const data = await this.getData();
        // ... geri kalan kayıt kodu ...
    }
}

// Test fonksiyonu
async function testFaucetPay() {
    const fp = new FaucetPayAPI();
    
    try {
        // Bakiye kontrolü
        const balance = await fp.checkBalance();
        console.log('Faucet Bakiyesi:', balance);

        // Örnek adres doğrulama
        const validation = await fp.validateAddress('test@example.com');
        console.log('Adres Doğrulama:', validation);

        // Son ödemeleri getir
        const payments = await fp.getRecentPayments();
        console.log('Son Ödemeler:', payments);
    } catch (error) {
        console.error('Test Hatası:', error);
    }
}
