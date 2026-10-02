type SkeletonBlockProps = {
  className?: string;
};

export default function SkeletonBlock({ className = "" }: SkeletonBlockProps) {
  return <div aria-hidden className={`motion-safe:animate-pulse rounded bg-gray-200 ${className}`} />;
}
