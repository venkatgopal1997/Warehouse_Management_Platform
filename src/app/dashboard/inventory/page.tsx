"use client";

import { useEffect, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  warehouse: { name: string; location: string };
}

export default function InventoryPage() {
  const [rowData, setRowData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const columnDefs: ColDef<InventoryItem>[] = [
    { field: "sku", headerName: "SKU", width: 140, filter: true, sortable: true },
    { field: "name", headerName: "Item Name", flex: 1, filter: true, sortable: true },
    { field: "quantity", headerName: "Qty", width: 100, sortable: true },
    {
      field: "warehouse.name",
      headerName: "Warehouse",
      width: 200,
      filter: true,
      sortable: true,
      valueGetter: (params) => params.data?.warehouse?.name,
    },
    {
      field: "warehouse.location",
      headerName: "Location",
      width: 180,
      filter: true,
      valueGetter: (params) => params.data?.warehouse?.location,
    },
  ];

  useEffect(() => {
    fetch("/api/inventory")
      .then((res) => res.json())
      .then((data) => {
        setRowData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Inventory</h1>

      <div className="ag-theme-alpine" style={{ height: 600, width: "100%" }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          loading={loading}
          pagination={true}
          paginationPageSize={20}
          defaultColDef={{
            resizable: true,
          }}
        />
      </div>
    </div>
  );
}
