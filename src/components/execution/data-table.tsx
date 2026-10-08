import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  /** Header text. Keep it short — the header is nowrap and the table scrolls. */
  header: string;
  /** Fixed width hint (any CSS width class) so columns stay comparable
   *  between the mission and automation rows of a mixed table. */
  width?: string;
  /** Right-align numeric-ish columns (counts, durations, costs). */
  align?: "left" | "right";
  render: (row: T) => ReactNode;
};

/**
 * A dense, semantic table — the reading surface for "show me everything at
 * once" in the Execution area.
 *
 * It owns only what all three Execution tables agree on: header cells, cell
 * padding, row hover, and the scroll container. Columns and rows are the
 * caller's, so a table can never imply a header its cells do not carry, and
 * the widths stay comparable between rows of different shapes.
 *
 * A dense table is usually wider than a phone, so `minWidth` holds the natural
 * width and the wrapper scrolls sideways. The page around it never does.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  notes = [],
  minWidth = "640px",
  caption,
  className,
  onRowClick,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Full-width rows rendered after the data rows, for prose that belongs
   *  inside the table (grouping notes, unknown-status guards) rather than in a
   *  wrapper that would imply a header the row does not carry. */
  notes?: Array<{ key: string; content: ReactNode }>;
  /** Makes the whole row clickable for pointer users.
   *
   *  A row click is a mouse-only shortcut, never the only way in: the caller
   *  must also render a real focusable control (a button) in one of the cells,
   *  because a <tr> cannot take focus and a click handler alone is invisible to
   *  keyboard and screen-reader users. */
  onRowClick?: (row: T) => void;
  /** Table minimum width. Forces inner horizontal scroll on narrow screens
   *  instead of letting the page itself overflow. */
  minWidth?: string;
  /** Visually hidden, but read by screen readers as the table's name. */
  caption?: string;
  className?: string;
}) {
  return (
    <div
      tabIndex={0}
      className={cn(
        "overflow-x-auto rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <table className="w-full text-sm" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b bg-muted/30">
          <tr>
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                style={c.width ? { width: c.width } : undefined}
                className={cn(
                  "whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground",
                  c.align === "right" && "text-right"
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b transition-colors last:border-b-0 hover:bg-muted/40",
                onRowClick && "cursor-pointer"
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={cn(
                    "px-3 py-2 align-middle",
                    c.align === "right" ? "text-right tabular-nums" : "text-left"
                  )}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {notes.map((n) => (
            <tr key={n.key} className="border-b bg-muted/20 last:border-b-0">
              <td colSpan={columns.length} className="px-3 py-2 text-xs text-muted-foreground">
                {n.content}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}