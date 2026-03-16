import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import axios from "axios";

import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";

// Validation Schema
const loginSchema = z.object({
  empno: z.string().min(1, "Employee number is required"),
  password: z.string().min(1, "Password is required"),
});

function LoginPortal() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { empno: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials) => {
      const response = await axios.post(API_ENDPOINTS.loginEmp, credentials);
      return response.data;
    },
    onSuccess: (data, variables) => {
      if (data.status === "success") {
        const userData = {
          ...data.data,
          empNo: data.data.empno || variables.empno.trim(),
          empName: data.data.empname,
        };
        login(userData);
        toast.success("Login Successful", { description: "Welcome back!" });
        navigate("/dashboard");
      } else {
        toast.error("Login Failed", { description: data.message || "Invalid credentials." });
      }
    },
    onError: (error) => {
      toast.error("Error", { 
        description: error.response?.data?.message || "Something went wrong." 
      });
    },
  });

  const onSubmit = (data) => {
    loginMutation.mutate({
      empno: data.empno.trim(),
      password: data.password.trim(),
    });
  };

  return (
    /* Preserved Original Gradient Background */
    <div className="bg-[linear-gradient(to_bottom,#becdda,#84a1ba)] flex items-center justify-center min-h-screen px-4">
      
      {/* Preserved Inner Box Gradient */}
      <div className="bg-[linear-gradient(to_bottom,#84a1ba,#becdda)] relative px-6 sm:px-10 py-10 rounded-3xl shadow-2xl w-full max-w-xs sm:max-w-sm md:max-w-md">
        
        <div className="flex flex-col items-center justify-center mb-6">
          <img src="/naysa_logo.png" alt="NAYSA Logo" className="w-[100px] h-[70px] mb-4" />
          <h2 className="text-xl font-semibold text-blue-900 tracking-tight">Employee Portal</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-5">
            <label htmlFor="empno" className="block text-sm font-medium text-gray-900 mb-1">
              Employee No.
            </label>
            <input
              {...register("empno")}
              type="text"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 
                ${errors.empno ? "border-red-500" : "border-gray-300"}`}
            />
            {errors.empno && <p className="text-red-700 text-xs mt-1">{errors.empno.message}</p>}
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-1">
              Password
            </label>
            <input
              {...register("password")}
              type="password"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 
                ${errors.password ? "border-red-500" : "border-gray-300"}`}
            />
            {errors.password && <p className="text-red-700 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div className="text-right mb-4">
            <Link to="/forgot-password" size="sm" className="text-sm font-semibold text-blue-900 hover:text-blue-700 transition duration-200">
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full bg-blue-800 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-blue-600 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {loginMutation.isPending ? "Signing in..." : "Sign In"}
          </button>

          <div className="text-center mt-4">
            <span className="text-sm text-blue-900">Don't have an account?&nbsp;</span>
            <Link to="/Register" className="text-sm font-semibold text-blue-900 hover:text-blue-800 hover:underline transition duration-200">
              Sign up
            </Link>
          </div>

          <p className="text-center text-xs text-blue-900 mt-4">© 2026 ALL RIGHTS RESERVED</p>
        </form>
      </div>
    </div>
  );
}

export default LoginPortal;