import { FaTelegramPlane, FaVk } from "react-icons/fa";

const socials = [
  {
    label: "Telegram",
    href: process.env.NEXT_PUBLIC_TELEGRAM_URL || "https://t.me/your_channel",
    icon: FaTelegramPlane,
  },
  {
    label: "VK",
    href: process.env.NEXT_PUBLIC_VK_URL || "https://vk.com/your_group",
    icon: FaVk,
  },
];

export default function SocialLinks() {
  return (
    <div className="flex items-center gap-3">
      {socials.map((social) => {
        const Icon = social.icon;
        return (
          <a
            key={social.label}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.label}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110"
            style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}
          >
            <Icon className="w-5 h-5" />
          </a>
        );
      })}
    </div>
  );
}
