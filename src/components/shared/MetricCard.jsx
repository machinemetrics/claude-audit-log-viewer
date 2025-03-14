import React from "react";

const MetricCard = ({ title, value, icon: Icon }) => (
  <div className="bg-white rounded-lg shadow p-4 flex flex-col">
    <div className="flex items-center justify-between pb-2">
      <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      <Icon className="h-4 w-4 text-gray-400" />
    </div>
    <div className="text-2xl font-bold">{value}</div>
  </div>
);

export default MetricCard;
