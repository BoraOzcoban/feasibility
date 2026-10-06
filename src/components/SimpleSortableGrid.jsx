import React from "react";
import TableToolbar from "./TableToolbar";
import { useAppContext } from "../app/AppContext";

export default function SimpleSortableGrid({
  columns,
  emptyLabel,
  getRowKey = (row) => row.id,
  gridTemplateColumns,
  headClassName,
  rowClassName,
  rows,
  tableClassName,
  tableId,
}) {
  const {
    copy,
    getHiddenTableColumns,
    getNextTableSortPatch,
    getSortableTableRows,
    getTableCellValue,
    getTableColumnKey,
    getTableSortIndicator,
    getVisibleTableGridTemplate,
    normalizeTableValue,
    tableControls,
    updateTableControl,
  } = useAppContext();

  const control = tableControls[tableId] || {};
  const hiddenColumns = new Set(getHiddenTableColumns(control));
  const visibleColumns = columns
    .map((column, index) => ({ column, index, key: getTableColumnKey(column, index) }))
    .filter((item) => !hiddenColumns.has(item.key));
  const visibleRows = getSortableTableRows(tableId, rows, columns, getRowKey);
  const visibleGridTemplateColumns = getVisibleTableGridTemplate(tableId, columns, gridTemplateColumns, false);

  return (
    <>
      {<TableToolbar tableId={tableId} rows={rows} visibleRows={visibleRows} />}
      <div className={tableClassName}>
        <div
          className={`${rowClassName} ${headClassName} sortable-table-head`}
          style={{ gridTemplateColumns: visibleGridTemplateColumns }}
        >
          {visibleColumns.map(({ column, key }) => {
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
        </div>
        {(visibleRows.length ? visibleRows : [{ id: "empty" }]).map((row) => (
          <div
            className={`${rowClassName}${row.id === "empty" ? " table-empty-row" : ""}`}
            style={{ gridTemplateColumns: visibleGridTemplateColumns }}
            key={row.id === "empty" ? `${tableId}-empty` : getRowKey(row)}
          >
            {row.id === "empty" ? (
              <span className="table-empty-cell">{emptyLabel || copy("No matching records", "Eşleşen kayıt yok")}</span>
            ) : (
              <>
                {visibleColumns.map(({ column, index, key }) => {
                  const content = column.render
                    ? column.render(row)
                    : normalizeTableValue(getTableCellValue(column, row));
                  const CellTag =
                    index === 0 && (rowClassName.includes("users-row") || rowClassName.includes("permissions-row"))
                      ? "strong"
                      : "span";
                  return <CellTag key={key}>{content}</CellTag>;
                })}
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
