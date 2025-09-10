import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FaCalendarAlt } from 'react-icons/fa';

const CustomDatePicker = ({ selectedDate, onChange, label }) => {
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="flex-1 min-w-[150px]">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative w-full">
        <DatePicker
          selected={selectedDate}
          onChange={onChange}
          customInput={
            <div className="relative w-full">
              <input
                type="text"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={formatDate(selectedDate)}
                readOnly 
              />
              <FaCalendarAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          }
        />
      </div>
    </div>
  );
};