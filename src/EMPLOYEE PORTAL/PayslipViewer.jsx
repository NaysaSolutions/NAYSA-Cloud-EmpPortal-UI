import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import html2pdf from 'html2pdf.js';

const PayslipViewer = () => {
  const { user } = useAuth();
  const [cutoff, setCutoff] = useState('');
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const payslipRef = useRef();

  useEffect(() => {
    if (!user?.empNo || !cutoff) return;

    setLoading(true);
    setError(null);

    axios
  .get('/api/reports/payslip', {
    params: { empno: user.empNo, cutoff }
  })
  .then((res) => {
    setPayslip(res.data);
    setError(null); // ✅ Clear previous error if successful
    setLoading(false);
  })
  .catch((err) => {
    setError('Failed to fetch payslip data.');
    setLoading(false);
  });

  }, [user, cutoff]);

  const {
    employee,
    earnings = [],
    deductions = [],
    total_earnings = 0,
    total_deductions = 0,
    net_pay = 0,
  } = payslip?.success ? payslip : {};



const handleExportPDF = () => {
  console.log('Exporting:', payslipRef.current);
  const element = payslipRef.current;
  if (!element) return;

  const opt = {
    margin:       0.5,
    filename:     `NAYSA-Payslip_${user.empNo}_Cutoff-${cutoff}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save();
};


  return (
    <div className="p-6 pt-[100px] max-w-4xl mx-auto mt-8">
<div className="flex justify-between items-center mb-4">
  <h2 className="text-xl font-bold">Generate Payslip</h2>

  <div className="flex space-x-2">
    <button
      onClick={() => window.print()}
      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
    >
      Print
    </button>
    <button
      onClick={handleExportPDF}
      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
    >
      Export to PDF
    </button>
  </div>
</div>


      {/* Cutoff input */}
      <input
        type="text"
        placeholder="Enter cutoff (e.g. 2025012)"
        className="border p-2 mb-4 w-full"
        value={cutoff}
        onChange={(e) => setCutoff(e.target.value)}
      />

      {!cutoff && <p className="text-sm text-gray-500">Enter a cutoff period to view your payslip.</p>}
      {loading && cutoff && <p className="text-gray-700">Loading payslip...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {payslip?.success && (
        
        <div ref={payslipRef} className="bg-white shadow-md rounded-lg p-2 text-xs">
          {/* <h1 className="text-xl font-bold mb-2 text-center">{employee.COMP_NAME}</h1> */}
          <h1 className="text-xl font-bold mb-2 text-center">NAYSA-Solutions Inc.</h1>
          <h2 className="text-lg font-semibold mb-6 text-center">Payslip</h2>



          <div className="grid grid-cols-2 gap-2 mb-4">
            <div><strong>Employee No:</strong> {employee.EMPNO}</div>
            <div><strong>Name:</strong> {employee.EMP_NAME}</div>
            <div><strong>Position:</strong> {employee.POSITION}</div>
            <div><strong>Branch:</strong> {employee.BRANCHNAME}</div>
            <div><strong>Cut-off:</strong> {employee.CUTOFFNAME}</div>
            <div><strong>Frequency:</strong> {employee.FREQUENCY}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <h3 className="font-semibold mb-2 border-b">Earnings</h3>
              <ul>
                {earnings.map((item) => (
                  <li key={item.TRANS_CODE} className="flex justify-between py-0.5">
                    <span>{item.DESCRIP}</span>
                    {/* <span className="font-mono">{item.AMOUNT.toFixed(2)}</span> */}
                    <span className="font-mono">{Number(item.AMOUNT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>

                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2 border-b">Deductions</h3>
              <ul>
                {deductions.map((item) => (
                  <li key={item.TRANS_CODE} className="flex justify-between py-0.5">
                    <span>{item.DESCRIP}</span>
                    {/* <span className="font-mono">{item.AMOUNT.toFixed(2)}</span> */}
                    <span className="font-mono">{Number(item.AMOUNT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <hr className="my-4" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-medium">
            <div className="flex justify-between">
              <span>Total Earnings:</span>
              <span className="font-mono">{total_earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Deductions:</span>
              {/* <span className="font-mono">{total_deductions.toFixed(2)}</span> */}
              <span className="font-mono">{total_deductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>

            </div>
            <div className="flex justify-between col-span-2 text-green-700 font-bold text-lg">
              <span>Net Pay:</span>
              <span className="font-mono">{net_pay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && payslip && !payslip.success && (
        <p className="text-center text-gray-600 mt-4">No payslip found for this cutoff.</p>
      )}
    </div>
  );
};

export default PayslipViewer;
