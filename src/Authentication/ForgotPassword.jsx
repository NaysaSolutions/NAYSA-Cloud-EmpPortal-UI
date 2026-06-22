import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import axios from "axios";
import API_ENDPOINTS from "@/apiConfig.jsx";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await axios.post(API_ENDPOINTS.forgotPassword, {
        email: email.trim(),
      });

      if (data?.status === "success") {
        await Swal.fire({
          title: "Temporary Password Sent",
          text: "Please check your registered email.",
          icon: "success",
          confirmButtonText: "OK",
        });
        navigate("/");
      } else {
        Swal.fire("Error", data?.message || "Request failed.", "error");
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
      <div className="bg-[linear-gradient(to_bottom,#84a1ba,#becdda)] px-6 py-10 rounded-3xl shadow-2xl w-full max-w-sm">
        <h2 className="text-xl font-semibold text-blue-900 mb-6 text-center">
          Forgot Password
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full bg-blue-800 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-600"
          >
            {loading ? "Sending..." : "Send Temporary Password"}
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

export default ForgotPassword;