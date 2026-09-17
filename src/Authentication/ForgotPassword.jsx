import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";
import axios from "axios";
import API_ENDPOINTS from "@/apiConfig.jsx";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEnvelope,
  faPaperPlane,
  faArrowLeft,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("Employee Portal");
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
      `}</style>

      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage: "url('/NAYSABG.png')",
          backgroundPosition: "center bottom",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-slate-950/20" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(2,6,23,.16) 0%, rgba(2,6,23,.24) 34%, rgba(2,6,23,.50) 68%, rgba(2,6,23,.76) 100%)",
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />

      <main className="relative z-10 mx-auto grid min-h-[calc(100dvh-48px)] w-full max-w-7xl grid-cols-1 items-center gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-5">
        <section className="hidden lg:order-1 lg:block lg:self-start lg:pr-10 lg:pt-[7vh] xl:pr-16">
          <div className="mb-5 inline-flex items-center rounded-full border border-white/30 bg-white/10 px-5 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white shadow-xl backdrop-blur-md">
            {companyName}
          </div>
          <h1 className="max-w-3xl text-4xl font-black uppercase leading-[1.02] tracking-[0.04em] text-white drop-shadow-[0_6px_20px_rgba(0,0,0,.45)] xl:text-5xl 2xl:text-6xl">
            RECOVER YOUR
            <br />
            ACCOUNT ACCESS.
          </h1>
          <p className="mt-4 max-w-xl text-sm font-medium leading-7 text-white/90 drop-shadow-md xl:text-base">
            Enter your registered email address and the portal will send your
            temporary password according to your existing recovery process.
          </p>
          <div className="my-5 h-1 w-24 rounded-full bg-sky-400 shadow-[0_0_22px_rgba(56,189,248,.85)]" />
          <div className="flex max-w-lg items-start gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 text-white/80 backdrop-blur-sm">
            <FontAwesomeIcon icon={faShieldHalved} className="mt-0.5 text-sky-300" />
            <p className="text-xs leading-5">
              For your security, use only the email address registered to your employee account.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center lg:order-2 lg:justify-end">
          <div className="w-full max-w-md">
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

            <div
              className="relative w-full overflow-hidden rounded-[28px] border border-white/70 p-5 shadow-2xl backdrop-blur-xl sm:p-6"
              style={{
                backgroundColor: "rgba(255,255,255,.96)",
                boxShadow:
                  "0 24px 70px rgba(2,6,23,.34), inset 0 1px 0 rgba(255,255,255,.96)",
              }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />

              <div className="mb-5">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-700">
                  Account Recovery
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                  Forgot password?
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Enter your registered email to request a temporary password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="recovery-email"
                    className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-slate-700"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <FontAwesomeIcon
                      icon={faEnvelope}
                      className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-sm text-slate-400"
                    />
                    <input
                      id="recovery-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      autoComplete="email"
                      placeholder="name@company.com"
                      disabled={loading}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-700 to-blue-700 px-3 py-2.5 text-sm font-extrabold text-white shadow-md transition duration-200 hover:-translate-y-0.5 hover:from-sky-600 hover:to-blue-600 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
                      Send Temporary Password
                    </>
                  )}
                </button>

                <div className="text-center">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 transition hover:text-blue-700 hover:underline"
                  >
                    <FontAwesomeIcon icon={faArrowLeft} className="text-[10px]" />
                    Back to Login
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 flex h-12 items-center justify-center border-t border-white/20 bg-slate-950/75 px-4 backdrop-blur-md">
        <p className="text-center text-[11px] font-semibold tracking-wide text-white/90 sm:text-xs">
          © {new Date().getFullYear()} NAYSA-SOLUTIONS, INC. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default ForgotPassword;
