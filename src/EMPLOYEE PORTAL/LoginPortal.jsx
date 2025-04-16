import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext"; // Import useAuth hook
// import API_ENDPOINTS from "C:/Users/mendo/OneDrive/Desktop/NAYSA-Cloud-EmpPortal-UI/src/apiConfig.jsx";
import API_ENDPOINTS from "@/apiConfig.jsx";

function LoginPortal() {
    const [empNo, setEmpNo] = useState(""); // Only store employee number
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { setUser } = useAuth(); // Get setUser from AuthContext

    const handleChange = (e) => {
        setEmpNo(e.target.value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
      
        try {
          // Send the request to fetch data based on empNo
          const response = await axios.post(API_ENDPOINTS.dashBoard, { EMP_NO: empNo }); // Use dynamic API URL here
      
          if (response.data.success) {
            // Ensure that the data is in the expected format and contains user info
            const userData = JSON.parse(response.data.data[0]?.result || "[]");
      
            if (userData.length > 0) {
              // Set the user data into context after successful login
              setUser(userData[0]); // Assuming that the result is an array, using the first entry
      
              console.log("User set:", userData); // Verify user data in console
      
              // Redirect to the dashboard after a successful login
              navigate("/dashboard");
            } else {
              // Handle no user data case (optional)
            }
          } else {
            // Handle API failure (optional)
          }
        } catch (error) {
          // Handle network or server errors
          Swal.fire({
            title: "Error!",
            text: "An error occurred. Please try again.",
            icon: "error",
            confirmButtonText: "OK",
          });
        } finally {
          setLoading(false); // Reset the loading state once the request is complete
        }
      };
      
      

    return (
        <div className="bg-[linear-gradient(to_bottom,#7392b7,#d8e1e9)] flex items-center justify-center min-h-screen px-4">
            <div className="relative px-6 sm:px-10 py-10 rounded-3xl shadow-md border border-[#457b9d] w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl">
                <div className="absolute inset-0 rounded-3xl " style={{ backgroundColor: '#5882C1', opacity: 0.5, zIndex: 0 }}></div>
                <div className="relative z-10">
                    <img src="/naysa_logo.png" alt="Logo" className="w-200 h-20 mb-3" />
                    <h2 className="text-white m-1" style={{ fontFamily: 'SF Pro Rounded, sans-serif' }}>NAYSA Employee Portal</h2>
                    <h2 className="text-4xl font-bold mb-5 text-white" style={{ fontFamily: 'SF Pro Rounded, sans-serif' }}>Welcome Back!</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-base font-normal text-[#162e3a]">Employee No.</label>
                            <input
                                type="text"
                                name="empNo"
                                value={empNo}
                                onChange={handleChange}
                                required
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-base font-normal text-[#162e3a]">Password</label>
                            <input
                                type="password"
                                name="password"
                                disabled
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div className="text-right mt-2 mb-4">
                            <Link to="/forgot-password" className="text-sm text-white hover:underline">Forgot Password?</Link>
                        </div>
                        <button type="submit" className="w-full bg-[#162e3a] text-base text-white p-3 rounded-lg" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                        <div className="text-center mt-5 flex justify-center items-center">
                            <span className="text-sm text-[#d2dce6]">Don't have an account?&nbsp;</span>
                            <span className="text-sm text-[#162e3a] hover:underline cursor-pointer" onClick={() => navigate('/register')}>Sign up</span>
                        </div>
                        <span className="text-[#162e3a] text-xs flex items-center justify-center mt-2 mb-2">© 2025 ALL RIGHTS RESERVED</span>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default LoginPortal;
