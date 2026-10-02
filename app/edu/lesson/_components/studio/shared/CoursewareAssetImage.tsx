"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

type CoursewareAssetImageProps = {
  src: string;
  alt?: string;
  decorative?: boolean;
  className?: string;
};

export default function CoursewareAssetImage({ src, alt = "", decorative = false, className }: CoursewareAssetImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span aria-hidden="true" className={`block rounded-md bg-slate-100 ${className ?? ""}`.trim()} />;
  }

  return (
    <img
      src={src}
      alt={decorative ? "" : alt}
      aria-hidden={decorative ? "true" : undefined}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
