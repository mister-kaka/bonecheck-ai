import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "study"
  | "history"
  | "file"
  | "upload"
  | "check"
  | "alert"
  | "error"
  | "search"
  | "zoom-in"
  | "zoom-out"
  | "reset"
  | "chevron-left"
  | "chevron-right"
  | "info";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}

const paths: Record<IconName, ReactNode> = {
  study: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" />
    </>
  ),
  file: (
    <>
      <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M8.5 13h7M8.5 16.5h5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V6" />
      <path d="M8 9.5 12 5.5l4 4" />
      <path d="M5 19h14" />
    </>
  ),
  check: <path d="M5 12.5 9.2 17 19 7" />,
  alert: (
    <>
      <path d="M12 4.5 20.5 19H3.5L12 4.5z" />
      <path d="M12 10v4" />
      <path d="M12 16.5h.01" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16.5 20 20.5" />
    </>
  ),
  "zoom-in": (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M11 8.5v5M8.5 11h5M16 16.5 20 20.5" />
    </>
  ),
  "zoom-out": (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M8.5 11h5M16 16.5 20 20.5" />
    </>
  ),
  reset: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v5h5" />
    </>
  ),
  "chevron-left": <path d="M14.5 6 8.5 12l6 6" />,
  "chevron-right": <path d="M9.5 6l6 6-6 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
};
