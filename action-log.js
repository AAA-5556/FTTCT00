document.addEventListener('DOMContentLoaded', () => {
    // ❗ مهم: لینک API خود را اینجا قرار دهید
    const API_URL = "https://script.google.com/macros/s/AKfycbyFhhTg_2xf6TqTBdybO883H4f6562sTDUSY8dbQJyN2K-nmFVD7ViTgWllEPwOaf7V/exec";

    // --- ۱. کد نگهبان و بررسی هویت ---
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || !userData.token || userData.role !== 'admin') {
        localStorage.removeItem('userData');
        window.location.href = 'index.html';
        return;
    }

    // --- توابع کمکی ---
    const persianNumbers = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
    const arabicNumbers  = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
    function normalizeNumbers(str) {
        if(typeof str !== 'string') return '';
        for(let i = 0; i < 10; i++) {
            str = str.replace(persianNumbers[i], i).replace(arabicNumbers[i], i);
        }
        return str;
    }
    
    function formatDateInput(input) {
        let value = normalizeNumbers(input.value).replace(/[^\d]/g, '');
        if (value.length > 8) value = value.slice(0, 8);
        if (value.length > 6) {
            value = value.slice(0, 4) + '/' + value.slice(4, 6) + '/' + value.slice(6);
        } else if (value.length > 4) {
            value = value.slice(0, 4) + '/' + value.slice(4);
        }
        input.value = value;
    }

    // --- شناسایی عناصر ---
    const logTableBody = document.getElementById('log-table-body');
    const loadingMessage = document.getElementById('loading-log');
    const userFilter = document.getElementById('user-filter');
    const actionTypeFilter = document.getElementById('action-type-filter');
    const startDateFilter = document.getElementById('start-date-filter');
    const endDateFilter = document.getElementById('end-date-filter');
    const resetFiltersButton = document.getElementById('reset-filters-log');
    const exportExcelButton = document.getElementById('export-excel');
    const paginationContainer = document.getElementById('pagination-container');

    // --- متغیرهای وضعیت ---
    let allLogs = [];
    let currentFilters = { user: '', actionType: 'all', startDate: '', endDate: '' };
    let currentPage = 1;
    const ITEMS_PER_PAGE = 30;
    
    // --- تابع کمکی برای تماس با API ---
    async function apiCall(action, payload) {
        try {
            const token = userData.token;
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
            return { status: 'error', message: 'خطا در ارتباط با سرور.' };
        }
    }

    // --- توابع نمایش ---
    function renderPage() { 
        const filteredLogs = applyFilters(); 
        const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE); 
        currentPage = Math.min(currentPage, totalPages || 1); 
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE; 
        const pageRecords = filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE); 
        renderTable(pageRecords); 
        renderPagination(totalPages); 
    }
    
    function renderTable(logs) { 
        logTableBody.innerHTML = ''; 
        if (logs.length === 0) { 
            logTableBody.innerHTML = '<tr><td colspan="5">رکوردی یافت نشد.</td></tr>'; 
            return; 
        } 
        logs.forEach(log => { 
            const row = document.createElement('tr'); 
            row.innerHTML = `<td>${log.timestamp}</td><td>${log.actor}</td><td>${log.role === 'admin' ? 'مدیر' : 'موسسه'}</td><td>${log.type}</td><td>${log.desc}</td>`; 
            logTableBody.appendChild(row); 
        }); 
    }

    function renderPagination(totalPages) {
        paginationContainer.innerHTML = '';
        if (totalPages <= 1) return;

        const createButton = (text, page) => {
            const button = document.createElement('button');
            button.textContent = text;
            if (page) {
                if (page === currentPage) button.classList.add('active');
                button.addEventListener('click', () => {
                    currentPage = page;
                    renderPage();
                });
            } else {
                button.disabled = true;
            }
            return button;
        };

        const prevButton = createButton('قبلی', currentPage - 1);
        if (currentPage === 1) prevButton.disabled = true;
        paginationContainer.appendChild(prevButton);

        const pages = new Set();
        pages.add(1);
        pages.add(totalPages);
        pages.add(currentPage);
        if (currentPage > 1) pages.add(currentPage - 1);
        if (currentPage < totalPages) pages.add(currentPage + 1);

        const sortedPages = Array.from(pages).sort((a, b) => a - b);
        
        let lastPage = 0;
        sortedPages.forEach(page => {
            if (page > lastPage + 1) {
                paginationContainer.appendChild(createButton('...'));
            }
            if (page > 0 && page <= totalPages) {
                paginationContainer.appendChild(createButton(page, page));
            }
            lastPage = page;
        });

        const nextButton = createButton('بعدی', currentPage + 1);
        if (currentPage === totalPages) nextButton.disabled = true;
        paginationContainer.appendChild(nextButton);
    }
    
    function populateActionFilter(logs) { 
        const actionTypes = [...new Set(logs.map(log => log.type))]; 
        actionTypes.forEach(type => { 
            const option = document.createElement('option'); 
            option.value = type; 
            option.textContent = type; 
            actionTypeFilter.appendChild(option); 
        }); 
    }

    // --- منطق فیلترها ---
    function applyFilters() {
        let filtered = [...allLogs];
        
        if (currentFilters.user) {
            filtered = filtered.filter(log => log.actor.toLowerCase().includes(currentFilters.user.toLowerCase()));
        }
        if (currentFilters.actionType !== 'all') {
            filtered = filtered.filter(log => log.type === currentFilters.actionType);
        }
        const startDate = normalizeNumbers(startDateFilter.value.trim());
        if (startDate) {
            filtered = filtered.filter(log => normalizeNumbers(log.timestamp.split(/,|،/)[0].trim()) >= startDate);
        }
        const endDate = normalizeNumbers(endDateFilter.value.trim());
        if (endDate) {
            filtered = filtered.filter(log => normalizeNumbers(log.timestamp.split(/,|،/)[0].trim()) <= endDate);
        }
        return filtered;
    }

    // --- مدیریت رویدادها ---
    function setupEventListeners() {
        const filters = [userFilter, actionTypeFilter, startDateFilter, endDateFilter];
        filters.forEach(filter => {
            filter.addEventListener('input', () => {
                formatDateInput(startDateFilter);
                formatDateInput(endDateFilter);
                currentFilters.user = userFilter.value;
                currentFilters.actionType = actionTypeFilter.value;
                currentPage = 1;
                renderPage();
            });
        });
        
        resetFiltersButton.addEventListener('click', () => {
            userFilter.value = ''; 
            actionTypeFilter.value = 'all';
            startDateFilter.value = '';
            endDateFilter.value = '';
            const changeEvent = new Event('input');
            userFilter.dispatchEvent(changeEvent);
        });

        exportExcelButton.addEventListener('click', () => {
            const dataToExport = applyFilters().map(log => ({ "تاریخ و زمان": log.timestamp, "کاربر": log.actor, "نقش": log.role === 'admin' ? 'مدیر' : 'موسسه', "نوع عمل": log.type, "توضیحات": log.desc }));
            if (dataToExport.length === 0) { 
                alert("داده‌ای برای خروجی گرفتن وجود ندارد."); 
                return; 
            }
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "تاریخچه تغییرات");
            XLSX.writeFile(workbook, "ActionLog.xlsx");
        });
    }
    
    // --- بارگذاری اولیه ---
    async function fetchActionLog() {
        const result = await apiCall('getActionLog', {});
        if (result.status === 'success') {
            loadingMessage.style.display = 'none';
            allLogs = result.data;
            populateActionFilter(allLogs);
            renderPage();
        } else {
            loadingMessage.textContent = 'خطا در بارگذاری تاریخچه: ' + result.message;
        }
    }

    setupEventListeners();
    fetchActionLog();
});
