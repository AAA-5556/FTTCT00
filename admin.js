document.addEventListener('DOMContentLoaded', () => {
    // --- A. SESSION & STATE MANAGEMENT ---
    let currentUser = getUserData();
    if (!currentUser) { logout(); return; }

    let allAttendanceRecords = [];
    let allMemberNames = {};
    let institutionNames = {};
    let currentFilters = { institution: 'all', startDate: '', endDate: '', status: 'all' };
    let currentPage = 1;
    const ITEMS_PER_PAGE = 30;

    // --- B. UI ELEMENT IDENTIFICATION ---
    const mainTitle = document.getElementById('admin-title');
    const impersonationBanner = document.getElementById('impersonation-banner');
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const dashboardContainer = document.getElementById('dashboard-container');
    const addUserForm = document.getElementById('add-user-form');
    const statusMessage = document.getElementById('status-message');
    const reportTableBody = document.getElementById('admin-data-body');
    const institutionFilter = document.getElementById('institution-filter');
    const startDateFilter = document.getElementById('start-date-filter');
    const endDateFilter = document.getElementById('end-date-filter');
    const statusFilterButtons = document.querySelectorAll('#status-filter-buttons .filter-btn');
    const paginationContainer = document.getElementById('pagination-container');
    const exportExcelButton = document.getElementById('export-excel');
    const resetFiltersButton = document.getElementById('reset-filters');
    const roleToAddSpan = document.getElementById('role-to-add');
    const newUserRoleInput = document.getElementById('new-user-role');

    // --- C. TAB MANAGEMENT ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // --- D. RENDER FUNCTIONS ---
    function renderUserDashboard(dashboardData) {
        dashboardContainer.innerHTML = '';
        if (!dashboardData || dashboardData.length === 0) {
            dashboardContainer.innerHTML = '<p>موردی برای نمایش وجود ندارد.</p>';
            return;
        }
        dashboardData.forEach(item => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            let cardContent = `<h3>${item.name}</h3>`;
            if (currentUser.role === 'admin') {
                cardContent += `<p>تعداد اعضا: <span class="highlight">${item.memberCount || 0}</span></p>`;
            } else {
                cardContent += `<p>کاربران زیرمجموعه: <span class="highlight">${item.managedUsers || 0}</span></p>`;
            }
            cardContent += `<div class="card-actions">
                <button class="action-btn" data-action="archive" data-id="${item.id}" data-name="${item.name}">آرشیو</button>
                ${currentUser.role !== 'admin' ? `<button class="action-btn view-as" data-action="view-as" data-id="${item.id}" data-name="${item.name}">مشاهده پنل</button>` : ''}
            </div>`;
            card.innerHTML = cardContent;
            dashboardContainer.appendChild(card);
        });
    }

    function renderAttendanceReport() {
        const filtered = allAttendanceRecords.filter(r => {
            const date = r.date.split('،')[0];
            return (currentFilters.institution === 'all' || r.institutionId == currentFilters.institution) &&
                   (!currentFilters.startDate || date >= currentFilters.startDate) &&
                   (!currentFilters.endDate || date <= currentFilters.endDate) &&
                   (currentFilters.status === 'all' || r.status === currentFilters.status);
        });

        const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
        currentPage = Math.min(currentPage, totalPages || 1);
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const pageRecords = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

        reportTableBody.innerHTML = '';
        if (pageRecords.length === 0) {
            reportTableBody.innerHTML = '<tr><td colspan="4">رکوردی یافت نشد.</td></tr>';
        } else {
            pageRecords.forEach(record => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${institutionNames[record.institutionId] || record.institutionId}</td>
                    <td>${allMemberNames[record.memberId] || '(نامشخص)'}</td>
                    <td>${record.date}</td>
                    <td>${record.status}</td>
                `;
                reportTableBody.appendChild(row);
            });
        }
        renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
        paginationContainer.innerHTML = '';
        if (totalPages <= 1) return;
        for (let i = 1; i <= totalPages; i++) {
            const button = document.createElement('button');
            button.textContent = i;
            if (i === currentPage) button.classList.add('active');
            button.addEventListener('click', () => {
                currentPage = i;
                renderAttendanceReport();
            });
            paginationContainer.appendChild(button);
        }
    }

    // --- E. EVENT LISTENERS ---
    function setupEventListeners() {
        document.getElementById('logout-button').addEventListener('click', logout);
        document.getElementById('end-impersonation-btn').addEventListener('click', () => {
            localStorage.removeItem('impersonationToken');
            localStorage.removeItem('originalUserToken'); // Clean up all impersonation keys
            // The main sessionToken is what we need. Reloading will re-read userData from it.
            // But since we don't store original userData, a full logout is safest.
            logout();
        });

        addUserForm.addEventListener('submit', async e => {
            e.preventDefault();
            const username = document.getElementById('new-username').value.trim();
            const password = document.getElementById('new-password').value.trim();
            const role = newUserRoleInput.value;
            if (!username || !password) return;
            try {
                const result = await apiCall('addUser', { username, password, role });
                statusMessage.textContent = result.message;
                statusMessage.className = 'status-message success';
                addUserForm.reset();
                initialize(); // Refresh
            } catch (error) {
                statusMessage.textContent = error.message;
                statusMessage.className = 'status-message error';
            }
        });

        dashboardContainer.addEventListener('click', async e => {
            const button = e.target.closest('.action-btn.view-as');
            if(button) {
                const targetUserId = button.dataset.id;
                if (confirm(`آیا می‌خواهید وارد پنل کاربری شوید؟`)) {
                    try {
                        const result = await apiCall('impersonateUser', { targetUserId });
                        localStorage.setItem('originalUserToken', getToken());
                        localStorage.setItem('impersonationToken', result.token);
                        localStorage.setItem('userData', JSON.stringify(result.user));
                        window.location.reload();
                    } catch (error) {
                        alert(error.message);
                    }
                }
            }
        });

        institutionFilter.addEventListener('change', e => { currentFilters.institution = e.target.value; currentPage = 1; renderAttendanceReport(); });
        startDateFilter.addEventListener('input', e => { currentFilters.startDate = e.target.value; currentPage = 1; renderAttendanceReport(); });
        endDateFilter.addEventListener('input', e => { currentFilters.endDate = e.target.value; currentPage = 1; renderAttendanceReport(); });

        statusFilterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                statusFilterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilters.status = btn.dataset.status;
                currentPage = 1;
                renderAttendanceReport();
            });
        });

        resetFiltersButton.addEventListener('click', () => {
            currentFilters = { institution: 'all', startDate: '', endDate: '', status: 'all' };
            institutionFilter.value = 'all';
            startDateFilter.value = '';
            endDateFilter.value = '';
            statusFilterButtons.forEach(b => b.classList.remove('active'));
            document.querySelector('#status-filter-buttons .filter-btn[data-status="all"]').classList.add('active');
            renderAttendanceReport();
        });

        exportExcelButton.addEventListener('click', () => {
            // Re-run filter logic for export
            const dataToExport = allAttendanceRecords
                .filter(r => {
                    const date = r.date.split('،')[0];
                    return (currentFilters.institution === 'all' || r.institutionId == currentFilters.institution) &&
                           (!currentFilters.startDate || date >= currentFilters.startDate) &&
                           (!currentFilters.endDate || date <= currentFilters.endDate) &&
                           (currentFilters.status === 'all' || r.status === currentFilters.status);
                })
                .map(rec => ({
                    'موسسه': institutionNames[rec.institutionId],
                    'عضو': allMemberNames[rec.memberId],
                    'تاریخ': rec.date,
                    'وضعیت': rec.status
                }));
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "گزارش");
            XLSX.writeFile(workbook, "AttendanceReport.xlsx");
        });
    }

    // --- F. INITIALIZATION ---
    async function initialize() {
        const roleMap = {
            'root_admin': { toAdd: 'Super Admin', value: 'super_admin' },
            'super_admin': { toAdd: 'Admin', value: 'admin' },
            'admin': { toAdd: 'Institution', value: 'institute' }
        };
        const roleInfo = roleMap[currentUser.role];
        if (roleInfo) {
            roleToAddSpan.textContent = roleInfo.toAdd;
            newUserRoleInput.value = roleInfo.value;
        }

        mainTitle.textContent = `پنل مدیریت (${currentUser.username} - ${currentUser.role})`;
        if (localStorage.getItem('impersonationToken')) impersonationBanner.style.display = 'flex';

        setupEventListeners();

        try {
            document.getElementById('loading-message-dashboard').style.display = 'block';
            document.getElementById('loading-message-report').style.display = 'block';

            const [dashboardData, adminData] = await Promise.all([
                apiCall('getDashboardData'),
                apiCall('getAdminData')
            ]);

            renderUserDashboard(dashboardData);

            allAttendanceRecords = adminData.records;
            institutionNames = adminData.institutionNames;
            allMemberNames = adminData.memberNames;

            institutionFilter.innerHTML = '<option value="all">همه موسسات</option>';
            for (const id in institutionNames) {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = institutionNames[id];
                institutionFilter.appendChild(option);
            }
            renderAttendanceReport();

            document.getElementById('loading-message-dashboard').style.display = 'none';

        } catch (error) {
            document.getElementById('loading-message-dashboard').textContent = `خطا: ${error.message}`;
            document.getElementById('loading-message-report').textContent = `خطا: ${error.message}`;
        }
    }

    initialize();
});
