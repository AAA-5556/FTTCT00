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

    let allLogs = [];
    let currentPage = 1;
    const ITEMS_PER_PAGE = 25;

    // --- RENDER & FILTER ---
    function renderPage() {
        const startDate = document.getElementById('start-date-filter').value;
        const endDate = document.getElementById('end-date-filter').value;
        const user = document.getElementById('user-filter').value.toLowerCase();

        const filteredLogs = allLogs.filter(log => {
            const logDate = log.timestamp.split('،')[0].trim();
            const logUser = log.actor.toLowerCase();
            const dateCondition = (!startDate || logDate >= startDate) && (!endDate || logDate <= endDate);
            const userCondition = !user || logUser.includes(user);
            return dateCondition && userCondition;
        });

        // Paginate and render table rows...
        // ... (Full implementation of pagination and rendering logic)
    }

    // --- EVENT LISTENERS ---
    document.getElementById('reset-filters').addEventListener('click', () => {
        document.getElementById('start-date-filter').value = '';
        document.getElementById('end-date-filter').value = '';
        document.getElementById('user-filter').value = '';
        renderPage();
    });
    // ... (Listeners for filter inputs and export button)

    // --- INITIALIZATION ---
    try {
        allLogs = await apiCall('getActionLog');
        loadingMessage.style.display = 'none';
        renderPage();
    } catch (error) {
        loadingMessage.textContent = 'خطا در بارگذاری گزارش فعالیت‌ها.';
    }
});
