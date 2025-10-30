// src/apiConfig.js

// const API_BASE_URL = "https://api.nemarph.com:81/api";
// const MODEL_BASE_URL = "https://api.nemarph.com:81/models";
// const IMAGE_BASE_URL  = "https://api.nemarph.com:81/images/timekeeping_images";

// const API_BASE_URL   = "/api";                // Laravel API endpoints
// const MODEL_BASE_URL = "/models";             // If you have a route/controller serving models
// const IMAGE_BASE_URL = "/images/timekeeping_images";

// // LOCALHOST
// const API_BASE_URL = "http://127.0.0.1:8000/api";
// const MODEL_BASE_URL = "http://127.0.0.1:8000/models";
// const IMAGE_BASE_URL  = "http://127.0.0.1:8000/images/timekeeping_images";

// CLIENT SERVER
// const API_BASE_URL = "http://win-q1lql18rg7f:8443/api";
// const MODEL_BASE_URL = "http://win-q1lql18rg7f:8443/models";
// const IMAGE_BASE_URL  = "http://win-q1lql18rg7f:8443/images/timekeeping_images";

// CLOUD SERVER
const API_BASE_URL = "/api";
const MODEL_BASE_URL = "/models";
const IMAGE_BASE_URL  = "/images/timekeeping_images";

// This URL should be updated based on the environment (development, production, etc.)   

const API_ENDPOINTS = {
    //AUTHENTICATION
    login: `${API_BASE_URL}/dashBoard`,
    regEmp: `${API_BASE_URL}/regEmp`,
    loginEmp: `${API_BASE_URL}/loginEmp`,
    dashBoard: `${API_BASE_URL}/dashBoard`,

    //Overtime
    fetchOvertimeApplications: `${API_BASE_URL}/getOTAppHistory`,
    saveOvertimeApplication: `${API_BASE_URL}/OTupsert`,
    cancelOvertimeApplication: `${API_BASE_URL}/cancelOT`,
    OvertimeHistoryApplication: `${API_BASE_URL}/getOTApprInq`,
    approvedOvertimeHistory: `${API_BASE_URL}/getOTApprHistory`,
    overtimeApproval: `${API_BASE_URL}/approvalOT`,
    
    //Leave
     fetchLeaveApplications: `${API_BASE_URL}/getLVAppHistory`,
     leaveTypes: `${API_BASE_URL}/leaveTypes`,
     cancelLeaveApplication: `${API_BASE_URL}/cancelLV`,
     fetchLeaveBalance: `${API_BASE_URL}/getLVBalance`,
     saveLeaveApplication: `${API_BASE_URL}/upsertLV`,
     LeaveHistoryApplication: `${API_BASE_URL}/getLVApprInq`,
     approvedLeaveHistory: `${API_BASE_URL}/getLVApprHistory`,
     leaveApproval: `${API_BASE_URL}/approvalLV`,

     //Official Business
     fetchOfficialBusinessApplicationsHistory: `${API_BASE_URL}/getOBAppHistory`,
     fetchOfficialBusinessApplications: `${API_BASE_URL}/getOBAppInq`,
     saveOfficialBusinessApplication: `${API_BASE_URL}/upsertOB`,
     cancelOfficialBusinessApplication: `${API_BASE_URL}/cancelOB`,
     OfficialBusinessHistoryApplication: `${API_BASE_URL}/getOBApprInq`,
     approvedOfficialBusinessHistory: `${API_BASE_URL}/getOBApprHistory`,
     officialBusinessApproval: `${API_BASE_URL}/approvalOB`,

     
    //DTR
    upsertTimeIn:            `${API_BASE_URL}/upsertTimeIn`,
    saveImage:               `${API_BASE_URL}/saveImage`,
    getNewImageId:           `${API_BASE_URL}/getNewImageId`,
    getDTRRecords:           `${API_BASE_URL}/dtrRecords`,
    getEmpBranchLoc:         `${API_BASE_URL}/empBranchLocation`,

    getDTRAppInq:            `${API_BASE_URL}/getDTRAppInq`,
    getDTRAppHistory:        `${API_BASE_URL}/getDTRAppHistory`,
    getDTRApprInq:           `${API_BASE_URL}/getDTRApprInq`,
    getDTRApprHistory:       `${API_BASE_URL}/getDTRApprHistory`,
    upsertDTR:               `${API_BASE_URL}/upsertDTR`,
    approvalDTR:             `${API_BASE_URL}/approvalDTR`,
    cancelDTR:               `${API_BASE_URL}/cancelDTR`,

    // Payslip
    payslipMain:             `${API_BASE_URL}/reports/payslip`,
    payslipLV:               `${API_BASE_URL}/reports/payslipLV`,
    payslipLN:               `${API_BASE_URL}/reports/payslipLN`,
    payslipYTD:              `${API_BASE_URL}/reports/payslipYTD`,

};

export { IMAGE_BASE_URL };
export { MODEL_BASE_URL };
export default API_ENDPOINTS;
