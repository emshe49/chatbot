import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { Outlet } from "react-router-dom";

function MainLayout() {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans antialiased text-slate-800">
      {/* Admin Sidebar */}
      <Sidebar />

      {/* Main Body */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Admin Header */}
        <Header />

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/80">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
