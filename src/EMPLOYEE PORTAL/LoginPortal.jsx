import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";

// You can use a library like 'react-icons' for this
// import { FaUser, FaLock } from 'react-icons/fa'; 

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

        try {
            const response = await axios.post(API_ENDPOINTS.loginEmp, requestData);

            if (response.data.status === "success") {
                const userData = {
                    ...response.data.data,
                    empNo: response.data.data.empno || formData.empno.trim(),
                    empName: response.data.data.empname
                };
                setUser(userData);
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
            <div className="bg-[linear-gradient(to_bottom,#7392b7,#d8e1e9)] relative px-6 sm:px-10 py-10 rounded-3xl shadow-2xl w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-md xl:max-w-md">
                <div className="flex flex-col items-center justify-center mb-6">
                    <img src="/naysa_logo.png" alt="NAYSA Logo" className="w-24 h-auto mb-4" />
                    <h2 className="text-xl font-semibold text-blue-900 tracking-tight">NAYSA Employee Portal</h2>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-5">
                        <label htmlFor="empno" className="block text-sm font-medium text-gray-900 mb-1">Employee No.</label>
                        <input
                            type="text"
                            id="empno"
                            name="empno"
                            value={formData.empno}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-1">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                        />
                    </div>
                    <div className="text-right mb-6">
                        <Link to="/forgot-password" className="text-sm font-semibold text-blue-900 hover:text-blue-700 transition duration-200">
                            Forgot Password?
                        </Link>
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-800 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-blue-600 disabled:cursor-not-allowed"
                        disabled={loading || !formData.empno || !formData.password}
                    >
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                    <div className="text-center mt-6">
                        <span className="text-sm text-blue-900">Don't have an account?&nbsp;</span>
                        <Link to="/Register" className="text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline transition duration-200">
                            Sign up
                        </Link>
                    </div>
                    <p className="text-center text-xs text-blue-900 mt-4">© 2025 ALL RIGHTS RESERVED</p>
                </form>
            </div>
        </div>
    );
}

export default LoginPortal;