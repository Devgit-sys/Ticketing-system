import React from 'react';

const positionClasses = {
  'bottom-right': 'bottom-5 right-5',
  'bottom-left': 'bottom-5 left-5',
  'top-right': 'top-5 right-5',
  'top-left': 'top-5 left-5',
  'bottom-center': 'bottom-5 left-1/2 -translate-x-1/2',
};

export default function WhatsAppButton({
  phoneNumber = '',
  message = 'Hello, I need help with the system.',
  position = 'bottom-right',
}) {
  const cleanPhoneNumber = (phoneNumber || '').replace(/\D/g, '');
  const whatsappLink = cleanPhoneNumber
    ? `https://wa.me/${cleanPhoneNumber}?text=${encodeURIComponent(message)}`
    : '#';

  const positionClass = positionClasses[position] || positionClasses['bottom-right'];

  return (
    <a
      href={whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className={`fixed ${positionClass} z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-all duration-300 ease-out hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-[#25D366]/30 animate-[fadeIn_0.35s_ease-out] ${
        !cleanPhoneNumber ? 'pointer-events-none opacity-60' : ''
      }`}
      onClick={(event) => {
        if (!cleanPhoneNumber) {
          event.preventDefault();
        }
      }}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-7 w-7 fill-current"
      >
        <path d="M12.04 2C6.58 2 2.16 6.39 2.16 11.84c0 2.08.62 4.08 1.71 5.81L2 22l4.5-1.57A9.82 9.82 0 0 0 12.04 21c5.46 0 9.88-4.39 9.88-9.84S17.5 2 12.04 2Zm0 17.8c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-2.67.93.9-2.6-.2-.3a7.83 7.83 0 0 1-1.2-4.18c0-4.34 3.54-7.87 7.9-7.87 2.11 0 4.09.82 5.58 2.31a7.86 7.86 0 0 1 2.32 5.56c0 4.33-3.54 7.86-7.9 7.86Zm4.34-5.88c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.53.12-.15.23-.58.78-.71.94-.13.15-.26.17-.48.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.1-.1.24-.26.36-.39.12-.12.16-.22.24-.36.08-.14.04-.27-.02-.39-.06-.12-.53-1.28-.72-1.75-.19-.46-.38-.4-.53-.4h-.45c-.15 0-.4.06-.61.29-.21.23-.8.78-.8 1.9s.82 2.2.93 2.35c.11.15 1.6 2.45 3.88 3.43.54.24.96.38 1.29.49.54.17 1.03.15 1.42.09.44-.07 1.42-.58 1.62-1.14.2-.56.2-1.03.14-1.13-.06-.1-.22-.16-.47-.28Z" />
      </svg>
    </a>
  );
}
