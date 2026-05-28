const crypto = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(crypto.scrypt);

const LMS_SESSION_COOKIE = 'ts_lms_session';
const LMS_SESSION_SECRET = process.env.LMS_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || 'change-this-lms-secret-before-production';
const LMS_SUPER_ADMIN_USERNAME = process.env.LMS_SUPER_ADMIN_USERNAME || process.env.ADMIN_USERNAME || 'admin';
const LMS_SUPER_ADMIN_PASSWORD = process.env.LMS_SUPER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'admin123';
const LMS_SUPER_ADMIN_NAME = process.env.LMS_SUPER_ADMIN_NAME || 'Super Admin';
const LMS_SUPER_ADMIN_EMAIL = process.env.LMS_SUPER_ADMIN_EMAIL || 'admin@tuitionsol.com';

const LMS_ROLES = new Set(['super_admin', 'teacher', 'student']);
const ATTENDANCE_STATUSES = new Set(['present', 'absent', 'late', 'excused']);
const MARK_TYPES = new Set(['assignment', 'quiz', 'exam', 'project', 'other']);
const REPORT_MARK_TYPES = new Set(['assignment', 'quiz', 'exam', 'project']);
const MARK_SOURCE_TYPES = new Set(['assignment', 'quiz', 'manual']);

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

function sanitizeNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeDate(value) {
    const clean = sanitizeText(value, 40);
    return clean || new Date().toISOString();
}

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function normalizeReportMonth(value) {
    const clean = sanitizeText(value, 40);
    const date = clean ? new Date(clean) : new Date();

    if (Number.isNaN(date.getTime())) {
        throw new Error('Invalid report month.');
    }

    return String(date.getUTCFullYear()) + '-' + String(date.getUTCMonth() + 1).padStart(2, '0');
}

function formatReportMonthLabel(reportMonth) {
    const clean = sanitizeText(reportMonth, 7);
    const parts = clean.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return clean;
    }

    return new Intl.DateTimeFormat('en-PK', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function isReportEligibleType(type) {
    return REPORT_MARK_TYPES.has(sanitizeText(type, 20).toLowerCase());
}

function getDefaultMarkSourceType(type) {
    const cleanType = sanitizeText(type, 20).toLowerCase();

    if (cleanType === 'assignment') {
        return 'assignment';
    }

    if (cleanType === 'quiz') {
        return 'quiz';
    }

    return 'manual';
}

function sanitizeUsername(value) {
    return sanitizeText(value, 40)
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '')
        .slice(0, 40);
}

function sanitizeRole(value) {
    const role = sanitizeText(value, 30).toLowerCase();
    if (!LMS_ROLES.has(role)) {
        throw new Error('Invalid LMS role.');
    }
    return role;
}

function sanitizeIdList(values, maxItems) {
    if (!Array.isArray(values)) {
        return [];
    }

    return Array.from(new Set(values
        .slice(0, maxItems)
        .map((value) => sanitizeText(value, 80))
        .filter(Boolean)));
}

function createEntityId(prefix) {
    return prefix + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

function stripMongoId(doc) {
    if (!doc || typeof doc !== 'object') {
        return doc;
    }

    const { _id, ...rest } = doc;
    return rest;
}

function sanitizeUserSummary(user) {
    return {
        id: sanitizeText(user && user.id, 80),
        fullName: sanitizeText(user && user.fullName, 120),
        username: sanitizeText(user && user.username, 40),
        role: sanitizeText(user && user.role, 30),
        email: sanitizeText(user && user.email, 120),
        phone: sanitizeText(user && user.phone, 40),
        active: sanitizeBoolean(user && user.active, true),
        mustChangePassword: sanitizeBoolean(user && user.mustChangePassword, false),
        passwordChangeReason: sanitizeText(user && user.passwordChangeReason, 40),
        createdAt: sanitizeText(user && user.createdAt, 40),
        updatedAt: sanitizeText(user && user.updatedAt, 40)
    };
}

async function hashPassword(password) {
    const cleanPassword = sanitizeText(password, 128);
    if (cleanPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = await scryptAsync(cleanPassword, salt, 64);
    return salt + ':' + Buffer.from(derivedKey).toString('hex');
}

async function verifyPassword(password, storedHash) {
    if (!storedHash || typeof storedHash !== 'string') {
        return false;
    }

    const parts = storedHash.split(':');
    if (parts.length !== 2) {
        return false;
    }

    const salt = parts[0];
    const originalHash = Buffer.from(parts[1], 'hex');
    const derivedKey = Buffer.from(await scryptAsync(sanitizeText(password, 128), salt, 64));

    if (derivedKey.length !== originalHash.length) {
        return false;
    }

    return crypto.timingSafeEqual(derivedKey, originalHash);
}

function generateTemporaryPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = 'TS-';

    for (let index = 0; index < 8; index += 1) {
        password += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }

    return password;
}

function createSignedToken(payload, secret) {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 12 * 60 * 60 * 1000 }), 'utf8').toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return body + '.' + signature;
}

function parseSignedToken(token, secret) {
    if (!token || typeof token !== 'string') {
        return null;
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
        return null;
    }

    const body = parts[0];
    const signature = parts[1];
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');

    if (signature.length !== expected.length) {
        return null;
    }

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return null;
    }

    try {
        const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!decoded || decoded.exp < Date.now()) {
            return null;
        }

        return decoded;
    } catch {
        return null;
    }
}

function getLmsSession(req) {
    return parseSignedToken(req.cookies[LMS_SESSION_COOKIE], LMS_SESSION_SECRET);
}

function setLmsSessionCookie(res, user, cookieSecure) {
    res.cookie(LMS_SESSION_COOKIE, createSignedToken({ userId: user.id, username: user.username, role: user.role }, LMS_SESSION_SECRET), {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieSecure,
        path: '/',
        maxAge: 12 * 60 * 60 * 1000
    });
}

function clearLmsSessionCookie(res) {
    res.clearCookie(LMS_SESSION_COOKIE, { path: '/' });
}

function requireLmsAuth(req, res, next) {
    const session = req.lmsSession || getLmsSession(req);
    if (!session) {
        res.status(401).json({ message: 'LMS authentication required.' });
        return;
    }

    req.lmsSession = session;
    next();
}

function requireLmsRole() {
    const allowedRoles = Array.from(arguments);

    return (req, res, next) => {
        const session = req.lmsSession || getLmsSession(req);
        if (!session) {
            res.status(401).json({ message: 'LMS authentication required.' });
            return;
        }

        if (!allowedRoles.includes(session.role)) {
            res.status(403).json({ message: 'You do not have access to this LMS action.' });
            return;
        }

        req.lmsSession = session;
        next();
    };
}

function sanitizeUserCreate(payload) {
    const role = sanitizeRole(payload && payload.role);
    const username = sanitizeUsername(payload && payload.username);
    const password = sanitizeText(payload && payload.password, 128);

    if (!username) {
        throw new Error('Username is required.');
    }

    if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
    }

    return {
        id: createEntityId(role === 'teacher' ? 'teacher' : role === 'student' ? 'student' : 'admin'),
        fullName: sanitizeText(payload && payload.fullName, 120),
        username,
        role,
        email: sanitizeText(payload && payload.email, 120),
        phone: sanitizeText(payload && payload.phone, 40),
        active: sanitizeBoolean(payload && payload.active, true),
        notes: sanitizeText(payload && payload.notes, 400),
        password,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

function sanitizeUserUpdate(payload) {
    const update = {
        fullName: sanitizeText(payload && payload.fullName, 120),
        email: sanitizeText(payload && payload.email, 120),
        phone: sanitizeText(payload && payload.phone, 40),
        notes: sanitizeText(payload && payload.notes, 400),
        active: sanitizeBoolean(payload && payload.active, true),
        updatedAt: new Date().toISOString()
    };

    const username = sanitizeUsername(payload && payload.username);
    if (username) {
        update.username = username;
    }

    const password = sanitizeText(payload && payload.password, 128);
    if (password) {
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters long.');
        }
        update.password = password;
    }

    return update;
}

function sanitizeClassPayload(payload) {
    const name = sanitizeText(payload && payload.name, 120);
    const code = sanitizeText(payload && payload.code, 40).toUpperCase();

    if (!name) {
        throw new Error('Class name is required.');
    }

    return {
        name,
        code,
        subject: sanitizeText(payload && payload.subject, 120),
        schedule: sanitizeText(payload && payload.schedule, 160),
        room: sanitizeText(payload && payload.room, 80),
        description: sanitizeText(payload && payload.description, 400),
        teacherIds: sanitizeIdList(payload && payload.teacherIds, 10),
        studentIds: sanitizeIdList(payload && payload.studentIds, 300),
        active: sanitizeBoolean(payload && payload.active, true),
        updatedAt: new Date().toISOString()
    };
}

function sanitizeAssignmentPayload(payload) {
    const title = sanitizeText(payload && payload.title, 120);

    if (!title) {
        throw new Error('Assignment title is required.');
    }

    return {
        id: sanitizeText(payload && payload.id, 80) || createEntityId('assignment'),
        title,
        description: sanitizeText(payload && payload.description, 1000),
        dueDate: sanitizeDate(payload && payload.dueDate),
        resourceLink: sanitizeText(payload && payload.resourceLink, 240),
        updatedAt: new Date().toISOString(),
        createdAt: sanitizeDate(payload && payload.createdAt)
    };
}

function sanitizeQuizPayload(payload) {
    const title = sanitizeText(payload && payload.title, 120);
    const totalMarks = sanitizeNumber(payload && payload.totalMarks, 0);

    if (!title) {
        throw new Error('Quiz title is required.');
    }

    if (totalMarks <= 0) {
        throw new Error('Quiz total marks must be greater than 0.');
    }

    return {
        id: sanitizeText(payload && payload.id, 80) || createEntityId('quiz'),
        title,
        description: sanitizeText(payload && payload.description, 1000),
        scheduledFor: sanitizeDate(payload && payload.scheduledFor),
        totalMarks,
        updatedAt: new Date().toISOString(),
        createdAt: sanitizeDate(payload && payload.createdAt)
    };
}

function sanitizeAttendancePayload(payload) {
    const date = sanitizeText(payload && payload.date, 20);
    if (!date) {
        throw new Error('Attendance date is required.');
    }

    if (!Array.isArray(payload && payload.entries) || payload.entries.length === 0) {
        throw new Error('Attendance entries are required.');
    }

    return {
        date,
        entries: payload.entries.slice(0, 300).map((entry) => {
            const studentId = sanitizeText(entry && entry.studentId, 80);
            const status = sanitizeText(entry && entry.status, 20).toLowerCase();

            if (!studentId || !ATTENDANCE_STATUSES.has(status)) {
                throw new Error('Attendance entries must include valid students and statuses.');
            }

            return {
                studentId,
                status,
                remarks: sanitizeText(entry && entry.remarks, 240)
            };
        }),
        updatedAt: new Date().toISOString()
    };
}

function sanitizeMarkPayload(payload) {
    const studentId = sanitizeText(payload && payload.studentId, 80);
    const title = sanitizeText(payload && payload.title, 120);
    const type = sanitizeText(payload && payload.type, 20).toLowerCase() || 'other';
    const score = sanitizeNumber(payload && payload.score, NaN);
    const totalMarks = sanitizeNumber(payload && payload.totalMarks, NaN);
    const sourceType = sanitizeText(payload && payload.sourceType, 20).toLowerCase();

    if (!studentId || !title || !MARK_TYPES.has(type) || !Number.isFinite(score) || !Number.isFinite(totalMarks) || totalMarks <= 0) {
        throw new Error('Mark entry requires student, title, type, score, and total marks.');
    }

    if (sourceType && !MARK_SOURCE_TYPES.has(sourceType)) {
        throw new Error('Unsupported mark source type.');
    }

    if (score < 0 || score > totalMarks) {
        throw new Error('Mark score must be between 0 and total marks.');
    }

    return {
        id: sanitizeText(payload && payload.id, 80) || createEntityId('mark'),
        studentId,
        title,
        type,
        score,
        totalMarks,
        notes: sanitizeText(payload && payload.notes, 400),
        recordedAt: sanitizeDate(payload && payload.recordedAt),
        sourceId: sanitizeText(payload && payload.sourceId, 80),
        sourceType: sourceType || getDefaultMarkSourceType(type),
        updatedAt: new Date().toISOString(),
        createdAt: sanitizeDate(payload && payload.createdAt)
    };
}

function sanitizeMonthlyReportUpdate(payload) {
    return {
        active: sanitizeBoolean(payload && payload.active, true),
        hidden: sanitizeBoolean(payload && payload.hidden, false),
        announcementTitle: sanitizeText(payload && payload.announcementTitle, 180),
        announcementSummary: sanitizeText(payload && payload.announcementSummary, 1000),
        restore: sanitizeBoolean(payload && payload.restore, false),
        updatedAt: new Date().toISOString()
    };
}

async function ensureUniqueUsername(usersCollection, username, existingId) {
    const existing = await usersCollection.findOne(existingId ? { username, id: { $ne: existingId } } : { username });
    if (existing) {
        throw new Error('Username already exists.');
    }
}

async function ensureUsersHaveRole(db, ids, role) {
    if (!ids.length) {
        return [];
    }

    const users = await db.collection('lms_users').find({ id: { $in: ids }, role, active: true }).toArray();
    if (users.length !== ids.length) {
        throw new Error('One or more assigned users are missing or inactive.');
    }

    return users;
}

async function hydrateClass(db, classDoc) {
    const cleanClass = stripMongoId(classDoc);
    const relatedUserIds = Array.from(new Set([...(cleanClass.teacherIds || []), ...(cleanClass.studentIds || [])]));
    const users = relatedUserIds.length === 0
        ? []
        : await db.collection('lms_users').find({ id: { $in: relatedUserIds } }).toArray();
    const userMap = new Map(users.map((user) => [user.id, sanitizeUserSummary(user)]));

    return {
        ...cleanClass,
        teachers: (cleanClass.teacherIds || []).map((id) => userMap.get(id)).filter(Boolean),
        students: (cleanClass.studentIds || []).map((id) => userMap.get(id)).filter(Boolean)
    };
}

function summarizeAttendance(records, studentId) {
    const summary = { present: 0, absent: 0, late: 0, excused: 0, total: 0, percentage: 0 };

    records.forEach((record) => {
        const entry = Array.isArray(record.entries) ? record.entries.find((item) => item.studentId === studentId) : null;
        if (!entry) {
            return;
        }

        if (summary[entry.status] != null) {
            summary[entry.status] += 1;
        }
        summary.total += 1;
    });

    if (summary.total > 0) {
        summary.percentage = Math.round(((summary.present + summary.late) / summary.total) * 100);
    }

    return summary;
}

function summarizeMarks(records) {
    if (!records.length) {
        return { averagePercentage: 0, totalEntries: 0 };
    }

    const totalPercentage = records.reduce((acc, record) => acc + ((record.score / record.totalMarks) * 100), 0);
    return {
        averagePercentage: Math.round(totalPercentage / records.length),
        totalEntries: records.length
    };
}

function buildReportAnnouncementSummary(classRecord, monthLabel, rankings) {
    if (!rankings.length) {
        return 'Monthly report for ' + (classRecord && classRecord.name ? classRecord.name : 'this class') + ' in ' + monthLabel + '.';
    }

    const topStudent = rankings[0];
    const topThree = rankings.slice(0, 3).map((item) => item.fullName || item.username).filter(Boolean);

    return (classRecord && classRecord.name ? classRecord.name : 'Class')
        + ' monthly report for '
        + monthLabel
        + '. Top performer: '
        + (topStudent.fullName || topStudent.username || 'Student')
        + ' ('
        + String(topStudent.averagePercentage || 0)
        + '%). '
        + (topThree.length > 1 ? 'Top students: ' + topThree.join(', ') + '.' : 'Results are now available.');
}

async function backfillLegacyLmsMarks(db) {
    const marksCollection = db.collection('lms_marks');
    const cursor = marksCollection.find({
        $or: [
            { reportMonth: { $exists: false } },
            { status: { $exists: false } },
            { sourceType: { $exists: false } },
            { sourceId: { $exists: false } },
            { teacherName: { $exists: false } }
        ]
    });

    while (await cursor.hasNext()) {
        const mark = await cursor.next();
        const status = sanitizeText(mark && mark.status, 20).toLowerCase() === 'posted' ? 'posted' : 'draft';
        const reportMonth = mark && mark.reportMonth ? sanitizeText(mark.reportMonth, 7) : normalizeReportMonth(mark && (mark.recordedAt || mark.updatedAt || mark.createdAt));
        const sourceType = mark && MARK_SOURCE_TYPES.has(mark.sourceType) ? mark.sourceType : getDefaultMarkSourceType(mark && mark.type);
        const update = {
            reportMonth,
            status,
            sourceType,
            sourceId: sanitizeText(mark && mark.sourceId, 80),
            teacherName: sanitizeText(mark && mark.teacherName, 120),
            postedAt: status === 'posted' ? sanitizeText(mark && (mark.postedAt || mark.updatedAt || mark.recordedAt), 40) : '',
            postedById: status === 'posted' ? sanitizeText(mark && mark.postedById, 80) : '',
            postedByRole: status === 'posted' ? sanitizeText(mark && mark.postedByRole, 30) : '',
            postedByName: status === 'posted' ? sanitizeText(mark && mark.postedByName, 120) : ''
        };

        await marksCollection.updateOne({ id: mark.id }, { $set: update });
    }
}

async function ensureLmsSeedData(getDb) {
    const db = await getDb();

    await Promise.all([
        db.collection('lms_users').createIndex({ id: 1 }, { unique: true }),
        db.collection('lms_users').createIndex({ username: 1 }, { unique: true }),
        db.collection('lms_password_reset_requests').createIndex({ id: 1 }, { unique: true }),
        db.collection('lms_password_reset_requests').createIndex({ userId: 1, status: 1, requestedAt: -1 }),
        db.collection('lms_classes').createIndex({ id: 1 }, { unique: true }),
        db.collection('lms_classes').createIndex({ teacherIds: 1 }),
        db.collection('lms_classes').createIndex({ studentIds: 1 }),
        db.collection('lms_assignments').createIndex({ id: 1 }, { unique: true }),
        db.collection('lms_assignments').createIndex({ classId: 1, dueDate: 1 }),
        db.collection('lms_quizzes').createIndex({ id: 1 }, { unique: true }),
        db.collection('lms_quizzes').createIndex({ classId: 1, scheduledFor: 1 }),
        db.collection('lms_attendance').createIndex({ classId: 1, date: 1 }, { unique: true }),
        db.collection('lms_marks').createIndex({ id: 1 }, { unique: true }),
        db.collection('lms_marks').createIndex({ classId: 1, studentId: 1 }),
        db.collection('lms_marks').createIndex({ classId: 1, reportMonth: 1, status: 1 }),
        db.collection('lms_marks').createIndex({ classId: 1, sourceType: 1, sourceId: 1, studentId: 1 }),
        db.collection('lms_monthly_reports').createIndex({ id: 1 }, { unique: true }),
        db.collection('lms_monthly_reports').createIndex({ classId: 1, reportMonth: 1 }, { unique: true }),
        db.collection('lms_monthly_reports').createIndex({ active: 1, hidden: 1, deletedAt: 1, reportMonth: -1 })
    ]);

    await backfillLegacyLmsMarks(db);

    const usersCollection = db.collection('lms_users');
    const existingAdmin = await usersCollection.findOne({ role: 'super_admin' });
    const passwordHash = await hashPassword(LMS_SUPER_ADMIN_PASSWORD);
    const now = new Date().toISOString();
    const seededAdmin = {
        fullName: LMS_SUPER_ADMIN_NAME,
        username: sanitizeUsername(LMS_SUPER_ADMIN_USERNAME),
        role: 'super_admin',
        email: sanitizeText(LMS_SUPER_ADMIN_EMAIL, 120),
        phone: '',
        notes: 'Seeded from environment variables.',
        active: true,
        mustChangePassword: false,
        passwordChangeReason: '',
        passwordHash,
        updatedAt: now
    };

    if (!existingAdmin) {
        await usersCollection.insertOne({
            id: createEntityId('admin'),
            ...seededAdmin,
            createdAt: now
        });
        return;
    }

    await usersCollection.updateOne({ id: existingAdmin.id }, {
        $set: seededAdmin,
        $setOnInsert: { createdAt: existingAdmin.createdAt || now }
    });
}

function registerLmsRoutes(app, options) {
    const getDb = options.getDb;
    const cookieSecure = Boolean(options.cookieSecure);

    async function fetchCurrentLmsUser(req, res) {
        const session = getLmsSession(req);
        if (!session) {
            return null;
        }

        const db = await getDb();
        const user = await db.collection('lms_users').findOne({ id: session.userId, active: true });

        if (!user) {
            if (res) {
                clearLmsSessionCookie(res);
            }
            return null;
        }

        req.lmsSession = {
            userId: user.id,
            username: user.username,
            role: user.role
        };

        if (res && (session.role !== user.role || session.username !== user.username)) {
            setLmsSessionCookie(res, user, cookieSecure);
        }

        return user;
    }

    app.use('/api/lms', async (req, res, next) => {
        try {
            if (req.path.startsWith('/auth/')) {
                next();
                return;
            }

            const session = getLmsSession(req);
            if (!session) {
                next();
                return;
            }

            const user = await fetchCurrentLmsUser(req, res);

            if (!user) {
                next();
                return;
            }

            if (user && user.mustChangePassword) {
                res.status(403).json({
                    message: 'Password change required before continuing.',
                    requiresPasswordChange: true,
                    user: sanitizeUserSummary(user)
                });
                return;
            }

            next();
        } catch (error) {
            next(error);
        }
    });

    async function assertTeacherClassAccess(db, teacherId, classId) {
        const classRecord = await db.collection('lms_classes').findOne({ id: classId, teacherIds: teacherId, active: true });
        if (!classRecord) {
            throw new Error('Class not found or not assigned to this teacher.');
        }

        return classRecord;
    }

    async function assertStudentClassAccess(db, studentId, classId) {
        const classRecord = await db.collection('lms_classes').findOne({ id: classId, studentIds: studentId, active: true });
        if (!classRecord) {
            throw new Error('Class not found or not assigned to this student.');
        }

        return classRecord;
    }

    async function getManageableClass(db, session, classId) {
        if (session.role === 'super_admin') {
            const classRecord = await db.collection('lms_classes').findOne({ id: classId });
            if (!classRecord) {
                throw new Error('Class not found.');
            }

            return classRecord;
        }

        if (session.role === 'teacher') {
            return assertTeacherClassAccess(db, session.userId, classId);
        }

        throw new Error('Class not found or not assigned to this user.');
    }

    function getSessionActorName(session) {
        return sanitizeText(session && session.username, 120) || 'system';
    }

    function getMarkStatus(mark) {
        return sanitizeText(mark && mark.status, 20).toLowerCase() === 'posted' ? 'posted' : 'draft';
    }

    function getMarkReportMonth(mark) {
        return mark && mark.reportMonth ? sanitizeText(mark.reportMonth, 7) : normalizeReportMonth(mark && (mark.recordedAt || mark.updatedAt || mark.createdAt));
    }

    function isMonthlyReportDeleted(report) {
        return Boolean(report && sanitizeText(report.deletedAt, 40));
    }

    async function getMonthlyReportByClassMonth(db, classId, reportMonth) {
        return db.collection('lms_monthly_reports').findOne({ classId, reportMonth });
    }

    async function buildMonthlyReportSnapshot(db, classRecord, reportMonth) {
        const hydratedClass = await hydrateClass(db, classRecord);
        const eligibleMarks = await db.collection('lms_marks').find({
            classId: classRecord.id,
            reportMonth,
            status: 'posted',
            type: { $in: Array.from(REPORT_MARK_TYPES) }
        }).sort({ recordedAt: -1, title: 1 }).toArray();

        const studentMap = new Map((hydratedClass.students || []).map((student) => [student.id, student]));
        const rankingMap = new Map();
        const marksByType = {};

        eligibleMarks.forEach((markDoc) => {
            const student = studentMap.get(markDoc.studentId);
            if (!student) {
                return;
            }

            const percentage = markDoc.totalMarks > 0 ? (markDoc.score / markDoc.totalMarks) * 100 : 0;
            const existing = rankingMap.get(markDoc.studentId) || {
                studentId: markDoc.studentId,
                fullName: student.fullName || '',
                username: student.username || '',
                obtainedMarks: 0,
                possibleMarks: 0,
                totalPercentage: 0,
                entriesCount: 0
            };

            existing.obtainedMarks += markDoc.score;
            existing.possibleMarks += markDoc.totalMarks;
            existing.totalPercentage += percentage;
            existing.entriesCount += 1;
            rankingMap.set(markDoc.studentId, existing);

            marksByType[markDoc.type] = (marksByType[markDoc.type] || 0) + 1;
        });

        const rankings = Array.from(rankingMap.values())
            .map((item) => ({
                studentId: item.studentId,
                fullName: item.fullName,
                username: item.username,
                obtainedMarks: item.obtainedMarks,
                possibleMarks: item.possibleMarks,
                entriesCount: item.entriesCount,
                averagePercentage: item.entriesCount ? Math.round(item.totalPercentage / item.entriesCount) : 0
            }))
            .sort((left, right) => {
                if (right.averagePercentage !== left.averagePercentage) {
                    return right.averagePercentage - left.averagePercentage;
                }

                if (right.obtainedMarks !== left.obtainedMarks) {
                    return right.obtainedMarks - left.obtainedMarks;
                }

                return (left.fullName || left.username || '').localeCompare(right.fullName || right.username || '');
            })
            .map((item, index) => ({ ...item, rank: index + 1 }));

        const overallAverage = rankings.length
            ? Math.round(rankings.reduce((acc, item) => acc + item.averagePercentage, 0) / rankings.length)
            : 0;

        return {
            reportMonth,
            monthLabel: formatReportMonthLabel(reportMonth),
            topStudent: rankings[0] || null,
            rankings,
            summary: {
                classId: classRecord.id,
                className: sanitizeText(classRecord && classRecord.name, 120),
                classCode: sanitizeText(classRecord && classRecord.code, 40),
                classSubject: sanitizeText(classRecord && classRecord.subject, 120),
                studentsCount: rankings.length,
                postedMarksCount: eligibleMarks.length,
                averagePercentage: overallAverage,
                marksByType
            }
        };
    }

    async function upsertMonthlyReport(db, classRecord, reportMonth, metadata) {
        const reportsCollection = db.collection('lms_monthly_reports');
        const existing = await reportsCollection.findOne({ classId: classRecord.id, reportMonth });
        const snapshot = await buildMonthlyReportSnapshot(db, classRecord, reportMonth);
        const now = new Date().toISOString();
        const document = {
            ...(existing ? stripMongoId(existing) : {}),
            id: existing && existing.id ? existing.id : createEntityId('report'),
            classId: classRecord.id,
            className: sanitizeText(classRecord && classRecord.name, 120),
            classCode: sanitizeText(classRecord && classRecord.code, 40),
            classSubject: sanitizeText(classRecord && classRecord.subject, 120),
            reportMonth,
            monthLabel: snapshot.monthLabel,
            topStudent: snapshot.topStudent,
            rankings: snapshot.rankings,
            summary: snapshot.summary,
            active: existing ? sanitizeBoolean(existing.active, true) : true,
            hidden: existing ? sanitizeBoolean(existing.hidden, false) : false,
            deletedAt: existing && existing.deletedAt ? existing.deletedAt : '',
            postedAt: metadata && metadata.postedAt ? metadata.postedAt : existing && existing.postedAt ? existing.postedAt : now,
            postedById: metadata && metadata.postedById ? metadata.postedById : existing && existing.postedById ? existing.postedById : '',
            postedByRole: metadata && metadata.postedByRole ? metadata.postedByRole : existing && existing.postedByRole ? existing.postedByRole : '',
            postedByName: metadata && metadata.postedByName ? metadata.postedByName : existing && existing.postedByName ? existing.postedByName : '',
            announcementTitle: sanitizeText(metadata && metadata.announcementTitle != null ? metadata.announcementTitle : existing && existing.announcementTitle, 180)
                || sanitizeText(classRecord && classRecord.name, 120) + ' - ' + snapshot.monthLabel + ' Report',
            announcementSummary: sanitizeText(metadata && metadata.announcementSummary != null ? metadata.announcementSummary : existing && existing.announcementSummary, 1000)
                || buildReportAnnouncementSummary(classRecord, snapshot.monthLabel, snapshot.rankings),
            updatedAt: now,
            createdAt: existing && existing.createdAt ? existing.createdAt : now
        };

        await reportsCollection.updateOne({ id: document.id }, { $set: document }, { upsert: true });
        const saved = await reportsCollection.findOne({ id: document.id });
        return stripMongoId(saved);
    }

    async function recalculateMonthlyReport(db, classId, reportMonth) {
        const existing = await getMonthlyReportByClassMonth(db, classId, reportMonth);
        if (!existing) {
            return null;
        }

        const classRecord = await db.collection('lms_classes').findOne({ id: classId });
        if (!classRecord) {
            return null;
        }

        return upsertMonthlyReport(db, classRecord, reportMonth, {
            postedAt: existing.postedAt,
            postedById: existing.postedById,
            postedByRole: existing.postedByRole,
            postedByName: existing.postedByName,
            announcementTitle: existing.announcementTitle,
            announcementSummary: existing.announcementSummary
        });
    }

    async function assertTeacherCanChangeReportMonth(db, session, classId, reportMonth, type, existingMark) {
        if (session.role === 'super_admin') {
            return;
        }

        if (existingMark && getMarkStatus(existingMark) === 'posted') {
            throw createHttpError(403, 'Posted marks cannot be changed by a teacher. Ask the super admin to update this month.');
        }

        if (!isReportEligibleType(type)) {
            return;
        }

        const report = await getMonthlyReportByClassMonth(db, classId, reportMonth);
        if (report && report.postedAt) {
            throw createHttpError(403, 'This month has already been posted. Only the super admin can update these marks.');
        }
    }

    function groupMarksByAssessment(records) {
        const groups = new Map();

        records.forEach((record) => {
            const key = record.sourceId
                ? [record.sourceType || getDefaultMarkSourceType(record.type), record.sourceId].join(':')
                : ['manual', record.type, record.title, record.reportMonth || normalizeReportMonth(record.recordedAt)].join(':');
            const existing = groups.get(key) || {
                groupId: key,
                sourceId: sanitizeText(record.sourceId, 80),
                sourceType: sanitizeText(record.sourceType, 20) || getDefaultMarkSourceType(record.type),
                title: sanitizeText(record.title, 120),
                type: sanitizeText(record.type, 20),
                reportMonth: getMarkReportMonth(record),
                status: getMarkStatus(record),
                postedAt: sanitizeText(record.postedAt, 40),
                entries: []
            };

            existing.entries.push(stripMongoId(record));
            groups.set(key, existing);
        });

        return Array.from(groups.values())
            .map((group) => ({
                ...group,
                entriesCount: group.entries.length,
                studentsCount: new Set(group.entries.map((entry) => entry.studentId)).size,
                averagePercentage: group.entries.length
                    ? Math.round(group.entries.reduce((acc, entry) => acc + ((entry.score / entry.totalMarks) * 100), 0) / group.entries.length)
                    : 0
            }))
            .sort((left, right) => {
                if (right.reportMonth !== left.reportMonth) {
                    return right.reportMonth.localeCompare(left.reportMonth);
                }

                return (left.title || '').localeCompare(right.title || '');
            });
    }

    async function upsertMarkRecord(db, classRecord, session, payload) {
        const classId = classRecord.id;
        const marksCollection = db.collection('lms_marks');
        const existing = payload.id ? await marksCollection.findOne({ id: payload.id }) : null;

        if (existing && existing.classId !== classId) {
            throw new Error('Marks entry belongs to another class.');
        }

        if (!(classRecord.studentIds || []).includes(payload.studentId)) {
            throw new Error('Marks can only be recorded for assigned students.');
        }

        const reportMonth = normalizeReportMonth(payload.recordedAt);
        if (existing && getMarkStatus(existing) === 'posted' && reportMonth !== getMarkReportMonth(existing)) {
            throw createHttpError(400, 'Posted marks must stay in the same report month.');
        }

        await assertTeacherCanChangeReportMonth(db, session, classId, reportMonth, payload.type, existing);

        const status = existing && getMarkStatus(existing) === 'posted' ? 'posted' : 'draft';
        const document = {
            ...(existing ? stripMongoId(existing) : {}),
            ...payload,
            classId,
            teacherId: existing && existing.teacherId ? existing.teacherId : session.userId,
            teacherName: existing && existing.teacherName ? existing.teacherName : getSessionActorName(session),
            sourceType: MARK_SOURCE_TYPES.has(payload.sourceType) ? payload.sourceType : getDefaultMarkSourceType(payload.type),
            sourceId: sanitizeText(payload.sourceId, 80),
            reportMonth,
            status,
            postedAt: status === 'posted' ? sanitizeText(existing && existing.postedAt, 40) : '',
            postedById: status === 'posted' ? sanitizeText(existing && existing.postedById, 80) : '',
            postedByRole: status === 'posted' ? sanitizeText(existing && existing.postedByRole, 30) : '',
            postedByName: status === 'posted' ? sanitizeText(existing && existing.postedByName, 120) : '',
            createdAt: existing && existing.createdAt ? existing.createdAt : payload.createdAt,
            updatedAt: payload.updatedAt
        };

        await marksCollection.updateOne({ id: document.id }, { $set: document }, { upsert: true });
        const saved = await marksCollection.findOne({ id: document.id });

        const affectedMonths = Array.from(new Set([
            existing ? getMarkReportMonth(existing) : '',
            saved ? getMarkReportMonth(saved) : ''
        ].filter(Boolean)));

        for (const affectedMonth of affectedMonths) {
            await recalculateMonthlyReport(db, classId, affectedMonth);
        }

        return stripMongoId(saved);
    }

    async function findPasswordResetUser(db, identifier) {
        const cleanIdentifier = sanitizeText(identifier, 80);
        const normalizedUsername = sanitizeUsername(cleanIdentifier);

        if (!cleanIdentifier) {
            throw new Error('User ID or username is required.');
        }

        return db.collection('lms_users').findOne({
            role: { $in: ['teacher', 'student'] },
            active: true,
            $or: [
                { id: cleanIdentifier },
                { username: normalizedUsername }
            ]
        });
    }

    async function buildPasswordResetRequestSummary(db, requestRecord) {
        const user = requestRecord && requestRecord.userId
            ? await db.collection('lms_users').findOne({ id: requestRecord.userId })
            : null;

        return {
            id: sanitizeText(requestRecord && requestRecord.id, 80),
            identifier: sanitizeText(requestRecord && requestRecord.identifier, 80),
            status: sanitizeText(requestRecord && requestRecord.status, 30),
            requestedAt: sanitizeText(requestRecord && requestRecord.requestedAt, 40),
            resolvedAt: sanitizeText(requestRecord && requestRecord.resolvedAt, 40),
            resolvedBy: sanitizeText(requestRecord && requestRecord.resolvedBy, 120),
            user: user ? sanitizeUserSummary(user) : null
        };
    }

    async function buildClassWorkspace(db, classRecord) {
        const classId = classRecord.id;
        const [assignments, quizzes, attendance, marks, monthlyReports] = await Promise.all([
            db.collection('lms_assignments').find({ classId }).sort({ dueDate: -1 }).toArray(),
            db.collection('lms_quizzes').find({ classId }).sort({ scheduledFor: -1 }).toArray(),
            db.collection('lms_attendance').find({ classId }).sort({ date: -1 }).toArray(),
            db.collection('lms_marks').find({ classId }).sort({ recordedAt: -1 }).toArray(),
            db.collection('lms_monthly_reports').find({ classId, deletedAt: '' }).sort({ reportMonth: -1 }).toArray()
        ]);

        return {
            classItem: await hydrateClass(db, classRecord),
            assignments: assignments.map(stripMongoId),
            quizzes: quizzes.map(stripMongoId),
            attendance: attendance.map(stripMongoId),
            marks: marks.map(stripMongoId),
            monthlyReports: monthlyReports.map(stripMongoId)
        };
    }

    app.post('/api/lms/auth/login', async (req, res, next) => {
        try {
            const username = sanitizeUsername(req.body && req.body.username);
            const password = sanitizeText(req.body && req.body.password, 128);
            const expectedRole = sanitizeText(req.body && req.body.role, 30).toLowerCase();

            if (!username || !password) {
                res.status(400).json({ message: 'Username and password are required.' });
                return;
            }

            const db = await getDb();
            const user = await db.collection('lms_users').findOne({ username, active: true });

            if (!user || !(await verifyPassword(password, user.passwordHash))) {
                res.status(401).json({ message: 'Invalid LMS username or password.' });
                return;
            }

            if (expectedRole && user.role !== expectedRole) {
                res.status(403).json({ message: 'This account is not allowed on the selected portal.' });
                return;
            }

            setLmsSessionCookie(res, user, cookieSecure);
            res.json({ authenticated: true, user: sanitizeUserSummary(user) });
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/auth/session', async (req, res, next) => {
        try {
            const user = await fetchCurrentLmsUser(req, res);
            res.json({ authenticated: Boolean(user), user: user ? sanitizeUserSummary(user) : null });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/auth/logout', (_req, res) => {
        clearLmsSessionCookie(res);
        res.json({ authenticated: false });
    });

    app.post('/api/lms/auth/forgot-password-request', async (req, res, next) => {
        try {
            const identifier = sanitizeText(req.body && req.body.identifier, 80);
            if (!identifier) {
                res.status(400).json({ message: 'User ID or username is required.' });
                return;
            }

            const db = await getDb();
            const user = await findPasswordResetUser(db, identifier);

            if (user) {
                const requestsCollection = db.collection('lms_password_reset_requests');
                const existingPending = await requestsCollection.findOne({ userId: user.id, status: 'pending' });

                if (!existingPending) {
                    await requestsCollection.insertOne({
                        id: createEntityId('resetreq'),
                        userId: user.id,
                        identifier,
                        status: 'pending',
                        requestedAt: new Date().toISOString(),
                        resolvedAt: '',
                        resolvedBy: ''
                    });
                }
            }

            res.status(202).json({
                requested: true,
                message: 'If your account exists, your password reset request has been sent to the super admin.'
            });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/auth/change-password', requireLmsAuth, async (req, res, next) => {
        try {
            const currentPassword = sanitizeText(req.body && req.body.currentPassword, 128);
            const newPassword = sanitizeText(req.body && req.body.newPassword, 128);

            if (!currentPassword || !newPassword) {
                res.status(400).json({ message: 'Current password and new password are required.' });
                return;
            }

            if (currentPassword === newPassword) {
                res.status(400).json({ message: 'New password must be different from the current password.' });
                return;
            }

            const db = await getDb();
            const usersCollection = db.collection('lms_users');
            const user = await usersCollection.findOne({ id: req.lmsSession.userId, role: req.lmsSession.role, active: true });

            if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
                res.status(401).json({ message: 'Current password is incorrect.' });
                return;
            }

            await usersCollection.updateOne({ id: user.id }, {
                $set: {
                    passwordHash: await hashPassword(newPassword),
                    mustChangePassword: false,
                    passwordChangeReason: '',
                    updatedAt: new Date().toISOString()
                }
            });

            const saved = await usersCollection.findOne({ id: user.id });
            res.json({ user: sanitizeUserSummary(saved) });
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/admin/overview', requireLmsAuth, requireLmsRole('super_admin'), async (_req, res, next) => {
        try {
            const db = await getDb();
            const [teacherCount, studentCount, classCount, assignmentCount, quizCount, attendanceCount, markCount, recentClasses, recentUsers] = await Promise.all([
                db.collection('lms_users').countDocuments({ role: 'teacher', active: true }),
                db.collection('lms_users').countDocuments({ role: 'student', active: true }),
                db.collection('lms_classes').countDocuments({ active: true }),
                db.collection('lms_assignments').countDocuments({}),
                db.collection('lms_quizzes').countDocuments({}),
                db.collection('lms_attendance').countDocuments({}),
                db.collection('lms_marks').countDocuments({}),
                db.collection('lms_classes').find({}).sort({ createdAt: -1 }).limit(5).toArray(),
                db.collection('lms_users').find({ role: { $in: ['teacher', 'student'] } }).sort({ createdAt: -1 }).limit(6).toArray()
            ]);

            res.json({
                stats: {
                    teachers: teacherCount,
                    students: studentCount,
                    classes: classCount,
                    assignments: assignmentCount,
                    quizzes: quizCount,
                    attendance: attendanceCount,
                    marks: markCount
                },
                recentClasses: await Promise.all(recentClasses.map((item) => hydrateClass(db, item))),
                recentUsers: recentUsers.map(sanitizeUserSummary)
            });
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/admin/users', requireLmsAuth, requireLmsRole('super_admin'), async (req, res, next) => {
        try {
            const role = sanitizeText(req.query.role, 30).toLowerCase();
            const filter = role && LMS_ROLES.has(role) ? { role } : { role: { $in: ['teacher', 'student'] } };
            const db = await getDb();
            const users = await db.collection('lms_users').find(filter).sort({ fullName: 1 }).toArray();
            res.json({ users: users.map(sanitizeUserSummary) });
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/admin/password-reset-requests', requireLmsAuth, requireLmsRole('super_admin'), async (req, res, next) => {
        try {
            const status = sanitizeText(req.query.status, 30).toLowerCase();
            const filter = status ? { status } : { status: 'pending' };
            const db = await getDb();
            const requests = await db.collection('lms_password_reset_requests').find(filter).sort({ requestedAt: -1 }).limit(50).toArray();

            res.json({
                requests: await Promise.all(requests.map((requestRecord) => buildPasswordResetRequestSummary(db, requestRecord)))
            });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/admin/password-reset-requests/:id/reset', requireLmsAuth, requireLmsRole('super_admin'), async (req, res, next) => {
        try {
            const requestId = sanitizeText(req.params.id, 80);
            const db = await getDb();
            const requestsCollection = db.collection('lms_password_reset_requests');
            const usersCollection = db.collection('lms_users');
            const requestRecord = await requestsCollection.findOne({ id: requestId, status: 'pending' });

            if (!requestRecord) {
                res.status(404).json({ message: 'Password reset request not found.' });
                return;
            }

            const user = await usersCollection.findOne({ id: requestRecord.userId, role: { $in: ['teacher', 'student'] } });
            if (!user) {
                res.status(404).json({ message: 'Requested user not found.' });
                return;
            }

            const temporaryPassword = generateTemporaryPassword();
            const now = new Date().toISOString();

            await usersCollection.updateOne({ id: user.id }, {
                $set: {
                    passwordHash: await hashPassword(temporaryPassword),
                    mustChangePassword: true,
                    passwordChangeReason: 'temporary_password',
                    updatedAt: now
                }
            });

            await requestsCollection.updateOne({ id: requestId }, {
                $set: {
                    status: 'reset',
                    resolvedAt: now,
                    resolvedBy: getSessionActorName(req.lmsSession)
                }
            });

            const savedUser = await usersCollection.findOne({ id: user.id });
            res.json({
                request: await buildPasswordResetRequestSummary(db, {
                    ...requestRecord,
                    status: 'reset',
                    resolvedAt: now,
                    resolvedBy: getSessionActorName(req.lmsSession)
                }),
                user: sanitizeUserSummary(savedUser),
                temporaryPassword
            });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/admin/users', requireLmsAuth, requireLmsRole('super_admin'), async (req, res, next) => {
        try {
            const payload = sanitizeUserCreate(req.body);
            const db = await getDb();
            const usersCollection = db.collection('lms_users');

            await ensureUniqueUsername(usersCollection, payload.username);

            const passwordHash = await hashPassword(payload.password);
            const document = {
                id: payload.id,
                fullName: payload.fullName,
                username: payload.username,
                role: payload.role,
                email: payload.email,
                phone: payload.phone,
                notes: payload.notes,
                active: payload.active,
                mustChangePassword: payload.role !== 'super_admin',
                passwordChangeReason: payload.role === 'super_admin' ? '' : 'first_login',
                passwordHash,
                createdAt: payload.createdAt,
                updatedAt: payload.updatedAt
            };

            await usersCollection.insertOne(document);
            res.status(201).json({ user: sanitizeUserSummary(document) });
        } catch (error) {
            next(error);
        }
    });

    app.put('/api/lms/admin/users/:id', requireLmsAuth, requireLmsRole('super_admin'), async (req, res, next) => {
        try {
            const userId = sanitizeText(req.params.id, 80);
            const update = sanitizeUserUpdate(req.body);
            const db = await getDb();
            const usersCollection = db.collection('lms_users');
            const existing = await usersCollection.findOne({ id: userId });

            if (!existing) {
                res.status(404).json({ message: 'User not found.' });
                return;
            }

            if (update.username) {
                await ensureUniqueUsername(usersCollection, update.username, userId);
            }

            const updateDoc = {
                fullName: update.fullName || existing.fullName,
                email: update.email,
                phone: update.phone,
                notes: update.notes,
                active: update.active,
                updatedAt: update.updatedAt
            };

            if (update.username) {
                updateDoc.username = update.username;
            }

            if (update.password) {
                updateDoc.passwordHash = await hashPassword(update.password);
                if (existing.role !== 'super_admin') {
                    updateDoc.mustChangePassword = true;
                    updateDoc.passwordChangeReason = 'temporary_password';
                }
            }

            await usersCollection.updateOne({ id: userId }, { $set: updateDoc });
            const saved = await usersCollection.findOne({ id: userId });
            res.json({ user: sanitizeUserSummary(saved) });
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/admin/classes', requireLmsAuth, requireLmsRole('super_admin'), async (_req, res, next) => {
        try {
            const db = await getDb();
            const classes = await db.collection('lms_classes').find({}).sort({ createdAt: -1 }).toArray();
            res.json({ classes: await Promise.all(classes.map((item) => hydrateClass(db, item))) });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/admin/classes', requireLmsAuth, requireLmsRole('super_admin'), async (req, res, next) => {
        try {
            const payload = sanitizeClassPayload(req.body);
            const db = await getDb();

            await Promise.all([
                ensureUsersHaveRole(db, payload.teacherIds, 'teacher'),
                ensureUsersHaveRole(db, payload.studentIds, 'student')
            ]);

            const now = new Date().toISOString();
            const document = {
                id: createEntityId('class'),
                name: payload.name,
                code: payload.code,
                subject: payload.subject,
                schedule: payload.schedule,
                room: payload.room,
                description: payload.description,
                teacherIds: payload.teacherIds,
                studentIds: payload.studentIds,
                active: payload.active,
                createdAt: now,
                updatedAt: now
            };

            await db.collection('lms_classes').insertOne(document);
            res.status(201).json({ classItem: await hydrateClass(db, document) });
        } catch (error) {
            next(error);
        }
    });

    app.put('/api/lms/admin/classes/:id', requireLmsAuth, requireLmsRole('super_admin'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const payload = sanitizeClassPayload(req.body);
            const db = await getDb();

            await Promise.all([
                ensureUsersHaveRole(db, payload.teacherIds, 'teacher'),
                ensureUsersHaveRole(db, payload.studentIds, 'student')
            ]);

            const existing = await db.collection('lms_classes').findOne({ id: classId });
            if (!existing) {
                res.status(404).json({ message: 'Class not found.' });
                return;
            }

            await db.collection('lms_classes').updateOne({ id: classId }, {
                $set: {
                    name: payload.name,
                    code: payload.code,
                    subject: payload.subject,
                    schedule: payload.schedule,
                    room: payload.room,
                    description: payload.description,
                    teacherIds: payload.teacherIds,
                    studentIds: payload.studentIds,
                    active: payload.active,
                    updatedAt: payload.updatedAt
                }
            });

            const saved = await db.collection('lms_classes').findOne({ id: classId });
            res.json({ classItem: await hydrateClass(db, saved) });
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/classes/:id/workspace', requireLmsAuth, requireLmsRole('super_admin', 'teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const db = await getDb();
            const classRecord = await getManageableClass(db, req.lmsSession, classId);
            res.json(await buildClassWorkspace(db, classRecord));
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/classes/:id/assignments', requireLmsAuth, requireLmsRole('super_admin', 'teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const db = await getDb();
            await getManageableClass(db, req.lmsSession, classId);

            const assignmentsCollection = db.collection('lms_assignments');
            const payload = sanitizeAssignmentPayload(req.body);
            const existing = payload.id ? await assignmentsCollection.findOne({ id: payload.id }) : null;

            if (existing && existing.classId !== classId) {
                throw new Error('Assignment belongs to another class.');
            }

            const document = {
                ...(existing ? stripMongoId(existing) : {}),
                ...payload,
                classId,
                teacherId: existing && existing.teacherId ? existing.teacherId : req.lmsSession.userId,
                teacherName: existing && existing.teacherName ? existing.teacherName : getSessionActorName(req.lmsSession),
                createdAt: existing && existing.createdAt ? existing.createdAt : payload.createdAt,
                updatedAt: payload.updatedAt
            };

            await assignmentsCollection.updateOne({ id: document.id }, { $set: document }, { upsert: true });
            const saved = await assignmentsCollection.findOne({ id: document.id });
            res.status(existing ? 200 : 201).json({ assignment: stripMongoId(saved) });
        } catch (error) {
            next(error);
        }
    });

    app.delete('/api/lms/classes/:id/assignments/:assignmentId', requireLmsAuth, requireLmsRole('super_admin', 'teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const assignmentId = sanitizeText(req.params.assignmentId, 80);
            const db = await getDb();
            await getManageableClass(db, req.lmsSession, classId);

            const result = await db.collection('lms_assignments').deleteOne({ id: assignmentId, classId });
            if (!result.deletedCount) {
                res.status(404).json({ message: 'Assignment not found.' });
                return;
            }

            res.status(204).end();
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/classes/:id/quizzes', requireLmsAuth, requireLmsRole('super_admin', 'teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const db = await getDb();
            await getManageableClass(db, req.lmsSession, classId);

            const quizzesCollection = db.collection('lms_quizzes');
            const payload = sanitizeQuizPayload(req.body);
            const existing = payload.id ? await quizzesCollection.findOne({ id: payload.id }) : null;

            if (existing && existing.classId !== classId) {
                throw new Error('Quiz belongs to another class.');
            }

            const document = {
                ...(existing ? stripMongoId(existing) : {}),
                ...payload,
                classId,
                teacherId: existing && existing.teacherId ? existing.teacherId : req.lmsSession.userId,
                teacherName: existing && existing.teacherName ? existing.teacherName : getSessionActorName(req.lmsSession),
                createdAt: existing && existing.createdAt ? existing.createdAt : payload.createdAt,
                updatedAt: payload.updatedAt
            };

            await quizzesCollection.updateOne({ id: document.id }, { $set: document }, { upsert: true });
            const saved = await quizzesCollection.findOne({ id: document.id });
            res.status(existing ? 200 : 201).json({ quiz: stripMongoId(saved) });
        } catch (error) {
            next(error);
        }
    });

    app.delete('/api/lms/classes/:id/quizzes/:quizId', requireLmsAuth, requireLmsRole('super_admin', 'teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const quizId = sanitizeText(req.params.quizId, 80);
            const db = await getDb();
            await getManageableClass(db, req.lmsSession, classId);

            const result = await db.collection('lms_quizzes').deleteOne({ id: quizId, classId });
            if (!result.deletedCount) {
                res.status(404).json({ message: 'Quiz not found.' });
                return;
            }

            res.status(204).end();
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/classes/:id/attendance', requireLmsAuth, requireLmsRole('super_admin', 'teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const db = await getDb();
            const classRecord = await getManageableClass(db, req.lmsSession, classId);
            const payload = sanitizeAttendancePayload(req.body);

            const allowedStudents = new Set(classRecord.studentIds || []);
            payload.entries.forEach((entry) => {
                if (!allowedStudents.has(entry.studentId)) {
                    throw new Error('Attendance can only be recorded for assigned students.');
                }
            });

            const attendanceCollection = db.collection('lms_attendance');
            const existing = await attendanceCollection.findOne({ classId, date: payload.date });
            const document = {
                classId,
                date: payload.date,
                entries: payload.entries,
                teacherId: existing && existing.teacherId ? existing.teacherId : req.lmsSession.userId,
                updatedAt: payload.updatedAt,
                createdAt: existing && existing.createdAt ? existing.createdAt : new Date().toISOString()
            };

            await attendanceCollection.updateOne({ classId, date: payload.date }, { $set: document }, { upsert: true });
            const saved = await attendanceCollection.findOne({ classId, date: payload.date });
            res.status(existing ? 200 : 201).json({ attendance: stripMongoId(saved) });
        } catch (error) {
            next(error);
        }
    });

    app.delete('/api/lms/classes/:id/attendance/:date', requireLmsAuth, requireLmsRole('super_admin', 'teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const date = sanitizeText(req.params.date, 40);
            const db = await getDb();
            await getManageableClass(db, req.lmsSession, classId);

            const result = await db.collection('lms_attendance').deleteOne({ classId, date });
            if (!result.deletedCount) {
                res.status(404).json({ message: 'Attendance record not found.' });
                return;
            }

            res.status(204).end();
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/classes/:id/marks', requireLmsAuth, requireLmsRole('super_admin', 'teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const reportMonth = sanitizeText(req.query && req.query.reportMonth, 7);
            const type = sanitizeText(req.query && req.query.type, 20).toLowerCase();
            const sourceType = sanitizeText(req.query && req.query.sourceType, 20).toLowerCase();
            const sourceId = sanitizeText(req.query && req.query.sourceId, 80);
            const status = sanitizeText(req.query && req.query.status, 20).toLowerCase();
            const db = await getDb();
            const classRecord = await getManageableClass(db, req.lmsSession, classId);
            const query = { classId };

            if (reportMonth) {
                query.reportMonth = reportMonth;
            }

            if (type) {
                query.type = type;
            }

            if (sourceType) {
                query.sourceType = sourceType;
            }

            if (sourceId) {
                query.sourceId = sourceId;
            }

            if (status) {
                query.status = status;
            }

            const records = await db.collection('lms_marks').find(query).sort({ recordedAt: -1, title: 1 }).toArray();
            res.json({
                classItem: await hydrateClass(db, classRecord),
                marks: records.map(stripMongoId),
                groups: groupMarksByAssessment(records)
            });
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/classes/:id/assignments/:assignmentId/marks', requireLmsAuth, requireLmsRole('super_admin', 'teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const assignmentId = sanitizeText(req.params.assignmentId, 80);
            const db = await getDb();
            const classRecord = await getManageableClass(db, req.lmsSession, classId);
            const assignment = await db.collection('lms_assignments').findOne({ id: assignmentId, classId });

            if (!assignment) {
                res.status(404).json({ message: 'Assignment not found.' });
                return;
            }

            const marks = await db.collection('lms_marks').find({ classId, sourceType: 'assignment', sourceId: assignmentId }).sort({ recordedAt: -1, studentId: 1 }).toArray();
            res.json({
                classItem: await hydrateClass(db, classRecord),
                assignment: stripMongoId(assignment),
                marks: marks.map(stripMongoId)
            });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/classes/:id/assignments/:assignmentId/marks', requireLmsAuth, requireLmsRole('super_admin', 'teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const assignmentId = sanitizeText(req.params.assignmentId, 80);
            const db = await getDb();
            const classRecord = await getManageableClass(db, req.lmsSession, classId);
            const assignment = await db.collection('lms_assignments').findOne({ id: assignmentId, classId });

            if (!assignment) {
                res.status(404).json({ message: 'Assignment not found.' });
                return;
            }

            if (!Array.isArray(req.body && req.body.entries) || req.body.entries.length === 0) {
                throw new Error('Mark entries are required.');
            }

            const existingMarks = await db.collection('lms_marks').find({ classId, sourceType: 'assignment', sourceId: assignmentId }).toArray();
            const existingByStudent = new Map(existingMarks.map((item) => [item.studentId, item]));
            const savedMarks = [];

            for (const entry of req.body.entries.slice(0, 300)) {
                const current = existingByStudent.get(sanitizeText(entry && entry.studentId, 80));
                const payload = sanitizeMarkPayload({
                    id: sanitizeText(entry && entry.id, 80) || (current && current.id) || '',
                    studentId: entry && entry.studentId,
                    title: assignment.title,
                    type: 'assignment',
                    score: entry && entry.score,
                    totalMarks: entry && entry.totalMarks,
                    notes: entry && entry.notes,
                    recordedAt: entry && entry.recordedAt,
                    sourceId: assignmentId,
                    sourceType: 'assignment',
                    createdAt: current && current.createdAt ? current.createdAt : undefined
                });
                savedMarks.push(await upsertMarkRecord(db, classRecord, req.lmsSession, payload));
            }

            res.json({ assignment: stripMongoId(assignment), marks: savedMarks });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/classes/:id/marks', requireLmsAuth, requireLmsRole('super_admin', 'teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const db = await getDb();
            const classRecord = await getManageableClass(db, req.lmsSession, classId);
            const payload = sanitizeMarkPayload(req.body);
            const saved = await upsertMarkRecord(db, classRecord, req.lmsSession, payload);
            res.status(payload.id ? 200 : 201).json({ mark: saved });
        } catch (error) {
            next(error);
        }
    });

    app.delete('/api/lms/classes/:id/marks/:markId', requireLmsAuth, requireLmsRole('super_admin', 'teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const markId = sanitizeText(req.params.markId, 80);
            const db = await getDb();
            await getManageableClass(db, req.lmsSession, classId);

            const existing = await db.collection('lms_marks').findOne({ id: markId, classId });
            if (existing && getMarkStatus(existing) === 'posted' && req.lmsSession.role !== 'super_admin') {
                throw createHttpError(403, 'Posted marks cannot be changed by a teacher. Ask the super admin to update this month.');
            }

            const result = await db.collection('lms_marks').deleteOne({ id: markId, classId });
            if (!result.deletedCount) {
                res.status(404).json({ message: 'Mark entry not found.' });
                return;
            }

            if (existing) {
                await recalculateMonthlyReport(db, classId, getMarkReportMonth(existing));
            }

            res.status(204).end();
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/classes/:id/monthly-reports', requireLmsAuth, requireLmsRole('super_admin', 'teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const reportMonth = sanitizeText(req.query && req.query.reportMonth, 7);
            const includeDeleted = sanitizeBoolean(req.query && req.query.includeDeleted, false);
            const db = await getDb();
            await getManageableClass(db, req.lmsSession, classId);

            const query = { classId };
            if (reportMonth) {
                query.reportMonth = reportMonth;
            }
            if (!includeDeleted) {
                query.deletedAt = '';
            }

            const reports = await db.collection('lms_monthly_reports').find(query).sort({ reportMonth: -1 }).toArray();
            res.json({ reports: reports.map(stripMongoId) });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/classes/:id/monthly-reports/:reportMonth/post', requireLmsAuth, requireLmsRole('super_admin', 'teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const reportMonth = normalizeReportMonth(req.params.reportMonth);
            const db = await getDb();
            const classRecord = await getManageableClass(db, req.lmsSession, classId);
            const existingReport = await getMonthlyReportByClassMonth(db, classId, reportMonth);

            if (existingReport && existingReport.postedAt) {
                throw createHttpError(403, isMonthlyReportDeleted(existingReport)
                    ? 'This month was already posted and deleted from public view. Ask the super admin to restore or update it.'
                    : 'This month has already been posted.');
            }

            const marksCollection = db.collection('lms_marks');
            const eligibleMarks = await marksCollection.find({
                classId,
                reportMonth,
                type: { $in: Array.from(REPORT_MARK_TYPES) }
            }).toArray();

            if (!eligibleMarks.length) {
                throw new Error('No eligible marks found for this class month.');
            }

            const now = new Date().toISOString();
            await marksCollection.updateMany({
                classId,
                reportMonth,
                type: { $in: Array.from(REPORT_MARK_TYPES) }
            }, {
                $set: {
                    status: 'posted',
                    postedAt: now,
                    postedById: req.lmsSession.userId,
                    postedByRole: req.lmsSession.role,
                    postedByName: getSessionActorName(req.lmsSession),
                    updatedAt: now
                }
            });

            const report = await upsertMonthlyReport(db, classRecord, reportMonth, {
                postedAt: now,
                postedById: req.lmsSession.userId,
                postedByRole: req.lmsSession.role,
                postedByName: getSessionActorName(req.lmsSession)
            });

            res.json({ report });
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/admin/monthly-reports', requireLmsAuth, requireLmsRole('super_admin'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.query && req.query.classId, 80);
            const reportMonth = sanitizeText(req.query && req.query.reportMonth, 7);
            const includeDeleted = sanitizeBoolean(req.query && req.query.includeDeleted, false);
            const query = {};

            if (classId) {
                query.classId = classId;
            }

            if (reportMonth) {
                query.reportMonth = reportMonth;
            }

            if (!includeDeleted) {
                query.deletedAt = '';
            }

            const db = await getDb();
            const reports = await db.collection('lms_monthly_reports').find(query).sort({ reportMonth: -1, className: 1 }).toArray();
            res.json({ reports: reports.map(stripMongoId) });
        } catch (error) {
            next(error);
        }
    });

    app.put('/api/lms/admin/monthly-reports/:id', requireLmsAuth, requireLmsRole('super_admin'), async (req, res, next) => {
        try {
            const reportId = sanitizeText(req.params.id, 80);
            const update = sanitizeMonthlyReportUpdate(req.body);
            const db = await getDb();
            const reportsCollection = db.collection('lms_monthly_reports');
            const existing = await reportsCollection.findOne({ id: reportId });

            if (!existing) {
                res.status(404).json({ message: 'Monthly report not found.' });
                return;
            }

            const document = {
                ...stripMongoId(existing),
                active: update.active,
                hidden: update.hidden,
                deletedAt: update.restore ? '' : existing.deletedAt || '',
                announcementTitle: update.announcementTitle || existing.announcementTitle,
                announcementSummary: update.announcementSummary || existing.announcementSummary,
                updatedAt: update.updatedAt
            };

            await reportsCollection.updateOne({ id: reportId }, { $set: document });
            const saved = await reportsCollection.findOne({ id: reportId });
            res.json({ report: stripMongoId(saved) });
        } catch (error) {
            next(error);
        }
    });

    app.delete('/api/lms/admin/monthly-reports/:id', requireLmsAuth, requireLmsRole('super_admin'), async (req, res, next) => {
        try {
            const reportId = sanitizeText(req.params.id, 80);
            const db = await getDb();
            const reportsCollection = db.collection('lms_monthly_reports');
            const existing = await reportsCollection.findOne({ id: reportId });

            if (!existing) {
                res.status(404).json({ message: 'Monthly report not found.' });
                return;
            }

            await reportsCollection.updateOne({ id: reportId }, {
                $set: {
                    deletedAt: new Date().toISOString(),
                    active: false,
                    hidden: true,
                    updatedAt: new Date().toISOString()
                }
            });

            res.status(204).end();
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/public/monthly-reports', async (req, res, next) => {
        try {
            const classId = sanitizeText(req.query && req.query.classId, 80);
            const reportMonth = sanitizeText(req.query && req.query.reportMonth, 7);
            const query = { active: true, hidden: false, deletedAt: '' };

            if (classId) {
                query.classId = classId;
            }

            if (reportMonth) {
                query.reportMonth = reportMonth;
            }

            const db = await getDb();
            const reports = await db.collection('lms_monthly_reports').find(query).sort({ reportMonth: -1, className: 1 }).toArray();
            res.json({ reports: reports.map(stripMongoId) });
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/teacher/classes', requireLmsAuth, requireLmsRole('teacher'), async (req, res, next) => {
        try {
            const db = await getDb();
            const classes = await db.collection('lms_classes').find({ teacherIds: req.lmsSession.userId, active: true }).sort({ name: 1 }).toArray();
            res.json({ classes: await Promise.all(classes.map((item) => hydrateClass(db, item))) });
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/teacher/classes/:id/workspace', requireLmsAuth, requireLmsRole('teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const db = await getDb();
            const classRecord = await assertTeacherClassAccess(db, req.lmsSession.userId, classId);
            res.json(await buildClassWorkspace(db, classRecord));
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/teacher/classes/:id/assignments', requireLmsAuth, requireLmsRole('teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const db = await getDb();

            await assertTeacherClassAccess(db, req.lmsSession.userId, classId);

            const payload = sanitizeAssignmentPayload(req.body);
            const document = {
                ...payload,
                classId,
                teacherId: req.lmsSession.userId,
                teacherName: req.lmsSession.username
            };

            await db.collection('lms_assignments').updateOne({ id: document.id }, { $set: document }, { upsert: true });
            const saved = await db.collection('lms_assignments').findOne({ id: document.id });
            res.status(201).json({ assignment: stripMongoId(saved) });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/teacher/classes/:id/quizzes', requireLmsAuth, requireLmsRole('teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const db = await getDb();

            await assertTeacherClassAccess(db, req.lmsSession.userId, classId);

            const payload = sanitizeQuizPayload(req.body);
            const document = {
                ...payload,
                classId,
                teacherId: req.lmsSession.userId,
                teacherName: req.lmsSession.username
            };

            await db.collection('lms_quizzes').updateOne({ id: document.id }, { $set: document }, { upsert: true });
            const saved = await db.collection('lms_quizzes').findOne({ id: document.id });
            res.status(201).json({ quiz: stripMongoId(saved) });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/teacher/classes/:id/attendance', requireLmsAuth, requireLmsRole('teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const db = await getDb();
            const classRecord = await assertTeacherClassAccess(db, req.lmsSession.userId, classId);
            const payload = sanitizeAttendancePayload(req.body);

            const allowedStudents = new Set(classRecord.studentIds || []);
            payload.entries.forEach((entry) => {
                if (!allowedStudents.has(entry.studentId)) {
                    throw new Error('Attendance can only be recorded for assigned students.');
                }
            });

            const document = {
                classId,
                date: payload.date,
                entries: payload.entries,
                teacherId: req.lmsSession.userId,
                updatedAt: payload.updatedAt,
                createdAt: new Date().toISOString()
            };

            await db.collection('lms_attendance').updateOne({ classId, date: payload.date }, { $set: document }, { upsert: true });
            const saved = await db.collection('lms_attendance').findOne({ classId, date: payload.date });
            res.status(201).json({ attendance: stripMongoId(saved) });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/lms/teacher/classes/:id/marks', requireLmsAuth, requireLmsRole('teacher'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const db = await getDb();
            const classRecord = await assertTeacherClassAccess(db, req.lmsSession.userId, classId);
            const payload = sanitizeMarkPayload(req.body);
            const saved = await upsertMarkRecord(db, classRecord, req.lmsSession, payload);
            res.status(payload.id ? 200 : 201).json({ mark: saved });
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/student/dashboard', requireLmsAuth, requireLmsRole('student'), async (req, res, next) => {
        try {
            const db = await getDb();
            const student = await db.collection('lms_users').findOne({ id: req.lmsSession.userId, role: 'student', active: true });

            if (!student) {
                res.status(404).json({ message: 'Student record not found.' });
                return;
            }

            const classes = await db.collection('lms_classes').find({ studentIds: req.lmsSession.userId, active: true }).sort({ name: 1 }).toArray();
            const classIds = classes.map((item) => item.id);
            const [assignments, quizzes, attendance, marks] = await Promise.all([
                classIds.length ? db.collection('lms_assignments').find({ classId: { $in: classIds } }).sort({ dueDate: -1 }).toArray() : [],
                classIds.length ? db.collection('lms_quizzes').find({ classId: { $in: classIds } }).sort({ scheduledFor: -1 }).toArray() : [],
                classIds.length ? db.collection('lms_attendance').find({ classId: { $in: classIds } }).sort({ date: -1 }).toArray() : [],
                classIds.length ? db.collection('lms_marks').find({ classId: { $in: classIds }, studentId: req.lmsSession.userId }).sort({ recordedAt: -1 }).toArray() : []
            ]);

            const hydratedClasses = await Promise.all(classes.map((item) => hydrateClass(db, item)));
            const classCards = hydratedClasses.map((classItem) => {
                const classAssignments = assignments.filter((item) => item.classId === classItem.id).map(stripMongoId);
                const classQuizzes = quizzes.filter((item) => item.classId === classItem.id).map(stripMongoId);
                const classAttendance = attendance.filter((item) => item.classId === classItem.id);
                const classMarks = marks.filter((item) => item.classId === classItem.id).map(stripMongoId);

                return {
                    ...classItem,
                    assignments: classAssignments,
                    quizzes: classQuizzes,
                    marks: classMarks,
                    attendanceSummary: summarizeAttendance(classAttendance, req.lmsSession.userId),
                    markSummary: summarizeMarks(classMarks)
                };
            });

            const attendancePercentages = classCards.map((item) => item.attendanceSummary.percentage).filter((value) => Number.isFinite(value));
            const overallAttendance = attendancePercentages.length > 0
                ? Math.round(attendancePercentages.reduce((acc, value) => acc + value, 0) / attendancePercentages.length)
                : 0;
            const overallMarks = summarizeMarks(marks.map(stripMongoId));

            res.json({
                student: sanitizeUserSummary(student),
                summary: {
                    classes: classCards.length,
                    assignments: assignments.length,
                    quizzes: quizzes.length,
                    attendance: overallAttendance,
                    averageScore: overallMarks.averagePercentage
                },
                classes: classCards
            });
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/lms/student/classes/:id', requireLmsAuth, requireLmsRole('student'), async (req, res, next) => {
        try {
            const classId = sanitizeText(req.params.id, 80);
            const db = await getDb();
            const classRecord = await assertStudentClassAccess(db, req.lmsSession.userId, classId);
            const [assignments, quizzes, attendance, marks] = await Promise.all([
                db.collection('lms_assignments').find({ classId }).sort({ dueDate: -1 }).toArray(),
                db.collection('lms_quizzes').find({ classId }).sort({ scheduledFor: -1 }).toArray(),
                db.collection('lms_attendance').find({ classId }).sort({ date: -1 }).toArray(),
                db.collection('lms_marks').find({ classId, studentId: req.lmsSession.userId }).sort({ recordedAt: -1 }).toArray()
            ]);

            res.json({
                classItem: await hydrateClass(db, classRecord),
                assignments: assignments.map(stripMongoId),
                quizzes: quizzes.map(stripMongoId),
                attendanceSummary: summarizeAttendance(attendance, req.lmsSession.userId),
                marks: marks.map(stripMongoId),
                markSummary: summarizeMarks(marks.map(stripMongoId))
            });
        } catch (error) {
            next(error);
        }
    });
}

module.exports = {
    ensureLmsSeedData,
    registerLmsRoutes
};