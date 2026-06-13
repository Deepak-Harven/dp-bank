const agentLogoutBtn = document.getElementById('agent-logout-btn');
const usersTableBody = document.querySelector('#users-table tbody');
const messagesTableBody = document.getElementById('messages-table-body');
const messagesBadge = document.getElementById('messages-badge');
const agentRefreshMessagesBtn = document.getElementById('agent-refresh-messages-btn');
const notification = document.getElementById('notification');
const searchInput = document.getElementById('search-input');

// Modal Elements
const detailModal = document.getElementById('detail-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalUserId = document.getElementById('modal-user-id');
const modalUsername = document.getElementById('modal-username');
const modalAccountNumber = document.getElementById('modal-account-number');
const modalBalance = document.getElementById('modal-balance');
const modalDateJoined = document.getElementById('modal-date-joined');
const modalTransactionsBody = document.getElementById('modal-transactions-body');

// Dashboard Stats Elements
const statTotalUsers = document.getElementById('stat-total-users');
const statTotalAccounts = document.getElementById('stat-total-accounts');
const statLastUpdated = document.getElementById('stat-last-updated');

// Global cache for users list
let allUsers = [];

function showNotification(message, type = 'error') {
    if (!notification) return;
    notification.textContent = message;
    notification.className = `notification ${type}`;
    setTimeout(() => notification.classList.add('hidden'), 3000);
}

if (agentLogoutBtn) {
    agentLogoutBtn.addEventListener('click', () => {
        localStorage.removeItem('agent_token');
        window.location.href = 'index.html';
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}

// Generate consistent join dates based on User ID
function getSimulatedJoinDate(userId) {
    const baseDate = new Date(2026, 4, 1); // 1st May 2026
    const joinDate = new Date(baseDate.getTime() + (userId * 24 * 60 * 60 * 1000 * 1.5));
    return joinDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Update dashboard summary cards stats
function updateDashboardStats(users) {
    if (!statTotalUsers || !statTotalAccounts || !statLastUpdated) return;

    const totalUsers = users.length;
    const totalAccounts = users.filter(u => u.account_number).length;

    statTotalUsers.textContent = totalUsers;
    statTotalAccounts.textContent = totalAccounts;

    const now = new Date();
    statLastUpdated.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ', ' + 
                                  now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Render users table body
function renderUsers(users) {
    if (!usersTableBody) return;

    if (users.length === 0) {
        usersTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">No matching users found.</td></tr>';
        return;
    }

    usersTableBody.innerHTML = users.map(user => `
        <tr>
            <td style="font-weight: 600;">#${user.id}</td>
            <td style="font-weight: bold; color: var(--bg-dark);">${user.username}</td>
            <td style="font-family: monospace; font-size: 14px;">${user.account_number || '-----'}</td>
            <td><span class="balance-accent">${formatCurrency(user.balance)}</span></td>
            <td style="color: var(--text-muted); font-size: 14px;">${getSimulatedJoinDate(user.id)}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn-view" onclick="viewUser(${user.id})">👁️ View</button>
                    <button class="btn-download-pdf" onclick="downloadPDF(${user.id})">📥 PDF</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Fetch all users on load
async function loadUsers() {
    try {
        const res = await fetch('/api/admin/users');
        allUsers = await res.json();
        
        updateDashboardStats(allUsers);
        
        // Render all users initially or apply current search filter if search contains text
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        if (query) {
            const filtered = allUsers.filter(user => 
                user.username.toLowerCase().includes(query) || 
                (user.account_number && user.account_number.includes(query))
            );
            renderUsers(filtered);
        } else {
            renderUsers(allUsers);
        }
    } catch (e) {
        showNotification('Failed to load users', 'error');
        if (usersTableBody) {
            usersTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error); padding: 30px;">Error loading users from server.</td></tr>';
        }
    }
}

// Search bar filter handling
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = allUsers.filter(user => 
            user.username.toLowerCase().includes(query) || 
            (user.account_number && user.account_number.includes(query))
        );
        renderUsers(filtered);
    });
}

// View User Modal details
async function viewUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    // Set user info details
    modalUserId.textContent = `#${user.id}`;
    modalUsername.textContent = user.username;
    modalAccountNumber.textContent = user.account_number || '-----';
    modalBalance.textContent = formatCurrency(user.balance);
    modalDateJoined.textContent = getSimulatedJoinDate(user.id);

    // Show loading state for transactions
    modalTransactionsBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted);">Loading transactions...</td></tr>';
    
    // Open modal
    if (detailModal) {
        detailModal.classList.add('active');
    }

    try {
        const res = await fetch(`/api/transactions?username=${user.username}`);
        const txs = await res.json();

        if (txs.length === 0) {
            modalTransactionsBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted);">No transactions logged yet.</td></tr>';
            return;
        }

        modalTransactionsBody.innerHTML = txs.map(tx => {
            const isDeposit = tx.type === 'deposit';
            const sign = isDeposit ? '+' : '-';
            const amountColor = isDeposit ? 'var(--success)' : 'var(--error)';
            const formattedDate = new Date(tx.timestamp + 'Z').toLocaleString('en-IN');

            return `
                <tr>
                    <td style="font-weight: 600; text-transform: capitalize;">${tx.type}</td>
                    <td style="color: ${amountColor}; font-weight: bold;">${sign}${formatCurrency(tx.amount)}</td>
                    <td style="color: var(--text-main); font-size: 13px;">${tx.description}</td>
                    <td style="color: var(--text-muted); font-size: 12px; font-family: monospace;">${formattedDate}</td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        modalTransactionsBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--error); padding: 20px;">Failed to load transaction history.</td></tr>';
    }
}

// Close Modal logic
if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
        if (detailModal) detailModal.classList.remove('active');
    });
}

if (detailModal) {
    detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) {
            detailModal.classList.remove('active');
        }
    });
}

// PDF Statement Generation using jsPDF and AutoTable
async function downloadPDF(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    showNotification(`Preparing statements for ${user.username}...`, 'success');

    try {
        const res = await fetch(`/api/transactions?username=${user.username}`);
        const txs = await res.json();

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // 1. Header Section
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(122, 82, 244); // Primary purple
        doc.text("DP Bank", 14, 20);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(113, 128, 150); // Muted grey
        doc.text("Agent Portal Statement", 14, 25);

        doc.setFontSize(10);
        doc.setTextColor(45, 55, 72);
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 140, 20);
        doc.text("Confidential Customer Report", 140, 25);

        // Divider Line
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 30, 196, 30);

        // 2. Profile Details Section
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(26, 32, 44);
        doc.text("Customer Profile Details", 14, 40);

        doc.autoTable({
            startY: 45,
            margin: { left: 14, right: 14 },
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 4 },
            body: [
                ['User ID:', `#${user.id}`, 'Account Number:', user.account_number || '-----'],
                ['Username:', user.username, 'Account Status:', 'Active'],
                ['Current Balance:', formatCurrency(user.balance), 'Date Joined:', getSimulatedJoinDate(user.id)]
            ],
            columnStyles: {
                0: { fontStyle: 'bold', width: 35, textColor: [113, 128, 150] },
                1: { fontStyle: 'bold', width: 55 },
                2: { fontStyle: 'bold', width: 35, textColor: [113, 128, 150] },
                3: { fontStyle: 'bold', width: 55 }
            }
        });

        // 3. Transactions Section
        const statementStartY = doc.lastAutoTable.finalY + 12;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(26, 32, 44);
        doc.text("Transaction History Log", 14, statementStartY);

        const transactionRows = txs.map(tx => {
            const isDeposit = tx.type === 'deposit';
            const sign = isDeposit ? '+' : '-';
            const formattedAmount = `${sign}INR ${tx.amount.toFixed(2)}`;
            const date = new Date(tx.timestamp + 'Z').toLocaleString('en-IN');
            return [
                tx.type.toUpperCase(),
                formattedAmount,
                tx.description,
                date
            ];
        });

        if (transactionRows.length === 0) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(10);
            doc.setTextColor(113, 128, 150);
            doc.text("No transactions found for this user account.", 14, statementStartY + 8);
        } else {
            doc.autoTable({
                startY: statementStartY + 5,
                margin: { left: 14, right: 14 },
                head: [['Type', 'Amount', 'Description', 'Date & Time']],
                body: transactionRows,
                theme: 'striped',
                headStyles: { fillColor: [122, 82, 244], textColor: [255, 255, 255] },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                styles: { fontSize: 9, cellPadding: 5 },
                columnStyles: {
                    0: { fontStyle: 'bold' },
                    1: { fontStyle: 'bold' }
                }
            });
        }

        // 4. Footer & Page Numbers
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(113, 128, 150);
            // Footer separator
            doc.setDrawColor(226, 232, 240);
            doc.line(14, 280, 196, 280);
            
            doc.text("Generated by DP Bank Agent Portal", 14, 285);
            doc.text(`Page ${i} of ${pageCount}`, 175, 285);
        }

        doc.save(`DP_Bank_Statement_${user.username}.pdf`);
        showNotification(`Downloaded statement for ${user.username}`, 'success');
    } catch (err) {
        showNotification('Failed to generate PDF statement', 'error');
    }
}

// Bind handlers to global window namespace so template literals can access them
window.viewUser = viewUser;
window.downloadPDF = downloadPDF;

// Verify token and load users and messages on page load
window.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('agent_token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    try {
        const res = await fetch('/api/agent-verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        if (res.ok) {
            loadUsers();
            loadMessages(); // Load messages initially to populate the badge
        } else {
            localStorage.removeItem('agent_token');
            window.location.href = 'index.html';
        }
    } catch(e) {
        window.location.href = 'index.html';
    }
});

// Refresh Button Logic for Users
const agentRefreshBtn = document.getElementById('agent-refresh-btn');
if (agentRefreshBtn) {
    agentRefreshBtn.addEventListener('click', () => {
        agentRefreshBtn.style.transition = 'transform 0.4s ease';
        agentRefreshBtn.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            agentRefreshBtn.style.transition = 'none';
            agentRefreshBtn.style.transform = 'none';
        }, 400);
        
        loadUsers();
    });
}

// Tab Switching Navigation Logic
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');
        
        // Update active nav item
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Switch panels
        document.querySelectorAll('.content-panel').forEach(panel => {
            panel.classList.remove('active');
            panel.classList.add('hidden');
        });
        const targetPanel = document.getElementById(target);
        if (targetPanel) {
            targetPanel.classList.remove('hidden');
            targetPanel.classList.add('active');
        }

        // If target is messages panel, fetch messages immediately
        if (target === 'panel-messages') {
            loadMessages();
        }
    });
});

// Refresh Button Logic for Messages
if (agentRefreshMessagesBtn) {
    agentRefreshMessagesBtn.addEventListener('click', () => {
        agentRefreshMessagesBtn.style.transition = 'transform 0.4s ease';
        agentRefreshMessagesBtn.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            agentRefreshMessagesBtn.style.transition = 'none';
            agentRefreshMessagesBtn.style.transform = 'none';
        }, 400);
        
        loadMessages();
    });
}

// Fetch customer messages from the server
async function loadMessages() {
    const token = localStorage.getItem('agent_token');
    if (!token) return;

    try {
        const res = await fetch('/api/contact-messages', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            if (res.status === 401) {
                localStorage.removeItem('agent_token');
                window.location.href = 'index.html';
                return;
            }
            throw new Error('Failed to fetch contact messages');
        }

        const messages = await res.json();

        // Count unread messages and update badge
        const unreadCount = messages.filter(msg => msg.status === 'unread').length;
        updateMessagesBadge(unreadCount);

        renderMessages(messages);
    } catch (err) {
        showNotification('Failed to load support messages', 'error');
        if (messagesTableBody) {
            messagesTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error); padding: 30px;">Error loading messages from server.</td></tr>';
        }
    }
}

// Update messages unread badge UI
function updateMessagesBadge(count) {
    if (!messagesBadge) return;
    if (count > 0) {
        messagesBadge.textContent = count;
        messagesBadge.classList.remove('hidden');
    } else {
        messagesBadge.textContent = '0';
        messagesBadge.classList.add('hidden');
    }
}

// Render support messages list
function renderMessages(messages) {
    if (!messagesTableBody) return;

    if (messages.length === 0) {
        messagesTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">No customer messages found.</td></tr>';
        return;
    }

    messagesTableBody.innerHTML = messages.map(msg => {
        const formattedDate = new Date(msg.created_at + 'Z').toLocaleString('en-IN');
        const isUnread = msg.status === 'unread';
        const actionButton = isUnread 
            ? `<button class="btn-read" onclick="markMessageAsRead(${msg.id})">✔️ Read</button>` 
            : `<button class="btn-read" disabled>✔️ Read</button>`;
        const statusPill = isUnread 
            ? `<span class="status-pill-message unread">Unread</span>` 
            : `<span class="status-pill-message read">Read</span>`;

        return `
            <tr>
                <td style="font-weight: 600;">#${msg.id}</td>
                <td style="font-weight: bold; color: var(--bg-dark);">${escapeHtml(msg.name)}</td>
                <td style="font-size: 14px;"><a href="mailto:${escapeHtml(msg.email)}" style="color: var(--primary); text-decoration: none;">${escapeHtml(msg.email)}</a></td>
                <td style="font-size: 14px; white-space: pre-wrap; line-height: 1.4;">${escapeHtml(msg.message)}</td>
                <td style="color: var(--text-muted); font-size: 13px; font-family: monospace;">${formattedDate}</td>
                <td>
                    <div class="actions-cell" style="display: flex; gap: 8px; align-items: center;">
                        ${statusPill}
                        ${actionButton}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Mark message as read
async function markMessageAsRead(id) {
    const token = localStorage.getItem('agent_token');
    if (!token) return;

    try {
        const res = await fetch(`/api/contact-messages/${id}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.ok) {
            showNotification('Message marked as read', 'success');
            loadMessages(); // Refresh messages and badge count
        } else {
            showNotification('Failed to update message status', 'error');
        }
    } catch (e) {
        showNotification('Error marking message as read', 'error');
    }
}

// Escape HTML utility
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

// Bind handlers to global namespace
window.markMessageAsRead = markMessageAsRead;
