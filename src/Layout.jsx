// Layout.jsx
import React from 'react';
import Sidebar from './Components/Sidebar';
import Dashboard from './Components/Dashboard';

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
