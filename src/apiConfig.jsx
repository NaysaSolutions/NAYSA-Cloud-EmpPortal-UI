// src/apiConfig.js
const API_BASE_URL = "https://api.nemarph.com:81/api"; // Base URL for the API
// This URL should be updated based on the environment (development, production, etc.)   

const API_ENDPOINTS = {
    //AUTHENTICATION
    login: `${API_BASE_URL}/dashBoard`,
    dashBoard: `${API_BASE_URL}/dashBoard`,

    //Overtime
    fetchOvertimeApplications: `${API_BASE_URL}/getOTAppHistory`,
    saveOvertimeApplication: `${API_BASE_URL}/OTupsert`,
    OvertimeHistoryApplication: `${API_BASE_URL}/getOTApprInq`,
    approvedOvertimeHistory: `${API_BASE_URL}/getOTApprHistory`,
    overtimeApproval: `${API_BASE_URL}/approvalOT`,
    
    //Leave
     fetchLeaveApplications: `${API_BASE_URL}/getLVAppHistory`,
     saveLeaveApplication: `${API_BASE_URL}/upsertLV`,
     LeaveHistoryApplication: `${API_BASE_URL}/getLVApprInq`,
     approvedLeaveHistory: `${API_BASE_URL}/getLVApprHistory`,
     leaveApproval: `${API_BASE_URL}/approvalLV`,
    

};

export default API_ENDPOINTS;
