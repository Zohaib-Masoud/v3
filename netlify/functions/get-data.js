const { createClient } = require('@supabase/supabase-client');
const admin = require('firebase-admin');

// Initialize Firebase Admin for token validation
// Netlify functions use environment variables set in the Netlify Dashboard UI
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
        }),
    });
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async (event, context) => {
    // Handle options preflight
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, body: "OK" };
    }

    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Missing Auth Token' }) };
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        // 1. Verify the user token identity with Firebase
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userEmail = decodedToken.email;

        // 2. Parse client criteria
        const filters = event.body ? JSON.parse(event.body) : {};

        // 3. Query Supabase securely using our private server key
        let query = supabase.from('businesses').select('*');

        if (filters.region) {
            query = query.ilike('address', `%${filters.region}%`);
        }
        if (filters.hasEmail) {
            query = query.not('email', 'is', null);
        }
        if (filters.hasWebsite) {
            query = query.not('website', 'is', null);
        }

        // Limit maximum return rows to prevent massive batch downloads (Security requirement)
        // If user is a known Admin, you can choose to skip this limit constraint
        query = query.limit(100);

        const { data: leads, error } = await query;
        if (error) throw error;

        // Fetch distinct cities/regions from jobs to populate filter options cleanly
        const { data: jobLocations } = await supabase.from('jobs').select('city').distinct();
        const regions = jobLocations ? [...new Set(jobLocations.map(j => j.city))].filter(Boolean) : [];

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leads, regions })
        };

    } catch (err) {
        console.error('Security Validation Error:', err);
        return { statusCode: 403, body: JSON.stringify({ error: 'Access Denied / System Failure' }) };
    }
};