import type { CSSProperties } from "react";

import PawIcon from "./PawIcon";

export type PawToggleIconProps = {
  expanded: boolean;
  size?: number;
  className?: string;
};

const PawToggleIcon = ({ expanded, size = 20, className }: PawToggleIconProps) => {
  const style: CSSProperties = {
    transform: expanded ? "translateY(-2px) scale(1.06) rotate(-6deg)" : "translateY(2px)",
    opacity: expanded ? 1 : 0.92,
    transition: "transform 0.18s ease, opacity 0.15s ease",
  };

  return <PawIcon size={size} className={className} style={style} />;
};

export default PawToggleIcon;
