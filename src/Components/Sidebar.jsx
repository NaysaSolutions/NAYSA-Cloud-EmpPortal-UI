import React from 'react';
import { Link, useLocation } from 'react-router-dom'; // Import Link and useLocation
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTh, faUsers, faClipboardList, faCog, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

const Sidebar = () => {
  const location = useLocation(); // Get the current route

  return (
    <aside className="w-2/12 bg-white p-5 flex flex-col justify-between font-poppins">
      <div>
        <div className="mb-8">
          <img
            src="public/NSI LOGO 2.avif"
            alt="Logo"
            className="w-50 h-auto mx-auto mb-16"
          />
        </div>
        <nav>
          <ul className="space-y-6">
            <li
              className={`flex items-center space-x-4 ${
                location.pathname === '/dashboard'
                  ? 'text-blue-500 font-semibold border-l-4 border-blue-500 pl-4'
                  : 'text-gray-700'
              }`}
            >
              <FontAwesomeIcon icon={faTh} className="w-6 h-6" />
              <Link to="/dashboard">Dashboard</Link>
            </li>
            <li
              className={`flex items-center space-x-4 ${
                location.pathname === '/clients'
                  ? 'text-blue-500 font-semibold border-l-4 border-blue-500 pl-4'
                  : 'text-gray-700'
              }`}
            >
              <FontAwesomeIcon icon={faUsers} className="w-6 h-6" />
              <Link to="/clients">Clients</Link>
            </li>
            <li className="flex items-center space-x-4 text-gray-700">
              <FontAwesomeIcon icon={faClipboardList} className="w-6 h-6" />
              <span>Prospect Clients</span>
            </li>
            <li className="flex items-center space-x-4 text-gray-700">
              <FontAwesomeIcon icon={faCog} className="w-6 h-6" />
              <span>Settings</span>
            </li>
          </ul>
        </nav>
      </div>
      <div className="flex items-center space-x-4 text-gray-500">
        <FontAwesomeIcon icon={faQuestionCircle} className="w-6 h-6" />
        <span>Help</span>
      </div>
    </aside>
  );
};

export default Sidebar;
