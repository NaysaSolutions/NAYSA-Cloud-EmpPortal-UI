import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";
import API_ENDPOINTS from "@/apiConfig.jsx";

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    empno: "",
    password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirm_password) {
      Swal.fire("Error", "Passwords do not match.", "error");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        empno: formData.empno.trim(),
        password: formData.password,
        confirm_password: formData.confirm_password,
      };

      const { data } = await axios.post(API_ENDPOINTS.regEmp, payload);

      if (data?.status === "Updated") {
        Swal.fire("Success", "Password registered successfully!", "success");
        navigate("/");
      } else {
        Swal.fire("Error", data?.message || "Registration failed.", "error");
      }
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "Something went wrong.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[linear-gradient(to_bottom,#becdda,#84a1ba)] flex items-center justify-center min-h-screen px-4">
      <div className="bg-[linear-gradient(to_bottom,#84a1ba,#becdda)] relative px-6 sm:px-10 py-10 rounded-3xl shadow-2xl w-full max-w-xs sm:max-w-sm md:max-w-md">
        {/* Header (same as Login) */}
        <div className="flex flex-col items-center justify-center mb-6">
          <img src="/naysa_logo.png" alt="NAYSA Logo" className="w-[100px] h-[70px] mb-4" />
          <h2 className="text-xl font-semibold text-blue-900 tracking-tight">
            NAYSA Employee Portal
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label htmlFor="empno" className="block text-sm font-medium text-gray-900 mb-1">
              Employee No.
            </label>
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-1">
              Password
            </label>
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

          <div className="mb-4">
            <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-900 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirm_password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-800 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-blue-600 disabled:cursor-not-allowed"
            disabled={
              loading ||
              !formData.empno ||
              !formData.password ||
              !formData.confirm_password
            }
          >
            {loading ? "Registering..." : "Register"}
          </button>

          <div className="text-center mt-4">
            <span className="text-sm text-blue-900">Already have an account?&nbsp;</span>
            <Link
              to="/"
              className="text-sm font-semibold text-blue-900 hover:text-blue-800 hover:underline transition duration-200"
            >
              Sign In
            </Link>
          </div>

          <p className="text-center text-xs text-blue-900 mt-4">© 2025 ALL RIGHTS RESERVED</p>
        </form>
      </div>
    </div>
  );
}

export default Register;
