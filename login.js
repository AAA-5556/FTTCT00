document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const statusDiv = document.getElementById('login-status');

    try {
        statusDiv.textContent = 'در حال ورود...';
        statusDiv.style.color = 'black';

        // This is a direct call, not using auth.js, as we don't have a token yet.
        const response = await fetch("https://script.google.com/macros/s/AKfycbyFhhTg_2xf6TqTBdybO883H4f6562sTDUSY8dbQJyN2K-nmFVD7ViTgWllEPwOaf7V/exec", {
            method: 'POST',
            body: JSON.stringify({ action: 'login', payload: { username, password } }),
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.status === 'success') {
            const { user, token } = result.data;
            localStorage.setItem('userData', JSON.stringify(user));
            localStorage.setItem('sessionToken', token);

            // --- CORRECT REDIRECTION LOGIC ---
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
