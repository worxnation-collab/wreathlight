import { weekCardKey, weekSrc, weekSrcSet } from "../../shared/art";

export function WeekArt({
  week,
  christmas,
  label,
}: {
  week: number;
  christmas: boolean;
  label: string;
}) {
  const key = weekCardKey(week, christmas);
  return (
    <div className="week-art">
      <picture>
        <source type="image/avif" srcSet={weekSrcSet(key, "avif")} sizes="(max-width: 640px) 100vw, 520px" />
        <source type="image/webp" srcSet={weekSrcSet(key, "webp")} sizes="(max-width: 640px) 100vw, 520px" />
        <img
          src={weekSrc(key, 800, "webp")}
          alt={label}
          width={800}
          height={1067}
          loading="lazy"
          decoding="async"
        />
      </picture>
    </div>
  );
}
