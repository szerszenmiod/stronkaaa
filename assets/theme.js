/**
 * PremiumMC Theme - Main JavaScript
 * Vanilla JS only - No frameworks
 */

class PremiumMCTheme {
  constructor() {
    this.init();
  }

  init() {
    this.initScrollAnimations();
    this.initRangiCards();
    this.initMobileNav();
    this.initCart();
  }

  // IntersectionObserver dla animacji
  initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('.animate-in').forEach(el => {
      observer.observe(el);
    });
  }

  // Rangi Cards - walidacja nicku i add to cart
  initRangiCards() {
    const cards = document.querySelectorAll('.ranga-card');
    
    cards.forEach(card => {
      const nickInput = card.querySelector('.minecraft-nick-input');
      const buyBtn = card.querySelector('.ranga-buy-btn');
      const errorEl = card.querySelector('.nick-error');
      
      if (!nickInput || !buyBtn) return;

      // Walidacja nicku Minecraft
      nickInput.addEventListener('input', (e) => {
        this.validateMinecraftNick(e.target, errorEl);
      });

      // Add to cart
      buyBtn.addEventListener('click', async () => {
        if (!this.validateMinecraftNick(nickInput, errorEl)) {
          return;
        }

        const productId = buyBtn.dataset.product;
        const nick = nickInput.value.trim();
        const group = buyBtn.dataset.group;

        try {
          await this.addToCart(productId, nick);
          this.showNotification('Dodano do koszyka!', 'success');
        } catch (error) {
          this.showNotification('Błąd dodawania do koszyka', 'error');
        }
      });
    });
  }

  validateMinecraftNick(input, errorEl) {
    const nick = input.value.trim();
    const regex = /^[a-zA-Z0-9_]{3,16}$/;
    
    if (!nick) {
      input.classList.remove('valid', 'invalid');
      errorEl.style.display = 'none';
      return false;
    }

    if (regex.test(nick)) {
      input.classList.add('valid');
      input.classList.remove('invalid');
      errorEl.style.display = 'none';
      return true;
    } else {
      input.classList.add('invalid');
      input.classList.remove('valid');
      errorEl.style.display = 'block';
      return false;
    }
  }

  async addToCart(productId, nick) {
    const formData = new FormData();
    formData.append('id', productId);
    formData.append('quantity', 1);
    formData.append('properties[Nick Minecraft]', nick);
    formData.append('sections', 'cart');

    const response = await fetch('/cart/add.js', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to add to cart');
    }
  }

  initMobileNav() {
    const toggle = document.getElementById('mobileToggle');
    const nav = document.getElementById('nav');

    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        nav.classList.toggle('mobile-open');
        document.body.classList.toggle('no-scroll');
      });
    }
  }

  initCart() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.cart-link')) {
        // Otwórz mini-cart
        e.preventDefault();
      }
    });
  }

  showNotification(message, type = 'info') {
    // Prosta notyfikacja
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      border-radius: 12px;
      z-index: 10000;
      transform: translateX(400px);
      transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize theme when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PremiumMCTheme();
});
