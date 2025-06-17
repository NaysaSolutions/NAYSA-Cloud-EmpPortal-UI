import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";

function LoginPortal() {
    const [formData, setFormData] = useState({
        empno: "",
        password: "",
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { setUser } = useAuth();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const requestData = {
        empno: formData.empno.trim(),
        password: formData.password.trim(),
    };

    console.log("Sending login data:", requestData);

    try {
        const response = await axios.post(API_ENDPOINTS.loginEmp, requestData);

        if (response.data.status === "success") {
             const userData = {
        ...response.data.data,
        empNo: response.data.data.empno || formData.empno.trim(),
        empName: response.data.data.empname
      };
      
      setUser(userData); // Store in context
      navigate("/dashboard");
            Swal.fire({
                title: "Login Successful",
                text: "Welcome back!",
                icon: "success",
                confirmButtonText: "OK",
            });
      
        } else {
            Swal.fire({
                title: "Login Failed",
                text: response.data.message || "Invalid credentials.",
                icon: "error",
                confirmButtonText: "OK",
            });
        }
    } catch (error) {
        console.error("Login request failed:", error);
        Swal.fire({
            title: "Error",
            text: error.response?.data?.message || "Something went wrong.",
            icon: "error",
            confirmButtonText: "OK",
        });
    } finally {
        setLoading(false);
    }
};



    return (
        <div className="bg-[linear-gradient(to_bottom,#7392b7,#d8e1e9)] flex items-center justify-center min-h-screen px-4">
            <div className="relative px-6 sm:px-10 py-10 rounded-3xl shadow-md border border-[#457b9d] w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl">
                <div className="absolute inset-0 rounded-3xl" style={{ backgroundColor: '#5882C1', opacity: 0.5, zIndex: 0 }}></div>
                <div className="relative z-10">
                    <img src="/naysa_logo.png" alt="Logo" className="w-200 h-20 mb-3" />
                    <h2 className="text-white m-1" style={{ fontFamily: 'SF Pro Rounded, sans-serif' }}>NAYSA Employee Portal</h2>
                    <h2 className="text-4xl font-bold mb-5 text-white" style={{ fontFamily: 'SF Pro Rounded, sans-serif' }}>Welcome Back!</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-base font-normal text-[#162e3a]">Employee No.</label>
                            <input
                                type="text"
                                name="empno"
                                value={formData.empno}
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
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div className="text-right mt-2 mb-4">
                            <Link to="/forgot-password" className="text-sm text-white hover:underline">Forgot Password?</Link>
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-[#162e3a] text-base text-white p-3 rounded-lg"
                            disabled={loading || !formData.empno || !formData.password}
                        >
                            {loading ? "Signing in..." : "Sign In"}
                        </button>
                        <div className="text-center mt-5 flex justify-center items-center">
                            <span className="text-sm text-[#d2dce6]">Don't have an account?&nbsp;</span>
                            <span className="text-sm text-[#162e3a] hover:underline cursor-pointer" onClick={() => navigate('/Register')}>Sign up</span>
                        </div>
                        <span className="text-[#162e3a] text-xs flex items-center justify-center mt-2 mb-2">© 2025 ALL RIGHTS RESERVED</span>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default LoginPortal;
