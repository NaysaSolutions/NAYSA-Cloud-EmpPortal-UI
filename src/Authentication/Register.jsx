import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from 'axios';
import Swal from 'sweetalert2';

// 1. Validation Schema
const registerSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function Register() {
  const navigate = useNavigate();

  // 2. Setup Form with Zod resolver
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data) => {
    try {
      await axios.post('/api/register', data);
      
      await Swal.fire({
        title: 'Registration Successful!',
        text: 'Your account has been created. Redirecting to login...',
        icon: 'success',
        timer: 3000,
        showConfirmButton: false,
      });
      navigate('/');
    } catch (error) {
      await Swal.fire({
        title: 'Registration Failed!',
        text: error.response?.data?.message || 'Please check your details and try again.',
        icon: 'error',
        confirmButtonText: 'OK',
      });
    }
  };

  return (
    <div className="bg-[linear-gradient(to_bottom,#A2BBF1,#D3A4DD)] flex items-center justify-center h-screen">
      <div className="relative px-20 py-10 rounded-3xl shadow-md w-[530px] h-[600px]">
        {/* Background Overlay */}
        <div className="absolute inset-0 rounded-3xl bg-[#5882C1] opacity-50 z-0"></div>

        <div className="relative z-10">
          <img src="public/naysa LOGO.png" alt="Logo" className="w-200 h-20 mb-3" />
          <h2 className="text-white m-1 font-[sans-serif]">NAYSA Databridge</h2>
          <h2 className="text-4xl font-bold mb-5 text-white font-[sans-serif]">Create Your Account</h2>

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Username */}
            <div className="mb-3">
              <label className="block text-base font-normal text-gray-700">Username</label>
              <input
                {...register("username")}
                type="text"
                placeholder="Enter your username"
                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
              />
              {errors.username && <p className="text-red-200 text-xs mt-1">{errors.username.message}</p>}
            </div>

            {/* Email */}
            <div className="mb-3">
              <label className="block text-base font-normal text-gray-700">Email</label>
              <input
                {...register("email")}
                type="email"
                placeholder="email@gmail.com"
                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
              />
              {errors.email && <p className="text-red-200 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="mb-3">
              <label className="block text-base font-normal text-gray-700">Password</label>
              <input
                {...register("password")}
                type="password"
                placeholder="At least 8 characters"
                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
              />
              {errors.password && <p className="text-red-200 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#162e3a] text-base text-white p-3 rounded-lg hover:bg-[#1a3846] transition-colors"
            >
              {isSubmitting ? 'Registering...' : 'Register'}
            </button>

            <div className="text-center mt-5 flex justify-center items-center">
              <span className="text-sm text-gray-300">Already have an account?&nbsp;</span>
              <Link to="/" className="text-sm text-white hover:underline">Sign In</Link>
            </div>

            <span className="text-white text-xs flex items-center justify-center mt-2 mb-2">
              © 2025 ALL RIGHTS RESERVED
            </span>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Register;