import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";
import { APP_DEPLOYED_AT_DISPLAY } from "@/deploymentInfo";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";


// You can use a library like 'react-icons' for this
// import { Fanpm runUser, FaLock } from 'react-icons/fa'; 

function LoginPortal() {
    const [formData, setFormData] = useState({
        empno: "",
        password: "",
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { setUser } = useAuth();
    const [showPassword, setShowPassword] = useState(false);


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

      const loadingToast = toast.loading("Signing in...", {
        description: "Please wait while we verify your account.",
      });

      try {
        const employeeNo = formData.empno.trim();
        const response = await axios.post(API_ENDPOINTS.loginEmp, {
          // `userId` is required by AuthController::loginDB; `empno` keeps
          // compatibility with the existing loginEmp endpoint contract.
          userId: employeeNo,
          empno: employeeNo,
          password: formData.password.trim(),
        });

        if (response.data.status !== "success") {
          throw new Error(response.data.message || "Invalid credentials.");
        }

        // The API returns the authenticated employee in `user`. Keep `data`
        // as a fallback for older deployments during rollout.
        const apiUser = response.data.user || response.data.data;
        if (!apiUser) throw new Error("Login response did not include employee access details.");

        if (response.data.token) localStorage.setItem("token", response.data.token);

        setUser({
          ...apiUser,
          empNo: apiUser.empNo || apiUser.empno || apiUser.EMP_NO || formData.empno.trim(),
          empName: apiUser.empName || apiUser.emp_name || apiUser.empname || "",
        });

        toast.success("Welcome back!", {
          id: loadingToast,
          description: "You have successfully signed in.",
          duration: 2500,
        });
        navigate("/dashboard", { replace: true });
      } catch (error) {
        console.error("Login request failed:", error);
        toast.error("Login Failed", {
          id: loadingToast,
          description: error.response?.data?.message || error.message || "Something went wrong.",
          duration: 4000,
        });
      } finally {
        setLoading(false);
      }
    };

    return (
        <div className="bg-[linear-gradient(to_bottom,#becdda,#84a1ba)] flex items-center justify-center min-h-screen px-4">
            <div className="bg-[linear-gradient(to_bottom,#84a1ba,#becdda)] relative px-6 sm:px-10 py-10 rounded-3xl shadow-2xl w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-md xl:max-w-md">
                <div className="flex flex-col items-center justify-center mb-6">
                    <img src="/naysa_logo.png" alt="NAYSA Logo" className="w-[100px] h-[70px] mb-4" />
                    <h2 className="text-xl font-semibold text-blue-900 tracking-tight">Employee Portal</h2>
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
                    {/* <div className="mb-4">
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
                    </div> */}
                    <div className="mb-4">
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-gray-900 mb-1"
                        >
                            Password
                        </label>

                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg
                 focus:outline-none focus:ring-2 focus:ring-blue-500
                 transition duration-200"
                            />

                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="absolute inset-y-0 right-3 flex items-center text-gray-500
                 hover:text-blue-700 focus:outline-none"
                                tabIndex={-1}
                            >
                                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                            </button>
                        </div>
                    </div>

                    <div className="text-right mb-4">
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
                    <div className="text-center ">
                        <span className="text-sm text-blue-900">Don't have an account?&nbsp;</span>
                        <Link to="/Register" className="text-sm font-semibold text-blue-900 hover:text-blue-800 hover:underline transition duration-200">
                            Sign up
                        </Link>
                    </div>
                    <p className="text-center text-xs text-blue-900 mt-4">&copy; 2025 ALL RIGHTS RESERVED</p>
                    <p className="text-center text-[10px] text-blue-900/80 mt-4">
                        Application Date: {APP_DEPLOYED_AT_DISPLAY}
                    </p>
                </form>
            </div>
        </div>
    );
}

export default LoginPortal;
