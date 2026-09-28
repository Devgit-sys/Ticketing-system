(function () {
  function ensureStyles() {
    if (document.getElementById('iepm-whatsapp-button-style')) return;

    const style = document.createElement('style');
    style.id = 'iepm-whatsapp-button-style';
    style.textContent = `
      @keyframes wa-float-in {
        0% {
          opacity: 0;
          transform: translateY(16px) scale(0.9);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function createWhatsAppButton({
    phoneNumber = '',
    message = 'Hello admin, I need help with the system.',
    position = 'bottom-right'
  } = {}) {
    const cleanNumber = normalizePhone(phoneNumber);
    if (!cleanNumber) return null;

    ensureStyles();

    const positionMap = {
      'bottom-right': { right: '20px', bottom: '20px' },
      'bottom-left': { left: '20px', bottom: '20px' },
      'top-right': { right: '20px', top: '20px' },
      'top-left': { left: '20px', top: '20px' },
      'bottom-center': { left: '50%', bottom: '20px', transform: 'translateX(-50%)' }
    };

    const config = positionMap[position] || positionMap['bottom-right'];

    const link = document.createElement('a');
    link.href = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Chat with system admin on WhatsApp');
    link.style.position = 'fixed';
    link.style.zIndex = '9999';
    link.style.width = '56px';
    link.style.height = '56px';
    link.style.borderRadius = '50%';
    link.style.display = 'flex';
    link.style.alignItems = 'center';
    link.style.justifyContent = 'center';
    link.style.background = '#25D366';
    link.style.color = '#ffffff';
    link.style.boxShadow = '0 14px 28px rgba(37, 211, 102, 0.35)';
    link.style.textDecoration = 'none';
    link.style.border = 'none';
    link.style.cursor = 'pointer';
    link.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
    link.style.animation = 'wa-float-in 0.35s ease-out';
    Object.assign(link.style, config);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.width = '28px';
    svg.style.height = '28px';
    svg.style.fill = 'currentColor';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12.04 2C6.58 2 2.16 6.39 2.16 11.84c0 2.08.62 4.08 1.71 5.81L2 22l4.5-1.57A9.82 9.82 0 0 0 12.04 21c5.46 0 9.88-4.39 9.88-9.84S17.5 2 12.04 2Zm0 17.8c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-2.67.93.9-2.6-.2-.3a7.83 7.83 0 0 1-1.2-4.18c0-4.34 3.54-7.87 7.9-7.87 2.11 0 4.09.82 5.58 2.31a7.86 7.86 0 0 1 2.32 5.56c0 4.33-3.54 7.86-7.9 7.86Zm4.34-5.88c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.53.12-.15.23-.58.78-.71.94-.13.15-.26.17-.48.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.1-.1.24-.26.36-.39.12-.12.16-.22.24-.36.08-.14.04-.27-.02-.39-.06-.12-.53-1.28-.72-1.75-.19-.46-.38-.4-.53-.4h-.45c-.15 0-.4.06-.61.29-.21.23-.8.78-.8 1.9s.82 2.2.93 2.35c.11.15 1.6 2.45 3.88 3.43.54.24.96.38 1.29.49.54.17 1.03.15 1.42.09.44-.07 1.42-.58 1.62-1.14.2-.56.2-1.03.14-1.13-.06-.1-.22-.16-.47-.28Z');
    svg.appendChild(path);
    link.appendChild(svg);

    link.addEventListener('mouseenter', function () {
      link.style.transform = 'scale(1.08)';
      link.style.boxShadow = '0 18px 32px rgba(37, 211, 102, 0.45)';
    });

    link.addEventListener('mouseleave', function () {
      link.style.transform = 'scale(1)';
      link.style.boxShadow = '0 14px 28px rgba(37, 211, 102, 0.35)';
    });

    if (document.body) {
      document.body.appendChild(link);
    }

    return link;
  }

  window.createWhatsAppButton = createWhatsAppButton;

  function init() {
    const app = document.getElementById('app');
    if (!app || app.classList.contains('hidden')) return;

    const headerBtn = document.getElementById('newTicketBtn');
    if (!headerBtn) return;

    const adminPhone = '+2348188615005';
    const adminMessage = 'Hello admin, I need help with the IEPM Ticket System.';

    headerBtn.innerHTML = '💬';
    headerBtn.setAttribute('aria-label', 'Chat with system admin on WhatsApp');
    headerBtn.title = 'Chat with system admin on WhatsApp';
    headerBtn.onclick = function (event) {
      event.preventDefault();
      window.open(`https://wa.me/${adminPhone.replace(/\D/g, '')}?text=${encodeURIComponent(adminMessage)}`, '_blank', 'noopener,noreferrer');
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
