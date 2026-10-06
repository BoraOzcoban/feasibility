import React, { useMemo, useState } from "react";
import { normalizeGlossaryText } from "../lib/glossary";
import { formatNumber } from "../lib/format";
import { useAppContext } from "../app/AppContext";

// Plain text for a cell, used by search and as the sort fallback.
function cellText(value) {
  if (value == null || value === false) return "";
  if (typeof value === "number" || typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(cellText).join(" ");
  if (React.isValidElement(value)) return "";
  return String(value);
}

function columnKey(column, index) {
  return column.key || column.header || `column-${index}`;
}

function rawValue(column, row) {
  if (column.value) return column.value(row);
  if (column.sortValue) return column.sortValue(row);
  if (column.render) return column.render(row);
  return "";
}

/**
 * Sortable, searchable, paged table. Column widths come from the content and
 * the table scrolls sideways inside its card when it does not fit.
 *
 * columns: { key, header, render?, value?, sortValue?, filterValue?, sortable?, numeric? }
 * A column with sortValue (or numeric: true) is right-aligned.
 */
export default function DataTable({
  columns,
  emptyLabel,
  getRowKey = (row) => row.id,
  onDeleteRow,
  onRowClick,
  pageSize = 10,
  rows,
  searchable = true,
}) {
  const { copy, locale } = useAppContext();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ direction: null, key: null });
  const [page, setPage] = useState(0);

  const visibleRows = useMemo(() => {
    const needle = normalizeGlossaryText(query);
    const filtered = needle
      ? rows.filter((row) =>
          columns.some((column) => {
            const value = column.filterValue ? column.filterValue(row) : rawValue(column, row);
            return normalizeGlossaryText(cellText(value)).includes(needle);
          }),
        )
      : rows;
    const column = columns.find((item, index) => columnKey(item, index) === sort.key);
    if (!column || !sort.direction) return filtered;
    const direction = sort.direction === "desc" ? -1 : 1;
    return [...filtered].sort((left, right) => {
      const a = cellText(column.sortValue ? column.sortValue(left) : rawValue(column, left));
      const b = cellText(column.sortValue ? column.sortValue(right) : rawValue(column, right));
      if (typeof a === "number" && typeof b === "number") return (a - b) * direction;
      return String(a).localeCompare(String(b), locale, { numeric: true, sensitivity: "base" }) * direction;
    });
  }, [columns, locale, query, rows, sort]);

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = visibleRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  function toggleSort(key) {
    setSort((current) => {
      if (current.key !== key) return { direction: "asc", key };
      if (current.direction === "asc") return { direction: "desc", key };
      return { direction: null, key: null };
    });
  }

  return (
    <div className="data-table-block">
      {searchable && rows.length > 5 && (
        <div className="data-table-toolbar">
          <input
            type="search"
            aria-label={copy("Search table", "Tabloda ara")}
            placeholder={copy("Search table", "Tabloda ara")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
          <span>
            {formatNumber(visibleRows.length)} / {formatNumber(rows.length)}
          </span>
        </div>
      )}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column, index) => {
                const key = columnKey(column, index);
                const active = sort.key === key && sort.direction;
                const numeric = column.numeric ?? Boolean(column.sortValue);
                return (
                  <th
                    className={numeric ? "is-num" : undefined}
                    key={key}
                    aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {column.sortable === false ? (
                      column.header
                    ) : (
                      <button type="button" className="sort-button" onClick={() => toggleSort(key)}>
                        {column.header}
                        <span aria-hidden="true">{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
                      </button>
                    )}
                  </th>
                );
              })}
              {onDeleteRow && (
                <th className="is-action">
                  <span className="visually-hidden">{copy("Actions", "İşlemler")}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.length ? (
              pageRows.map((row) => (
                <tr
                  className={onRowClick ? "is-clickable" : undefined}
                  key={getRowKey(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((column, index) => {
                    const numeric = column.numeric ?? Boolean(column.sortValue);
                    return (
                      <td className={numeric ? "is-num" : undefined} key={columnKey(column, index)}>
                        {column.render ? column.render(row) : cellText(rawValue(column, row))}
                      </td>
                    );
                  })}
                  {onDeleteRow && (
                    <td className="is-action">
                      <button
                        type="button"
                        className="table-delete-button"
                        aria-label={copy("Delete record", "Kaydı sil")}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteRow(row);
                        }}
                      >
                        {copy("Delete", "Sil")}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td className="data-table-empty" colSpan={columns.length + (onDeleteRow ? 1 : 0)}>
                  {emptyLabel || copy("No matching records", "Eşleşen kayıt yok")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="data-table-pager">
          <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
            {copy("Previous", "Önceki")}
          </button>
          <span>
            {copy("Page", "Sayfa")} {currentPage + 1} / {pageCount}
          </span>
          <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>
            {copy("Next", "Sonraki")}
          </button>
        </div>
      )}
    </div>
  );
}
