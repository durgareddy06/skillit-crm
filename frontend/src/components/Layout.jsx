import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-skillit-bg">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
