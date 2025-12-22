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
    const addUserCard = document.getElementById('add-user-section');

    mainTitle.textContent = `پنل مدیریت ارشد (${currentUser.username} - ${currentUser.role})`;

    const roleMap = {
        'root_admin': { toAdd: 'Super Admin', value: 'super_admin' },
        'super_admin': { toAdd: 'Admin', value: 'admin' }
    };

    const roleInfo = roleMap[currentUser.role];
    if (roleInfo) {
        roleToAddSpan.textContent = roleInfo.toAdd;
        newUserRoleInput.value = roleInfo.value;
    } else {
        addUserCard.style.display = 'none';
    }

    document.getElementById('logout-button').addEventListener('click', logout);

    const mainMenuButton = document.getElementById('main-menu-button');
    const mainMenuDropdown = document.getElementById('main-menu-dropdown');
    mainMenuButton.addEventListener('click', () => {
        mainMenuDropdown.style.display = mainMenuDropdown.style.display === 'block' ? 'none' : 'block';
    });

    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;
        const role = newUserRoleInput.value;

        try {
            statusMessage.style.display = 'none';
            const response = await apiCall('addUser', { username, password, role });
            statusMessage.textContent = response.message;
            statusMessage.className = 'status-message success';
            statusMessage.style.display = 'block';
            addUserForm.reset();
            loadDashboard(); // Refresh dashboard
        } catch (error) {
            statusMessage.textContent = error.message;
            statusMessage.className = 'status-message error';
            statusMessage.style.display = 'block';
        }
    });

    const renderDashboard = (data) => {
        dashboardContainer.innerHTML = ''; // Clear previous content

        // Add "Add User" button
        const addUserButton = document.createElement('button');
        addUserButton.id = 'add-user-button';
        addUserButton.className = 'btn btn-primary dashboard-button';
        addUserButton.textContent = `+ افزودن ${roleInfo.toAdd}`;
        addUserButton.addEventListener('click', () => {
            addUserCard.style.display = addUserCard.style.display === 'none' ? 'block' : 'none';
        });
        dashboardContainer.appendChild(addUserButton);

        if (data.length === 0) {
            dashboardContainer.innerHTML += '<p>کاربری برای نمایش وجود ندارد.</p>';
            return;
        }

        const usersGrid = document.createElement('div');
        usersGrid.className = 'users-grid';

        data.forEach(user => {
            const userCard = document.createElement('div');
            userCard.className = 'user-card';

            let statsHtml = '';
            if (user.hasOwnProperty('managedUsers')) {
                statsHtml = `<p>کاربران تحت مدیریت: ${user.managedUsers}</p>`;
            } else if (user.hasOwnProperty('memberCount')) {
                statsHtml = `<p>تعداد اعضا: ${user.memberCount}</p>`;
            }

            userCard.innerHTML = `
                <h3>${user.name}</h3>
                ${statsHtml}
                <div class="user-card-actions">
                    <button class="btn btn-secondary" data-action="impersonate" data-id="${user.id}">ورود به پنل</button>
                    <button class="btn btn-danger" data-action="archive" data-id="${user.id}">آرشیو</button>
                </div>
            `;
            usersGrid.appendChild(userCard);
        });

        dashboardContainer.appendChild(usersGrid);
    };

    dashboardContainer.addEventListener('click', async (e) => {
        if (!e.target.matches('button')) return;

        const action = e.target.dataset.action;
        const userId = e.target.dataset.id;

        if (action === 'impersonate') {
            try {
                const response = await apiCall('impersonateUser', { targetUserId: userId });
                if (response.token && response.user) {
                    sessionStorage.setItem('impersonation_token', response.token);
                    sessionStorage.setItem('impersonation_user', JSON.stringify(response.user));
                    window.location.href = 'admin.html'; // Or the relevant panel
                }
            } catch (error) {
                alert(`خطا در ورود به پنل: ${error.message}`);
            }
        }

        if (action === 'archive') {
            if (confirm(`آیا از آرشیو کردن این کاربر اطمینان دارید؟`)) {
                try {
                    await apiCall('archiveUser', { userIdToArchive: userId });
                    loadDashboard(); // Refresh dashboard
                } catch (error) {
                    alert(`خطا در آرشیو: ${error.message}`);
                }
            }
        }
    });

    const loadDashboard = async () => {
        try {
            dashboardContainer.innerHTML = '<p>در حال بارگذاری...</p>';
            const dashboardData = await apiCall('getDashboardData');
            renderDashboard(dashboardData);
        } catch (error) {
            dashboardContainer.innerHTML = `<p class="error-message">خطا: ${error.message}</p>`;
        }
    };

    // Initial load
    loadDashboard();
});
