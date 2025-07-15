// api.js or similar
const API_BASE_URL = 'https://api.nemarph.com:81/api';

export const getNewImageId = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/timekeeping/get-new-image-id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include'
    });
    return await response.json();
  } catch (error) {
    console.error('Error getting new image ID:', error);
    throw error;
  }
};

export const saveImage = async (imageId, imageData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/timekeeping/save-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ imageId, imageData }),
      credentials: 'include'
    });
    return await response.json();
  } catch (error) {
    console.error('Error saving image:', error);
    throw error;
  }
};

export const upsertTimeRecord = async (data) => {
  try {
    const response = await fetch(`${API_BASE_URL}/timekeeping/upsert-record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    return await response.json();
  } catch (error) {
    console.error('Error upserting time record:', error);
    throw error;
  }
};