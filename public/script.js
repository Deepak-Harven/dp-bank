// Application State
let isLoginMode = true;
let currentUsername = null;
let currentAccountNumber = null;

// DOM Elements - Views
const landingView = document.getElementById('landing-view');
const authView = document.getElementById('auth-view');
const dashboardView = document.getElementById('dashboard-view');

// DOM Elements - Navigation
const navLoginBtn = document.getElementById('nav-login-btn');
const heroGetStartedBtn = document.getElementById('hero-get-started-btn');
const backToHomeBtn = document.getElementById('back-to-home-btn');

// DOM Elements - Auth Form
const authForm = document.getElementById('auth-form');
const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');
const toggleBtn = document.getElementById('toggle-btn');
const toggleText = document.getElementById('toggle-text');
const notification = document.getElementById('notification');

// DOM Elements - Forgot Password
const showForgotBtn = document.getElementById('show-forgot-btn');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const backToLoginBtn = document.getElementById('back-to-login-btn');
const forgotPasswordWrapper = document.getElementById('forgot-password-wrapper');
const toggleModeContainer = document.querySelector('.toggle-mode');

// DOM Elements - Dashboard
const userDisplayName = document.getElementById('user-display-name');
const accountBalance = document.getElementById('account-balance');
const logoutBtn = document.getElementById('logout-btn');
const navItems = document.querySelectorAll('.nav-item');
const contentPanels = document.querySelectorAll('.content-panel');
const txList = document.getElementById('transactions-list');

// ------------------------------------
// Navigation Logic
// ------------------------------------

// From Landing to Auth
navLoginBtn.addEventListener('click', () => {
    isLoginMode = true;
    updateAuthUI();
    switchView(landingView, authView);
});
heroGetStartedBtn.addEventListener('click', () => {
    isLoginMode = true;
    updateAuthUI();
    switchView(landingView, authView);
});

// From Auth back to Landing
backToHomeBtn.addEventListener('click', () => {
    switchView(authView, landingView);
});

// Helper for views
function switchView(hideView, showView) {
    hideView.classList.remove('active');
    hideView.classList.add('hidden');
    showView.classList.remove('hidden');
    showView.classList.add('active');
}

// ------------------------------------
// Authentication Logic
// ------------------------------------

function updateAuthUI() {
    if (isLoginMode) {
        formTitle.textContent = 'Log in to your account';
        submitBtn.textContent = 'Log In';
        toggleText.textContent = "Don't have an account?";
        toggleBtn.textContent = 'Sign Up';
        if (forgotPasswordWrapper) forgotPasswordWrapper.style.display = 'block';
    } else {
        formTitle.textContent = 'Create a new account';
        submitBtn.textContent = 'Sign Up';
        toggleText.textContent = 'Already have an account?';
        toggleBtn.textContent = 'Log In';
        if (forgotPasswordWrapper) forgotPasswordWrapper.style.display = 'none';
    }
    
    authForm.style.display = 'block';
    if (forgotPasswordForm) {
        forgotPasswordForm.style.display = 'none';
        forgotPasswordForm.classList.remove('hidden'); // We manage with style.display now
    }
    if (toggleModeContainer) toggleModeContainer.style.display = 'block';
    
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

toggleBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    updateAuthUI();
});

function showNotification(message, type = 'error') {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    setTimeout(() => notification.classList.add('hidden'), 3000);
}

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const endpoint = isLoginMode ? '/api/login' : '/api/register';
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        
        if (!response.ok) return showNotification(data.error, 'error');
        
        if (isLoginMode) {
            currentUsername = data.username;
            currentAccountNumber = data.accountNumber;
            localStorage.setItem('auth_token', data.token);
            updateBalanceUI(data.balance);
            switchView(authView, dashboardView);
            loadTransactions();
        } else {
            showNotification('Account created! Please log in.', 'success');
            toggleBtn.click();
        }
    } catch (error) {
        showNotification('Cannot connect to server.', 'error');
    }
});

// Password Visibility Toggle
document.querySelectorAll('.eye-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = btn.previousElementSibling;
        if (input.type === 'password') {
            input.type = 'text';
            btn.classList.add('open');
        } else {
            input.type = 'password';
            btn.classList.remove('open');
        }
    });
});

// Forgot Password Logic
if (showForgotBtn) {
    showForgotBtn.addEventListener('click', () => {
        formTitle.textContent = 'Reset your password';
        authForm.style.display = 'none';
        forgotPasswordForm.style.display = 'block';
        if (toggleModeContainer) toggleModeContainer.style.display = 'none';
    });
}

if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', () => {
        updateAuthUI();
    });
}

if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('forgot-username').value.trim();
        const newPassword = document.getElementById('forgot-new-password').value;
        
        try {
            const response = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, newPassword })
            });
            const data = await response.json();
            
            if (!response.ok) return showNotification(data.error, 'error');
            
            showNotification(data.message, 'success');
            document.getElementById('forgot-username').value = '';
            document.getElementById('forgot-new-password').value = '';
            updateAuthUI();
        } catch (error) {
            showNotification('Cannot connect to server.', 'error');
        }
    });
}

// Logout
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('auth_token');
    currentUsername = null;
    currentAccountNumber = null;
    switchView(dashboardView, landingView); // Go all the way back to landing page
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    showNotification('Logged out successfully', 'success');
    
    // Reset dashboard tabs
    navItems.forEach(item => item.classList.remove('active'));
    contentPanels.forEach(p => p.classList.remove('active', 'hidden'));
    navItems[0].classList.add('active');
    contentPanels.forEach(p => p.id !== 'panel-home' ? p.classList.add('hidden') : p.classList.add('active'));
});


// ------------------------------------
// Dashboard Logic
// ------------------------------------

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}
function updateBalanceUI(balance) {
    userDisplayName.textContent = currentUsername;
    accountBalance.textContent = formatCurrency(balance);
    
    // Update the new account details section
    const accNumEl = document.getElementById('display-account-number');
    if (accNumEl && currentAccountNumber) {
        accNumEl.textContent = currentAccountNumber;
    }
    
    // Update virtual card name
    const cardNameEl = document.getElementById('virtual-card-name');
    if (cardNameEl) {
        cardNameEl.textContent = currentUsername.toUpperCase();
    }
}

// Sidebar Navigation
navItems.forEach(btn => {
    btn.addEventListener('click', () => {
        navItems.forEach(item => item.classList.remove('active'));
        btn.classList.add('active');
        
        const targetId = btn.getAttribute('data-target');
        contentPanels.forEach(panel => {
            panel.classList.remove('active');
            panel.classList.add('hidden');
        });
        document.getElementById(targetId).classList.remove('hidden');
        document.getElementById(targetId).classList.add('active');

        if (targetId === 'panel-home') loadTransactions();
    });
});

// Helper to parse date robustly across SQLite and PostgreSQL
function parseAndFormatDate(timestamp, locale) {
    if (!timestamp) return '---';
    let dateStr = timestamp;
    if (typeof dateStr === 'string') {
        if (dateStr.includes(' ') && !dateStr.includes('T')) {
            dateStr = dateStr.replace(' ', 'T');
        }
        if (!dateStr.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(dateStr)) {
            dateStr += 'Z';
        }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Invalid Date' : (locale ? d.toLocaleString(locale) : d.toLocaleString());
}

async function loadTransactions() {
    if (!currentUsername) return;
    txList.innerHTML = '<div class="loading-text">Loading transactions...</div>';
    
    try {
        const res = await fetch(`/api/transactions?username=${currentUsername}`);
        const txs = await res.json();
        
        if (txs.length === 0) {
            txList.innerHTML = '<div class="loading-text">No transactions found.</div>';
            return;
        }

        txList.innerHTML = txs.map(tx => {
            const isDeposit = tx.type === 'deposit';
            const sign = isDeposit ? '+' : '-';
            const classColor = isDeposit ? 'positive' : 'negative';
            const iconClass = isDeposit ? 'deposit' : 'withdraw';
            const iconChar = isDeposit ? '↓' : '↑';
            const date = parseAndFormatDate(tx.timestamp);
            
            return `
                <div class="transaction-item">
                    <div class="tx-left">
                        <div class="tx-icon ${iconClass}">${iconChar}</div>
                        <div class="tx-info">
                            <h4>${tx.description}</h4>
                            <p>${date}</p>
                        </div>
                    </div>
                    <div class="tx-amount ${classColor}">${sign}${formatCurrency(tx.amount)}</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        txList.innerHTML = '<div class="loading-text">Failed to load transactions.</div>';
    }
}

// Deposit
document.getElementById('deposit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = document.getElementById('deposit-amount').value;
    try {
        const res = await fetch('/api/deposit', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUsername, amount: Number(amount) })
        });
        const data = await res.json();
        if (!res.ok) return showNotification(data.error, 'error');
        updateBalanceUI(data.balance);
        showNotification(data.message, 'success');
        document.getElementById('deposit-amount').value = '';
    } catch (e) { showNotification('Deposit failed', 'error'); }
});

// Withdraw
document.getElementById('withdraw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = document.getElementById('withdraw-amount').value;
    try {
        const res = await fetch('/api/withdraw', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUsername, amount: Number(amount) })
        });
        const data = await res.json();
        if (!res.ok) return showNotification(data.error, 'error');
        updateBalanceUI(data.balance);
        showNotification(data.message, 'success');
        document.getElementById('withdraw-amount').value = '';
    } catch (e) { showNotification('Withdrawal failed', 'error'); }
});

// Transfer
document.getElementById('transfer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const toAccount = document.getElementById('transfer-to').value.trim();
    const amount = document.getElementById('transfer-amount').value;
    try {
        const res = await fetch('/api/transfer', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromUser: currentUsername, toAccount, amount: Number(amount) })
        });
        const data = await res.json();
        if (!res.ok) return showNotification(data.error, 'error');
        updateBalanceUI(data.balance);
        showNotification(data.message, 'success');
        document.getElementById('transfer-to').value = '';
        document.getElementById('transfer-amount').value = '';
    } catch (e) { showNotification('Transfer failed', 'error'); }
});

// FAQ Accordion Logic
document.querySelectorAll('.faq-item').forEach(item => {
    item.addEventListener('click', () => {
        item.classList.toggle('active');
    });
});

// ------------------------------------
// Agent Authentication Logic
// ------------------------------------

const agentAuthView = document.getElementById('agent-auth-view');
const navAgentLoginBtn = document.getElementById('nav-agent-login-btn');
const agentBackToHomeBtn = document.getElementById('agent-back-to-home-btn');

const agentAuthForm = document.getElementById('agent-auth-form');
const agentForgotPasswordForm = document.getElementById('agent-forgot-password-form');
const agentShowForgotBtn = document.getElementById('agent-show-forgot-btn');
const agentBackToLoginBtn = document.getElementById('agent-back-to-login-btn');
const agentFormTitle = document.getElementById('agent-form-title');

if (navAgentLoginBtn) {
    navAgentLoginBtn.addEventListener('click', () => {
        if (agentFormTitle) agentFormTitle.textContent = 'Agent Portal Access';
        if (agentAuthForm) agentAuthForm.style.display = 'block';
        if (agentForgotPasswordForm) agentForgotPasswordForm.style.display = 'none';
        switchView(landingView, agentAuthView);
    });
}

if (agentBackToHomeBtn) {
    agentBackToHomeBtn.addEventListener('click', () => {
        switchView(agentAuthView, landingView);
    });
}

if (agentShowForgotBtn) {
    agentShowForgotBtn.addEventListener('click', () => {
        agentFormTitle.textContent = 'Reset Agent Password';
        agentAuthForm.style.display = 'none';
        agentForgotPasswordForm.style.display = 'block';
    });
}

if (agentBackToLoginBtn) {
    agentBackToLoginBtn.addEventListener('click', () => {
        agentFormTitle.textContent = 'Agent Portal Access';
        agentAuthForm.style.display = 'block';
        agentForgotPasswordForm.style.display = 'none';
    });
}

if (agentAuthForm) {
    agentAuthForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const agentCode = document.getElementById('agent-code').value.trim();
        const password = document.getElementById('agent-password').value;
        
        try {
            const response = await fetch('/api/agent-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentCode, password })
            });
            const data = await response.json();
            
            if (!response.ok) return showNotification(data.error, 'error');
            
            // Redirect to agent dashboard
            localStorage.setItem('agent_token', data.token);
            window.location.href = 'agent-dashboard.html';
        } catch (error) {
            showNotification('Cannot connect to server.', 'error');
        }
    });
}

if (agentForgotPasswordForm) {
    agentForgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const agentCode = document.getElementById('agent-forgot-code').value.trim();
        const newPassword = document.getElementById('agent-forgot-new-password').value;
        
        try {
            const response = await fetch('/api/agent-reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentCode, newPassword })
            });
            const data = await response.json();
            
            if (!response.ok) return showNotification(data.error, 'error');
            
            showNotification(data.message, 'success');
            document.getElementById('agent-forgot-code').value = '';
            document.getElementById('agent-forgot-new-password').value = '';
            agentBackToLoginBtn.click();
        } catch (error) {
            showNotification('Cannot connect to server.', 'error');
        }
    });
}

// Refresh Button Logic
const userRefreshBtn = document.getElementById('user-refresh-btn');
if (userRefreshBtn) {
    userRefreshBtn.addEventListener('click', () => {
        // Simple spin animation
        userRefreshBtn.style.transition = 'transform 0.4s ease';
        userRefreshBtn.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            userRefreshBtn.style.transition = 'none';
            userRefreshBtn.style.transform = 'none';
        }, 400);
        
        loadTransactions();
    });
}

// Session Persistence Logic
window.addEventListener('DOMContentLoaded', async () => {
    const agentToken = localStorage.getItem('agent_token');
    if (agentToken) {
        try {
            const res = await fetch('/api/agent-verify-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: agentToken })
            });
            if (res.ok) {
                window.location.href = 'agent-dashboard.html';
                return;
            } else {
                localStorage.removeItem('agent_token');
            }
        } catch(e) {}
    }

    const authToken = localStorage.getItem('auth_token');
    if (authToken) {
        try {
            const res = await fetch('/api/verify-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authToken })
            });
            const data = await res.json();
            if (res.ok) {
                currentUsername = data.username;
                currentAccountNumber = data.accountNumber;
                updateBalanceUI(data.balance);
                
                document.querySelectorAll('.view').forEach(v => {
                    v.classList.remove('active');
                    v.classList.add('hidden');
                });
                dashboardView.classList.remove('hidden');
                dashboardView.classList.add('active');
                
                loadTransactions();
            } else {
                localStorage.removeItem('auth_token');
            }
        } catch(e) {}
    }
});

// Footer Contact Form Submission Handler
const footerContactForm = document.getElementById('footer-contact-form');
const contactFormStatus = document.getElementById('contact-form-status');

if (footerContactForm) {
    footerContactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const message = document.getElementById('contact-message').value.trim();
        
        if (contactFormStatus) {
            contactFormStatus.textContent = "Sending...";
            contactFormStatus.style.color = "#cbd5e1";
        }
        
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, message })
            });
            const data = await res.json();
            
            if (res.ok) {
                if (contactFormStatus) {
                    contactFormStatus.textContent = "✅ Message sent successfully!";
                    contactFormStatus.style.color = "var(--success)";
                }
                // Clear fields
                document.getElementById('contact-name').value = '';
                document.getElementById('contact-email').value = '';
                document.getElementById('contact-message').value = '';
                
                // Clear success notification after 4 seconds
                setTimeout(() => {
                    if (contactFormStatus) contactFormStatus.textContent = '';
                }, 4000);
            } else {
                if (contactFormStatus) {
                    contactFormStatus.textContent = "❌ Something went wrong. Try again.";
                    contactFormStatus.style.color = "var(--error)";
                }
            }
        } catch (error) {
            if (contactFormStatus) {
                contactFormStatus.textContent = "❌ Cannot connect to server. Try again.";
                contactFormStatus.style.color = "var(--error)";
            }
        }
    });
}
