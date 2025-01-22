// Airdrop zamanlayıcı fonksiyonu
function updateCountdown() {
    const timers = document.querySelectorAll('.airdrop-timer');
    
    timers.forEach(timer => {
        const deadline = new Date(timer.dataset.deadline).getTime();
        const now = new Date().getTime();
        const distance = deadline - now;
        
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        timer.querySelector('.countdown').innerHTML = `${days}g ${hours}s ${minutes}d ${seconds}s`;
        
        if (distance < 0) {
            timer.querySelector('.countdown').innerHTML = "Süre doldu!";
        }
    });
}

// Her saniye güncelle
setInterval(updateCountdown, 1000);

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', updateCountdown);

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Animasyonlu scroll efekti
window.addEventListener('scroll', () => {
    const cards = document.querySelectorAll('.card, .game-content, .airdrop-card');
    cards.forEach(card => {
        const cardTop = card.getBoundingClientRect().top;
        const triggerBottom = window.innerHeight * 0.8;
        
        if (cardTop < triggerBottom) {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }
    });
});

// Mobil menü toggle
if (document.querySelector('.mobile-menu-toggle')) {
    document.querySelector('.mobile-menu-toggle').addEventListener('click', () => {
        document.querySelector('nav ul').classList.toggle('active');
    });
}

// Airdrop kartları için hover efekti
const airdropCards = document.querySelectorAll('.airdrop-card');
airdropCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-10px)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
    });
});
