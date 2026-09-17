import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import Swal from "sweetalert2";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faEnvelope,
  faLock,
  faEye,
  faEyeSlash,
  faUserPlus,
} from "@fortawesome/free-solid-svg-icons";

const registerSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data) => {
    try {
      await axios.post("/api/register", data);

      await Swal.fire({
        title: "Registration Successful!",
        text: "Your account has been created. Redirecting to login...",
        icon: "success",
        timer: 3000,
        showConfirmButton: false,
      });

      navigate("/");
    } catch (error) {
      await Swal.fire({
        title: "Registration Failed!",
        text:
          error.response?.data?.message ||
          "Please check your details and try again.",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  const inputClass = (hasError) =>
    `w-full rounded-xl border bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:ring-4 ${
      hasError
        ? "border-rose-300 focus:border-rose-400 focus:ring-rose-400/15"
        : "border-slate-200 focus:border-sky-400 focus:ring-sky-400/15"
    }`;

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-slate-950 text-slate-900 lg:h-[100dvh] lg:overflow-hidden">
      <style>{`
        @keyframes naysaFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-7px) scale(1.015); }
        }
        @keyframes naysaGlow {
          0%, 100% { opacity: .30; transform: scale(.94); }
          50% { opacity: .58; transform: scale(1.08); }
        }
        .naysa-logo-float { animation: naysaFloat 4.8s ease-in-out infinite; }
        .naysa-logo-glow { animation: naysaGlow 4.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .naysa-logo-float, .naysa-logo-glow { animation: none !important; }
        }
        @media (min-width: 1024px) and (max-height: 760px) {
          .portal-register-wrap { transform: scale(.88); }
        }
      `}</style>

      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/NAYSABG.png')" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-slate-950/45" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/75 via-sky-950/35 to-blue-800/25" />
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />

      <main className="relative z-10 mx-auto grid min-h-[calc(100dvh-48px)] w-full max-w-7xl grid-cols-1 items-center gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-5">
        <section className="hidden lg:block">
          <div className="mb-5 inline-flex items-center rounded-full border border-white/30 bg-white/10 px-5 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white shadow-xl backdrop-blur-md">
            Employee Portal
          </div>
          <h1 className="max-w-3xl text-4xl font-black uppercase leading-[1.02] tracking-[0.04em] text-white drop-shadow-[0_6px_20px_rgba(0,0,0,.45)] xl:text-5xl 2xl:text-6xl">
            CREATE YOUR
            <br />
            EMPLOYEE ACCESS.
          </h1>
          <p className="mt-4 max-w-xl text-sm font-medium leading-7 text-white/90 drop-shadow-md xl:text-base">
            Register your portal credentials so you can access employee services
            securely from desktop, tablet, or mobile.
          </p>
          <div className="my-5 h-1 w-24 rounded-full bg-sky-400 shadow-[0_0_22px_rgba(56,189,248,.85)]" />
          <p className="max-w-lg text-xs leading-6 text-white/75">
            Use a valid email address and a password with at least 8 characters.
          </p>
        </section>

        <section className="flex items-center justify-center">
          <div className="portal-register-wrap w-full max-w-md origin-center transition-transform">
            <div className="mb-3 flex flex-col items-center text-center">
              <div className="relative flex h-24 w-52 items-center justify-center sm:h-28 sm:w-60">
                <div className="naysa-logo-glow absolute inset-x-8 bottom-2 h-8 rounded-full bg-sky-300/35 blur-2xl" />
                <img
                  src="/naysa_logo.png"
                  alt="NAYSA Logo"
                  className="naysa-logo-float relative z-10 w-32 select-none drop-shadow-[0_10px_24px_rgba(0,0,0,.35)] sm:w-36"
                  draggable="false"
                />
              </div>
              <h1 className="-mt-1 text-2xl font-extrabold tracking-tight text-white drop-shadow-[0_4px_15px_rgba(0,0,0,.5)] sm:text-[28px]">
                Employee Portal
              </h1>
              <p className="mt-0.5 text-xs font-medium text-white/80">
                NAYSA-SOLUTIONS, INC.
              </p>
            </div>

            <div
              className="relative w-full overflow-hidden rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-2xl backdrop-blur-xl sm:p-6"
              style={{
                boxShadow:
                  "0 24px 70px rgba(2,6,23,.34), inset 0 1px 0 rgba(255,255,255,.92)",
              }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />

              <div className="mb-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-700">
                  New Employee Access
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                  Create your account
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enter your details to register for the employee portal.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Username
                  </label>
                  <div className="relative">
                    <FontAwesomeIcon
                      icon={faUser}
                      className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-sm text-slate-400"
                    />
                    <input
                      {...register("username")}
                      type="text"
                      autoComplete="username"
                      placeholder="Enter your username"
                      className={inputClass(errors.username)}
                    />
                  </div>
                  {errors.username && (
                    <p className="mt-1 text-[11px] font-medium text-rose-600">
                      {errors.username.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Email Address
                  </label>
                  <div className="relative">
                    <FontAwesomeIcon
                      icon={faEnvelope}
                      className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-sm text-slate-400"
                    />
                    <input
                      {...register("email")}
                      type="email"
                      autoComplete="email"
                      placeholder="name@company.com"
                      className={inputClass(errors.email)}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-[11px] font-medium text-rose-600">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <FontAwesomeIcon
                      icon={faLock}
                      className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-sm text-slate-400"
                    />
                    <input
                      {...register("password")}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      className={`${inputClass(errors.password)} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-[11px] font-medium text-rose-600">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-700 to-blue-700 px-3 py-2.5 text-sm font-extrabold text-white shadow-md transition duration-200 hover:-translate-y-0.5 hover:from-sky-600 hover:to-blue-600 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faUserPlus} className="text-xs" />
                      Register
                    </>
                  )}
                </button>

                <div className="text-center">
                  <span className="text-xs font-medium text-slate-600">
                    Already have an account?{" "}
                  </span>
                  <Link
                    to="/"
                    className="text-xs font-bold text-sky-700 transition hover:text-blue-700 hover:underline"
                  >
                    Sign In
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 flex h-12 items-center justify-center border-t border-white/15 bg-slate-950/75 px-4 backdrop-blur-md">
        <p className="text-center text-[11px] font-semibold tracking-wide text-white/90 sm:text-xs">
          © {new Date().getFullYear()} NAYSA-SOLUTIONS, INC. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default Register;
