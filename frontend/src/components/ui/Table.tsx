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
  /** Breakpoint at which card view switches to the desktop table. Default `md`. */
  cardBreakpoint?: "md" | "tablet";
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
      ? "cursor-pointer transition-colors hover:bg-gray-100 select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
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
  cardBreakpoint = "md",
}: TableProps<T>) {
  if (!columns || columns.length === 0) {
    return null;
  }

  const isTabletBp = cardBreakpoint === "tablet";
  const cardsHiddenClass = isTabletBp ? "tablet:hidden" : "md:hidden";
  const tableVisibleClass = isTabletBp
    ? "hidden tablet:block"
    : "hidden md:block";
  const hideOnMobileCellClass = isTabletBp
    ? "hidden tablet:table-cell"
    : "hidden md:table-cell";
  const hideOnMobileHeaderGroupClass = isTabletBp
    ? "hidden tablet:table-header-group"
    : "hidden md:table-header-group";

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
          <thead className={`bg-gray-50 ${hideOnMobileHeaderGroupClass}`}>
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
        <div className={`${cardsHiddenClass} min-w-0 space-y-4`}>
          {data.map((row, i) => (
            <div
              key={i}
              className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              {columns
                .filter((col) => !col.hideOnMobile)
                .map((column, j) => (
                  <div
                    key={j}
                    className="mb-3 flex min-w-0 flex-col border-b border-gray-100 pb-3 last:mb-0 last:border-0 last:pb-0"
                  >
                    <span className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
                      {column.header}
                    </span>
                    <span className="min-w-0 break-words text-sm text-gray-900">
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
        <div className={`${tableVisibleClass} overflow-x-auto`}>
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
    <div className="min-w-0 overflow-x-auto">
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
                )} ${column.hideOnMobile ? hideOnMobileCellClass : ""}`}
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
                    column.hideOnMobile ? hideOnMobileCellClass : ""
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
  );
}
