import React from "react";
import { useAppContext } from "../app/AppContext";

export default function SortableTableHead({
  tableId,
  columns,
  gridTemplateColumns,
  hasRowActions = false,
  minWidth = undefined,
}) {
  const {
    getHiddenTableColumns,
    getNextTableSortPatch,
    getTableColumnKey,
    getTableSortIndicator,
    getVisibleTableGridTemplate,
    tableControls,
    updateTableControl,
  } = useAppContext();

  const control = tableControls[tableId] || {};
  const hiddenColumns = new Set(getHiddenTableColumns(control));
  const visibleColumns = columns
    .map((column, index) => ({ column, index, key: getTableColumnKey(column, index) }))
    .filter((item) => !hiddenColumns.has(item.key));
  const visibleGridTemplateColumns = getVisibleTableGridTemplate(tableId, columns, gridTemplateColumns, hasRowActions);

  return (
    <div
      className="operation-data-row operation-data-head sortable-table-head"
      style={{ gridTemplateColumns: visibleGridTemplateColumns, minWidth }}
    >
      {visibleColumns.map(({ column, index, key }) => {
        const active = control.sortKey === key;

        return (
          <div className="sortable-heading-cell" key={key}>
            <button
              type="button"
              className={`sort-heading-button ${active ? "active" : ""}`}
              disabled={column.sortable === false}
              onClick={() => updateTableControl(tableId, getNextTableSortPatch(control, key))}
            >
              <span>{column.header}</span>
              {column.sortable !== false && (
                <small className="sort-indicator" aria-hidden="true">
                  {getTableSortIndicator(control, key)}
                </small>
              )}
            </button>
          </div>
        );
      })}
      {hasRowActions && <span className="table-row-action-head" aria-hidden="true" />}
    </div>
  );
}
