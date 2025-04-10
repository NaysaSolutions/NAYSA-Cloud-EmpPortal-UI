import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import axios from 'axios';

function ResetPassword() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Make API call to reset the password (no token needed)
            const response = await axios.post('http://localhost:8000/api/register', {
                email,
                password,
                password_confirmation: passwordConfirm,
            });

            if (response.data.status === 'success') {
                await Swal.fire({
                    title: 'Password Reset Successful!',
                    text: 'Your password has been updated.',
                    icon: 'success',
                    confirmButtonText: 'OK',
                });
                navigate('/login'); // Redirect to login page after successful password reset
            } else {
                await Swal.fire({
                    title: 'Error!',
                    text: response.data.message || 'There was an issue resetting the password.',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
            }
        } catch (error) {
            console.error('Error during password reset request:', error);
            await Swal.fire({
                title: 'Error!',
                text: 'There was an issue resetting the password. Please try again later.',
                icon: 'error',
                confirmButtonText: 'OK',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[linear-gradient(to_bottom,#A2BBF1,#D3A4DD)] flex items-center justify-center h-screen relative">
            <div
                className="relative px-20 py-10 rounded-3xl shadow-md"
                style={{ width: '530px', height: '350px', position: 'relative' }}
            >
                <div
                    className="absolute inset-0 rounded-3xl"
                    style={{ backgroundColor: '#5882C1', opacity: 0.5, zIndex: 0 }}
                ></div>
                <div className="relative z-10">
                    <h2 className="text-4xl font-bold mb-5 text-white">Reset Your Password</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label htmlFor="email" className="block text-base font-normal text-gray-700">
                                Email Address
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="email@gmail.com"
                                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="password" className="block text-base font-normal text-gray-700">
                                New Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="********"
                                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="password_confirmation" className="block text-base font-normal text-gray-700">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                id="password_confirmation"
                                name="password_confirmation"
                                value={passwordConfirm}
                                onChange={(e) => setPasswordConfirm(e.target.value)}
                                required
                                placeholder="********"
                                className="mt-1 p-2 w-[380px] h-[45px] border-[1px] rounded-[12px]"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-[#162e3a] text-base text-white p-3 rounded-lg"
                            disabled={loading}
                        >
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default ResetPassword;
