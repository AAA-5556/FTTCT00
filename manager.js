document.addEventListener('DOMContentLoaded', async () => {
    const currentUser = getUserData();
    if (!currentUser || (currentUser.role !== 'root_admin' && currentUser.role !== 'super_admin')) {
        logout();
        return;
    }

    const mainTitle = document.getElementById('manager-title');
    const dashboardContainer = document.getElementById('dashboard-container');
    const addUserForm = document.getElementById('add-user-form');
    const statusMessage = document.getElementById('status-message');
    const roleToAddSpan = document.getElementById('role-to-add');
    const newUserRoleInput = document.getElementById('new-user-role');

    mainTitle.textContent = `پنل مدیریت ارشد (${currentUser.username} - ${currentUser.role})`;

    const roleMap = {
        'root_admin': { toAdd: 'Super Admin', value: 'super_admin' },
        'super_admin': { toAdd: 'Admin', value: 'admin' }
    };
    const roleInfo = roleMap[currentUser.role];
    if (roleInfo) {
        roleToAddSpan.textContent = roleInfo.toAdd;
        newUserRoleInput.value = roleInfo.value;
    }

    document.getElementById('logout-button').addEventListener('click', logout);
    // Add menu toggle logic
    const mainMenuButton = document.getElementById('main-menu-button');
    const mainMenuDropdown = document.getElementById('main-menu-dropdown');
    mainMenuButton.addEventListener('click', () => {
        mainMenuDropdown.style.display = mainMenuDropdown.style.display === 'block' ? 'none' : 'block';
    });


    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ... (Logic for adding a new user)
    });

    dashboardContainer.addEventListener('click', async (e) => {
        // ... (Logic for impersonation and archiving)
    });

    try {
        const dashboardData = await apiCall('getDashboardData');
        // ... (Render dashboard logic)
    } catch (error) {
        dashboardContainer.innerHTML = `<p class="error-message">خطا: ${error.message}</p>`;
    }
});
