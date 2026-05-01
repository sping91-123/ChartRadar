// ===========================
// Mobile Menu Toggle
// ===========================

const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuLinks = document.querySelectorAll('.mobile-menu-link');

mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('active');
    const icon = mobileMenuBtn.querySelector('i');
    
    if (mobileMenu.classList.contains('active')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
    } else {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }
});

// Close mobile menu when clicking on a link
mobileMenuLinks.forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        const icon = mobileMenuBtn.querySelector('i');
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    });
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        if (mobileMenu.classList.contains('active')) {
            mobileMenu.classList.remove('active');
            const icon = mobileMenuBtn.querySelector('i');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    }
});

// ===========================
// Smooth Scrolling for Anchor Links
// ===========================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        
        // Skip if href is just "#"
        if (href === '#') {
            e.preventDefault();
            return;
        }
        
        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            e.preventDefault();
            
            const headerOffset = 80;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ===========================
// Scroll to Top Button
// ===========================

const scrollTopBtn = document.getElementById('scrollTop');

window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
        scrollTopBtn.classList.add('visible');
    } else {
        scrollTopBtn.classList.remove('visible');
    }
});

scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// ===========================
// Header Scroll Effect
// ===========================

const header = document.querySelector('.header');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        header.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.4)';
    } else {
        header.style.boxShadow = 'none';
    }
    
    lastScroll = currentScroll;
});

// ===========================
// Intersection Observer for Animations
// ===========================

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe exchange cards
document.querySelectorAll('.exchange-card').forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
    observer.observe(card);
});

// Observe YouTube features
document.querySelectorAll('.youtube-feature').forEach((feature, index) => {
    feature.style.opacity = '0';
    feature.style.transform = 'translateX(-30px)';
    feature.style.transition = `opacity 0.6s ease ${index * 0.15}s, transform 0.6s ease ${index * 0.15}s`;
    observer.observe(feature);
});

// Observe YouTube video card
const videoCard = document.querySelector('.youtube-video-card');
if (videoCard) {
    videoCard.style.opacity = '0';
    videoCard.style.transform = 'translateX(30px)';
    videoCard.style.transition = 'opacity 0.8s ease 0.3s, transform 0.8s ease 0.3s';
    observer.observe(videoCard);
}

// Observe community card
const communityCard = document.querySelector('.community-card');
if (communityCard) {
    communityCard.style.opacity = '0';
    communityCard.style.transform = 'scale(0.95)';
    communityCard.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    observer.observe(communityCard);
}

// ===========================
// Exchange Card Hover Effects
// ===========================

document.querySelectorAll('.exchange-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-8px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0) scale(1)';
    });
});

// ===========================
// YouTube Video Thumbnail Click
// ===========================

const videoThumbnail = document.querySelector('.video-thumbnail');
if (videoThumbnail) {
    videoThumbnail.addEventListener('click', () => {
        window.open('https://www.youtube.com/@코털스-선털', '_blank');
    });
    
    videoThumbnail.style.cursor = 'pointer';
}

// ===========================
// Stat Counter Animation
// ===========================

const animateCounter = (element, target, suffix = '') => {
    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target + suffix;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current) + suffix;
        }
    }, duration / steps);
};

// Observe hero stats for counter animation
const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.animated) {
                entry.target.dataset.animated = 'true';
                
                // Animate stat numbers
                const statNumbers = entry.target.querySelectorAll('.stat-number');
                statNumbers.forEach(stat => {
                    const text = stat.textContent;
                    if (text.includes('%')) {
                        const value = parseInt(text);
                        animateCounter(stat, value, '%');
                    } else if (text.includes('K+')) {
                        const value = parseFloat(text);
                        stat.textContent = '0K+';
                        animateCounterFloat(stat, value, 'K+');
                    } else if (text.includes('+')) {
                        const value = parseInt(text);
                        animateCounter(stat, value, '+');
                    }
                });
            }
        });
    }, { threshold: 0.5 });
    
    statsObserver.observe(heroStats);
}

const animateCounterFloat = (element, target, suffix = '') => {
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target + suffix;
            clearInterval(timer);
        } else {
            element.textContent = current.toFixed(1) + suffix;
        }
    }, duration / steps);
};

// ===========================
// Logo Click - Scroll to Top
// ===========================

const logo = document.querySelector('.logo');
if (logo) {
    logo.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    logo.style.cursor = 'pointer';
}

// ===========================
// Add Ripple Effect to Buttons
// ===========================

const addRippleEffect = (button) => {
    button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');
        
        this.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
};

// Add ripple effect to all buttons
document.querySelectorAll('.btn-primary, .btn-hero-primary, .exchange-btn, .btn-youtube, .btn-telegram').forEach(btn => {
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
});

// ===========================
// Add Dynamic Styles for Ripple
// ===========================

const style = document.createElement('style');
style.textContent = `
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ===========================
// Parallax Effect for Hero Background
// ===========================

window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const heroBackground = document.querySelector('.hero-background');
    
    if (heroBackground && scrolled < window.innerHeight) {
        heroBackground.style.transform = `translateY(${scrolled * 0.5}px)`;
        heroBackground.style.opacity = 1 - (scrolled / window.innerHeight);
    }
});

// ===========================
// Console Welcome Message
// ===========================

console.log('%c🚀 코털스에 오신 것을 환영합니다!', 'color: #f97316; font-size: 20px; font-weight: bold;');
console.log('%c코인에 털린 사람들을 위한 채널', 'color: #fb923c; font-size: 14px;');
console.log('%c최대 50% 수수료 페이백 혜택을 받아보세요!', 'color: #10b981; font-size: 14px;');
console.log('%cYouTube: https://www.youtube.com/@코털스-선털', 'color: #3b82f6; font-size: 12px;');

// ===========================
// Page Load Animation
// ===========================

window.addEventListener('load', () => {
    document.body.style.opacity = '1';
});

// Set initial opacity
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 0.3s ease';
