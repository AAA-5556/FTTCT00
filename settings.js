document.addEventListener('DOMContentLoaded', async () => {
    // ❗ مهم: لینک API خود را اینجا قرار دهید
    const API_URL = "https://script.google.com/macros/s/AKfycbyFhhTg_2xf6TqTBdybO883H4f6562sTDUSY8dbQJyN2K-nmFVD7ViTgWllEPwOaf7V/exec";

    // --- ۱. کد نگهبان و بررسی هویت ---
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || !userData.token || userData.role !== 'admin') {
        localStorage.removeItem('userData');
        window.location.href = 'index.html';
        return;
    }

    // --- شناسایی عناصر ---
    const allowMemberManagementCheck = document.getElementById('allowMemberManagement');
    const allowUsernameChangeCheck = document.getElementById('allowUsernameChange');
    const allowPasswordChangeCheck = document.getElementById('allowPasswordChange');
    const saveButton = document.getElementById('save-settings-btn');
    const statusMessage = document.getElementById('settings-status');

    // --- تابع کمکی برای تماس با API (با ارسال توکن) ---
    async function apiCall(action, payload) {
        try {
            const token = JSON.parse(localStorage.getItem('userData')).token;
            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ action, payload, token })
            });
            const result = await response.json();
            if (result.status === 'error' && (result.message.includes('منقضی') || result.message.includes('نامعتبر'))) {
                alert(result.message);
                localStorage.removeItem('userData');
                window.location.href = 'index.html';
            }
            return result;
        } catch (error) {
            console.error('API Call Error:', error);
            return { status: 'error', message: 'خطا در ارتباط با سرور.' };
        }
    }

    // --- بارگذاری تنظیمات اولیه ---
    async function loadSettings() {
        statusMessage.textContent = 'در حال بارگذاری تنظیمات...';
        const result = await apiCall('getSettings', {});
        if (result.status === 'success') {
            statusMessage.textContent = '';
            allowMemberManagementCheck.checked = result.data.allowMemberManagement;
            allowUsernameChangeCheck.checked = result.data.allowUsernameChange;
            allowPasswordChangeCheck.checked = result.data.allowPasswordChange;
        } else {
            statusMessage.textContent = 'خطا در بارگذاری تنظیمات.';
        }
    }

    // --- مدیریت رویداد کلیک برای ذخیره ---
    saveButton.addEventListener('click', async () => {
        saveButton.disabled = true;
        saveButton.textContent = 'در حال ذخیره...';
        statusMessage.textContent = '';

        const newSettings = {
            allowMemberManagement: allowMemberManagementCheck.checked,
            allowUsernameChange: allowUsernameChangeCheck.checked,
            allowPasswordChange: allowPasswordChangeCheck.checked
        };

        const result = await apiCall('updateSettings', newSettings);
        if (result.status === 'success') {
            statusMessage.style.color = 'green';
            statusMessage.textContent = result.data.message;
        } else {
            statusMessage.style.color = 'red';
            statusMessage.textContent = 'خطا در ذخیره تنظیمات.';
        }

        saveButton.disabled = false;
        saveButton.textContent = 'ذخیره تنظیمات';
    });

    // --- اجرای اولیه ---
    loadSettings();
});
