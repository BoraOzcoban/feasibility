import React from "react";
import SortableTableHead from "./SortableTableHead";
import TableToolbar from "./TableToolbar";
import { useAppContext } from "../app/AppContext";

export default function SortableDataTable({
  columns,
  emptyLabel,
  gridTemplateColumns,
  getRowKey = (row) => row.id,
  onDeleteRow,
  onRowClick,
  rows,
  tableId,
  useButtonRows = false,
}) {
  const {
    copy,
    getSortableTableRows,
    getTableCellValue,
    getTableColumnKey,
    getTableMinWidth,
    getVisibleTableColumns,
    getVisibleTableGridTemplate,
    normalizeTableValue,
  } = useAppContext();

  const visibleRows = getSortableTableRows(tableId, rows, columns, getRowKey);
  const visibleColumns = getVisibleTableColumns(tableId, columns);
  const hasRowActions = Boolean(onDeleteRow);
  const visibleGridTemplateColumns = getVisibleTableGridTemplate(tableId, columns, gridTemplateColumns, hasRowActions);
  const minWidth = getTableMinWidth(visibleColumns, gridTemplateColumns, hasRowActions);
  const displayRows = visibleRows.length ? visibleRows : [{ id: "empty" }];

  return (
    <>
      {<TableToolbar tableId={tableId} rows={rows} visibleRows={visibleRows} />}
      <div className="operation-data-table">
        {
          <SortableTableHead
            tableId={tableId}
            columns={columns}
            gridTemplateColumns={gridTemplateColumns}
            hasRowActions={hasRowActions}
            minWidth={minWidth}
          />
        }
        {displayRows.map((row) => {
          const isEmpty = row.id === "empty";
          const rowKey = isEmpty ? `${tableId}-empty` : getRowKey(row);

          return (
            <div
              role={useButtonRows && !isEmpty ? "button" : undefined}
              tabIndex={useButtonRows && !isEmpty ? 0 : undefined}
              className={`operation-data-row${useButtonRows ? " operation-data-button-row" : ""}${isEmpty ? " table-empty-row" : ""}`}
              style={{ gridTemplateColumns: visibleGridTemplateColumns, minWidth }}
              key={rowKey}
              onClick={
                useButtonRows
                  ? () => {
                      if (!isEmpty && onRowClick) onRowClick(row);
                    }
                  : undefined
              }
              onKeyDown={
                useButtonRows
                  ? (event) => {
                      if (!isEmpty && onRowClick && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
            >
              {isEmpty ? (
                <span className="table-empty-cell">
                  {emptyLabel || copy("No matching records", "Eşleşen kayıt yok")}
                </span>
              ) : (
                <>
                  {visibleColumns.map((column) => {
                    const originalIndex = columns.indexOf(column);
                    const text = normalizeTableValue(getTableCellValue(column, row));
                    return (
                      <span
                        className="operation-data-cell"
                        key={getTableColumnKey(column, originalIndex)}
                        title={text || undefined}
                      >
                        {column.render ? column.render(row) : text}
                      </span>
                    );
                  })}
                  {onDeleteRow && (
                    <button
                      type="button"
                      className="table-delete-button"
                      aria-label={copy("Delete record", "Kaydı sil")}
                      title={copy("Delete record", "Kaydı sil")}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteRow(row);
                      }}
                    >
                      {copy("Delete", "Sil")}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
