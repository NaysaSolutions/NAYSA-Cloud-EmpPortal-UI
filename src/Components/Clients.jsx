import React, {useState} from "react";
import AddClientForm from "./AddClient";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faUserCircle } from '@fortawesome/free-solid-svg-icons';

const ClientsInformation = () => {
  const [showAddClientForm, setShowAddClientForm] = useState(false);

  const clients = [
    { code: "#AHGA60", name: "Hizon Lab Inc.", date: "01/01/2025", reserve1: "$100" },
    { code: "#AHGA61", name: "Jomel Mendoza", date: "01/01/2025", reserve1: "$100"},
    { code: "#AHGA62", name: "Gerard Mendoza", date: "01/01/2025", reserve1: "$100"},
    { code: "#AHGA63", name: "Danica Galo", date: "01/01/2025", reserve1: "$100"},
    { code: "#AHGA64", name: "Arvee Aurelio", date: "01/01/2025", reserve1: "$100"},
    { code: "#AHGA65", name: "Myka Ocariza", date: "01/01/2025", reserve1: "$100"},
    { code: "#AHGA66", name: "Emy Elloran", date: "01/01/2025", reserve1: "$100"},
    { code: "#AHGA67", name: "France Rosimo", date: "01/01/2025", reserve1: "$100"},
    { code: "#AHGA68", name: "Noel Ramos", date: "01/01/2025", reserve1: "$100"},
    { code: "#AHGA69", name: "Anj Alarcon", date: "01/01/2025", reserve1: "$100"},
  ];

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = clients.slice(indexOfFirstItem, indexOfLastItem);

  const totalPages = Math.ceil(clients.length / itemsPerPage);

  const handlePrev = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (showAddClientForm) {
    return <AddClientForm />;
  }


  return (
    <div className="p-6 bg-[#f8f8f8] font-poppins">
        <div className="flex justify-end mb-6 space-x-4">
                  <FontAwesomeIcon icon={faBell} className="w-6 h-6 text-gray-500 bg-white rounded-lg shadow-md" style={{ fill: 'none' }} />
                  <FontAwesomeIcon icon={faUserCircle} className="w-6 h-6 text-gray-500 " style={{ fill: 'none' }} />
                </div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Clients Information</h2>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        onClick={() => setShowAddClientForm(true)}>
          Add New Clients
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">Client Code</label>
          <input
            type="text"
            placeholder="Enter Customer Code"
            className="p-2 bg-white border border-gray-300 rounded-lg focus:outline-none"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">Client Name</label>
          <input
            type="text"
            placeholder="Enter Customer Name"
            className="p-2 bg-white border border-gray-300 rounded-lg focus:outline-none"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">Contract Date</label>
          <input
            type="date"
            className="p-2 bg-white border border-gray-300 rounded-lg focus:outline-none"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">Reserve</label>
          <input
            type="text"
            placeholder="Reserve"
            className="p-2 bg-white border border-gray-300 rounded-lg focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md shadow-md">
        <table className="min-w-full bg-white">
          <thead>
            <tr className="bg-white text-gray-700">
              <th className="p-4 border-b"> </th>
              <th className="p-4 border-b text-left">Customer Code</th>
              <th className="p-4 border-b text-left">Customer Name</th>
              <th className="p-4 border-b text-left">Contract Date</th>
              <th className="p-4 border-b text-left">Reserve Fields</th>
              <th className="p-4 border-b text-left">Reserve Fields</th>
              <th className="p-4 border-b text-left">Reserve Fields</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="p-4 border-b">
                  <input type="checkbox" />
                </td>
                <td className="p-4 border-b text-blue-500">{client.code}</td>
                <td className="p-4 border-b">{client.name}</td>
                <td className="p-4 border-b">{client.date}</td>
                <td className="p-4 border-b">{client.reserve1}</td>
                <td className="p-4 border-b">{client.reserve2}</td>
                <td className="p-4 border-b">{client.reserve3}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination */}
        <div className="flex justify-between items-center bg-white px-4 py-3">
          <div className="text-sm text-slate-500">
            Showing <b>{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, clients.length)}</b> of {clients.length}
          </div>
          <div className="flex space-x-1">
            <button
              onClick={handlePrev}
              disabled={currentPage === 1}
              className={`px-3 py-1 min-w-9 min-h-9 text-sm font-normal ${currentPage === 1 ? "text-gray-400" : "text-slate-500"} bg-white border border-slate-200 rounded hover:bg-slate-50 hover:border-slate-400 transition duration-200 ease`}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index}
                onClick={() => setCurrentPage(index + 1)}
                className={`px-3 py-1 min-w-9 min-h-9 text-sm font-normal ${
                  currentPage === index + 1 ? "text-white bg-slate-800" : "text-slate-500 bg-white"
                } border border-slate-200 rounded hover:bg-slate-50 hover:border-slate-400 transition duration-200 ease`}
              >
                {index + 1}
              </button>
            ))}
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 min-w-9 min-h-9 text-sm font-normal ${currentPage === totalPages ? "text-gray-400" : "text-slate-500"} bg-white border border-slate-200 rounded hover:bg-slate-50 hover:border-slate-400 transition duration-200 ease`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientsInformation;
