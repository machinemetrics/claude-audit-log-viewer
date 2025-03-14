import React, { useState } from "react";

const SortableTable = ({ data, columns }) => {
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });

  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      // Special handling for date objects
      if (
        a[sortConfig.key] instanceof Date &&
        b[sortConfig.key] instanceof Date
      ) {
        return sortConfig.direction === "asc"
          ? a[sortConfig.key].getTime() - b[sortConfig.key].getTime()
          : b[sortConfig.key].getTime() - a[sortConfig.key].getTime();
      }

      // Try to convert to dates if they're date strings
      if (
        typeof a[sortConfig.key] === "string" &&
        typeof b[sortConfig.key] === "string"
      ) {
        const dateA = new Date(a[sortConfig.key]);
        const dateB = new Date(b[sortConfig.key]);

        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return sortConfig.direction === "asc"
            ? dateA.getTime() - dateB.getTime()
            : dateB.getTime() - dateA.getTime();
        }
      }

      // Regular comparison for non-date values
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [data, sortConfig]);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Helper function to safely format cell values
  const formatCellValue = (value, format) => {
    if (value === undefined || value === null) {
      return "N/A";
    }

    // If we have a formatter function
    if (typeof format === "function") {
      try {
        // For date values, ensure they are proper Date objects
        if (value instanceof Date) {
          return format(value);
        }
        // Try to convert string dates to Date objects first
        else if (typeof value === "string") {
          const dateObj = new Date(value);
          if (!isNaN(dateObj.getTime())) {
            return format(dateObj);
          }
        }
        // For other types, just apply the formatter
        return format(value);
      } catch (error) {
        console.error("Error formatting value:", error, value);
        return String(value);
      }
    }

    // Default formatting for dates (if no formatter provided)
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value.toLocaleDateString();
    }

    return String(value);
  };

  return (
    <div className="relative overflow-x-auto shadow-md rounded-lg">
      <table className="w-full text-sm text-left text-gray-700">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                onClick={() => requestSort(column.key)}
                className="px-6 py-3 cursor-pointer hover:bg-gray-100"
              >
                {column.label}
                {sortConfig.key === column.key && (
                  <span>{sortConfig.direction === "asc" ? " ↑" : " ↓"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, i) => (
            <tr key={i} className="bg-white border-b hover:bg-gray-50">
              {columns.map((column) => (
                <td key={column.key} className="px-6 py-4">
                  {formatCellValue(row[column.key], column.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SortableTable;
