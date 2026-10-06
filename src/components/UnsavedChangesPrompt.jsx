import React from "react";
import { createPortal } from "react-dom";
import { useAppContext } from "../app/AppContext";

export default function UnsavedChangesPrompt() {
  const { closeUnsavedPrompt, copy, handleLeaveWithoutSaving, handleSaveUnsavedAndContinue, unsavedPrompt } =
    useAppContext();

  if (!unsavedPrompt.open || typeof document === "undefined") return null;

  return createPortal(
    <div className="unsaved-changes-backdrop" role="presentation">
      <section
        className="unsaved-changes-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
      >
        <span>{copy("Unsaved changes", "Kaydedilmemiş değişiklik")}</span>
        <h2 id="unsaved-changes-title">{copy("You have not saved your changes", "Değişiklikleri kaydetmediniz")}</h2>
        <p>
          {copy(
            "Do you want to save before leaving, or continue without saving?",
            "Çıkmadan önce kaydetmek mi, yoksa kaydetmeden devam etmek mi istersiniz?",
          )}
        </p>
        {unsavedPrompt.message && <small>{unsavedPrompt.message}</small>}
        <div className="unsaved-changes-actions">
          <button type="button" className="ghost" onClick={closeUnsavedPrompt} disabled={unsavedPrompt.saving}>
            {copy("Stay on page", "Sayfada kal")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleLeaveWithoutSaving}
            disabled={unsavedPrompt.saving}
          >
            {copy("Leave without saving", "Kaydetmeden çık")}
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleSaveUnsavedAndContinue}
            disabled={unsavedPrompt.saving}
          >
            {unsavedPrompt.saving
              ? copy("Saving...", "Kaydediliyor...")
              : copy("Save and continue", "Kaydet ve devam et")}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
