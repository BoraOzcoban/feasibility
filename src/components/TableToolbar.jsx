import React from "react";
import { formatNumber } from "../lib/format";
import { useAppContext } from "../app/AppContext";

export default function TableToolbar({ tableId, rows, visibleRows }) {
  const { copy, getHiddenTableColumns, getHiddenTableRows, resetTableHiding, tableControls, updateTableControl } =
    useAppContext();

  const control = tableControls[tableId] || {};
  const hiddenCount = getHiddenTableColumns(control).length + getHiddenTableRows(control).length;

  return (
    <div className="table-control-bar">
      <label>
        <span>{copy("Filter", "Filtrele")}</span>
        <input
          type="search"
          value={control.query || ""}
          placeholder={copy("Search table", "Tabloda ara")}
          onChange={(event) => updateTableControl(tableId, { query: event.target.value })}
        />
      </label>
      <div className="table-control-actions">
        {hiddenCount > 0 && (
          <button type="button" className="table-reset-hidden-button" onClick={() => resetTableHiding(tableId)}>
            {copy("Show hidden", "Gizlemeleri kaldır")}
          </button>
        )}
        <strong>
          {formatNumber(visibleRows.length)} / {formatNumber(rows.length)}
        </strong>
      </div>
    </div>
  );
}
