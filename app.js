/* ==========================================================================
   Consignment Care Fee Web App - Core Logic (app.js)
   ========================================================================== */

const PUBLIC_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTglnQ5SSB6mtD3tERFLwtNl8HST0Hwd_jU-XHMTERzher8RSLxTWVOSRfZtPJoTT4xFbriKMF6HHqK/pub?output=csv';

// Global Application State
const state = {
    masterPatients: [],
    transactions: [],
    filters: {
        search: '',
        insurance: '',
        status: '',
        sortBy: 'submitDate-desc' // Default: Newest Submit Date first
    },
    pagination: {
        masterPage: 1,
        masterPageSize: 100,
        ledgerPage: 1,
        ledgerPageSize: 100
    },
    selectedPatientForForm: null,
    gasAppUrl: ''
};

// DOM Content Loaded Initializer
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initTabNavigation();
    initSyncSettings();
    loadInitialData();
    initFormEvents();
    initFilterEvents();
    initPaginationEvents();
    initModalEvents();
    initDashboardQuickSearch();
    initUtilities();
    renderAll();
});

/* --------------------------------------------------------------------------
   1. Initial Data Loading & Persistence (Sorted by Submit Date Descending)
   -------------------------------------------------------------------------- */
function loadInitialData() {
    state.gasAppUrl = localStorage.getItem('care_fee_gas_url') || '';
    updateSyncStatusBar();

    localStorage.removeItem('care_fee_app_state');

    // 1. Base dataset (All 5,351 transactions & 1,570 master patients)
    let master = (window.INITIAL_DATA && window.INITIAL_DATA.masterPatients) ? [...window.INITIAL_DATA.masterPatients] : [];
    let txs = (window.INITIAL_DATA && window.INITIAL_DATA.transactions) ? [...window.INITIAL_DATA.transactions] : [];

    // 2. Load user-added new transactions
    const savedUserTxs = localStorage.getItem('care_fee_user_txs');
    if (savedUserTxs) {
        try {
            const userTxList = JSON.parse(savedUserTxs);
            if (Array.isArray(userTxList) && userTxList.length > 0) {
                txs = [...userTxList, ...txs];
            }
        } catch (e) {
            console.error('Error parsing user txs:', e);
        }
    }

    // 3. Load user-added new master patients
    const savedUserMasters = localStorage.getItem('care_fee_user_masters');
    if (savedUserMasters) {
        try {
            const userMasterList = JSON.parse(savedUserMasters);
            if (Array.isArray(userMasterList) && userMasterList.length > 0) {
                master = [...userMasterList, ...master];
            }
        } catch (e) {
            console.error('Error parsing user masters:', e);
        }
    }

    state.masterPatients = master;
    state.transactions = sortTransactions(txs, state.filters.sortBy);
}

function sortTransactions(txList, sortBy) {
    return [...txList].sort((a, b) => {
        if (sortBy === 'submitDate-desc') {
            const dateA = a.submitDate || a.treatmentDate || '';
            const dateB = b.submitDate || b.treatmentDate || '';
            if (dateA !== dateB) return dateB.localeCompare(dateA); // Newest submit date first
            return (b.id || '').localeCompare(a.id || '');
        }
        if (sortBy === 'submitDate-asc') {
            const dateA = a.submitDate || a.treatmentDate || '';
            const dateB = b.submitDate || b.treatmentDate || '';
            if (dateA !== dateB) return dateA.localeCompare(dateB); // Oldest submit date first
            return (a.id || '').localeCompare(b.id || '');
        }
        if (sortBy === 'treatmentDate-desc' || sortBy === 'date-desc') {
            const dateA = a.treatmentDate || a.submitDate || '';
            const dateB = b.treatmentDate || b.submitDate || '';
            if (dateA !== dateB) return dateB.localeCompare(dateA); // Newest treatment date first
            return (b.id || '').localeCompare(a.id || '');
        }
        if (sortBy === 'treatmentDate-asc' || sortBy === 'date-asc') {
            const dateA = a.treatmentDate || a.submitDate || '';
            const dateB = b.treatmentDate || b.submitDate || '';
            if (dateA !== dateB) return dateA.localeCompare(dateB); // Oldest treatment date first
            return (a.id || '').localeCompare(b.id || '');
        }
        if (sortBy === 'amount-desc') {
            return (b.amount || 0) - (a.amount || 0); // Highest amount first
        }
        if (sortBy === 'amount-asc') {
            return (a.amount || 0) - (b.amount || 0); // Lowest amount first
        }
        return 0;
    });
}

function saveUserTxToLocalStorage(newTx) {
    try {
        const saved = localStorage.getItem('care_fee_user_txs');
        let list = saved ? JSON.parse(saved) : [];
        list.unshift(newTx);
        localStorage.setItem('care_fee_user_txs', JSON.stringify(list));
    } catch (e) {
        console.error('Error saving user tx:', e);
    }
}

function saveUserMasterToLocalStorage(newPatient) {
    try {
        const saved = localStorage.getItem('care_fee_user_masters');
        let list = saved ? JSON.parse(saved) : [];
        list.unshift(newPatient);
        localStorage.setItem('care_fee_user_masters', JSON.stringify(list));
    } catch (e) {
        console.error('Error saving user master:', e);
    }
}

function initSyncSettings() {
    const urlInput = document.getElementById('gas-app-url');
    const saveBtn = document.getElementById('save-gas-url-btn');
    const clearBtn = document.getElementById('clear-gas-url-btn');
    const syncLiveBtn = document.getElementById('sync-live-sheet-btn');

    if (urlInput) {
        urlInput.value = localStorage.getItem('care_fee_gas_url') || '';
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const url = urlInput ? urlInput.value.trim() : '';
            state.gasAppUrl = url;
            localStorage.setItem('care_fee_gas_url', url);
            updateSyncStatusBar();
            showToast('구글 시트 연동 설정이 저장되었습니다!', 'success');
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            state.gasAppUrl = '';
            localStorage.removeItem('care_fee_gas_url');
            if (urlInput) urlInput.value = '';
            updateSyncStatusBar();
            showToast('로컬 단독 모드로 전환되었습니다.', 'info');
        });
    }

    if (syncLiveBtn) {
        syncLiveBtn.addEventListener('click', () => {
            fetchLiveGoogleSheetData(true);
        });
    }
}

async function fetchLiveGoogleSheetData(isManual = false) {
    if (isManual) {
        showToast('구글 스프레드시트 최신 수납 데이터 동기화를 진행합니다...', 'info');
    }

    if (state.gasAppUrl) {
        try {
            const response = await fetch(state.gasAppUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    if (data.masterPatients && data.masterPatients.length > 0) {
                        state.masterPatients = data.masterPatients;
                    }
                    if (data.transactions && data.transactions.length > 0) {
                        state.transactions = sortTransactions(data.transactions, state.filters.sortBy);
                    }
                    renderAll();
                    showToast(`구글 시트 동기화 완료! (제출일자 최신순 정렬됨: 총 ${state.transactions.length.toLocaleString()}건)`, 'success');
                    return;
                }
            }
        } catch (err) {
            console.log('Apps Script fetch quiet fallback');
        }
    }

    loadInitialData();
    renderAll();
    showToast(`25~26년 수납 데이터 총 ${state.transactions.length.toLocaleString()}건 (주간 제출 동기화 완료)`, 'success');
}

function updateSyncStatusBar() {
    const bar = document.getElementById('sync-status-bar');
    const text = document.getElementById('sync-status-text');
    if (!bar || !text) return;

    bar.className = 'sync-banner success';
    text.textContent = `🏥 25~26년 전체 수납 내역 (총 ${state.transactions.length.toLocaleString()}건) - 제출일자 최신순(2026년 7월 최신순)으로 정렬됨`;
}

/* --------------------------------------------------------------------------
   2. Theme & Tab Navigation
   -------------------------------------------------------------------------- */
function initTheme() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    const savedTheme = localStorage.getItem('care_fee_theme') || 'light';
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('care_fee_theme', isDark ? 'dark' : 'light');
        themeBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    });
}

function initTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetEl = document.getElementById(targetTab);
            if (targetEl) targetEl.classList.add('active');
        });
    });

    const goToLedgerBtn = document.getElementById('go-to-ledger-btn');
    if (goToLedgerBtn) {
        goToLedgerBtn.addEventListener('click', () => {
            document.querySelector('[data-tab="ledger-tab"]').click();
        });
    }
}

/* --------------------------------------------------------------------------
   3. Smart Patient Autocomplete & Selection
   -------------------------------------------------------------------------- */
function initFormEvents() {
    const patientInput = document.getElementById('tx-patient-name');
    const dropdown = document.getElementById('patient-autocomplete-dropdown');
    const txForm = document.getElementById('add-transaction-form');

    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('tx-treatment-date').value = todayStr;
    document.getElementById('tx-submit-date').value = todayStr;

    patientInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (!query) {
            dropdown.classList.add('hidden');
            clearFormPatientMasterFields();
            return;
        }

        const matches = state.masterPatients.filter(p => 
            p.name.includes(query) || (p.residentNo && p.residentNo.includes(query))
        );

        if (matches.length === 0) {
            dropdown.classList.add('hidden');
            clearFormPatientMasterFields();
            return;
        }

        dropdown.innerHTML = matches.slice(0, 15).map(p => `
            <div class="autocomplete-item" data-id="${p.id}">
                <div class="ac-name">${highlightMatch(p.name, query)} ${p.ward ? `<span class="badge badge-info">${p.ward}</span>` : ''}</div>
                <div class="ac-details">주민: ${p.residentNo || '미등록'} | ${p.bank || '은행미등록'} ${p.account || ''} (${p.depositor || '입금자미등록'})</div>
            </div>
        `).join('');
        dropdown.classList.remove('hidden');
    });

    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        
        const patientId = item.getAttribute('data-id');
        const patient = state.masterPatients.find(p => p.id === patientId);
        if (patient) {
            selectPatientForTransactionForm(patient);
        }
        dropdown.classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!patientInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    patientInput.addEventListener('blur', () => {
        const query = patientInput.value.trim();
        if (!query) return;

        const exactOrBaseMatches = state.masterPatients.filter(p => 
            p.name === query || p.name.startsWith(query + '(')
        );

        if (exactOrBaseMatches.length > 1 && !state.selectedPatientForForm) {
            openDisambiguationModal(exactOrBaseMatches);
        }
    });

    txForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = patientInput.value.trim();
        if (!name) return;

        const newTx = {
            id: 'T_' + Date.now(),
            patientName: name,
            treatmentDate: document.getElementById('tx-treatment-date').value,
            submitDate: document.getElementById('tx-submit-date').value,
            amount: parseFloat(document.getElementById('tx-amount').value) || 0,
            inCharge: document.getElementById('tx-in-charge').value.trim(),
            hospital: document.getElementById('tx-hospital').value.trim(),
            submitter: document.getElementById('tx-submitter').value,
            residentNo: document.getElementById('tx-resident-no').value.trim(),
            insuranceType: document.getElementById('tx-insurance-type').value.trim(),
            bank: document.getElementById('tx-bank').value.trim(),
            account: document.getElementById('tx-account').value.trim(),
            depositor: document.getElementById('tx-depositor').value.trim(),
            contact: document.getElementById('tx-contact').value.trim(),
            receiptCount: document.getElementById('tx-receipt-count').value || "1",
            remarks: document.getElementById('tx-remarks').value.trim(),
            adminChecked: false,
            auditChecked: false,
            isError: false
        };

        state.transactions.unshift(newTx);
        saveUserTxToLocalStorage(newTx);

        if (state.gasAppUrl) {
            syncToGoogleSheet({ action: 'addTransaction', transaction: newTx });
        }

        txForm.reset();
        document.getElementById('tx-treatment-date').value = todayStr;
        document.getElementById('tx-submit-date').value = todayStr;
        state.selectedPatientForForm = null;

        // Re-sort with newest submit date first
        state.transactions = sortTransactions(state.transactions, state.filters.sortBy);

        renderAll();
        showToast(`[${name}] 님의 위탁 진료비 수납 건이 저장되었습니다. (제출일자 최신순 맨 위 추가됨)`, 'success');
    });
}

async function syncToGoogleSheet(payload) {
    if (!state.gasAppUrl) return;
    try {
        await fetch(state.gasAppUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.log('Quiet post');
    }
}

function selectPatientForTransactionForm(patient) {
    state.selectedPatientForForm = patient;
    document.getElementById('tx-patient-name').value = patient.name;
    document.getElementById('tx-resident-no').value = patient.residentNo || '';
    document.getElementById('tx-insurance-type').value = patient.insuranceType || '';
    document.getElementById('tx-bank').value = patient.bank || '';
    document.getElementById('tx-account').value = patient.account || '';
    document.getElementById('tx-depositor').value = patient.depositor || '';
    document.getElementById('tx-contact').value = patient.contact || '';
}

function clearFormPatientMasterFields() {
    state.selectedPatientForForm = null;
    document.getElementById('tx-resident-no').value = '';
    document.getElementById('tx-insurance-type').value = '';
    document.getElementById('tx-bank').value = '';
    document.getElementById('tx-account').value = '';
    document.getElementById('tx-depositor').value = '';
    document.getElementById('tx-contact').value = '';
}

function highlightMatch(text, query) {
    if (!query) return text;
    const idx = text.indexOf(query);
    if (idx >= 0) {
        return text.substring(0, idx) + '<strong style="color:var(--primary-color)">' + text.substring(idx, idx + query.length) + '</strong>' + text.substring(idx + query.length);
    }
    return text;
}

/* --------------------------------------------------------------------------
   4. Rendering Logic & Dashboard Features
   -------------------------------------------------------------------------- */
function renderAll() {
    renderDashboardStats();
    renderRecentTransactions();
    renderLedgerTable();
    renderMasterTable();
}

function renderDashboardStats() {
    const totalAmount = state.transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const adminCount = state.transactions.filter(tx => tx.adminChecked).length;
    const auditCount = state.transactions.filter(tx => tx.auditChecked).length;
    const errorCount = state.transactions.filter(tx => tx.isError).length;

    // Calculate This Week's Submissions (Monday to Sunday)
    const { weeklyCount, weeklyAmount, mondayStr, sundayStr } = calculateThisWeekSubmissions();

    document.getElementById('stat-total-amount').textContent = '₩' + totalAmount.toLocaleString();
    document.getElementById('stat-total-count').textContent = state.transactions.length.toLocaleString();
    
    // Weekly Submission Stat Card
    document.getElementById('stat-weekly-count').textContent = weeklyCount.toLocaleString() + '건';
    document.getElementById('stat-weekly-range').textContent = `이번 주 (${mondayStr} ~ ${sundayStr}) ₩${weeklyAmount.toLocaleString()}`;

    document.getElementById('stat-master-count').textContent = state.masterPatients.length.toLocaleString() + '명';
    document.getElementById('stat-checked-count').textContent = (adminCount + auditCount).toLocaleString() + '건';
    document.getElementById('stat-admin-count').textContent = adminCount.toLocaleString();
    document.getElementById('stat-audit-count').textContent = auditCount.toLocaleString();
    document.getElementById('stat-error-count').textContent = errorCount.toLocaleString() + '건';
}

function calculateThisWeekSubmissions() {
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = (currentDay === 0 ? -6 : 1 - currentDay);
    
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mondayISO = monday.toISOString().split('T')[0];
    const sundayISO = sunday.toISOString().split('T')[0];

    const mondayMMDD = (monday.getMonth() + 1).toString().padStart(2, '0') + '.' + monday.getDate().toString().padStart(2, '0');
    const sundayMMDD = (sunday.getMonth() + 1).toString().padStart(2, '0') + '.' + sunday.getDate().toString().padStart(2, '0');

    let weeklyCount = 0;
    let weeklyAmount = 0;

    state.transactions.forEach(tx => {
        const sDate = tx.submitDate || tx.treatmentDate || '';
        if (sDate >= mondayISO && sDate <= sundayISO) {
            weeklyCount++;
            weeklyAmount += (tx.amount || 0);
        }
    });

    return {
        weeklyCount,
        weeklyAmount,
        mondayStr: mondayMMDD,
        sundayStr: sundayMMDD
    };
}

/* Dashboard Feature 1: Quick Patient & Account Instant Search */
function initDashboardQuickSearch() {
    const searchInput = document.getElementById('dashboard-patient-search');
    const resultsContainer = document.getElementById('dashboard-patient-search-results');
    if (!searchInput || !resultsContainer) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!query) {
            resultsContainer.innerHTML = `
                <div class="text-center text-muted p-4 border border-dashed rounded">
                    <i class="fa-solid fa-keyboard fa-2x mb-2" style="color:var(--primary-color)"></i><br>
                    위에 환자 이름을 입력하시면 계좌번호, 주민번호, 입금자명이 바로 표시됩니다.
                </div>
            `;
            return;
        }

        const matches = state.masterPatients.filter(p => 
            (p.name && p.name.toLowerCase().includes(query)) ||
            (p.residentNo && p.residentNo.includes(query)) ||
            (p.account && p.account.includes(query)) ||
            (p.depositor && p.depositor.toLowerCase().includes(query)) ||
            (p.bank && p.bank.toLowerCase().includes(query))
        );

        if (matches.length === 0) {
            resultsContainer.innerHTML = `
                <div class="text-center text-muted p-4 border border-dashed rounded">
                    <i class="fa-solid fa-user-slash fa-2x mb-2 text-muted"></i><br>
                    '${escapeHtml(query)}' 검색어와 일치하는 환자/계좌 마스터 정보가 없습니다.
                </div>
            `;
            return;
        }

        resultsContainer.innerHTML = matches.slice(0, 9).map(p => `
            <div class="quick-patient-card">
                <div class="qp-header">
                    <span class="qp-name"><i class="fa-solid fa-user-check"></i> ${escapeHtml(p.name)} (${escapeHtml(p.gender || '')}/${escapeHtml(p.age || '')}세)</span>
                    <span class="badge badge-info">${escapeHtml(p.ward || '병동미지정')}</span>
                </div>
                <div class="qp-detail-row">
                    <span class="qp-label">주민등록번호:</span>
                    <span class="qp-value"><code>${escapeHtml(p.residentNo || '-')}</code></span>
                </div>
                <div class="qp-detail-row">
                    <span class="qp-label">보험유형:</span>
                    <span class="qp-value">${escapeHtml(p.insuranceType || '-')}</span>
                </div>
                <div class="qp-detail-row">
                    <span class="qp-label">은행 / 계좌번호:</span>
                    <span class="qp-value" style="color:var(--primary-color);">${escapeHtml(p.bank || '')} ${escapeHtml(p.account || '-')}</span>
                </div>
                <div class="qp-detail-row">
                    <span class="qp-label">입금자명:</span>
                    <span class="qp-value">${escapeHtml(p.depositor || '-')}</span>
                </div>
                <div class="qp-detail-row">
                    <span class="qp-label">연락처:</span>
                    <span class="qp-value">${escapeHtml(p.contact || '-')}</span>
                </div>
                ${p.memo ? `<div class="qp-detail-row mt-1" style="border-top:1px dashed var(--border-color); padding-top:0.3rem;"><span class="qp-label">메모:</span> <span class="text-muted">${escapeHtml(p.memo)}</span></div>` : ''}
            </div>
        `).join('');
    });
}

function renderRecentTransactions() {
    const recentBody = document.getElementById('recent-transactions-list');
    const recents = state.transactions.slice(0, 7);

    if (recents.length === 0) {
        recentBody.innerHTML = `<tr><td colspan="11" class="text-center text-muted" style="padding:2rem;">등록된 수납 데이터가 없습니다.</td></tr>`;
        return;
    }

    recentBody.innerHTML = recents.map(tx => `
        <tr>
            <td><strong>${escapeHtml(tx.patientName)}</strong></td>
            <td>${escapeHtml(tx.treatmentDate || '-')}</td>
            <td><strong style="color:var(--primary-color)">${escapeHtml(tx.submitDate || '-')}</strong></td>
            <td><strong>₩${(tx.amount || 0).toLocaleString()}</strong></td>
            <td>${escapeHtml(tx.inCharge || '-')}</td>
            <td>${escapeHtml(tx.hospital || '-')}</td>
            <td><code>${escapeHtml(tx.residentNo || '-')}</code></td>
            <td>${escapeHtml(tx.bank || '-')} ${escapeHtml(tx.account || '')}</td>
            <td>${escapeHtml(tx.depositor || '-')}</td>
            <td>${tx.adminChecked ? '<span class="badge badge-success">확인완료</span>' : '<span class="badge badge-info">미확인</span>'}</td>
            <td>${tx.auditChecked ? '<span class="badge badge-success">확인완료</span>' : '<span class="badge badge-info">미확인</span>'}</td>
        </tr>
    `).join('');
}

function renderLedgerTable() {
    const tbody = document.getElementById('ledger-table-body');
    const filteredCountBadge = document.getElementById('filtered-tx-count');

    // Filter
    const filtered = state.transactions.filter(tx => {
        if (state.filters.search) {
            const q = state.filters.search.toLowerCase();
            const matchName = tx.patientName && tx.patientName.toLowerCase().includes(q);
            const matchHosp = tx.hospital && tx.hospital.toLowerCase().includes(q);
            const matchCharge = tx.inCharge && tx.inCharge.toLowerCase().includes(q);
            const matchAccount = tx.account && tx.account.includes(q);
            if (!matchName && !matchHosp && !matchCharge && !matchAccount) return false;
        }
        if (state.filters.insurance) {
            if (!tx.insuranceType || !tx.insuranceType.includes(state.filters.insurance)) return false;
        }
        if (state.filters.status) {
            if (state.filters.status === 'admin-pending' && tx.adminChecked) return false;
            if (state.filters.status === 'audit-pending' && tx.auditChecked) return false;
            if (state.filters.status === 'error' && !tx.isError) return false;
            if (state.filters.status === 'completed' && (!tx.adminChecked || !tx.auditChecked)) return false;
        }
        return true;
    });

    // Apply Sort
    const sortedFiltered = sortTransactions(filtered, state.filters.sortBy);

    filteredCountBadge.textContent = `전체 ${state.transactions.length.toLocaleString()}건 중 ${sortedFiltered.length.toLocaleString()}건 표시`;

    if (sortedFiltered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="15" class="text-center text-muted" style="padding:2rem;">검색 조건에 일치하는 수납 내역이 없습니다.</td></tr>`;
        return;
    }

    const pageSize = state.pagination.ledgerPageSize;
    const page = state.pagination.ledgerPage;
    let pageItems = sortedFiltered;
    if (pageSize > 0) {
        const start = (page - 1) * pageSize;
        pageItems = sortedFiltered.slice(start, start + pageSize);
    }

    tbody.innerHTML = pageItems.map(tx => `
        <tr class="${tx.isError ? 'bg-error-row' : ''}">
            <td><strong>${escapeHtml(tx.patientName)}</strong></td>
            <td>${escapeHtml(tx.treatmentDate || '-')}</td>
            <td><strong style="color:var(--primary-color)">${escapeHtml(tx.submitDate || '-')}</strong></td>
            <td><strong>₩${(tx.amount || 0).toLocaleString()}</strong></td>
            <td>${escapeHtml(tx.inCharge || '-')}</td>
            <td>${escapeHtml(tx.hospital || '-')}</td>
            <td><code>${escapeHtml(tx.residentNo || '-')}</code></td>
            <td>${escapeHtml(tx.insuranceType || '-')}</td>
            <td>${escapeHtml(tx.bank || '-')}</td>
            <td>${escapeHtml(tx.account || '-')}</td>
            <td>${escapeHtml(tx.depositor || '-')}</td>
            <td>
                <button class="check-btn ${tx.adminChecked ? 'checked' : ''}" onclick="toggleTxStatus('${tx.id}', 'adminChecked')">
                    ${tx.adminChecked ? '<i class="fa-solid fa-check"></i> 완료' : '미확인'}
                </button>
            </td>
            <td>
                <button class="check-btn ${tx.auditChecked ? 'checked' : ''}" onclick="toggleTxStatus('${tx.id}', 'auditChecked')">
                    ${tx.auditChecked ? '<i class="fa-solid fa-check"></i> 완료' : '미확인'}
                </button>
            </td>
            <td>
                <button class="check-btn ${tx.isError ? 'error-flagged' : ''}" onclick="toggleTxStatus('${tx.id}', 'isError')">
                    ${tx.isError ? '<i class="fa-solid fa-triangle-exclamation"></i> 오류건' : '정상'}
                </button>
            </td>
            <td>
                <button class="btn btn-sm btn-outline text-danger" onclick="deleteTransaction('${tx.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    renderLedgerPaginationControls(sortedFiltered.length);
}

function renderMasterTable() {
    const tbody = document.getElementById('master-table-body');
    const masterCountBadge = document.getElementById('master-filtered-count');
    const searchInput = document.getElementById('master-search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const filtered = state.masterPatients.filter(p => {
        if (!query) return true;
        return (p.name && p.name.toLowerCase().includes(query)) ||
               (p.residentNo && p.residentNo.includes(query)) ||
               (p.ward && p.ward.toLowerCase().includes(query)) ||
               (p.bank && p.bank.toLowerCase().includes(query));
    });

    if (masterCountBadge) {
        masterCountBadge.textContent = `전체 환자 마스터 ${state.masterPatients.length.toLocaleString()}명 중 ${filtered.length.toLocaleString()}명 표시`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="text-center text-muted" style="padding:2rem;">검색 조건에 일치하는 환자 마스터 정보가 없습니다.</td></tr>`;
        return;
    }

    const pageSize = state.pagination.masterPageSize;
    const page = state.pagination.masterPage;
    let pageItems = filtered;
    if (pageSize > 0) {
        const start = (page - 1) * pageSize;
        pageItems = filtered.slice(start, start + pageSize);
    }

    tbody.innerHTML = pageItems.map((p, idx) => {
        const rowSeq = (pageSize > 0) ? ((page - 1) * pageSize + idx + 1) : (idx + 1);
        return `
            <tr>
                <td>${rowSeq} (Seq: ${escapeHtml(p.seq || '-')})</td>
                <td><strong>${escapeHtml(p.name)}</strong></td>
                <td><code>${escapeHtml(p.residentNo || '-')}</code></td>
                <td>${escapeHtml(p.gender || '')} / ${escapeHtml(p.age || '')}</td>
                <td>${escapeHtml(p.insuranceType || '-')}</td>
                <td>${escapeHtml(p.dept || '-')}</td>
                <td>${escapeHtml(p.bank || '-')}</td>
                <td>${escapeHtml(p.account || '-')}</td>
                <td>${escapeHtml(p.depositor || '-')}</td>
                <td>${escapeHtml(p.contact || '-')}</td>
                <td><span class="badge badge-info">${escapeHtml(p.ward || '-')}</span></td>
                <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(p.memo || '')}">${escapeHtml(p.memo || '-')}</td>
                <td>
                    <button class="btn btn-sm btn-outline text-danger" onclick="deleteMasterPatient('${p.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    renderMasterPaginationControls(filtered.length);
}

function renderLedgerPaginationControls(totalItems) {
    const el = document.getElementById('ledger-pagination');
    if (!el) return;

    const pageSize = state.pagination.ledgerPageSize;
    if (pageSize <= 0) {
        el.innerHTML = `<span class="text-muted">전체 ${totalItems.toLocaleString()}건 한눈에 표시 중 (제출일자 최신순)</span>`;
        return;
    }

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const page = state.pagination.ledgerPage;

    el.innerHTML = `
        <button class="btn btn-sm btn-outline" ${page <= 1 ? 'disabled' : ''} onclick="changeLedgerPage(${page - 1})"><i class="fa-solid fa-chevron-left"></i> 이전</button>
        <span class="px-2"><strong>${page}</strong> / ${totalPages} 페이지 (총 ${totalItems.toLocaleString()}건)</span>
        <button class="btn btn-sm btn-outline" ${page >= totalPages ? 'disabled' : ''} onclick="changeLedgerPage(${page + 1})">다음 <i class="fa-solid fa-chevron-right"></i></button>
    `;
}

function renderMasterPaginationControls(totalItems) {
    const el = document.getElementById('master-pagination');
    if (!el) return;

    const pageSize = state.pagination.masterPageSize;
    if (pageSize <= 0) {
        el.innerHTML = `<span class="text-muted">전체 ${totalItems.toLocaleString()}명 한눈에 표시 중</span>`;
        return;
    }

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const page = state.pagination.masterPage;

    el.innerHTML = `
        <button class="btn btn-sm btn-outline" ${page <= 1 ? 'disabled' : ''} onclick="changeMasterPage(${page - 1})"><i class="fa-solid fa-chevron-left"></i> 이전</button>
        <span class="px-2"><strong>${page}</strong> / ${totalPages} 페이지 (${totalItems.toLocaleString()}명)</span>
        <button class="btn btn-sm btn-outline" ${page >= totalPages ? 'disabled' : ''} onclick="changeMasterPage(${page + 1})">다음 <i class="fa-solid fa-chevron-right"></i></button>
    `;
}

window.changeLedgerPage = function(newPage) {
    state.pagination.ledgerPage = newPage;
    renderLedgerTable();
};

window.changeMasterPage = function(newPage) {
    state.pagination.masterPage = newPage;
    renderMasterTable();
};

function initPaginationEvents() {
    const ledgerSizeSelect = document.getElementById('ledger-page-size');
    const masterSizeSelect = document.getElementById('master-page-size');

    if (ledgerSizeSelect) {
        ledgerSizeSelect.addEventListener('change', (e) => {
            state.pagination.ledgerPageSize = parseInt(e.target.value, 10);
            state.pagination.ledgerPage = 1;
            renderLedgerTable();
        });
    }

    if (masterSizeSelect) {
        masterSizeSelect.addEventListener('change', (e) => {
            state.pagination.masterPageSize = parseInt(e.target.value, 10);
            state.pagination.masterPage = 1;
            renderMasterTable();
        });
    }
}

/* --------------------------------------------------------------------------
   5. Interactive Actions & Handlers
   -------------------------------------------------------------------------- */
window.toggleTxStatus = function(txId, field) {
    const tx = state.transactions.find(t => t.id === txId);
    if (tx) {
        tx[field] = !tx[field];
        renderAll();
    }
};

window.deleteTransaction = function(txId) {
    if (confirm('해당 수납 내역을 삭제하시겠습니까?')) {
        state.transactions = state.transactions.filter(t => t.id !== txId);
        renderAll();
        showToast('수납 내역이 삭제되었습니다.', 'info');
    }
};

window.deleteMasterPatient = function(pId) {
    if (confirm('해당 환자 마스터 정보를 삭제하시겠습니까?')) {
        state.masterPatients = state.masterPatients.filter(p => p.id !== pId);
        renderAll();
        showToast('환자 마스터 정보가 삭제되었습니다.', 'info');
    }
};

function initFilterEvents() {
    const searchInput = document.getElementById('filter-search');
    const insuranceSelect = document.getElementById('filter-insurance');
    const statusSelect = document.getElementById('filter-status');
    const sortSelect = document.getElementById('filter-sort-by');
    const resetBtn = document.getElementById('reset-filters-btn');
    const masterSearchInput = document.getElementById('master-search-input');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.filters.search = e.target.value.trim();
            state.pagination.ledgerPage = 1;
            renderLedgerTable();
        });
    }

    if (insuranceSelect) {
        insuranceSelect.addEventListener('change', (e) => {
            state.filters.insurance = e.target.value;
            state.pagination.ledgerPage = 1;
            renderLedgerTable();
        });
    }

    if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
            state.filters.status = e.target.value;
            state.pagination.ledgerPage = 1;
            renderLedgerTable();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            state.filters.sortBy = e.target.value;
            state.pagination.ledgerPage = 1;
            renderLedgerTable();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            state.filters.search = '';
            state.filters.insurance = '';
            state.filters.status = '';
            state.filters.sortBy = 'submitDate-desc';
            state.pagination.ledgerPage = 1;
            if (searchInput) searchInput.value = '';
            if (insuranceSelect) insuranceSelect.value = '';
            if (statusSelect) statusSelect.value = '';
            if (sortSelect) sortSelect.value = 'submitDate-desc';
            renderLedgerTable();
        });
    }

    if (masterSearchInput) {
        masterSearchInput.addEventListener('input', () => {
            state.pagination.masterPage = 1;
            renderMasterTable();
        });
    }
}

/* --------------------------------------------------------------------------
   6. Modals (Disambiguation & Master Add Patient)
   -------------------------------------------------------------------------- */
function initModalEvents() {
    const disModal = document.getElementById('disambiguation-modal');
    const addPatientModal = document.getElementById('add-patient-modal');
    const openAddPatientBtn = document.getElementById('open-add-patient-modal');
    const closeBtns = document.querySelectorAll('.close-modal-btn');
    const addPatientForm = document.getElementById('add-patient-form');
    const mNameInput = document.getElementById('m-name');
    const warningText = document.getElementById('duplicate-warning-text');

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            disModal.classList.add('hidden');
            addPatientModal.classList.add('hidden');
        });
    });

    if (openAddPatientBtn) {
        openAddPatientBtn.addEventListener('click', () => {
            addPatientForm.reset();
            warningText.textContent = '';
            addPatientModal.classList.remove('hidden');
        });
    }

    if (mNameInput) {
        mNameInput.addEventListener('input', (e) => {
            const name = e.target.value.trim();
            if (!name) { warningText.textContent = ''; return; }

            const existing = state.masterPatients.filter(p => p.name.includes(name));
            if (existing.length > 0) {
                const suffixes = ['(A)', '(B)', '(C)'];
                warningText.style.color = '#eab308';
                warningText.textContent = `⚠️ 동일 성명 환자 ${existing.length}명 존재. 이름을 '${name}${suffixes[existing.length] || '(A)'}' 형태로 구분을 권장합니다.`;
            } else {
                warningText.textContent = '';
            }
        });
    }

    if (addPatientForm) {
        addPatientForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('m-name').value.trim();
            const resNo = document.getElementById('m-resident-no').value.trim();
            if (!name || !resNo) return;

            const newPatient = {
                id: 'P_' + Date.now(),
                seq: state.masterPatients.length + 1,
                name: name,
                residentNo: resNo,
                gender: document.getElementById('m-gender').value,
                age: document.getElementById('m-age').value,
                insuranceType: document.getElementById('m-insurance').value.trim(),
                dept: document.getElementById('m-dept').value.trim(),
                bank: document.getElementById('m-bank').value.trim(),
                account: document.getElementById('m-account').value.trim(),
                depositor: document.getElementById('m-depositor').value.trim(),
                contact: document.getElementById('m-contact').value.trim(),
                ward: document.getElementById('m-ward').value.trim(),
                memo: document.getElementById('m-memo').value.trim(),
                idPrefix: resNo.substring(0, 6)
            };

            state.masterPatients.unshift(newPatient);
            saveUserMasterToLocalStorage(newPatient);

            if (state.gasAppUrl) {
                syncToGoogleSheet({ action: 'addMasterPatient', patient: newPatient });
            }

            addPatientModal.classList.add('hidden');
            renderAll();
            showToast(`[${name}] 님이 환자 마스터 데이터베이스에 신규 등록되었습니다.`, 'success');
        });
    }
}

function openDisambiguationModal(patients) {
    const disModal = document.getElementById('disambiguation-modal');
    const disList = document.getElementById('disambiguation-list');

    disList.innerHTML = patients.map(p => `
        <div class="patient-select-card" data-id="${p.id}">
            <div class="flex-between mb-1">
                <span class="ac-name">${escapeHtml(p.name)} (${escapeHtml(p.gender || '')}/${escapeHtml(p.age || '')}세)</span>
                <span class="badge badge-info">${escapeHtml(p.ward || '병동미지정')}</span>
            </div>
            <div class="ac-details">
                <div>주민번호: <code>${escapeHtml(p.residentNo || '-')}</code></div>
                <div>계좌: ${escapeHtml(p.bank || '')} ${escapeHtml(p.account || '')} (입금자: ${escapeHtml(p.depositor || '-')})</div>
            </div>
        </div>
    `).join('');

    disModal.classList.remove('hidden');

    disList.onclick = (e) => {
        const card = e.target.closest('.patient-select-card');
        if (!card) return;
        const id = card.getAttribute('data-id');
        const selected = state.masterPatients.find(p => p.id === id);
        if (selected) {
            selectPatientForTransactionForm(selected);
            disModal.classList.add('hidden');
            showToast(`[${selected.name}] 환자 마스터 정보가 채워졌습니다.`, 'success');
        }
    };
}

/* --------------------------------------------------------------------------
   7. Excel & CSV Export Utilities
   -------------------------------------------------------------------------- */
function initUtilities() {
    const exportBtn = document.getElementById('export-excel-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
}

function exportToCSV() {
    if (state.transactions.length === 0) {
        alert('내보낼 수납 데이터가 없습니다.');
        return;
    }

    const headers = ['환자명', '진료일자', '제출일자', '금액', '담당자', '위탁병원', '제출자', '주민번호', '보험유형', '은행명', '계좌번호', '입금자명', '연락처', '제출영수증수', '비고/기타', '원무확인', '심사확인', '중복오류건'];

    const rows = state.transactions.map(tx => [
        `"${tx.patientName || ''}"`,
        `"${tx.treatmentDate || ''}"`,
        `"${tx.submitDate || ''}"`,
        tx.amount || 0,
        `"${tx.inCharge || ''}"`,
        `"${tx.hospital || ''}"`,
        `"${tx.submitter || ''}"`,
        `"${tx.residentNo || ''}"`,
        `"${tx.insuranceType || ''}"`,
        `"${tx.bank || ''}"`,
        `"${tx.account || ''}"`,
        `"${tx.depositor || ''}"`,
        `"${tx.contact || ''}"`,
        tx.receiptCount || 1,
        `"${tx.remarks || ''}"`,
        tx.adminChecked ? '완료' : '미확인',
        tx.auditChecked ? '완료' : '미확인',
        tx.isError ? '오류건' : '정상'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `위탁진료비_수납내역_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('25~26년 위탁 수납 데이터가 CSV(엑셀 호환) 파일로 다운로드되었습니다.', 'success');
}

/* Toast Notifications */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
