import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { IoArrowBack } from 'react-icons/io5';
import axios from 'axios';

function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleEmailChange = (e) => {
        setEmail(e.target.value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setLoading(true);

        try {
            const response = await axios.post('http://localhost:8000/api/forgot-password', {
                email,
            });

            if (response.data.status === 'success') {
                await Swal.fire({
                    title: 'Password reset link sent!',
                    text: 'Please check your email to reset your password.',
                    icon: 'success',
                    confirmButtonText: 'OK',
                });
            } else {
                await Swal.fire({
                    title: 'Error!',
                    text: response.data.message || 'There was an issue sending the reset link.',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
            }
        } catch (error) {
            await Swal.fire({
                title: 'Error!',
                text: 'There was an issue sending the reset link. Please try again later.',
                icon: 'error',
                confirmButtonText: 'OK',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[linear-gradient(to_bottom,#A2BBF1,#D3A4DD)] flex items-center justify-center h-screen relative">
            {/* Back Icon */}
            <button
                onClick={() => navigate('/')}
                className="absolute top-5 left-5 text-white text-3xl z-50"
                aria-label="Go back to login page"
            >
                <IoArrowBack />
            </button>
            <div
                className="relative px-20 py-10 rounded-3xl shadow-md"
                style={{ width: '530px', height: '270px', position: 'relative' }}
            >
                <div
                    className="absolute inset-0 rounded-3xl"
                    style={{ backgroundColor: '#5882C1', opacity: 0.5, zIndex: 0 }}
                ></div>
                <div className="relative z-10">
                    <h2
                        className="text-4xl font-bold mb-5 text-white"
                        style={{ fontFamily: 'SF Pro Rounded, sans-serif' }}
                    >
                        Forgot Password?
                    </h2>

                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label
                                htmlFor="email"
                                className="block text-base font-normal text-gray-700"
                            >
                                Enter your email address
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={email}
                                onChange={handleEmailChange}
                                required
                                placeholder="email@gmail.com"
                                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-[#162e3a] text-base text-white p-3 rounded-lg"
                            disabled={loading}
                        >
                            {loading ? 'Sending...' : 'Send Password Reset Link'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default ForgotPassword;
