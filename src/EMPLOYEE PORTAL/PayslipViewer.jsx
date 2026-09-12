import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";

import html2pdf from "html2pdf.js";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { useAuth } from "./AuthContext";
import {
  FileText,
  Download,
  User,
  MapPin,
  AlertCircle,
  Banknote,
} from "lucide-react";
import "@/index.css";
import API_ENDPOINTS from "@/apiConfig.jsx";

const exportPayslipsByPage = async (pages, filename) => {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const margin = 8;

  const availableWidth =
    pageWidth - margin * 2;

  const availableHeight =
    pageHeight - margin * 2;

  for (let index = 0; index < pages.length; index += 1) {
    const pageElement = pages[index];

    const canvas = await html2canvas(pageElement, {
      scale: 2,
      useCORS: true,
      logging: false,

      backgroundColor: "#ffffff",

      scrollX: 0,
      scrollY: 0,

      windowWidth: 800,
    });

    const imageData =
      canvas.toDataURL("image/jpeg", 0.98);

    const imageWidth = canvas.width;
    const imageHeight = canvas.height;

    /*
     * Scale payslip to page width.
     */
    let renderWidth = availableWidth;

    let renderHeight =
      (imageHeight * renderWidth) /
      imageWidth;

    /*
     * If unusually tall, scale down so that the entire
     * payslip still fits on one page.
     */
    if (renderHeight > availableHeight) {
      renderHeight = availableHeight;

      renderWidth =
        (imageWidth * renderHeight) /
        imageHeight;
    }

    /*
     * Align at TOP of every page.
     *
     * This is the key fix for your Page 2 header space.
     */
    const x =
      (pageWidth - renderWidth) / 2;

    const y = margin;

    if (index > 0) {
      pdf.addPage();
    }

    pdf.addImage(
      imageData,
      "JPEG",
      x,
      y,
      renderWidth,
      renderHeight,
      undefined,
      "FAST"
    );
  }

  pdf.save(filename);
};

const normalizeApiPayload = (payload) => {
  if (payload == null) return {};

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return {};

    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload
    : {};
};

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const toFiniteNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const formatAmount = (
  value,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2
) =>
  toFiniteNumber(value).toLocaleString(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  });

const ResponsiveTable = ({ columns, rows, rowKey, className = "" }) => (
  <div
    className={`payslip-table-wrapper bg-white border border-gray-200 rounded-xl overflow-hidden ${className}`}
  >
    <div className="hidden sm:block overflow-x-auto payslip-table">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 md:px-4 py-2 text-xs font-bold text-gray-500 tracking-wider whitespace-nowrap ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="bg-white">
          {rows.map((row, idx) => (
            <tr
              key={rowKey ? rowKey(row, idx) : idx}
              className="hover:bg-gray-50"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 md:px-4 py-1.5 whitespace-nowrap text-xs text-gray-600 ${
                    col.align === "right" ? "text-right" : "text-left"
                  } ${
                    col.emphasize ? "font-medium text-gray-900" : ""
                  }`}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="sm:hidden">
      {rows.map((row, idx) => (
        <div
          key={rowKey ? rowKey(row, idx) : idx}
          className="p-3 space-y-1"
        >
          {columns.map((col) => (
            <div
              key={col.key}
              className="flex items-baseline justify-between gap-3 text-xs"
            >
              <span className="text-gray-500">{col.label}</span>

              <span
                className={`text-right ${
                  col.emphasize
                    ? "font-medium text-gray-900"
                    : "text-gray-700"
                }`}
              >
                {col.render ? col.render(row) : row[col.key]}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start space-x-3">
    <Icon className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />

    <div className="min-w-0">
      <p className="text-[12px] sm:text-xs text-gray-500">{label}</p>
      <p className="text-[12px] sm:text-[13px] font-semibold text-gray-800 break-words">
        {value ?? "—"}
      </p>
    </div>
  </div>
);

const PayslipViewer = () => {
  const { user } = useAuth();
  const empNo = user?.empNo ?? "";

  const [cutoffOptions, setCutoffOptions] = useState([]);
  const [cutoffFrom, setCutoffFrom] = useState("");
  const [cutoffTo, setCutoffTo] = useState("");
  const [payslipList, setPayslipList] = useState([]);

  const [loadingCutoffs, setLoadingCutoffs] = useState(false);
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [error, setError] = useState(null);

  const rangeInfo = useMemo(() => {
  if (!cutoffFrom || !cutoffTo) {
    return {
      hasRange: false,
      valid: false,
      invalid: false,
    };
  }

  const fromExists = cutoffOptions.some(
    (item) => String(item.CUT_OFF) === String(cutoffFrom)
  );

  const toExists = cutoffOptions.some(
    (item) => String(item.CUT_OFF) === String(cutoffTo)
  );

  if (!fromExists || !toExists) {
    return {
      hasRange: true,
      valid: false,
      invalid: true,
    };
  }

  /*
   * CUT_OFF is expected to be chronologically sortable
   * such as:
   *
   * 20260115
   * 20260130
   *
   * or another increasing payroll period code.
   */
  const valid =
    String(cutoffFrom).localeCompare(
      String(cutoffTo),
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      }
    ) <= 0;

  return {
    hasRange: true,
    valid,
    invalid: !valid,
  };
}, [cutoffOptions, cutoffFrom, cutoffTo]);

  useEffect(() => {
    if (!empNo) {
      setCutoffOptions([]);
      setCutoffFrom("");
      setCutoffTo("");
      setPayslipList([]);
      return undefined;
    }

    const controller = new AbortController();

    const fetchCutoffs = async () => {
      setLoadingCutoffs(true);
      setError(null);

      try {
        const response = await axios.get(API_ENDPOINTS.payslipCutoff, {
          params: { empno: empNo },
          signal: controller.signal,
        });

        // const payload = normalizeApiPayload(response.data);
        // setCutoffOptions(normalizeArray(payload.employeecutoff));

        const payload = normalizeApiPayload(response.data);

        const cutoffs = normalizeArray(
          payload.employeecutoff
        );

        const sortedCutoffs = [...cutoffs].sort((a, b) =>
          String(a.CUT_OFF).localeCompare(
            String(b.CUT_OFF),
            undefined,
            {
              numeric: true,
              sensitivity: "base",
            }
          )
        );

        setCutoffOptions(sortedCutoffs);

      } catch (err) {
        if (
          err?.name === "CanceledError" ||
          err?.code === "ERR_CANCELED"
        ) {
          return;
        }

        console.error("Error fetching cutoff options:", err);

        setCutoffOptions([]);
        setError(
          err?.response?.data?.message ||
            "Failed to load payroll cutoff options."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCutoffs(false);
        }
      }
    };

    fetchCutoffs();

    return () => controller.abort();
  }, [empNo]);

  useEffect(() => {
    if (!empNo || !rangeInfo.valid) {
      setPayslipList([]);
      return undefined;
    }

    const controller = new AbortController();

    const fetchPayslips = async () => {
      setLoadingPayslips(true);
      setError(null);

      try {
        const response = await axios.get(API_ENDPOINTS.payslipRange, {
          params: {
            empno: empNo,
            from: cutoffFrom,
            to: cutoffTo,
          },
          signal: controller.signal,
        });

        const payload = normalizeApiPayload(response.data);

        if (payload.success === false) {
          throw new Error(
            payload.message || "Unable to load payslip data."
          );
        }

        setPayslipList(normalizeArray(payload.payslips));
      } catch (err) {
        if (
          err?.name === "CanceledError" ||
          err?.code === "ERR_CANCELED"
        ) {
          return;
        }

        console.error("Payslip range error:", err);

        setPayslipList([]);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load payslip data."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingPayslips(false);
        }
      }
    };

    fetchPayslips();

    return () => controller.abort();
  }, [empNo, cutoffFrom, cutoffTo, rangeInfo.valid]);

  const handleExportPDF = async () => {
    const container = document.getElementById("payslip-container");

    if (!container || payslipList.length === 0) {
      return;
    }

    try {
      container.classList.add("pdf-export-mode");

      // Give the browser one frame to apply PDF CSS.
      await new Promise((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(resolve)
        )
      );

      const pages = Array.from(
        container.querySelectorAll(".payslip-page")
      );

      if (pages.length === 0) {
        throw new Error("No payslip pages found.");
      }

      const worker = html2pdf();

      const pdf = worker
        .set({
          margin: [8, 8, 8, 8],

          image: {
            type: "jpeg",
            quality: 0.98,
          },

          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 800,
            scrollX: 0,
            scrollY: 0,
          },

          jsPDF: {
            unit: "pt",
            format: "letter",
            orientation: "portrait",
          },
        });

      /*
      * Render each payslip independently.
      *
      * This prevents html2pdf from calculating the second
      * payslip's Y-position based on the previous page.
      */
      let finalPdf = null;

      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];

        const pageWorker = html2pdf()
          .set({
            margin: [8, 8, 8, 8],

            image: {
              type: "jpeg",
              quality: 0.98,
            },

            html2canvas: {
              scale: 2,
              useCORS: true,
              logging: false,
              windowWidth: 800,
              scrollX: 0,
              scrollY: 0,
            },

            jsPDF: {
              unit: "pt",
              format: "letter",
              orientation: "portrait",
            },
          })
          .from(page)
          .toPdf();

        const pagePdf = await pageWorker.get("pdf");

        if (index === 0) {
          finalPdf = pagePdf;
        } else {
          /*
          * html2pdf/jsPDF doesn't directly merge worker PDFs here,
          * so we'll use canvas rendering below instead.
          */
        }
      }

      /*
      * The more reliable implementation is below.
      */
      await exportPayslipsByPage(
        pages,
        `NAYSA-Payslip_${empNo}_Range-${cutoffFrom}-${cutoffTo}.pdf`
      );
    } catch (err) {
      console.error("PDF generation error:", err);

      setError(
        err?.message ||
        "Failed to generate payslip PDF."
      );
    } finally {
      container.classList.remove("pdf-export-mode");
    }
  };

  const loading = loadingCutoffs || loadingPayslips;
  const hasValidRange = rangeInfo.valid;
  const rangeIsInvalid = rangeInfo.invalid;

  return (
    <div className="mt-[75px] sm:mt-[80px] px-3 sm:px-4 md:px-6 py-4 bg-gray-50 min-h-screen ml-0 lg:ml-[200px]">
      <div className="mx-auto max-w-8xl">
        <div className="mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2.5 sm:p-3 rounded-xl shrink-0">
                <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>

              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                  Generate Payslip
                </h1>
              </div>
            </div>

            {payslipList.length > 0 && !loadingPayslips && (
              <button
                type="button"
                onClick={handleExportPDF}
                className="flex items-center justify-center space-x-2 bg-blue-700 text-white px-4 py-3 rounded-xl hover:bg-blue-900 transition-colors shadow-lg w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                <span>Download Payslip</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="flex-1 w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={cutoffFrom}
              onChange={(e) => setCutoffFrom(e.target.value)}
              disabled={loadingCutoffs}
            >
              <option value="">
                {loadingCutoffs ? "Loading periods..." : "-- From --"}
              </option>

              {cutoffOptions.map((option) => (
                <option
                  key={option.CUT_OFF}
                  value={option.CUT_OFF}
                >
                  {option.CUTOFFNAME}
                </option>
              ))}
            </select>

            <select
              className="flex-1 w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={cutoffTo}
              onChange={(e) => setCutoffTo(e.target.value)}
              disabled={loadingCutoffs}
            >
              <option value="">
                {loadingCutoffs ? "Loading periods..." : "-- To --"}
              </option>

              {cutoffOptions.map((option) => (
                <option
                  key={option.CUT_OFF}
                  value={option.CUT_OFF}
                >
                  {option.CUTOFFNAME}
                </option>
              ))}
            </select>
          </div>

          {rangeIsInvalid && (
            <p className="text-xs text-red-600 mt-2">
              The "From" period must come before or match the "To" period.
            </p>
          )}
        </div>

        {loadingPayslips && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 text-sm sm:text-base">
              Loading payslip data...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-2">
            <div className="flex items-start sm:items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3 shrink-0 mt-0.5 sm:mt-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {!loadingPayslips && (
          <div
            id="payslip-container"
            className="payslip-pdf-content"
          >
            {payslipList.map((data) => {
              const employee = normalizeApiPayload(data.employee);

              if (!employee?.EMPNO) return null;

              const earnings = normalizeArray(data.earnings);
              const deductions = normalizeArray(data.deductions);
              const employeelv = normalizeArray(data.leave);
              const employeeln = normalizeArray(data.loans);
              const employeeytd = normalizeArray(data.ytd);

              const totalEarnings = toFiniteNumber(data.total_earnings);
              const totalDeductions = toFiniteNumber(data.total_deductions);
              const netPay = toFiniteNumber(data.net_pay);

              const freqType = String(employee.FREQ_TYPE ?? "")
                .trim()
                .toUpperCase();

              const rateLabel = ["SP", "MP"].includes(freqType)
                ? "Basic Rate"
                : freqType === "DP"
                  ? "Daily Rate"
                  : null;

              const rateValue =
                rateLabel === "Basic Rate"
                  ? employee.BASIC
                  : employee.DAILY_RATE;

              return (
                <div
                  id={`payslip-${data.cutoffCode}`}
                  key={data.cutoffCode}
                  className="payslip-page bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
                >
                  <div className="text-blue-900 p-3 sm:p-4 text-center">
                    <h1 className="text-lg sm:text-xl font-extrabold break-words">
                      {employee.COMP_NAME}
                    </h1>

                    <p className="text-blue-800 text-xs sm:text-sm font-extrabold p-1">
                      Branch: {employee.BRANCHNAME}
                    </p>

                    <p className="text-blue-800 text-xs sm:text-sm font-extrabold">
                      Payroll Period: {data.cutoffName}
                    </p>
                  </div>

                  <div className="payslip-body p-3 sm:p-4">
                    <div className="payslip-employee-info grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mb-4">
                      <div className="space-y-2">
                        <InfoRow icon={User} label="Employee No." value={employee.EMPNO} />
                        <InfoRow icon={User} label="Employee Name" value={employee.EMP_NAME} />
                        <InfoRow icon={User} label="Payroll Group" value={employee.GROUP_NAME} />
                      </div>

                      <div className="space-y-2">
                        <InfoRow icon={MapPin} label="Department" value={employee.ORG_NAME} />
                        <InfoRow icon={MapPin} label="Position" value={employee.POSITION} />

                        {rateLabel && (
                          <InfoRow
                            icon={Banknote}
                            label={rateLabel}
                            value={`₱ ${formatAmount(rateValue)}`}
                          />
                        )}
                      </div>
                    </div>

                    <div className="payslip-earnings-deductions grid grid-cols-1 lg:grid-cols-2 gap-4 mb-2">
                      <div className="bg-blue-50 rounded-xl p-3 sm:p-4">
                        <h3 className="text-xs sm:text-sm font-semibold text-blue-800 mb-2">
                          Earnings
                        </h3>

                        {earnings.length > 0 ? (
                          <div className="sm:space-y-0.5 text-[11px] sm:text-xs">
                            {earnings.map((item, index) => (
                              <div
                                key={`${data.cutoffCode}-${item.TRANS_CODE ?? "earning"}-${index}`}
                                className="grid grid-cols-[minmax(0,1fr)_60px_90px] gap-2 py-1 items-start w-full"
                              >
                                <span className="text-gray-700 break-words">
                                  {item.DESCRIP}
                                </span>

                                <span className="font-semibold text-blue-700 text-right w-full">
                                  {formatAmount(item.HOURS)}
                                </span>

                                <span className="font-semibold text-blue-700 text-right w-full">
                                  {formatAmount(item.AMOUNT)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">
                            No earnings found.
                          </p>
                        )}
                      </div>

                      <div className="bg-red-50 rounded-xl p-3 sm:p-4">
                        <h3 className="text-xs sm:text-sm font-semibold text-red-800 mb-2">
                          Deductions
                        </h3>

                        {deductions.length > 0 ? (
                          <div className="space-y-0 sm:space-y-0.5 text-[11px] sm:text-xs">
                            {deductions.map((item, index) => (
                              <div
                                key={`${data.cutoffCode}-${item.TRANS_CODE ?? "deduction"}-${index}`}
                                className="grid grid-cols-[minmax(0,1fr)_100px] gap-2 py-1 items-start w-full"
                              >
                                <span className="text-gray-700 break-words">
                                  {item.DESCRIP}
                                </span>

                                <span className="font-semibold text-red-700 text-right w-full">
                                  {formatAmount(item.AMOUNT)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">
                            No deductions found.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="payslip-summary bg-gray-50 rounded-xl p-3 sm:p-4 mb-4">
                      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-6">
                        <div className="text-center">
                          <p className="text-[11px] sm:text-sm text-gray-500 mb-1">
                            Total Earnings
                          </p>
                          <p className="text-xs sm:text-lg font-bold text-blue-600">
                            ₱ {formatAmount(totalEarnings)}
                          </p>
                        </div>

                        <div className="text-center">
                          <p className="text-[11px] sm:text-sm text-gray-500 mb-1">
                            Total Deductions
                          </p>
                          <p className="text-xs sm:text-lg font-bold text-red-600">
                            ₱ {formatAmount(totalDeductions)}
                          </p>
                        </div>

                        <div className="text-center">
                          <p className="text-[11px] sm:text-sm text-gray-500 mb-1">
                            Net Pay
                          </p>
                          <p className="text-xs sm:text-lg font-bold text-gray-800">
                            ₱ {formatAmount(netPay)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {employeeytd.length > 0 && (
                      <div className="payslip-ytd mb-4">
                        <ResponsiveTable
                          columns={[
                            {
                              key: "YTD_GROSS",
                              label: "YTD Gross",
                              align: "right",
                              render: (row) => `₱ ${formatAmount(row.YTD_GROSS)}`,
                            },
                            {
                              key: "YTD_TAXABLE",
                              label: "YTD Taxable",
                              align: "right",
                              render: (row) => `₱ ${formatAmount(row.YTD_TAXABLE)}`,
                            },
                            {
                              key: "YTD_TAX",
                              label: "YTD Tax",
                              align: "right",
                              render: (row) => `₱ ${formatAmount(row.YTD_TAX)}`,
                            },
                            {
                              key: "YTD_SSS",
                              label: "YTD SSS",
                              align: "right",
                              render: (row) => `₱ ${formatAmount(row.YTD_SSS)}`,
                            },
                            {
                              key: "YTD_HDMF",
                              label: "YTD HDMF",
                              align: "right",
                              render: (row) => `₱ ${formatAmount(row.YTD_HDMF)}`,
                            },
                            {
                              key: "YTD_MED",
                              label: "YTD PhilHealth",
                              align: "right",
                              render: (row) => `₱ ${formatAmount(row.YTD_MED)}`,
                            },
                          ]}
                          rows={employeeytd}
                          rowKey={(_, index) => `${data.cutoffCode}-ytd-${index}`}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {employeeln.length > 0 && (
                        <ResponsiveTable
                          columns={[
                            {
                              key: "LOAN_DESC",
                              label: "Loan Type",
                              emphasize: true,
                            },
                            {
                              key: "LOAN_BAL",
                              label: "Balance",
                              align: "right",
                              render: (row) => `₱ ${formatAmount(row.LOAN_BAL)}`,
                            },
                            {
                              key: "TOTAL_PAID",
                              label: "Total Paid",
                              align: "right",
                              render: (row) => `₱ ${formatAmount(row.TOTAL_PAID)}`,
                            },
                          ]}
                          rows={employeeln}
                          rowKey={(row, index) =>
                            `${data.cutoffCode}-${row.LOAN_DESC ?? "loan"}-${index}`
                          }
                        />
                      )}

                      {employeelv.length > 0 && (
                        <ResponsiveTable
                          columns={[
                            {
                              key: "LV_TYPE",
                              label: "Leave Type",
                              emphasize: true,
                            },
                            {
                              key: "AVAILED_HRS",
                              label: "Used (hrs)",
                              align: "right",
                              render: (row) =>
                                `${formatAmount(row.AVAILED_HRS, 1, 1)} hrs`,
                            },
                            {
                              key: "AVAILED",
                              label: "Used (days)",
                              align: "right",
                              render: (row) =>
                                `${formatAmount(row.AVAILED, 1, 1)} days`,
                            },
                            {
                              key: "ENDBAL_HRS",
                              label: "Balance (hrs)",
                              align: "right",
                              render: (row) =>
                                `${formatAmount(row.ENDBAL_HRS, 1, 1)} hrs`,
                            },
                            {
                              key: "ENDBAL",
                              label: "Balance (days)",
                              align: "right",
                              render: (row) =>
                                `${formatAmount(row.ENDBAL, 1, 1)} days`,
                            },
                          ]}
                          rows={employeelv}
                          rowKey={(row, index) =>
                            `${data.cutoffCode}-${row.LV_TYPE ?? "leave"}-${index}`
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading &&
          !error &&
          hasValidRange &&
          payslipList.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center">
              <FileText className="w-14 h-14 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />

              <p className="text-gray-600 text-base sm:text-lg">
                No payslip found for the selected period range
              </p>

              <p className="text-gray-500 text-sm mt-2">
                Please check the "From" and "To" periods and try again
              </p>
            </div>
          )}
      </div>
    </div>
  );
};

export default PayslipViewer;
