"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

interface AnalyticsData {
  stockLevels: Array<{
    warehouse_name: string;
    total_stock: number;
    unique_items: number;
  }>;
  velocity: Array<{
    date: string;
    movement_type: string;
    total_quantity: number;
    movement_count: number;
  }>;
  topMovers: Array<{
    sku: string;
    item_name: string;
    warehouse_name: string;
    total_inbound: number;
    total_outbound: number;
    movement_count: number;
  }>;
  lowStock: Array<{
    sku: string;
    item_name: string;
    warehouse_name: string;
    quantity: number;
    stock_status: string;
  }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load analytics");
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading analytics from BigQuery...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error: {error}</p>
        <p className="text-sm text-red-500 mt-1">
          Make sure BigQuery is configured and the sync has run.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const topMoversColDefs: ColDef[] = [
    { field: "sku", headerName: "SKU", width: 120 },
    { field: "item_name", headerName: "Item", flex: 1 },
    { field: "warehouse_name", headerName: "Warehouse", width: 180 },
    { field: "total_inbound", headerName: "Inbound", width: 100 },
    { field: "total_outbound", headerName: "Outbound", width: 100 },
    { field: "movement_count", headerName: "Movements", width: 110, sort: "desc" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">
        Analytics{" "}
        <span className="text-sm font-normal text-gray-500">
          (powered by BigQuery)
        </span>
      </h1>

      {/* Stock Levels by Warehouse - Bar Chart */}
      <section className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Stock Levels by Warehouse
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.stockLevels}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="warehouse_name" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="total_stock" fill="#3b82f6" name="Total Stock" />
            <Bar dataKey="unique_items" fill="#10b981" name="Unique Items" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Movement Velocity - Line Chart */}
      <section className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Movement Velocity (Last 90 Days)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.velocity}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="total_quantity"
              stroke="#3b82f6"
              name="Total Qty"
            />
            <Line
              type="monotone"
              dataKey="movement_count"
              stroke="#f59e0b"
              name="Movement Count"
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Top Movers - AG Grid */}
      <section className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Top Movers (Last 30 Days)
        </h2>
        <div className="ag-theme-alpine" style={{ height: 350, width: "100%" }}>
          <AgGridReact
            rowData={data.topMovers}
            columnDefs={topMoversColDefs}
            pagination={true}
            paginationPageSize={10}
          />
        </div>
      </section>

      {/* Low Stock Alert - Anomaly */}
      {data.lowStock.length > 0 && (
        <section className="bg-white rounded-lg border border-orange-200 p-6">
          <h2 className="text-lg font-semibold text-orange-700 mb-4">
            ⚠️ Low Stock Alerts
          </h2>
          <div className="space-y-2">
            {data.lowStock.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded ${
                  item.stock_status === "CRITICAL"
                    ? "bg-red-50"
                    : "bg-yellow-50"
                }`}
              >
                <div>
                  <span className="font-medium text-gray-900">{item.sku}</span>
                  <span className="text-gray-500 ml-2">{item.item_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-gray-500">
                    {item.warehouse_name}
                  </span>
                  <span
                    className={`ml-3 font-bold ${
                      item.stock_status === "CRITICAL"
                        ? "text-red-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {item.quantity} units
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
