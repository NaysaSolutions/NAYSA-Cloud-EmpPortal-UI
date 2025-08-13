
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import { useAuth } from './AuthContext';
import { FileText, Download, Printer, Calendar, User, Building, MapPin, Clock, AlertCircle } from 'lucide-react';
import '../index.css'; // or './globals.css'

const PayslipViewer = () => {
  const { user } = useAuth();
  const [cutoff, setCutoff] = useState('');
  const [payslip, setPayslip] = useState(null);
  const [paysliplv, setPaysliplv] = useState(null);
  const [payslipln, setPayslipln] = useState(null);
  const [payslipytd, setPayslipytd] = useState(null);

  const [cutoffOptions, setCutoffOptions] = useState([]);
  const [cutoffFrom, setCutoffFrom] = useState('');
  const [cutoffTo, setCutoffTo] = useState('');

  const [payslipList, setPayslipList] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const payslipRef = useRef();

useEffect(() => {
  if (!user?.empNo || !cutoffFrom || !cutoffTo) return;

  setLoading(true);
  setError(null);

  const range = getCutoffRange();

  const fetchAllPayslipsInRange = async () => {
    try {
      const results = await Promise.all(range.map(async (cut) => {
        const [main, lv, ln, ytd] = await Promise.all([
          axios.get('/api/reports/payslip', { params: { empno: user.empNo, cutoff: cut.CUT_OFF } }),
          axios.get('/api/reports/payslipLV', { params: { empno: user.empNo, cutoff: cut.CUT_OFF } }),
          axios.get('/api/reports/payslipLN', { params: { empno: user.empNo, cutoff: cut.CUT_OFF } }),
          axios.get('/api/reports/payslipYTD', { params: { empno: user.empNo, cutoff: cut.CUT_OFF } }),
        ]);

        return {
          cutoffName: cut.CUTOFFNAME,
          cutoffCode: cut.CUT_OFF,
          main: main.data,
          lv: lv.data,
          ln: ln.data,
          ytd: ytd.data
        };
      }));

      setPayslipList(results);
    } catch (err) {
      setError('Failed to fetch payslip data for the range.');
    } finally {
      setLoading(false);
    }
  };

  fetchAllPayslipsInRange();
}, [user, cutoffFrom, cutoffTo]);



  useEffect(() => {
  if (!user?.empNo) return;

  console.log("Sending empNo to /api/reports/payslipCutoff:", user.empNo);

  const fetchCutoffs = async () => {
    try {
      const res = await axios.get('/api/reports/payslipCutoff', {
        params: { empno: user.empNo },
      });
      setCutoffOptions(res.data?.employeecutoff || []);
    } catch (err) {
      console.error("Error fetching cutoff options:", err);
      setError('Failed to load cutoff options.');
    }
  };

  fetchCutoffs();
}, [user]);


  const {
    employee,
    earnings = [],
    deductions = [],
    total_earnings = 0,
    total_deductions = 0,
    net_pay = 0,
  } = payslip?.success ? payslip : {};

  const employeelv = paysliplv?.success ? paysliplv.employeelv : [];
  const employeeln = payslipln?.success ? payslipln.employeeln : [];
  const employeeytd = payslipytd?.success ? payslipytd.employeeytd : [];

  const getCutoffRange = () => {
  if (!cutoffFrom || !cutoffTo) return [];

  const fromIndex = cutoffOptions.findIndex(o => o.CUT_OFF === cutoffFrom);
  const toIndex = cutoffOptions.findIndex(o => o.CUT_OFF === cutoffTo);

  if (fromIndex === -1 || toIndex === -1 || fromIndex > toIndex) return [];

  return cutoffOptions.slice(fromIndex, toIndex + 1);
};

const handleExportPDF = () => {
  const element = document.createElement('div');
  element.style.padding = '20px';
  
  // Clone all payslip elements
  payslipList.forEach((_, index) => {
    const slip = document.getElementById(`payslip-${index}`)?.cloneNode(true);
    if (slip) {
      element.appendChild(slip);
      element.appendChild(document.createElement('hr')); // Add separator
    }
  });

  const opt = {
    margin: 3,
    filename: `NAYSA-Payslip_${user.empNo}_Range-${cutoffFrom}-${cutoffTo}.pdf`,
    image: { type: 'jpeg', quality: 1 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
  };

  html2pdf()
    .set(opt)
    .from(element)
    .save();
};

  return (
    <div className="mt-[80px] p-4 bg-gray-100 min-h-screen ml-0 lg:ml-[200px]">
      <div className="mx-auto">
        {/* Header Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-3 rounded-xl">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Generate Payslip</h1>
                {/* <p className="text-gray-600">Generate and download your payslip</p> */}
              </div>
            </div>
            
            {payslipList.length > 0 && (
              <div className="flex space-x-3">
                <button
                  onClick={handleExportPDF}
                  className="flex items-center space-x-2 bg-blue-700 text-white px-4 py-3 rounded-xl hover:blue-900 shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Payslip</span>
                </button>
              </div>
            )}
          </div>
          
          <div className="flex space-x-2">
            <select
              className="flex-1 px-2 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={cutoffFrom}
              onChange={(e) => setCutoffFrom(e.target.value)}
            >
              <option value="">-- From --</option>
              {cutoffOptions.map((option) => (
                <option key={option.CUT_OFF} value={option.CUT_OFF}>
                  {option.CUTOFFNAME}
                </option>
              ))}
            </select>

            <select
              className="flex-1 px-2 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={cutoffTo}
              onChange={(e) => setCutoffTo(e.target.value)}
            >
              <option value="">-- To --</option>
              {cutoffOptions.map((option) => (
                <option key={option.CUT_OFF} value={option.CUT_OFF}>
                  {option.CUTOFFNAME}
                </option>
              ))}
            </select>
          </div>


        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading payslip data...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-2">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

{payslipList.map((data, index) => {
  const { main, lv, ln, ytd, cutoffName, cutoffCode } = data;
  if (!main.success) return null;

  const employee = main.employee;
  const earnings = main.earnings || [];
  const deductions = main.deductions || [];
  const net_pay = main.net_pay || 0;
  const total_earnings = main.total_earnings || 0;
  const total_deductions = main.total_deductions || 0;
  const employeelv = lv?.employeelv || [];
  const employeeln = ln?.employeeln || [];
  const employeeytd = ytd?.employeeytd || [];

  return (
    <div key={index} ref={index === 0 ? payslipRef : null} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
      {/* 👇 Insert your full payslip HTML layout here */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-1 text-center">
        <h1 className="text-xl font-bold mb-0">{employee.COMP_NAME}</h1>
        {/* <p className="text-blue-100 text-base">Payroll Period: {cutoffName}</p> */}
      </div>

      <div className="p-4">
              {/* Employee Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Employee No.</p>
                      <p className="text-sm font-semibold text-gray-800">{employee.EMPNO}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Employee Name</p>
                      <p className="text-sm font-semibold text-gray-800">{employee.EMP_NAME}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Building className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Branch</p>
                      <p className="text-sm font-semibold text-gray-800">{employee.BRANCHNAME}</p>
                    </div>
                  </div>
                  
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Department</p>
                      <p className="text-sm font-semibold text-gray-800">{employee.ORG_NAME}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Position</p>
                      <p className="text-sm font-semibold text-gray-800">{employee.POSITION}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Payroll Period</p>
                      <p className="text-sm font-semibold text-gray-800">({employee.FREQUENCY}) {employee.CUTOFFNAME} </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Earnings and Deductions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-2">
                <div className="bg-blue-50 rounded-xl p-4">
                  <h3 className="text-base font-semibold text-blue-800 mb-2 flex items-center">
                    {/* <TrendingUp className="w-5 h-5 mr-2" /> */}
                    Earnings
                  </h3>
                  <div className="space-y-0 text-xs">
                    {earnings.map((item) => (
                      <div className="grid grid-cols-3 gap-2 py-1 border-b border-blue-100 last:border-b-0">
                      <span className="text-gray-700">{item.DESCRIP}</span>
                      <span className="font-mono font-semibold text-blue-700 text-right">
                        {Number(item.HOURS || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="font-mono font-semibold text-blue-700 text-right">
                        {Number(item.AMOUNT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    ))}
                  </div>
                </div>

                <div className="bg-red-50 rounded-xl p-4">
                  <h3 className="text-base font-semibold text-red-800 mb-2 flex items-center">
                    {/* <DollarSign className="w-5 h-5 mr-2" /> */}
                    Deductions
                  </h3>
                  <div className="space-y-0 text-xs">
                    {deductions.map((item) => (
                      <div key={item.TRANS_CODE} className="flex justify-between items-center py-1 border-b border-red-100 last:border-b-0">
                        <span className="text-gray-700">{item.DESCRIP}</span>
                        <span className="font-mono font-semibold text-red-700">
                          {Number(item.AMOUNT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-2 mb-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 mb-1">Total Earnings</p>
                    <p className="text-lg font-bold text-blue-600">
                      ₱ {total_earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 mb-1">Total Deductions</p>
                    <p className="text-lg font-bold text-red-600">
                      ₱ {total_deductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-center border-2 border-gray-400 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Net Pay</p>
                    <p className="text-lg font-bold text-gray-600">
                      ₱ {net_pay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* YTD Summary */}
              {employeeytd.length > 0 && (
                <div className="mb-4">
                  {/* <h3 className="text-base font-semibold text-gray-800 mb-4">Year-to-Date Summary</h3> */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">YTD Gross</th>
                            <th className="px-6 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">YTD Taxable</th>
                            <th className="px-6 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">YTD Tax</th>
                            <th className="px-6 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">YTD SSS</th>
                            <th className="px-6 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">YTD HDMF</th>
                            <th className="px-6 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">YTD PhilHealth</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {employeeytd.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-1 text-left whitespace-nowrap text-xs text-gray-600">
                                ₱ {Number(item.YTD_GROSS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-1 text-left whitespace-nowrap text-xs text-gray-600">
                                ₱ {Number(item.YTD_TAXABLE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-1 text-left whitespace-nowrap text-xs text-gray-600">
                                ₱ {Number(item.YTD_TAX).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-1 text-left whitespace-nowrap text-xs text-gray-600">
                                ₱ {Number(item.YTD_SSS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-1 text-left whitespace-nowrap text-xs text-gray-600">
                                ₱ {Number(item.YTD_HDMF).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-1 text-left whitespace-nowrap text-xs text-gray-600">
                                ₱ {Number(item.YTD_MED).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Loans and Leaves */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {/* Loans Section */}
                {employeeln.length > 0 && (
                  <div>
                    {/* <h3 className="text-base font-semibold text-gray-800 mb-2">Loan Balance</h3> */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Loan Type</th>
                              {/* <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Loan Amount</th> */}
                              <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Balance</th>
                              <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Total Paid</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {employeeln.map((item, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-1 whitespace-nowrap text-xs font-medium text-gray-900">{item.LOAN_DESC}</td>
                                {/* <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                                  ₱ {Number(item.LOAN_AMT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td> */}
                                <td className="px-4 py-1 whitespace-nowrap text-xs text-gray-500 text-right">
                                  ₱ {Number(item.LOAN_BAL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-1 whitespace-nowrap text-xs text-gray-500 text-right">
                                  ₱ {Number(item.TOTAL_PAID).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Leaves Section */}
                {employeelv.length > 0 && (
                  <div>
                    {/* <h3 className="text-base font-semibold text-gray-800 mb-2">Leave Balance</h3> */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Leave Type</th>
                              <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Used</th>
                              <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {employeelv.map((item, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-1 whitespace-nowrap text-xs font-medium text-gray-900">{item.LV_TYPE}</td>
                                <td className="px-4 py-1 whitespace-nowrap text-xs text-gray-500 text-right">
                                  {Number(item.AVAILED_HRS).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} hrs
                                </td>
                                <td className="px-4 py-1 whitespace-nowrap text-xs text-gray-500 text-right">
                                  {Number(item.ENDBAL_HRS).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} hrs
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
    </div>
  );
})}


        {/* Payslip Content */}
        {payslip?.success && (
          <div ref={payslipRef} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Company Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-2 text-center">
              <h1 className="text-2xl font-bold mb-2">NAYSA-Solutions Inc.</h1>
              {/* <h1 className="text-2xl font-bold mb-2">{employee.COMP_NAME}</h1> */}
              {/* <p className="text-blue-100 text-lg">Employee Payslip</p> */}
            </div>

            
          </div>
        )}

        {/* No Data State */}
        {!loading && !error && payslip && !payslip.success && cutoff && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No payslip found for cutoff "{cutoff}"</p>
            <p className="text-gray-500 text-sm mt-2">Please check the cutoff period and try again</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayslipViewer;