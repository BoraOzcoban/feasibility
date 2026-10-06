import React from "react";
import { InfoTip } from "./InfoTip";
import { useAppContext } from "../app/AppContext";

export default function OperationRecordForm({ entity, fields, options = {} }) {
  const { copy, handleSaveOperationRecord, operationForms, operationsLoading, updateOperationForm } = useAppContext();

  const formClassName = ["card operation-data-form operations-record-form-card", options.className]
    .filter(Boolean)
    .join(" ");
  const recordFormLabels = {
    equipment: {
      eyebrow: copy("Register equipment", "Ekipman kaydı"),
      title: copy("Equipment details", "Ekipman detayları"),
    },
    machine: {
      eyebrow: copy("Register machine", "Makine kaydı"),
      title: copy("Machine capability", "Makine kabiliyeti"),
    },
    material: {
      eyebrow: copy("Register material", "Malzeme kaydı"),
      title: copy("Material details", "Malzeme detayları"),
    },
    workforce: {
      eyebrow: copy("Register workforce", "İşgücü kaydı"),
      title: copy("Workforce details", "İşgücü detayları"),
    },
  };
  const recordFormLabel = recordFormLabels[entity] || {
    eyebrow: copy("New record", "Yeni kayıt"),
    title: copy("Record details", "Kayıt detayları"),
  };

  return (
    <form className={formClassName} onSubmit={(event) => handleSaveOperationRecord(entity, event)}>
      <div className="card-header">
        <div>
          <span>{recordFormLabel.eyebrow}</span>
          <h2>{recordFormLabel.title}</h2>
        </div>
      </div>
      <div className="form-grid">
        {fields.map((field) => (
          <label key={field.name}>
            <span className="label-with-info">
              {field.label}
              {field.info && <InfoTip label={`${field.label} ${copy("info", "bilgi")}`} text={field.info} />}
            </span>
            {field.type === "select" ? (
              <select
                value={operationForms[entity][field.name]}
                onChange={(event) => updateOperationForm(entity, field.name, event.target.value)}
              >
                {field.options.map((option) => {
                  const value = Array.isArray(option) ? option[0] : (option.value ?? option);
                  const label = Array.isArray(option) ? option[1] : (option.label ?? option);

                  return (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  );
                })}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                value={operationForms[entity][field.name]}
                onChange={(event) => updateOperationForm(entity, field.name, event.target.value)}
              />
            ) : (
              <input
                min={field.min ?? 0}
                step={field.step || "1"}
                type={field.type || "text"}
                value={operationForms[entity][field.name]}
                onChange={(event) => updateOperationForm(entity, field.name, event.target.value)}
              />
            )}
          </label>
        ))}
      </div>
      <button className="primary" disabled={operationsLoading} type="submit">
        {operationsLoading ? copy("Saving...", "Kaydediliyor...") : copy("Save", "Kaydet")}
      </button>
    </form>
  );
}
