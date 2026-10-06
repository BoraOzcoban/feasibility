import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { glossaryEntries, normalizeGlossaryText } from "../lib/glossary";
import { createPortal } from "react-dom";

export function positionFloatingInfoPanel(trigger, panel) {
  if (!trigger || !panel || typeof window === "undefined") return;

  const viewportPadding = 12;
  const gap = 10;
  const triggerRect = trigger.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const panelWidth = Math.min(panelRect.width || 320, window.innerWidth - (viewportPadding * 2));
  const panelHeight = panelRect.height || 80;
  const idealLeft = triggerRect.left + (triggerRect.width / 2) - (panelWidth / 2);
  const left = Math.min(
    Math.max(viewportPadding, idealLeft),
    Math.max(viewportPadding, window.innerWidth - panelWidth - viewportPadding),
  );
  const bottomTop = triggerRect.bottom + gap;
  const top = bottomTop + panelHeight + viewportPadding <= window.innerHeight
    ? bottomTop
    : Math.max(viewportPadding, triggerRect.top - panelHeight - gap);

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.maxWidth = `${Math.max(220, window.innerWidth - (viewportPadding * 2))}px`;
}

export function InfoTip({ label = "Info", text }) {
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [visible, setVisible] = useState(false);

  const updatePosition = useCallback(() => {
    positionFloatingInfoPanel(triggerRef.current, panelRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!visible) return undefined;

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition, visible]);

  if (!text) return null;

  return (
    <>
      <span
        className="info-tip"
        onBlur={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        <button ref={triggerRef} type="button" aria-label={label}>i</button>
      </span>
      {typeof document !== "undefined" && createPortal(
        <span
          ref={panelRef}
          className={`info-tip-panel floating-info-tip-panel ${visible ? "is-visible" : ""}`}
          role="tooltip"
        >
          {text}
        </span>,
        document.body,
      )}
    </>
  );
}

// Glossary text for a label, shown as a static InfoTip next to it.
export function GlossaryTip({ language, term }) {
  const key = normalizeGlossaryText(term);
  const entry = glossaryEntries.find((item) => [...item.en, ...item.tr].some((value) => normalizeGlossaryText(value) === key));
  if (!entry) return null;

  return <InfoTip label={`${term} ${language === "tr" ? "bilgi" : "info"}`} text={language === "tr" ? entry.infoTr : entry.infoEn} />;
}
