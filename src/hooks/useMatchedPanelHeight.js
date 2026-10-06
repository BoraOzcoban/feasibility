import { useLayoutEffect, useRef, useState } from "react";

export function useMatchedPanelHeight(dependencyKey) {
  const sourceRef = useRef(null);
  const [height, setHeight] = useState(null);

  useLayoutEffect(() => {
    const element = sourceRef.current;

    if (!element) {
      setHeight(null);
      return undefined;
    }

    let frameId = 0;

    const measure = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        const nextHeight = Math.ceil(element.getBoundingClientRect().height);
        setHeight((currentHeight) => (Math.abs((currentHeight || 0) - nextHeight) > 1 ? nextHeight : currentHeight));
      });
    };

    measure();

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resizeObserver?.observe(element);
    window.addEventListener("resize", measure);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [dependencyKey]);

  return [
    sourceRef,
    height ? { "--matched-record-card-height": `${height}px` } : undefined,
  ];
}
