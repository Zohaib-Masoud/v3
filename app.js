import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// REPLACE WITH YOUR FIREBASE PROJECT CONFIGURATION
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Dom Elements
const authContainer = document.getElementById('auth-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const authError = document.getElementById('auth-error');
const userDisplayEmail = document.getElementById('user-display-email');
const logoutBtn = document.getElementById('logout-btn');
const leadsTbody = document.getElementById('leads-tbody');
const filterRegion = document.getElementById('filter-region');
const applyFiltersBtn = document.getElementById('apply-filters-btn');

let rawLeadsData = [];

// Track auth changes securely
onAuthStateChanged(auth, async (user) => {
    if (user) {
        authContainer.classList.add('hidden');
        dashboardContainer.classList.remove('hidden');
        userDisplayEmail.textContent = user.email;
        await initializeDashboard();
    } else {
        authContainer.classList.remove('hidden');
        dashboardContainer.classList.add('hidden');
    }
});

// Login Form Action
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        authError.textContent = error.message;
        authError.classList.remove('hidden');
    }
});

// Logout Button Action
logoutBtn.addEventListener('click', () => signOut(auth));

// Fetch Data via Secure Serverless Netlify Function Middleware
async function fetchSecureDashboardData(filters = {}) {
    const user = auth.currentUser;
    if (!user) return;

    // Get JWT ID token from Firebase to authenticate server request
    const token = await user.getIdToken();

    try {
        const response = await fetch('/.netlify/functions/get-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(filters)
        });

        if (!response.ok) throw new Error('Unauthorized or internal error');
        return await response.json();
    } catch (err) {
        console.error(err);
        leadsTbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:red">Failed to authenticate access layer query.</td></tr>`;
    }
}

async function initializeDashboard() {
    leadsTbody.innerHTML = `<tr><td colspan="7" class="text-center">Fetching records...</td></tr>`;
    const data = await fetchSecureDashboardData();
    if (!data) return;

    rawLeadsData = data.leads || [];
    
    // Populate dropdown with unique regions/cities dynamically
    const regions = data.regions || [];
    filterRegion.innerHTML = '<option value="">All Regions</option>' + 
        regions.map(r => `<option value="${r}">${r}</option>`).join('');

    renderTable(rawLeadsData);
}

function renderTable(leads) {
    if (leads.length === 0) {
        leadsTbody.innerHTML = `<tr><td colspan="7" class="text-center">No matching leads located.</td></tr>`;
        return;
    }

    leadsTbody.innerHTML = leads.map(lead => `
        <tr>
            <td><strong>${lead.business_name || 'N/A'}</strong></td>
            <td>${lead.category || 'N/A'}</td>
            <td>${lead.phone || 'N/A'}</td>
            <td>${lead.email || 'N/A'}</td>
            <td>${lead.website ? `<a href="${lead.website}" target="_blank">Link</a>` : 'N/A'}</td>
            <td>⭐ ${lead.rating || '0'} (${lead.review_count || 0})</td>
            <td><button class="secondary-btn" onclick="navigator.clipboard.writeText('${lead.phone || ''}')">Copy Phone</button></td>
        </tr>
    `).join('');
}

// Client Side Filter Execution
applyFiltersBtn.addEventListener('click', async () => {
    const filters = {
        region: filterRegion.value,
        tile: document.getElementById('filter-tile').value.trim(),
        hasEmail: document.getElementById('filter-email').checked,
        hasWebsite: document.getElementById('filter-website').checked
    };
    
    leadsTbody.innerHTML = `<tr><td colspan="7" class="text-center">Applying backend filters...</td></tr>`;
    const data = await fetchSecureDashboardData(filters);
    if (data) renderTable(data.leads || []);
});