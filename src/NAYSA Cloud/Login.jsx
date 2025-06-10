import React, { useState } from 'react'; 
import { Link } from 'react-router-dom';

function Login() {

    return (
        // <div className="bg-[linear-gradient(to_bottom,#7392b7,#d8e1e9)] flex items-center justify-center min-h-screen px-4">
            <div className="bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center min-h-screen px-4">
        
           <div className="relative px-20 py-10 rounded-3xl shadow-md" style={{ width: '530px', height: '565px' }}>
                <div className="absolute inset-0 rounded-3xl" style={{ backgroundColor: '#5882C1', opacity: 0.5, zIndex: 0 }}></div>
    
                <div className="relative z-10">
                    <img src="public/naysa_logo.png" alt="Logo" className="w-200 h-20 mb-3" />
                    
                    <h2 className="text-white m-1" style={{ fontFamily: 'SF Pro Rounded, sans-serif' }}>
                        NAYSA Financials
                    </h2>
                    <h2 className="text-4xl font-bold mb-5 text-white" style={{ fontFamily: 'SF Pro Rounded, sans-serif' }}>
                        Welcome Back!
                    </h2>
    
                    <form>
                        <div className="mb-4">
                            <label htmlFor="userId" className="block text-base font-normal text-gray-700">
                                User ID
                            </label>
                            <input
                                type="text"
                                id="userId"
                                name="userId"
                                placeholder="input userId"
                                required
                                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="password" className="block text-base font-normal text-gray-700">
                                Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                placeholder="at least 8 characters"
                                required
                                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
                            />
                        </div>
                        <div className="text-right mt-2 mb-4">
                            <div className="text-sm text-white hover:underline">Forgot Password?</div>
                        </div>
                        <button type="submit" className="w-full bg-[#162e3a] text-base text-white p-3 rounded-lg">
                            Sign In
                        </button>

                        <div className="text-center mt-5 flex justify-center items-center">
                            <span className="text-sm text-gray-300">Don't have an account?&nbsp;</span>
                            <Link to="/register" className="text-sm text-white hover:underline cursor-pointer">
                            Sign up
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

export default Login;
