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
    const archiveListView = document.getElementById('archive-list-view');
    const profileView = document.getElementById('profile-view');
    const archiveTableBody = document.getElementById('archive-table-body');
    const loadingMessage = document.getElementById('loading-archive');
    const backToListBtn = document.getElementById('back-to-list-btn');
    const profileTitle = document.getElementById('profile-title');
    const profileCard = document.getElementById('profile-summary-card');
    const profileMembersBody = document.getElementById('profile-members-body');
    const profileHistoryBody = document.getElementById('profile-history-body');
    const memberProfileCardArchive = document.getElementById('member-profile-card-archive');
    let allMembers = {};

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

    // --- توابع نمایش ---
    function renderArchiveTable(archivedInstitutions) {
        archiveTableBody.innerHTML = '';
        if (archivedInstitutions.length === 0) {
            archiveTableBody.innerHTML = '<tr><td colspan="4">هیچ موسسه آرشیو شده‌ای یافت نشد.</td></tr>';
            return;
        }
        archivedInstitutions.forEach(inst => {
            const row = document.createElement('tr');
            row.dataset.institution = JSON.stringify(inst);
            row.innerHTML = `<td><a href="#" class="view-profile-link">${inst.username}</a></td><td>${inst.archiveDate || '-'}</td><td>${inst.archivedBy || '-'}</td><td><button class="restore-btn" data-id="${inst.institutionId}" data-name="${inst.username}">بازگردانی</button></td>`;
            archiveTableBody.appendChild(row);
        });
    }
    
    function showProfileView(institution) {
        archiveListView.style.display = 'none';
        profileView.style.display = 'block';
        profileTitle.textContent = `پروفایل موسسه: ${institution.username}`;
        profileCard.innerHTML = `<p>تاریخ ایجاد: <span class="highlight">${institution.creationDate || '-'}</span></p><p>ایجاد شده توسط: <span class="highlight">${institution.createdBy || '-'}</span></p><p>تاریخ آرشیو: <span class="highlight">${institution.archiveDate || '-'}</span></p><p>آرشیو شده توسط: <span class="highlight">${institution.archivedBy || '-'}</span></p>`;
        fetchProfileDetails(institution.institutionId);
    }

    async function fetchProfileDetails(institutionId) {
        profileMembersBody.innerHTML = '<tr><td colspan="3">در حال بارگذاری...</td></tr>';
        profileHistoryBody.innerHTML = '<tr><td colspan="3">در حال بارگذاری...</td></tr>';
        const [membersResult, historyResult] = await Promise.all([
            apiCall('getAllMembersForAdmin', { institutionId }),
            apiCall('getInstitutionHistory', { institutionId })
        ]);
        if(membersResult.status === 'success') {
            profileMembersBody.innerHTML = '';
            membersResult.data.forEach(m => allMembers[m.memberId] = m.fullName);
            if (membersResult.data.length === 0) {
                profileMembersBody.innerHTML = '<tr><td colspan="3">هیچ عضوی یافت نشد.</td></tr>';
            } else {
                membersResult.data.forEach(member => {
                    const row = document.createElement('tr');
                    row.innerHTML = `<td>${member.memberId}</td><td><a href="#" class="clickable-member-archive" data-member-id="${member.memberId}">${member.fullName}</a></td><td>${member.isActive ? 'فعال' : 'غیرفعال'}</td>`;
                    profileMembersBody.appendChild(row);
                });
            }
        }
        if(historyResult.status === 'success') {
            profileHistoryBody.innerHTML = '';
             if (historyResult.data.length === 0) {
                profileHistoryBody.innerHTML = '<tr><td colspan="3">هیچ سابقه‌ای یافت نشد.</td></tr>';
            } else {
                historyResult.data.forEach(record => {
                    const row = document.createElement('tr');
                    const memberName = allMembers[record.memberId] || `(شناسه: ${record.memberId})`;
                    row.innerHTML = `<td>${record.date}</td><td>${memberName}</td><td>${record.status}</td>`;
                    profileHistoryBody.appendChild(row);
                });
            }
        }
    }
    
    // --- بارگذاری اولیه ---
    async function fetchArchived() {
        const result = await apiCall('getArchivedInstitutions', {});
        if (result.status === 'success') {
            loadingMessage.style.display = 'none';
            renderArchiveTable(result.data);
        } else {
            loadingMessage.textContent = 'خطا در بارگذاری اطلاعات: ' + result.message;
        }
    }

    // --- مدیریت رویدادها ---
    archiveTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('restore-btn')) {
            const instId = target.dataset.id;
            const instName = target.dataset.name;
            if (confirm(`آیا از بازگردانی موسسه "${instName}" مطمئن هستید؟`)) {
                target.disabled = true;
                target.textContent = 'در حال بازگردانی...';
                const result = await apiCall('restoreInstitution', { institutionId: instId });
                if (result.status === 'success') {
                    alert(result.data.message);
                    fetchArchived();
                } else {
                    alert('خطا در بازگردانی: ' + result.message);
                    target.disabled = false;
                    target.textContent = 'بازگردانی';
                }
            }
        } else if (target.classList.contains('view-profile-link')) {
            e.preventDefault();
            const institutionData = JSON.parse(target.closest('tr').dataset.institution);
            showProfileView(institutionData);
        }
    });
    
    backToListBtn.addEventListener('click', () => {
        profileView.style.display = 'none';
        archiveListView.style.display = 'block';
        memberProfileCardArchive.style.display = 'none';
    });
    
    document.querySelectorAll('#profile-view .tab-button').forEach(button => { button.addEventListener('click', () => { document.querySelectorAll('#profile-view .tab-button').forEach(btn => btn.classList.remove('active')); document.querySelectorAll('#profile-view .tab-content').forEach(content => content.classList.remove('active')); button.classList.add('active'); document.getElementById(button.dataset.tab + '-tab').classList.add('active'); }); });

    profileMembersBody.addEventListener('click', async (e) => {
        e.preventDefault();
        if (e.target.classList.contains('clickable-member-archive')) {
            const memberId = e.target.dataset.memberId;
            memberProfileCardArchive.style.display = 'block';
            memberProfileCardArchive.innerHTML = `<p>در حال دریافت آمار عضو...</p>`;
            const result = await apiCall('getMemberProfile', { memberId });
            if (result.status === 'success') {
                const profile = result.data;
                memberProfileCardArchive.innerHTML = `<h4>پروفایل عضو: ${e.target.textContent}</h4><p>تاریخ ثبت نام: <span class="highlight">${profile.creationDate}</span></p><p>کد ملی: <span class="highlight">${profile.nationalId}</span></p><p>شماره موبایل: <span class="highlight">${profile.mobile}</span></p><hr><p>تعداد کل حضور: <span class="highlight present">${profile.totalPresents}</span></p><p>تعداد کل غیبت: <span class="highlight absent">${profile.totalAbsents}</span></p>`;
            } else {
                memberProfileCardArchive.innerHTML = `<p class="error-message">${result.message}</p>`;
            }
        }
    });

    // --- اجرای اولیه ---
    fetchArchived();
});
