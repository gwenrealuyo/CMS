export interface FilterState {
  role: string;
  dateRange: string;
}

interface FilterOptionsProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

export default function FilterOptions({
  filters,
  onFilterChange,
}: FilterOptionsProps) {
  return (
    <div className="flex gap-4">
      <select
        value={filters.role}
        onChange={(e) => onFilterChange({ ...filters, role: e.target.value })}
        className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        <option value="">All Roles</option>
        <option value="member">Member</option>
        <option value="visitor">Visitor</option>
        <option value="coordinator">Coordinator</option>
        <option value="pastor">Pastor</option>
      </select>

      <select
        value={filters.dateRange}
        onChange={(e) =>
          onFilterChange({ ...filters, dateRange: e.target.value })
        }
        className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        <option value="">All Time</option>
        <option value="week">Last Week</option>
        <option value="month">Last Month</option>
        <option value="year">Last Year</option>
      </select>
    </div>
  );
}
