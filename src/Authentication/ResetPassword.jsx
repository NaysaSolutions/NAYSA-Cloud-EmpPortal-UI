import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import axios from "axios";
import API_ENDPOINTS from "@/apiConfig.jsx";

function ResetPassword() {
  // Grab the email silently from the URL (e.g., ?email=name@company.com)
  const [searchParams] = useSearchParams();
  const emailFromUrl = searchParams.get("email");

  const [tempPassword, setTempPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Safety check just in case they opened the page without clicking the email link
    if (!emailFromUrl) {
      return Swal.fire("Error", "Invalid link. Please request a new password reset from the login page.", "error");
    }

    if (password !== passwordConfirm) {
      return Swal.fire("Error", "Your new passwords do not match.", "error");
    }

    setLoading(true);

    try {
      // Use the config file instead of hardcoding the URL!
      const response = await axios.post(API_ENDPOINTS.updateTempPassword, {
        email: emailFromUrl,
        temp_password: tempPassword,
        new_password: password,
        new_password_confirmation: passwordConfirm,
      });

      if (response.data.status === "success") {
        await Swal.fire({
          title: "Password Reset Successful!",
          text: "Your password has been securely updated.",
          icon: "success",
          confirmButtonText: "Go to Login",
        });
        navigate("/"); 
      } else {
        await Swal.fire({
          title: "Error!",
          text: response.data.message || "There was an issue resetting the password.",
          icon: "error",
          confirmButtonText: "OK",
        });
      }
    } catch (error) {
      console.error("Error during password reset request:", error);
      await Swal.fire({
        title: "Error!",
        text: error.response?.data?.message || "Invalid temporary password or server error.",
        icon: "error",
        confirmButtonText: "OK",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[linear-gradient(to_bottom,#becdda,#84a1ba)] flex items-center justify-center min-h-screen px-4">
      <div className="bg-[linear-gradient(to_bottom,#84a1ba,#becdda)] px-6 py-10 rounded-3xl shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-semibold text-blue-900 mb-6 text-center">
          Reset Password
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* EMAIL FIELD REMOVED! */}

          <div>
            <label htmlFor="tempPassword" className="block text-sm font-medium text-gray-900 mb-1">
              Temporary Password
            </label>
            <input
              type="text"
              id="tempPassword"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              required
              placeholder="From your email (e.g. A1B2C3)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="pt-2 border-t border-blue-300/30">
            <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-1 mt-2">
              New Permanent Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength="8"
              placeholder="Min. 8 characters"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label htmlFor="password_confirmation" className="block text-sm font-medium text-gray-900 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              id="password_confirmation"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              minLength="8"
              placeholder="Retype new password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !tempPassword || !password}
            className="w-full bg-blue-800 text-white font-semibold py-3 mt-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-600 transition-colors"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>

          <p
            className="text-center text-sm text-blue-900 mt-4 cursor-pointer hover:underline"
            onClick={() => navigate("/")}
          >
            Back to Login
          </p>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;