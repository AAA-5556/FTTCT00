document.addEventListener('DOMContentLoaded', () => {
    // ❗ مهم: لینک API خود را اینجا قرار دهید
    const API_URL = "https://script.google.com/macros/s/AKfycbyFhhTg_2xf6TqTBdybO883H4f6562sTDUSY8dbQJyN2K-nmFVD7ViTgWllEPwOaf7V/exec";

    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');
    
    // --- تابع کمکی برای تماس با API ---
    async function apiCall(action, payload, token) {
        try {
            const requestBody = { action, payload, token };
            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });
            return await response.json();
        } catch (error) {
            return { status: 'error', message: 'خطا در ارتباط با سرور.' };
        }
    }

    // --- تابع جدید: بررسی خودکار توکن در زمان بارگذاری صفحه ---
    async function autoValidateToken() {
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (userData && userData.token) {
            loginButton.disabled = true;
            loginButton.textContent = 'در حال بررسی نشست قبلی...';
            
            const result = await apiCall('validateAndLogin', null, userData.token);

            if (result.status === 'success' && result.data) {
                // اگر توکن معتبر بود
                usernameInput.disabled = true;
                passwordInput.disabled = true;
                loginButton.textContent = `ادامه به عنوان ${result.data.username}`;
                loginButton.disabled = false;
                
                // تغییر عملکرد دکمه ورود به هدایت مستقیم
                loginForm.onsubmit = (e) => {
                    e.preventDefault();
                    if (result.data.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else if (result.data.role === 'institute') {
                        window.location.href = 'attendance.html';
                    }
                };
            } else {
                // اگر توکن معتبر نبود
                localStorage.removeItem('userData');
                loginButton.disabled = false;
                loginButton.textContent = 'ورود';
            }
        }
    }

    // --- مدیریت فرم ورود عادی ---
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); 
        const username = usernameInput.value;
        const password = passwordInput.value;
        if (!username || !password) return; // اگر فرم خالی بود و روی دکمه ورود کلیک شد، کاری نکن

        loginButton.disabled = true;
        loginButton.textContent = 'در حال بررسی...';
        errorMessage.textContent = '';
        
        const result = await apiCall('login', { username, password });

        if (result.status === 'success' && result.data.token) {
            localStorage.setItem('userData', JSON.stringify(result.data));
            if (result.data.role === 'admin') {
                window.location.href = 'admin.html';
            } else if (result.data.role === 'institute') {
                window.location.href = 'attendance.html';
            }
        } else {
            errorMessage.textContent = result.message || "خطایی رخ داد.";
            loginButton.disabled = false;
            loginButton.textContent = 'ورود';
        }
    });
    
    // --- اجرای اولیه ---
    autoValidateToken();
});
