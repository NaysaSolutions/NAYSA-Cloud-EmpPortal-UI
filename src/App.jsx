// import React from 'react';
// import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import './App.css';
// import Login from './NAYSA Cloud/Login';
// import Register from './NAYSA Cloud/Register'; // Make sure to import Register

// function App() {
//   return (
//     <Router>
//       <div className="flex">
//         <Routes>
//           <Route path="/" element={<Login />} />
//           <Route path="/register" element={<Register />} />
//         </Routes>
//       </div>
//     </Router>
//   );
// }

// export default App;




import React from "react";
import Navbar from "./NAYSA Cloud/Components/Navbar";
import Sidebar from "./NAYSA Cloud/Components/Sidebar";

function App() {
  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 bg-gray-50">
          {/* Page content goes here */}
        </main>
      </div>
    </div>
  );
}

export default App;



// import React from 'react';
// import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import './App.css';
// import Login from './NAYSA Cloud/Login';
// import Register from './NAYSA Cloud/Register'; // Make sure to import Register

// function App() {
//   return (
//     <Router>
//       <div className="flex">
//         <Routes>
//           <Route path="/" element={<Login />} />
//           <Route path="/register" element={<Register />} />
//         </Routes>
//       </div>
//     </Router>
//   );
// }

// export default App;

























































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
