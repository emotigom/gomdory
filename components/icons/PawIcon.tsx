import type { CSSProperties } from "react";

export type PawIconProps = {
  size?: number;
  className?: string;
  title?: string;
  style?: CSSProperties;
};

const PawIcon = ({ size, className, title, style }: PawIconProps) => {
  const combinedClassName = ["block", className].filter(Boolean).join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      className={combinedClassName}
      style={style}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="28" cy="28" r="8" />
      <circle cx="43" cy="20" r="8" />
      <circle cx="57" cy="20" r="8" />
      <circle cx="72" cy="28" r="8" />
      <path d="M50 40c-14 0-25 10.5-26.5 24.2C22.1 79.7 34.1 92 50 92s27.9-12.3 26.5-27.8C75 50.5 64 40 50 40Z" />
    </svg>
  );
};

export default PawIcon;
