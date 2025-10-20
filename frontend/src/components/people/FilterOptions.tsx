export interface FilterState {
  role: string;
  status: string;
  dateRange: string;
  searchQuery: string;
}

interface FilterOptionsProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

export default function FilterOptions({
  filters,
  onFilterChange,
}: FilterOptionsProps) {
  const handleFilterChange = (key: keyof FilterState, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      role: "",
      status: "",
      dateRange: "",
      searchQuery: "",
    });
  };

  const hasActiveFilters = filters.role || filters.status || filters.dateRange;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear All Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Role Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            value={filters.role}
            onChange={(e) => handleFilterChange("role", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Roles</option>
            <option value="PASTOR">Pastor</option>
            <option value="COORDINATOR">Coordinator</option>
            <option value="MEMBER">Member</option>
            <option value="VISITOR">Visitor</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SEMIACTIVE">Semi-active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="DECEASED">Deceased</option>
          </select>
        </div>

        {/* Date Range Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Join Date
          </label>
          <select
            value={filters.dateRange}
            onChange={(e) => handleFilterChange("dateRange", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Time</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="quarter">Last 3 Months</option>
            <option value="year">Last Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {/* Quick Actions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quick Filters
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleFilterChange("status", "ACTIVE")}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                filters.status === "ACTIVE"
                  ? "bg-green-100 text-green-800 border border-green-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Active Only
            </button>
            <button
              onClick={() => handleFilterChange("role", "MEMBER")}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                filters.role === "MEMBER"
                  ? "bg-green-100 text-green-800 border border-green-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Members Only
            </button>
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">
              Active Filters:
            </span>
            <div className="flex flex-wrap gap-2">
              {filters.role && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  Role: {filters.role}
                  <button
                    onClick={() => handleFilterChange("role", "")}
                    className="ml-1 hover:text-blue-600"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.status && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  Status: {filters.status}
                  <button
                    onClick={() => handleFilterChange("status", "")}
                    className="ml-1 hover:text-green-600"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.dateRange && (
                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                  Date: {filters.dateRange}
                  <button
                    onClick={() => handleFilterChange("dateRange", "")}
                    className="ml-1 hover:text-purple-600"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
