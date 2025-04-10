// Layout.jsx
import React from 'react';
import Sidebar from './Components/Sidebar';
import Dashboard from './Components/Dashboard';
>>>>>>> parent of 6405bfa (Merge branch 'main' of https://github.com/NaysaSolutions/NAYSA-Cloud-EmpPortal-UI)

const Layout = ({ children }) => {
  return (
    <div className="flex h-screen">
      {/* Global Sidebar */}
      <Sidebar />
      {/* Main Content */}
      <div className="flex-1">{children}</div>
    </div>
  );
};

export default Layout;
