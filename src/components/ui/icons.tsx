// Iconos de línea de NIVEL en SVG, decorativos y del color del texto.
import type { ReactNode } from "react";

function Icon({ children, size = 28 }: { readonly children: ReactNode; readonly size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

interface IconProps {
  readonly size?: number;
}

export const HelmetIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M3 17h18" />
    <path d="M5 17v-3a7 7 0 0 1 14 0v3" />
    <path d="M10 7.3V11M14 7.3V11" />
    <path d="M4 17v1.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V17" />
  </Icon>
);

export const BuildingIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
    <path d="M16 9h2a2 2 0 0 1 2 2v10" />
    <path d="M2 21h20" />
    <path d="M8 7h4M8 11h4M8 15h4" />
  </Icon>
);

export const MicIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </Icon>
);

export const BadgeIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <circle cx="12" cy="9" r="5.5" />
    <path d="m8.5 13.5-1.5 7 5-2.6 5 2.6-1.5-7" />
    <path d="m10 9 1.4 1.4L14 7.8" />
  </Icon>
);

export const HandshakeIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="m11 17 2 2a1.4 1.4 0 0 0 2-2" />
    <path d="m14 16 2.5 2.5a1.4 1.4 0 0 0 2-2L14.6 12.6a3 3 0 0 0-4.2 0l-.9.9a1.4 1.4 0 0 1-2-2l2.8-2.8a5.8 5.8 0 0 1 7-.9l.5.3a2 2 0 0 0 1.4.2L21 8" />
    <path d="m21 4 1 11h-2" />
    <path d="M3 4 2 15l6.5 6.5a1.4 1.4 0 0 0 2-2" />
    <path d="M3 5h8" />
  </Icon>
);

export const ArrowIcon = ({ size = 22 }: IconProps) => (
  <Icon size={size}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </Icon>
);

export const HomeIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9.5h13V10" />
    <path d="M10 19.5v-5h4v5" />
  </Icon>
);

export const RouteIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <circle cx="6" cy="18" r="2.2" />
    <circle cx="18" cy="6" r="2.2" />
    <path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8" />
  </Icon>
);

export const BriefcaseIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <rect x="3" y="7" width="18" height="13" rx="2.5" />
    <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
    <path d="M3 12.5h18" />
  </Icon>
);

export const UserIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <circle cx="12" cy="8.5" r="4" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Icon>
);

export const CrewIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 19.5a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6" />
    <path d="M18.5 14.2a6.5 6.5 0 0 1 3 5.3" />
  </Icon>
);

export const WalletIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <path d="M4 7.5V18a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9.5a1 1 0 0 0-1-1H5.5A1.5 1.5 0 0 1 4 7V7a2 2 0 0 1 2-2h11" />
    <circle cx="16" cy="13.75" r="1.2" />
  </Icon>
);

export const StarIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />
  </Icon>
);

export const ChevronIcon = ({ size = 22 }: IconProps) => (
  <Icon size={size}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const PinIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </Icon>
);

export const SendIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <path d="M21 4 10.5 14.5" />
    <path d="M21 4 14.5 20l-4-5.5-5.5-4Z" />
  </Icon>
);

export const MicOffIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <path d="M9 9v2a3 3 0 0 0 4.8 2.4" />
    <path d="M15 10.5V6a3 3 0 0 0-5.7-1.3" />
    <path d="M5 11a7 7 0 0 0 11.2 5.6" />
    <path d="M12 18v3" />
    <path d="m4 4 16 16" />
  </Icon>
);
