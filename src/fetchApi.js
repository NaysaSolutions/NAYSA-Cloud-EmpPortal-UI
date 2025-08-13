import API_ENDPOINTS from "@/apiConfig.jsx";

const fetchApi = async (endpoint, method = 'POST', data = null) => {
    const config = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (data) {
        config.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(endpoint, config);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Network response was not ok');
        }

        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error; // Re-throw the error so the calling function can handle it
    }
};

export default fetchApi;