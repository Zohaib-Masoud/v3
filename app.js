import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

// Your verified Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyANWgxLrNSdCpuwK6FV3JuaCVEqp7XDT24",
    authDomain: "data-bank-on.firebaseapp.com",
    projectId: "data-bank-on",
    storageBucket: "data-bank-on.firebasestorage.app",
    messagingSenderId: "1093372768449",
    appId: "1:1093372768449:web:130cf82cdb749216212440",
    measurementId: "G-D7TRDG2WPP"
};

// Initialize Firebase and Auth services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// DOM Elements
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

// Monitor authentication state shifts
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

// Login Execution Pipeline
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

// Terminate User Session
logoutBtn.addEventListener('click', () => signOut(auth));

// Handle Secure Tokens and Fetch Remote Records via Netlify Backend
async function fetchSecureDashboardData(filters = {}) {
    const user = auth.currentUser;
    if (!user) return;

    // Retrieve temporary JWT token to validate request on the backend function
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

        if (!response.ok) throw new Error('Unauthorized API response payload');
        return await response.json();
    } catch (err) {
        console.error(err);
        leadsTbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--error)">Security handoff error. Check backend server logs.</td></tr>`;
    }
}

async function initializeDashboard() {
    leadsTbody.innerHTML = `<tr><td colspan="7" class="text-center">Decompressing data streams...</td></tr>`;
    const data = await fetchSecureDashboardData();
    if (!data) return;

    rawLeadsData = data.leads || [];
    
    // Dynamically rebuild region menu from structural database items
    const regions = data.regions || [];
    filterRegion.innerHTML = '<option value="">All Regions</option>' + 
        regions.map(r => `<option value="${r}">${r}</option>`).join('');

    renderTable(rawLeadsData);
}

function renderTable(leads) {
    if (leads.length === 0) {
        leadsTbody.innerHTML = `<tr><td colspan="7" class="text-center">No structural leads matching criteria found.</td></tr>`;
        return;
    }

    leadsTbody.innerHTML = leads.map(lead => `
        <tr>
            <td><strong>${lead.business_name || 'N/A'}</strong></td>
            <td>${lead.category || 'N/A'}</td>
            <td>${lead.phone || 'N/A'}</td>
            <td>${lead.email || 'N/A'}</td>
            <td>${lead.website ? `<a href="${lead.website}" target="_blank" rel="noopener">Link</a>` : 'N/A'}</td>
            <td>⭐ ${lead.rating || '0'} (${lead.review_count || 0})</td>
            <td><button class="secondary-btn" onclick="navigator.clipboard.writeText('${lead.phone || ''}')">Copy Phone</button></td>
        </tr>
    `).join('');
}

// Trigger Client Filters 
applyFiltersBtn.addEventListener('click', async () => {
    const filters = {
        region: filterRegion.value,
        tile: document.getElementById('filter-tile').value.trim(),
        hasEmail: document.getElementById('filter-email').checked,
        hasWebsite: document.getElementById('filter-website').checked
    };
    
    leadsTbody.innerHTML = `<tr><td colspan="7" class="text-center">Filtering rows on server tier...</td></tr>`;
    const data = await fetchSecureDashboardData(filters);
    if (data) renderTable(data.leads || []);
});