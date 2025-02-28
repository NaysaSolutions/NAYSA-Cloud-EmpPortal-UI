import { useNavigate, useLocation } from "react-router-dom";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Get the current route

  // Function to check if a link is active
  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Top Navbar */}
      <div className="flex justify-center items-center bg-[#162e3a] text-white p-3 fixed top-0 left-0 w-full h-[30px] z-20">
        <span className="font-bold text-lg">NEW NEMAR DEVELOPMENT CORPORATION</span>
      </div>

      {/* Main Navbar */}
      <div className="flex justify-between items-center bg-white shadow-md p-4 fixed top-[15px] mt-3 left-0 w-full z-10">
        
        {/* ✅ Clickable Logo & "Employee Portal" */}
        <div 
          className="flex items-center space-x-2 cursor-pointer" 
          onClick={() => navigate("/dashboard")}
        >
          <img 
            src="naysa_logo.png" 
            className="w-[100px] h-[60px]" 
            alt="Naysa Logo"
          />
          <span className="text-[#0e00cb] font-bold text-lg mt-3">Employee Portal</span>
        </div>

        {/* Navigation Links */}
        <div className="flex space-x-[45px] ml-[450px]">
          <span 
            onClick={() => navigate("/dashboard")} 
            className={`cursor-pointer hover:font-bold ${
              isActive("/dashboard") ? "text-blue-900 font-bold border-b-2 border-blue-900" : "text-blue-700"
            }`}
          >
            Inquiry
          </span>
          <span 
            onClick={() => navigate("/timekeeping")} 
            className={`cursor-pointer hover:font-bold ${
              isActive("/timekeeping") ? "text-blue-900 font-bold border-b-2 border-blue-900" : "text-blue-700"
            }`}
          >
            Timekeeping
          </span>
          <span 
            onClick={() => navigate("/overtime")} 
            className={`cursor-pointer hover:font-bold ${
              isActive("/overtime") ? "text-blue-900 font-bold border-b-2 border-blue-900" : "text-blue-700"
            }`}
          >
            Overtime
          </span>
          <span 
            onClick={() => navigate("/leave")} 
            className={`cursor-pointer hover:font-bold ${
              isActive("/leave") ? "text-blue-900 font-bold border-b-2 border-blue-900" : "text-blue-700"
            }`}
          >
            Leave
          </span>
          <span 
            onClick={() => navigate("/official-business")} 
            className={`cursor-pointer hover:font-bold ${
              isActive("/official-business") ? "text-blue-900 font-bold border-b-2 border-blue-900" : "text-blue-700"
            }`}
          >
            Official Business
          </span>
          <span 
            onClick={() => navigate("/adjustment")} 
            className={`cursor-pointer hover:font-bold ${
              isActive("/adjustment") ? "text-blue-900 font-bold border-b-2 border-blue-900" : "text-blue-700"
            }`}
          >
            Adjustment
          </span>
        </div>
      </div>
    </>
  );
};

export default Navbar;
