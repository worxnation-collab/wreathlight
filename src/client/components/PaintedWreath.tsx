import { useEffect, useRef, useState } from "react";
import { WREATH_VIDEO, wreathSrc, wreathSrcSet, type WreathState } from "../../shared/art";

/** Decorative painted wreath. The interactive SVG beside it stays the accessible wreath. */
export function PaintedWreath({ state, enableVideo = false }: { state: WreathState; enableVideo?: boolean }) {
  const [reduce, setReduce] = useState(false);
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => { setOn(false); }, [state]);

  const video = enableVideo && !reduce ? WREATH_VIDEO[state] : undefined;

  return (
    <div className="painted-wreath" aria-hidden="true">
      <picture>
        <source type="image/avif" srcSet={wreathSrcSet(state, "avif")} sizes="(min-width: 1100px) 58vw, 92vw" />
        <source type="image/webp" srcSet={wreathSrcSet(state, "webp")} sizes="(min-width: 1100px) 58vw, 92vw" />
        <img
          src={wreathSrc(state, 1280, "webp")}
          alt=""
          width={1920}
          height={1080}
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      {video ? (
        <video
          ref={ref}
          className={on ? "is-on" : undefined}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          onCanPlay={() => {
            const el = ref.current;
            if (!el) return;
            const play = el.play();
            if (play && typeof play.then === "function") play.then(() => setOn(true)).catch(() => {});
            else setOn(true);
          }}
        >
          <source src={video} type="video/mp4" />
        </video>
      ) : null}
    </div>
  );
}
