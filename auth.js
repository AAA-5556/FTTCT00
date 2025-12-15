function getToken() {
    return localStorage.getItem('sessionToken');
}

function getUserData() {
    return JSON.parse(localStorage.getItem('userData'));
}

function logout() {
    localStorage.removeItem('userData');
    localStorage.removeItem('sessionToken');
    window.location.href = 'index.html';
}

async function apiCall(action, payload = {}) {
    const token = getToken();
    if (!token) {
        logout();
        throw new Error("No session token found.");
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action, payload, token }),
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.status === 'error') {
            if (result.message.includes('منقضی') || result.message.includes('نامعتبر')) {
                alert(result.message);
                logout();
            }
            throw new Error(result.message);
        }
        return result.data;
    } catch (error) {
        console.error(`API Call Error (${action}):`, error);
        alert(`خطا در ارتباط با سرور: ${error.message}`);
        throw error;
    }
}
