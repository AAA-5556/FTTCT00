document.addEventListener('DOMContentLoaded', async () => {
    const userData = getUserData();
    if (!userData || userData.role === 'institute') {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('admin-username').textContent = userData.username;
    document.getElementById('logout-button').addEventListener('click', logout);
    document.getElementById('back-to-dashboard').addEventListener('click', () => { window.location.href = 'admin.html'; });

    const logBody = document.getElementById('log-body');
    const loadingMessage = document.getElementById('loading-message');
    const paginationContainer = document.getElementById('pagination-container');
    const startDateFilter = document.getElementById('start-date-filter');
    const endDateFilter = document.getElementById('end-date-filter');
    const userFilter = document.getElementById('user-filter');

    let allLogs = [];
    let currentPage = 1;
    const ITEMS_PER_PAGE = 25;

    function applyFilters() {
        const startDate = startDateFilter.value;
        const endDate = endDateFilter.value;
        const user = userFilter.value.toLowerCase();
        return allLogs.filter(log => {
            const logDate = log.timestamp.split('،')[0].trim();
            const logUser = log.actor.toLowerCase();
            return (!startDate || logDate >= startDate) &&
                   (!endDate || logDate <= endDate) &&
                   (!user || logUser.includes(user));
        });
    }

    function renderPage() {
        const filteredLogs = applyFilters();
        const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
        currentPage = Math.min(currentPage, totalPages || 1);
        const pageLogs = filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

        logBody.innerHTML = '';
        if (pageLogs.length === 0) {
            logBody.innerHTML = '<tr><td colspan="5">هیچ رکوردی یافت نشد.</td></tr>';
        } else {
            pageLogs.forEach(log => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${log.timestamp}</td>
                    <td>${log.actor}</td>
                    <td>${log.role}</td>
                    <td>${log.type}</td>
                    <td>${log.desc}</td>
                `;
                logBody.appendChild(row);
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
            button.addEventListener('click', () => { currentPage = i; renderPage(); });
            paginationContainer.appendChild(button);
        }
    }

    document.getElementById('reset-filters').addEventListener('click', () => {
        startDateFilter.value = '';
        endDateFilter.value = '';
        userFilter.value = '';
        currentPage = 1;
        renderPage();
    });

    document.getElementById('export-excel').addEventListener('click', () => {
        const dataToExport = applyFilters().map(log => ({
            'زمان': log.timestamp,
            'کاربر': log.actor,
            'نقش': log.role,
            'نوع': log.type,
            'توضیحات': log.desc
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "گزارش فعالیت");
        XLSX.writeFile(workbook, "ActionLog.xlsx");
    });

    [startDateFilter, endDateFilter, userFilter].forEach(el => {
        el.addEventListener('input', () => { currentPage = 1; renderPage(); });
    });

    try {
        allLogs = await apiCall('getActionLog');
        loadingMessage.style.display = 'none';
        renderPage();
    } catch (error) {
        loadingMessage.textContent = `خطا در بارگذاری: ${error.message}`;
    }
});
