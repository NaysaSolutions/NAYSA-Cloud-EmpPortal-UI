import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";
import API_ENDPOINTS from "@/apiConfig.jsx";
import { APP_DEPLOYED_AT_DISPLAY } from "@/deploymentInfo";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faEyeSlash,
  faUser,
  faLock,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    empno: "",
    password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [companyName, setCompanyName] = useState("Employee Portal");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (formData.password !== formData.confirm_password) {
      await Swal.fire("Error", "Passwords do not match.", "error");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        empno: formData.empno.trim(),
        password: formData.password,
        confirm_password: formData.confirm_password,
      };

      const { data } = await axios.post(API_ENDPOINTS.regEmp, payload);

      if (data?.status === "Updated") {
        await Swal.fire(
          "Success",
          "Password registered successfully!",
          "success"
        );

        navigate("/");
      } else {
        await Swal.fire(
          "Error",
          data?.message || "Registration failed.",
          "error"
        );
      }
    } catch (err) {
      await Swal.fire(
        "Error",
        err.response?.data?.message || "Something went wrong.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchCompanyName = async () => {
      try {
        const response = await axios.get(API_ENDPOINTS.companyName);

        if (!mounted) return;

        const name = response.data?.companyName?.trim();

        if (name) {
          setCompanyName(name);
        }
      } catch (error) {
        console.error("Unable to load company name:", error);

        if (mounted) {
          setCompanyName("Employee Portal");
        }
      }
    };

    fetchCompanyName();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="portal-page relative min-h-[100dvh] overflow-x-hidden bg-slate-950 text-slate-900 lg:h-[100dvh] lg:overflow-hidden">
      <style>{`
        @keyframes naysaFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-7px) scale(1.015); }
        }

        @keyframes naysaGlow {
          0%, 100% { opacity: .30; transform: scale(.94); }
          50% { opacity: .58; transform: scale(1.08); }
        }

        .naysa-logo-float {
          animation: naysaFloat 4.8s ease-in-out infinite;
        }

        .naysa-logo-glow {
          animation: naysaGlow 4.8s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .naysa-logo-float,
          .naysa-logo-glow {
            animation: none !important;
          }
        }

        /*
          Register has one more input than Login, so scale it slightly
          more on short desktop displays to keep the full form visible
          at 100% browser zoom.
        */
        @media (min-width: 1024px) and (max-height: 820px) {
          .portal-main {
            padding-top: .35rem;
            padding-bottom: .35rem;
          }

          .portal-brand-copy {
            transform: scale(.90);
            transform-origin: left top;
          }

          .portal-auth-wrap {
            transform: scale(.84);
          }
        }

        @media (min-width: 1024px) and (min-height: 821px) and (max-height: 900px) {
          .portal-auth-wrap {
            transform: scale(.93);
          }
        }
      `}</style>

      {/* =========================================================
          BACKGROUND
      ========================================================= */}
      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage: "url('/NAYSABG.png')",
          backgroundPosition: "center bottom",
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-slate-950/20" />

      {/* Darker on the RIGHT because the authentication card is there */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(2,6,23,.16) 0%, rgba(2,6,23,.24) 34%, rgba(2,6,23,.50) 68%, rgba(2,6,23,.76) 100%)",
        }}
      />

      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />

      {/* =========================================================
          MAIN
      ========================================================= */}
      <main className="portal-main relative z-10 mx-auto grid min-h-[calc(100dvh-48px)] w-full max-w-7xl grid-cols-1 items-center gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-5">
        {/* =======================================================
            LEFT BRANDING - DESKTOP
        ======================================================= */}
        <section className="portal-brand-copy hidden lg:order-1 lg:block lg:self-start lg:pr-10 lg:pt-[7vh] xl:pr-16">
          <div className="mb-5 inline-flex items-center rounded-full border border-white/30 bg-white/10 px-5 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white shadow-xl backdrop-blur-md">
            {companyName}
          </div>

          <h1 className="max-w-3xl text-4xl font-black uppercase leading-[1.02] tracking-[0.04em] text-white drop-shadow-[0_6px_20px_rgba(0,0,0,.45)] xl:text-4xl 2xl:text-6xl">
            YOUR WORKDAY,  SIMPLIFIED.
            {/* <br /> */}
            {/* SIMPLIFIED. */}
          </h1>

          <p className="mt-4 text-lg font-bold uppercase tracking-[0.16em] text-sky-100 drop-shadow-md xl:text-2xl">
            Employee Self-Service Portal
          </p>

          <div className="my-5 h-1 w-24 rounded-full bg-sky-400 shadow-[0_0_22px_rgba(56,189,248,.85)]" />

          <p className="max-w-xl text-sm font-medium leading-7 text-white/90 drop-shadow-md xl:text-base">
            Create your employee portal access to securely manage attendance,
            schedules, leave applications, overtime, payslips, announcements,
            and other employee services.
          </p>

          <div className="mt-6 flex max-w-2xl flex-wrap gap-2">
            {[
              "Timekeeping",
              "Employee Schedule",
              "Leave",
              "Official Business",
              "Overtime",
              "Payslips",
            ].map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur"
              >
                {item}
              </span>
            ))}
          </div>
        </section>

        {/* =======================================================
            REGISTER - RIGHT SIDE
        ======================================================= */}
        <section className="flex items-center justify-center lg:order-2 lg:justify-end">
          <div className="portal-auth-wrap w-full max-w-md origin-center transition-transform">
            {/* LOGO / PORTAL TITLE */}
            <div className="mb-2 flex flex-col items-center text-center">
              <div className="relative flex h-24 w-52 items-center justify-center sm:h-28 sm:w-60">
                <div className="naysa-logo-glow absolute inset-x-8 bottom-2 h-8 rounded-full bg-sky-300/30 blur-2xl" />
                <img
                  src="/naysa_logo.png"
                  alt="NAYSA Logo"
                  className="naysa-logo-float relative z-10 w-32 select-none drop-shadow-[0_10px_24px_rgba(0,0,0,.35)] sm:w-36"
                  draggable="false"
                />
              </div>

              <h1 className="-mt-1 mb-1 text-2xl font-extrabold tracking-tight text-white drop-shadow-[0_4px_15px_rgba(0,0,0,.5)] sm:text-[28px]">
                Employee Portal
              </h1>

              <div className="mt-2 mb-1 inline-flex items-center rounded-full border border-white/30 bg-white/10 px-5 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white shadow-xl backdrop-blur-md">
                {companyName}
              </div>
            </div>

            {/* REGISTER CARD */}
            <div
              className="relative w-full overflow-hidden rounded-[28px] border border-white/70 p-5 shadow-2xl backdrop-blur-xl sm:p-6"
              style={{
                backgroundColor: "rgba(255,255,255,.96)",
                boxShadow:
                  "0 24px 70px rgba(2,6,23,.34), inset 0 1px 0 rgba(255,255,255,.96)",
              }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />

              {/* CARD HEADER */}
              <div className="mb-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-700">
                  Employee Registration
                </p>

                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                  Create your access
                </h2>

                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Register your employee number and create your portal password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* EMPLOYEE NO */}
                <div>
                  <label
                    htmlFor="empno"
                    className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-slate-700"
                  >
                    Employee No.
                  </label>

                  <div className="relative">
                    <div className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400">
                      <FontAwesomeIcon icon={faUser} className="text-sm" />
                    </div>

                    <input
                      type="text"
                      id="empno"
                      name="empno"
                      value={formData.empno}
                      onChange={handleChange}
                      autoComplete="username"
                      placeholder="Enter employee number"
                      disabled={loading}
                      required
                      autoFocus
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* PASSWORD */}
                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-slate-700"
                  >
                    Password
                  </label>

                  <div className="relative">
                    <div className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400">
                      <FontAwesomeIcon icon={faLock} className="text-sm" />
                    </div>

                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      autoComplete="new-password"
                      placeholder="Enter your password"
                      disabled={loading}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-12 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      disabled={loading}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      <FontAwesomeIcon
                        icon={showPassword ? faEyeSlash : faEye}
                      />
                    </button>
                  </div>
                </div>

                {/* CONFIRM PASSWORD */}
                <div>
                  <label
                    htmlFor="confirm_password"
                    className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-slate-700"
                  >
                    Confirm Password
                  </label>

                  <div className="relative">
                    <div className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400">
                      <FontAwesomeIcon icon={faLock} className="text-sm" />
                    </div>

                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirm_password"
                      name="confirm_password"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      disabled={loading}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-12 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword((prev) => !prev)
                      }
                      disabled={loading}
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                      title={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                      className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      <FontAwesomeIcon
                        icon={showConfirmPassword ? faEyeSlash : faEye}
                      />
                    </button>
                  </div>
                </div>

                {/* REGISTER BUTTON */}
                <button
                  type="submit"
                  disabled={
                    loading ||
                    !formData.empno.trim() ||
                    !formData.password ||
                    !formData.confirm_password
                  }
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-700 to-blue-700 px-3 py-2.5 text-sm font-extrabold text-white shadow-md transition duration-200 hover:-translate-y-0.5 hover:from-sky-600 hover:to-blue-600 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Registering...
                    </>
                  ) : (
                    <>
                      Register
                      <FontAwesomeIcon
                        icon={faArrowRight}
                        className="text-xs"
                      />
                    </>
                  )}
                </button>

                {/* BACK TO LOGIN */}
                <div className="pt-0.5 text-center">
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

              {/* APPLICATION DATE */}
              <div className="mt-4 border-t border-slate-200 pt-3">
                <p className="text-center text-[9px] text-slate-400">
                  Application Date: {APP_DEPLOYED_AT_DISPLAY}
                </p>
              </div>
            </div>

            <p className="mt-3 text-center text-[10px] font-medium text-white/80 drop-shadow-md lg:hidden">
              Create your employee portal access securely from any device.
            </p>
          </div>
        </section>
      </main>

      {/* =========================================================
          FOOTER
      ========================================================= */}
      <footer className="relative z-10 flex h-12 items-center justify-center border-t border-white/20 bg-slate-950/75 px-4 backdrop-blur-md">
        <p className="text-center text-[11px] font-semibold tracking-wide text-white/90 sm:text-xs">
          © {new Date().getFullYear()} NAYSA-SOLUTIONS, INC. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default Register;
