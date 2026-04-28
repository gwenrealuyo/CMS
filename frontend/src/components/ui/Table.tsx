import { ReactNode, KeyboardEvent as ReactKeyboardEvent } from "react";

interface TableColumn<T> {
  header: string;
  /** Desktop table header cell content; defaults to plain `header` text */
  desktopHeader?: ReactNode;
  /** Sortable/table header interaction (desktop only); adds keyboard support */
  onHeaderClick?: () => void;
  headerClassName?: string;
  accessor: keyof T;
  render?: (value: any, row: T) => ReactNode;
  hideOnMobile?: boolean;
}

interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  mobileCardView?: boolean;
}

function renderDesktopThClasses<T>(
  column: Pick<
    TableColumn<T>,
    "headerClassName" | "onHeaderClick"
  >,
  baseDesktop: string,
) {
  return [
    baseDesktop,
    column.onHeaderClick
      ? "cursor-pointer transition-colors hover:bg-gray-100 select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-0"
      : "",
    column.headerClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export default function Table<T>({
  data = [],
  columns = [],
  mobileCardView = true,
}: TableProps<T>) {
  if (!columns || columns.length === 0) {
    return null;
  }

  /* Match Cluster reports / People table: muted uppercase headers, gray-50 strip */
  const desktopThCommon =
    "px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500";

  const handleHeaderKeyDown = (
    e: ReactKeyboardEvent<HTMLTableCellElement>,
    onClick?: () => void,
  ) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 hidden md:table-header-group">
            <tr>
              {columns.map((column, i) => (
                <th
                  key={i}
                  scope="col"
                  className={renderDesktopThClasses(column, desktopThCommon)}
                  onClick={column.onHeaderClick}
                  onKeyDown={(e) => handleHeaderKeyDown(e, column.onHeaderClick)}
                  tabIndex={column.onHeaderClick ? 0 : undefined}
                >
                  {column.desktopHeader ?? column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 md:px-6 py-4 text-center text-gray-500"
              >
                No data available
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // Mobile card view
  if (mobileCardView) {
    return (
      <>
        {/* Mobile card view */}
        <div className="md:hidden space-y-4">
          {data.map((row, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              {columns
                .filter((col) => !col.hideOnMobile)
                .map((column, j) => (
                  <div
                    key={j}
                    className="flex flex-col mb-3 last:mb-0 border-b border-gray-100 last:border-0 pb-3 last:pb-0"
                  >
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      {column.header}
                    </span>
                    <span className="text-sm text-gray-900">
                      {column.render
                        ? column.render(row[column.accessor], row)
                        : String(row[column.accessor] ?? "")}
                    </span>
                  </div>
                ))}
            </div>
          ))}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column, i) => (
                  <th
                    key={i}
                    scope="col"
                    className={renderDesktopThClasses(column, desktopThCommon)}
                    onClick={column.onHeaderClick}
                    onKeyDown={(e) => handleHeaderKeyDown(e, column.onHeaderClick)}
                    tabIndex={column.onHeaderClick ? 0 : undefined}
                  >
                    {column.desktopHeader ?? column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((row, i) => (
                <tr
                  key={i}
                  className="transition-colors duration-150 hover:bg-gray-50"
                >
                  {columns.map((column, j) => (
                    <td
                      key={j}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                      {column.render
                        ? column.render(row[column.accessor], row)
                        : String(row[column.accessor] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // Standard table with horizontal scroll on mobile
  return (
    <div className="overflow-x-auto -mx-4 md:mx-0">
      <div className="inline-block min-w-full align-middle md:px-0">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, i) => (
              <th
                  key={i}
                  scope="col"
                  className={`${renderDesktopThClasses(
                    column,
                    desktopThCommon,
                  )} ${column.hideOnMobile ? "hidden md:table-cell" : ""}`}
                  onClick={column.onHeaderClick}
                  onKeyDown={(e) => handleHeaderKeyDown(e, column.onHeaderClick)}
                  tabIndex={column.onHeaderClick ? 0 : undefined}
                >
                  {column.desktopHeader ?? column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, i) => (
              <tr
                key={i}
                className="transition-colors duration-150 hover:bg-gray-50"
              >
                {columns.map((column, j) => (
                  <td
                    key={j}
                    className={`px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${
                      column.hideOnMobile ? "hidden md:table-cell" : ""
                    }`}
                  >
                    {column.render
                      ? column.render(row[column.accessor], row)
                      : String(row[column.accessor] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
