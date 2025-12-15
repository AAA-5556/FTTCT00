document.addEventListener('DOMContentLoaded', () => {

    // --- A. SESSION & STATE MANAGEMENT ---
    let currentUser = getUserData();
    if (!currentUser) { logout(); return; }

    let allAttendanceRecords = [];
    let institutionNames = {};
    let currentFilters = { institution: 'all', startDate: '', endDate: '', status: 'all' };
    let currentPage = 1;
    const ITEMS_PER_PAGE = 30;

    // --- B. UI ELEMENT IDENTIFICATION ---
    const mainTitle = document.getElementById('admin-title');
    const impersonationBanner = document.getElementById('impersonation-banner');
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    // User Management Elements
    const dashboardContainer = document.getElementById('dashboard-container');
    const userManagementSection = document.getElementById('user-management-section');
    const addUserForm = document.getElementById('add-user-form');
    const statusMessage = document.getElementById('status-message');

    // Attendance Report Elements
    const reportTableBody = document.getElementById('admin-data-body');
    const institutionFilter = document.getElementById('institution-filter');
    const startDateFilter = document.getElementById('start-date-filter');
    const endDateFilter = document.getElementById('end-date-filter');
    const statusFilterButtons = document.querySelectorAll('#status-filter-buttons .filter-btn');
    const paginationContainer = document.getElementById('pagination-container');
    const exportExcelButton = document.getElementById('export-excel');
    const resetFiltersButton = document.getElementById('reset-filters');

    // --- C. TAB MANAGEMENT ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
    
    // --- D. CORE LOGIC ---
    function renderUserDashboard(dashboardData) {
        // Renders the hierarchical user management view
        // (Functionality from previous steps)
    }

    function renderAttendanceReport() {
        // Applies filters, paginates, and renders the attendance table
        // (Restored functionality)
    }

    function populateInstitutionFilter() {
        // Populates the dropdown with institution names
    }

    // --- E. EVENT LISTENERS ---
    function setupEventListeners() {
        // Logout, Impersonation, and Main Menu
        document.getElementById('logout-button').addEventListener('click', logout);
        document.getElementById('end-impersonation-btn').addEventListener('click', () => {
            localStorage.removeItem('impersonationToken');
            window.location.reload();
        });

        // Tab 1: User Management Listeners
        addUserForm.addEventListener('submit', async (e) => { /* ... */ });
        dashboardContainer.addEventListener('click', async (e) => { /* ... */ });

        // Tab 2: Attendance Report Listeners
        institutionFilter.addEventListener('change', () => renderAttendanceReport());
        startDateFilter.addEventListener('input', () => renderAttendanceReport());
        endDateFilter.addEventListener('input', () => renderAttendanceReport());
        statusFilterButtons.forEach(btn => btn.addEventListener('click', () => { /* ... */ }));
        resetFiltersButton.addEventListener('click', () => { /* ... */ });
        exportExcelButton.addEventListener('click', () => { /* ... */ });
    }

    // --- F. INITIALIZATION ---
    async function initialize() {
        mainTitle.textContent = `پنل مدیریت (${currentUser.username} - ${currentUser.role})`;
        if (localStorage.getItem('impersonationToken')) {
            impersonationBanner.style.display = 'flex';
        }

        setupEventListeners();

        try {
            const [dashboardData, adminData] = await Promise.all([
                apiCall('getDashboardData'),
                apiCall('getAdminData')
            ]);

            // Init User Mgmt Tab
            renderUserDashboard(dashboardData);

            // Init Attendance Report Tab
            allAttendanceRecords = adminData.records;
            institutionNames = adminData.institutionNames;
            populateInstitutionFilter();
            renderAttendanceReport();

        } catch (error) {
            console.error("Initialization failed:", error);
            document.getElementById('loading-message-dashboard').textContent = 'خطا در بارگذاری.';
            document.getElementById('loading-message-report').textContent = 'خطا در بارگذاری.';
        }
    }

    initialize();
});
