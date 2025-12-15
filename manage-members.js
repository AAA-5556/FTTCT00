document.addEventListener('DOMContentLoaded', async () => {
    // ❗ مهم: لینک API خود را اینجا قرار دهید
    const API_URL = "https://script.google.com/macros/s/AKfycbyFhhTg_2xf6TqTBdybO883H4f6562sTDUSY8dbQJyN2K-nmFVD7ViTgWllEPwOaf7V/exec";

    // --- ۱. کد نگهبان و بررسی هویت (نسخه اصلاح شده) ---
    const userData = JSON.parse(localStorage.getItem('userData'));
    const urlParams = new URLSearchParams(window.location.search);
    const institutionId = urlParams.get('id');

    // اگر کاربر اصلاً لاگین نکرده، او را خارج کن
    if (!userData || !userData.token) {
        localStorage.removeItem('userData');
        window.location.href = 'index.html';
        return;
    }

    // بررسی دسترسی: کاربر باید یا مدیر باشد، یا موسسه‌ای باشد که صفحه خودش را مشاهده می‌کند
    const isAllowed = (userData.role === 'admin') || (userData.role === 'institute' && userData.institutionId == institutionId);

    if (!isAllowed) {
        alert("شما اجازه دسترسی به این صفحه را ندارید.");
        // کاربر را به پنل خودش برمی‌گردانیم
        if(userData.role === 'admin') window.location.href = 'admin.html';
        else window.location.href = 'attendance.html';
        return;
    }

    // --- شناسایی عناصر ---
    const pageTitle = document.getElementById('manage-page-title');
    const addForm = document.getElementById('add-members-form');
    // ... بقیه عناصر مثل قبل ...
    const namesTextarea = document.getElementById('names-textarea');
    const idsTextarea = document.getElementById('ids-textarea');
    const mobilesTextarea = document.getElementById('mobiles-textarea');
    const addStatusMessage = document.getElementById('add-status-message');
    const activeMembersBody = document.querySelector('#active-members-table tbody');
    const inactiveMembersBody = document.querySelector('#inactive-members-table tbody');
    const editModal = document.getElementById('edit-member-modal');
    const editForm = document.getElementById('edit-member-form');
    const cancelEditBtn = document.getElementById('cancel-member-edit');

    // --- دریافت نام موسسه از آدرس URL ---
    const institutionName = urlParams.get('name');
    if (!institutionId || !institutionName) { pageTitle.textContent = "خطا: موسسه مشخص نشده است."; return; }
    pageTitle.textContent = `مدیریت اعضای موسسه: ${institutionName}`;

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

    // --- توابع ---
    async function fetchAllMembers() {
        activeMembersBody.innerHTML = '<tr><td colspan="5">در حال بارگذاری...</td></tr>';
        inactiveMembersBody.innerHTML = '<tr><td colspan="5">در حال بارگذاری...</td></tr>';
        const result = await apiCall('getAllMembersForAdmin', { institutionId });
        if (result.status === 'success') {
            renderTables(result.data);
        } else {
            alert('خطا در دریافت لیست اعضا: ' + result.message);
        }
    }

    function renderTables(members) {
        activeMembersBody.innerHTML = '';
        inactiveMembersBody.innerHTML = '';
        if (members.length === 0) {
            activeMembersBody.innerHTML = '<tr><td colspan="5">هیچ عضو فعالی یافت نشد.</td></tr>';
            inactiveMembersBody.innerHTML = '<tr><td colspan="5">هیچ عضو غیرفعالی یافت نشد.</td></tr>';
        } else {
            members.forEach(member => {
                const row = document.createElement('tr');
                row.dataset.member = JSON.stringify(member);
                if (member.isActive) {
                    row.innerHTML = `<td>${member.memberId}</td><td>${member.fullName}</td><td>${member.nationalId}</td><td>${member.mobile}</td><td><button class="edit-btn" data-id="${member.memberId}">ویرایش</button><button class="delete-btn" data-id="${member.memberId}">حذف</button></td>`;
                    activeMembersBody.appendChild(row);
                } else {
                    row.innerHTML = `<td>${member.memberId}</td><td>${member.fullName}</td><td>${member.nationalId}</td><td>${member.mobile}</td><td><button class="restore-btn" data-id="${member.memberId}">بازگردانی</button></td>`;
                    inactiveMembersBody.appendChild(row);
                }
            });
        }
    }
    
    // --- مدیریت رویدادها ---
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = { institutionId, namesString: namesTextarea.value.trim(), idsString: idsTextarea.value.trim(), mobilesString: mobilesTextarea.value.trim() };
        if (!payload.namesString) return;
        addStatusMessage.textContent = 'در حال افزودن...';
        const result = await apiCall('addMembersBatch', payload);
        if (result.status === 'success') { addStatusMessage.style.color = 'green'; addForm.reset(); } 
        else { addStatusMessage.style.color = 'red'; }
        addStatusMessage.textContent = result.data ? result.data.message : result.message;
        fetchAllMembers();
    });

    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        const memberId = target.dataset.id;
        if (!memberId) return;
        let action = '';
        if (target.classList.contains('delete-btn')) {
            action = 'deleteMember';
            if (!confirm(`آیا از حذف (غیرفعال کردن) این عضو مطمئن هستید؟`)) return;
        } else if (target.classList.contains('restore-btn')) {
            action = 'restoreMember';
        } else if (target.classList.contains('edit-btn')) {
            const memberData = JSON.parse(target.closest('tr').dataset.member);
            document.getElementById('edit-member-id').value = memberData.memberId;
            document.getElementById('edit-fullname').value = memberData.fullName;
            document.getElementById('edit-nationalid').value = memberData.nationalId;
            document.getElementById('edit-mobile').value = memberData.mobile;
            editModal.style.display = 'flex';
            return;
        }
        if (action) {
            target.disabled = true;
            await apiCall(action, { institutionId, memberId });
            fetchAllMembers();
        }
    });

    cancelEditBtn.addEventListener('click', () => {
        editModal.style.display = 'none';
    });

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            institutionId,
            memberId: document.getElementById('edit-member-id').value,
            fullName: document.getElementById('edit-fullname').value,
            nationalId: document.getElementById('edit-nationalid').value,
            mobile: document.getElementById('edit-mobile').value
        };
        await apiCall('updateMemberDetails', payload);
        editModal.style.display = 'none';
        fetchAllMembers();
    });

    // --- اجرای اولیه ---
    fetchAllMembers();
});
