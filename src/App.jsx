// // App.js
// import React, { useState } from 'react';
// import Authentication from './Auth/Authentication';
// import ChildComponent from './Context API/ChildComponent';
// import MyContext from './Context API/Context';

// function App() {

//   <Authentication/>
//    const [theme, setTheme] = useState('Dark');

//    return (
//      <MyContext.Provider value={{ theme, setTheme }}>
//       <div
//          className={`min-h-screen flex justify-center items-center transition-colors duration-300 ${
//            theme === 'Light' ? 'bg-white text-black' : 'bg-gray-800 text-white'
//          }`}
//        >
//        <ChildComponent />
//        </div>
//      </MyContext.Provider>
//    );
// }

//  export default App;


// import React from 'react';
// import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import Login from './Authentication/Login';
// import Register from './Authentication/Register';
// import Layout from './Layout'; 
// import Dashboard from './Components/Dashboard';
// import ForgotPassword from './Authentication/ForgotPassword';
// import Clients from './Components/Clients'; 
// import AddClients from './Components/AddClient';

// function App() {
//   return (
//     <Router>
//       <Routes>
//         {/* Route for Login */}
//         <Route path="/" element={<Login />} />
        
//         {/* Route for Register */}
//         <Route path="/register" element={<Register />} />

//         {/* Route for Forgot Password */}
//         <Route path="/forgot-password" element={<ForgotPassword />} />

//         {/* Route for Dashboard inside Layout */}
//         <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />

//         {/* Route for Clients inside Layout */}
//         <Route path="/clients" element={<Layout><Clients /></Layout>} />

//         {/* Route for Add Clients inside Layout */}
//         <Route path="/Addclients" element={<Layout><AddClients /></Layout>} />
//       </Routes>
//     </Router>
//   );
// }

// export default App;





// import React from 'react';
// import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// import EmployeeForm from './Components/EmployeeForm';
// import EmployeeList from './Components/EmployeeList';
// import Authentication from './Auth/Authentication';
// import PrivateRoute from './Auth/PrivateRoute';

// function App() {
//   return (
//     <Router>
//       <Routes>
//         {/* Default route to show the authentication page */}
//         <Route path="/" element={<Navigate to="/authentication" replace />} />
        
//         {/* Authentication page */}
//         <Route path="/authentication" element={<Authentication />} />
        
//         {/* Private routes */}
//         <Route path="/form" element={<PrivateRoute element={<EmployeeForm />} />} />
//         <Route path="/employees" element={<PrivateRoute element={<EmployeeList />} />} />
//       </Routes>
//     </Router>
//   );
// }

// export default App;

//App.js
// import React from "react";
// import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// import Header from "./header"; // Import Header globally
// import ReceivingReport from "./receivingReport";
// import ReceivingReportHistory from "./receivingReportHistory";

// const App = () => {
//   return (
//     <Router>
//       {/* Global Header */}
//       <Header />

//       {/* Page Content */}
//       <Routes>
//         <Route path="/" element={<ReceivingReport />} />
//         <Route path="/history" element={<ReceivingReportHistory />} />
//       </Routes>
//     </Router>
//   );
// };

// export default App;




import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./EMPLOYEE PORTAL/AuthContext";
import Sidebar from "./EMPLOYEE PORTAL/Sidebar";
import Navbar from "./EMPLOYEE PORTAL/Navbar";
import Dashboard from "./EMPLOYEE PORTAL/Dashboard";
import LoginPortal from "./EMPLOYEE PORTAL/LoginPortal";

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LoginPortal />} />
          <Route path="/dashboard" element={<ProtectedRoute><MainApp /></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

const MainApp = () => (
  <div className="flex">
    <Sidebar />
    <div className="flex-grow">
      <Navbar />
      <Dashboard />
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/" />;
};

export default App;







































































// // src/App.jsx
// import React from 'react';
// import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
// import EmployeeList from './Components/EmployeeList';
// import EmployeeForm from './Components/EmployeeForm';
// //import Button from './Components/Button';

// const App = () => {
//   return (
//     // <Button/>
//     <Router>
//       <div className="max-w-4xl mx-auto p-6">
//         <Routes>
//           <Route path="/" element={<EmployeeList />} />
//           <Route path="/add" element={<EmployeeForm />} />
//           <Route path="/edit/:id" element={<EmployeeForm />} />
//         </Routes>
//       </div>
//     </Router>
//   );
// };

// export default App;
