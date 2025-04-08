import React from 'react';
import { Link } from 'react-router-dom';


function Register() {
 

    return (
        <div className="bg-[linear-gradient(to_bottom,#7392b7,#d8e1e9)] flex items-center justify-center min-h-screen px-4">
            <div className="relative px-20 py-10 rounded-3xl shadow-md" style={{ width: '530px', height: '700px', position: 'relative' }}>
                <div className="absolute inset-0 rounded-3xl" style={{ backgroundColor: '#5882C1', opacity: 0.5, zIndex: 0 }}></div>

                <div className="relative z-10">
                <img src="public/naysa_logo.png" alt="Logo" className="w-200 h-20 mb-3" />

                    <h2 className="text-white m-1" style={{ fontFamily: 'SF Pro Rounded, sans-serif' }}>
                        NAYSA Financials
                    </h2>
                    <h2 className="text-4xl font-bold mb-5 text-white" style={{ fontFamily: 'SF Pro Rounded, sans-serif' }}>
                        Create Your Account
                    </h2>

                    <form>
                        <div className="mb-3">
                            <label htmlFor="userId" className="block text-base font-normal text-gray-700">
                                User ID
                            </label>
                            <input
                                type="text"
                                id="userId"
                                name="userId"
                                required
                                placeholder="Enter your User ID"
                                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="username" className="block text-base font-normal text-gray-700">
                                Username
                            </label>
                            <input
                                type="text"
                                id="username"
                                name="username"
                                required
                                placeholder="Enter your username"
                                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="email" className="block text-base font-normal text-gray-700">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                required
                                placeholder="email@gmail.com"
                                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
                            />
                        </div>
                        <div className="mb-5">
                            <label htmlFor="password" className="block text-base font-normal text-gray-700">
                                Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                placeholder="At least 8 characters"
                                required
                                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
                            />
                        </div>
                        <button type="submit" className="w-full bg-[#162e3a] text-base text-white p-3 rounded-lg">
                            Register
                        </button>

                        <div className="text-center mt-5 flex justify-center items-center">
                            <span className="text-sm text-gray-300">Already have an account?&nbsp;</span>
                            <Link to="/" className="text-sm text-white hover:underline">
                                Sign In
                            </Link>
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
