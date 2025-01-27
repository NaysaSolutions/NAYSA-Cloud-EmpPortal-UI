import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';

function Register() {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => { 
        e.preventDefault();
        console.log('Form Data:', formData);
    
        setLoading(true);
        try {
            const response = await axios.post('http://localhost:8000/api/register', formData);
            
            await Swal.fire({
                title: 'Registration Successful!',
                text: 'Your account has been created. Redirecting you to login...',
                icon: 'success',
                timer: 3000,
                showConfirmButton: false,
            });
    
            console.log('Registration Response:', response.data);
            
            // Redirect to login page
            navigate('/');
        } catch (error) {
            await Swal.fire({
                title: 'Registration Failed!',
                text: 'Please check your details and try again.',
                icon: 'error',
                confirmButtonText: 'OK',
            });
            console.error('Registration failed: ', error);
        } finally {
            setLoading(false);
        }
    };
    

    return (
        <div className="bg-[linear-gradient(to_bottom,#A2BBF1,#D3A4DD)] flex items-center justify-center h-screen">
            <div
                className="relative px-20 py-10 rounded-3xl shadow-md"
                style={{ width: '530px', height: '600px', position: 'relative' }}
            >
                <div
                    className="absolute inset-0 rounded-3xl"
                    style={{
                        backgroundColor: '#5882C1',
                        opacity: 0.5,
                        zIndex: 0,
                    }}
                ></div>

                <div className="relative z-10">
                    <img
                        src="public/naysa LOGO.png"
                        alt="Logo"
                        className="w-200 h-20 mb-3"
                    />

                    <h2
                        className="text-white m-1"
                        style={{ fontFamily: 'SF Pro Rounded, sans-serif' }}
                    >
                        NAYSA Databridge
                    </h2>
                    <h2
                        className="text-4xl font-bold mb-5 text-white"
                        style={{ fontFamily: 'SF Pro Rounded, sans-serif' }}
                    >
                        Create Your Account
                    </h2>

                    <form onSubmit={handleSubmit}>
                       
                        <div className="mb-3">
                            <label
                                htmlFor="name"
                                className="block text-base font-normal text-gray-700"
                            >
                                Username
                            </label>
                            <input
                                type="text"
                                id="username"
                                name="username"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                placeholder="Enter your username"
                                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
                            />
                        </div>
                        <div className="mb-3">
                            <label
                                htmlFor="email"
                                className="block text-base font-normal text-gray-700"
                            >
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                placeholder="email@gmail.com"
                                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
                            />
                        </div>
                        <div className="mb-3">
                            <label
                                htmlFor="password"
                                className="block text-base font-normal text-gray-700"
                            >
                                Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="At least 8 characters"
                                required
                                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-[#162e3a] text-base text-white p-3 rounded-lg"
                            disabled={loading}
                        >
                            {loading ? 'Registering...' : 'Register'}
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
