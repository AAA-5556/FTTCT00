document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const statusDiv = document.getElementById('login-status');

    try {
        statusDiv.textContent = 'در حال ورود...';
        statusDiv.style.color = 'black';

        const response = await fetch(API_URL, { // Uses the global API_URL from config.js
            method: 'POST',
            body: JSON.stringify({ action: 'login', payload: { username, password } }),
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.status === 'success') {
            const { user, token } = result.data;
            localStorage.setItem('userData', JSON.stringify(user));
            localStorage.setItem('sessionToken', token);

            switch (user.role) {
                case 'root_admin':
                case 'super_admin':
                    window.location.href = 'manager.html';
                    break;
                case 'admin':
                    window.location.href = 'admin.html';
                    break;
                case 'institute':
                    window.location.href = 'attendance.html';
                    break;
                default:
                    throw new Error('نقش کاربر نامعتبر است.');
            }
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        statusDiv.textContent = `خطا: ${error.message}`;
        statusDiv.style.color = 'red';
    }
});
