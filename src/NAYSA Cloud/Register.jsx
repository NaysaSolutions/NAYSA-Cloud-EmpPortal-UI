import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import Swal from "sweetalert2";
import API_ENDPOINTS from "@/apiConfig.jsx";

// 1. Schema Validation (Replaces manual if-checks)
const registerSchema = z.object({
  empno: z.string().min(1, "Employee No. is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirm_password: z.string()
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

function Register() {
  const navigate = useNavigate();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data) => {
    try {
      const payload = {
        empno: data.empno.trim(),
        password: data.password,
        confirm_password: data.confirm_password,
      };

      const response = await axios.post(API_ENDPOINTS.regEmp, payload);

      if (response.data?.status === "Updated") {
        Swal.fire("Success", "Password registered successfully!", "success");
        navigate("/");
      } else {
        Swal.fire("Error", response.data?.message || "Registration failed.", "error");
      }
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Something went wrong.", "error");
    }
  };

  return (
    <div className="bg-[linear-gradient(to_bottom,#becdda,#84a1ba)] flex items-center justify-center min-h-screen px-4">
      <div className="bg-[linear-gradient(to_bottom,#84a1ba,#becdda)] relative px-6 sm:px-10 py-10 rounded-3xl shadow-2xl w-full max-w-xs sm:max-w-sm md:max-w-md">
        
        <div className="flex flex-col items-center justify-center mb-6">
          <img src="/naysa_logo.png" alt="NAYSA Logo" className="w-[100px] h-[70px] mb-4" />
          <h2 className="text-xl font-semibold text-blue-900 tracking-tight">Employee Portal</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Employee No */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-900 mb-1">Employee No.</label>
            <input
              {...register("empno")}
              type="text"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors.empno ? "border-red-500" : "border-gray-300"}`}
            />
            {errors.empno && <p className="text-red-600 text-xs mt-1">{errors.empno.message}</p>}
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-900 mb-1">Password</label>
            <input
              {...register("password")}
              type="password"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors.password ? "border-red-500" : "border-gray-300"}`}
            />
            {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {/* Confirm Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-900 mb-1">Confirm Password</label>
            <input
              {...register("confirm_password")}
              type="password"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors.confirm_password ? "border-red-500" : "border-gray-300"}`}
            />
            {errors.confirm_password && <p className="text-red-600 text-xs mt-1">{errors.confirm_password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-800 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-blue-600"
          >
            {isSubmitting ? "Registering..." : "Register"}
          </button>

          <div className="text-center mt-4">
            <span className="text-sm text-blue-900">Already have an account? </span>
            <Link to="/" className="text-sm font-semibold text-blue-900 hover:underline">Sign In</Link>
          </div>
          <p className="text-center text-xs text-blue-900 mt-4">© 2026 ALL RIGHTS RESERVED</p>
        </form>
      </div>
    </div>
  );
}

export default Register;