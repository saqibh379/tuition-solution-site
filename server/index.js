require('dotenv').config();

const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { MongoClient } = require('mongodb');

const { createDefaultForms } = require('./defaultForms');
const { ensureLmsSeedData, registerLmsRoutes } = require('./lms');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIRS = ['Assets', 'css', 'images', 'js'];
const SESSION_COOKIE = 'ts_admin_session';
const FORM_TYPES = new Set(['text', 'email', 'tel', 'number', 'date', 'textarea', 'select', 'radio', 'checkbox', 'file']);
const FORM_WIDTHS = new Set(['full', 'half']);
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_FALLBACK_URI = process.env.MONGODB_FALLBACK_URI || (process.env.NODE_ENV === 'production' ? '' : 'mongodb://127.0.0.1:27017/Tuition_Solution');
const DB_NAME = process.env.MONGODB_DB_NAME || extractDatabaseName(MONGODB_URI) || extractDatabaseName(MONGODB_FALLBACK_URI) || 'Tuition_Solution';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'change-this-secret-before-production';
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';

if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI. Create a local .env file from .env.example before starting the server.');
}

const app = express();
app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin))) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Vary', 'Origin');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    }

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    next();
});
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

function createMongoClient(uri) {
    return new MongoClient(uri, {
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 5000
    });
}

let activeMongoUri = MONGODB_URI;
let mongoClient = createMongoClient(activeMongoUri);

let database;

function extractDatabaseName(uri) {
    if (!uri) {
        return '';
    }

    const match = uri.match(/\/([^/?]+)(?:\?|$)/);
    return match && match[1] ? decodeURIComponent(match[1]) : '';
}

function collectMongoErrorCodes(error) {
    const codes = new Set();
    let current = error;

    while (current) {
        if (current.code) {
            codes.add(String(current.code));
        }
        current = current.cause;
    }

    return codes;
}

function shouldUseLocalMongoFallback(error) {
    if (!MONGODB_FALLBACK_URI || MONGODB_FALLBACK_URI === activeMongoUri) {
        return false;
    }

    const codes = collectMongoErrorCodes(error);
    return codes.has('EAI_AGAIN') || codes.has('ENOTFOUND') || codes.has('ETIMEDOUT') || codes.has('ECONNREFUSED');
}

function stripMongoId(doc) {
    if (!doc || typeof doc !== 'object') {
        return doc;
    }

    const { _id, ...rest } = doc;
    return rest;
}

function sanitizeText(value, maxLength) {
    return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function sanitizeBoolean(value, fallback) {
    if (typeof value === 'boolean') {
        return value;
    }

    if (value === 'true') {
        return true;
    }

    if (value === 'false') {
        return false;
    }

    return fallback;
}

function sanitizeStringArray(values, maxItems, maxItemLength) {
    if (!Array.isArray(values)) {
        return [];
    }

    return values
        .slice(0, maxItems)
        .map((item) => sanitizeText(item, maxItemLength))
        .filter(Boolean);
}

function sanitizeField(field) {
    const type = sanitizeText(field && field.type, 20);
    const width = sanitizeText(field && field.width, 10) || 'full';

    if (!FORM_TYPES.has(type)) {
        throw new Error('Unsupported field type: ' + type);
    }

    if (!FORM_WIDTHS.has(width)) {
        throw new Error('Unsupported field width: ' + width);
    }

    const label = sanitizeText(field && field.label, 120);
    if (!label) {
        throw new Error('Each field requires a label.');
    }

    return {
        label,
        type,
        placeholder: sanitizeText(field && field.placeholder, 200),
        required: sanitizeBoolean(field && field.required, false),
        width,
        options: sanitizeStringArray(field && field.options, 50, 120)
    };
}

function sanitizeForm(form, index) {
    const label = sanitizeText(form && form.name, 120);
    if (!label) {
        throw new Error('Form #' + (index + 1) + ' requires a name.');
    }

    const fields = Array.isArray(form && form.fields) ? form.fields.map(sanitizeField) : [];
    if (fields.length === 0) {
        throw new Error('Form "' + label + '" must include at least one field.');
    }

    return {
        id: sanitizeText(form && form.id, 80) || 'form_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11),
        name: label,
        description: sanitizeText(form && form.description, 240),
        icon: sanitizeText(form && form.icon, 80) || 'fas fa-file-alt',
        color: sanitizeText(form && form.color, 30) || 'primary',
        active: sanitizeBoolean(form && form.active, true),
        createdAt: sanitizeText(form && form.createdAt, 40) || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fields
    };
}

function sanitizeFormList(payload) {
    if (!Array.isArray(payload)) {
        throw new Error('Forms payload must be an array.');
    }

    return payload.map(sanitizeForm);
}

function sanitizeSubmissionData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Submission data must be an object.');
    }

    const entries = Object.entries(data).slice(0, 100);
    const clean = {};

    for (const [key, value] of entries) {
        const cleanKey = sanitizeText(key, 120);
        if (!cleanKey) {
            continue;
        }

        if (Array.isArray(value)) {
            clean[cleanKey] = sanitizeStringArray(value, 50, 240);
            continue;
        }

        clean[cleanKey] = sanitizeText(value, 500);
    }

    return clean;
}

function sanitizeSubmissionList(payload) {
    if (!Array.isArray(payload)) {
        throw new Error('Submissions payload must be an array.');
    }

    return payload.map((item) => ({
        formId: sanitizeText(item && item.formId, 80),
        formName: sanitizeText(item && item.formName, 120),
        data: sanitizeSubmissionData(item && item.data),
        submittedAt: sanitizeText(item && item.submittedAt, 40) || new Date().toISOString()
    }));
}

function sanitizeRegistrationSubmission(payload) {
    return {
        formId: sanitizeText(payload && payload.formId, 80),
        formName: sanitizeText(payload && payload.formName, 120),
        data: sanitizeSubmissionData(payload && payload.data),
        submittedAt: new Date().toISOString()
    };
}

function sanitizeAdmission(payload) {
    const record = {
        studentName: sanitizeText(payload && payload.studentName, 120),
        fatherName: sanitizeText(payload && payload.fatherName, 120),
        dob: sanitizeText(payload && payload.dob, 40),
        gender: sanitizeText(payload && payload.gender, 20),
        cnic: sanitizeText(payload && payload.cnic, 20),
        phone: sanitizeText(payload && payload.phone, 30),
        whatsapp: sanitizeText(payload && payload.whatsapp, 30),
        email: sanitizeText(payload && payload.email, 120),
        address: sanitizeText(payload && payload.address, 300),
        course: sanitizeText(payload && payload.course, 120),
        shift: sanitizeText(payload && payload.shift, 80),
        education: sanitizeText(payload && payload.education, 120),
        siblingDiscount: sanitizeText(payload && payload.siblingDiscount, 30),
        source: sanitizeText(payload && payload.source, 120),
        remarks: sanitizeText(payload && payload.remarks, 500),
        submittedAt: new Date().toISOString()
    };

    if (!record.studentName || !record.phone || !record.course || !record.education || !record.shift) {
        throw new Error('Admission submission is missing required fields.');
    }

    return record;
}

function sanitizeContactMessage(payload) {
    const record = {
        name: sanitizeText(payload && payload.name, 120),
        phone: sanitizeText(payload && payload.phone, 30),
        email: sanitizeText(payload && payload.email, 120),
        course: sanitizeText(payload && payload.course, 120),
        message: sanitizeText(payload && payload.message, 1000),
        submittedAt: new Date().toISOString()
    };

    if (!record.name || !record.phone || !record.course) {
        throw new Error('Contact submission is missing required fields.');
    }

    return record;
}

function createSignedSessionToken(username) {
    const payload = Buffer.from(JSON.stringify({ username, exp: Date.now() + 12 * 60 * 60 * 1000 }), 'utf8').toString('base64url');
    const signature = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('base64url');
    return payload + '.' + signature;
}

function parseSignedSessionToken(token) {
    if (!token || typeof token !== 'string') {
        return null;
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
        return null;
    }

    const payload = parts[0];
    const signature = parts[1];
    const expected = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('base64url');

    if (signature.length !== expected.length) {
        return null;
    }

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return null;
    }

    try {
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!decoded || decoded.exp < Date.now()) {
            return null;
        }
        return decoded;
    } catch {
        return null;
    }
}

function getSession(req) {
    return parseSignedSessionToken(req.cookies[SESSION_COOKIE]);
}

function requireAdmin(req, res, next) {
    if (!getSession(req)) {
        res.status(401).json({ message: 'Authentication required.' });
        return;
    }

    next();
}

function setSessionCookie(res, username) {
    res.cookie(SESSION_COOKIE, createSignedSessionToken(username), {
        httpOnly: true,
        sameSite: 'lax',
        secure: COOKIE_SECURE,
        path: '/',
        maxAge: 12 * 60 * 60 * 1000
    });
}

async function getDb() {
    if (!database) {
        try {
            await mongoClient.connect();
        } catch (error) {
            if (!shouldUseLocalMongoFallback(error)) {
                throw error;
            }

            activeMongoUri = MONGODB_FALLBACK_URI;
            mongoClient = createMongoClient(activeMongoUri);
            await mongoClient.connect();
            console.warn('Primary MongoDB connection failed. Falling back to local MongoDB for this local run.');
        }

        database = mongoClient.db(DB_NAME);
    }

    return database;
}

async function ensureSeedData() {
    const db = await getDb();
    const formsCollection = db.collection('forms');
    const totalForms = await formsCollection.countDocuments();

    if (totalForms === 0) {
        await formsCollection.insertMany(createDefaultForms());
    }
}

async function replaceCollection(name, documents) {
    const db = await getDb();
    const collection = db.collection(name);
    await collection.deleteMany({});

    if (documents.length > 0) {
        await collection.insertMany(documents);
    }
}

app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});

app.post('/api/admin/login', (req, res) => {
    const username = sanitizeText(req.body && req.body.username, 64);
    const password = sanitizeText(req.body && req.body.password, 128);

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        res.status(401).json({ message: 'Invalid username or password.' });
        return;
    }

    setSessionCookie(res, username);
    res.json({ authenticated: true });
});

app.get('/api/admin/session', (req, res) => {
    const session = getSession(req);
    res.json({ authenticated: Boolean(session) });
});

app.post('/api/admin/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ authenticated: false });
});

app.get('/api/forms', async (req, res, next) => {
    try {
        const db = await getDb();
        const wantsAll = req.query.all === 'true';
        const query = wantsAll && getSession(req) ? {} : { active: true };
        const forms = await db.collection('forms').find(query).sort({ createdAt: 1 }).toArray();
        res.json({ forms: forms.map(stripMongoId) });
    } catch (error) {
        next(error);
    }
});

app.put('/api/forms', requireAdmin, async (req, res, next) => {
    try {
        const forms = sanitizeFormList(Array.isArray(req.body) ? req.body : req.body.forms);
        await replaceCollection('forms', forms);
        res.json({ forms });
    } catch (error) {
        next(error);
    }
});

app.get('/api/submissions', requireAdmin, async (_req, res, next) => {
    try {
        const db = await getDb();
        const submissions = await db.collection('submissions').find({}).sort({ submittedAt: 1 }).toArray();
        res.json({ submissions: submissions.map(stripMongoId) });
    } catch (error) {
        next(error);
    }
});

app.put('/api/submissions', requireAdmin, async (req, res, next) => {
    try {
        const submissions = sanitizeSubmissionList(Array.isArray(req.body) ? req.body : req.body.submissions);
        await replaceCollection('submissions', submissions);
        res.json({ submissions });
    } catch (error) {
        next(error);
    }
});

app.post('/api/submissions', async (req, res, next) => {
    try {
        const submission = sanitizeRegistrationSubmission(req.body);
        const db = await getDb();
        await db.collection('submissions').insertOne(submission);
        res.status(201).json({ submission });
    } catch (error) {
        next(error);
    }
});

app.post('/api/admissions', async (req, res, next) => {
    try {
        const admission = sanitizeAdmission(req.body);
        const db = await getDb();
        await db.collection('admissions').insertOne(admission);
        res.status(201).json({ admission });
    } catch (error) {
        next(error);
    }
});

app.post('/api/contact-messages', async (req, res, next) => {
    try {
        const message = sanitizeContactMessage(req.body);
        const db = await getDb();
        await db.collection('contact_messages').insertOne(message);
        res.status(201).json({ message });
    } catch (error) {
        next(error);
    }
});

registerLmsRoutes(app, {
    getDb,
    cookieSecure: COOKIE_SECURE
});

for (const dirName of PUBLIC_DIRS) {
    app.use('/' + dirName, express.static(path.join(ROOT_DIR, dirName)));
}

app.get('/', (_req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.get('/:page', async (req, res, next) => {
    const page = req.params.page;
    if (!/^[a-z0-9-]+\.html$/i.test(page)) {
        next();
        return;
    }

    const filePath = path.join(ROOT_DIR, page);
    try {
        await fs.access(filePath);
        res.sendFile(filePath);
    } catch {
        next();
    }
});

app.use((req, res) => {
    res.status(404).json({ message: 'Not found.' });
});

app.use((error, _req, res, _next) => {
    const explicitStatus = Number(error && (error.status || error.statusCode));
    const status = explicitStatus >= 400 && explicitStatus < 600
        ? explicitStatus
        : error && /required|missing|unsupported|must|invalid|not found|not allowed|cannot/i.test(String(error.message)) ? 400 : 500;
    res.status(status).json({ message: error.message || 'Unexpected server error.' });
});

async function start() {
    await ensureSeedData();
    await ensureLmsSeedData(getDb);

    app.listen(PORT, () => {
        console.log('Tuition Solution server running on http://localhost:' + PORT);
    });
}

start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});