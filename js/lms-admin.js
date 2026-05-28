(function () {
    'use strict';

    const state = {
        currentUser: null,
        teachers: [],
        students: [],
        resetRequests: [],
        classes: [],
        reports: [],
        selectedClassId: '',
        workspace: null,
        activeView: 'admin-overview-section',
        reportClassFilter: '',
        reportMonthFilter: ''
    };

    let viewNavigator = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function emptyState(message, extraClasses) {
        const helpers = window.TuitionSolutionLms;
        return '<div class="lms-empty ' + (extraClasses || '') + '"><p>' + helpers.escapeHtml(message) + '</p></div>';
    }

    function formatReportMonthLabel(reportMonth) {
        if (!reportMonth) {
            return 'Unknown month';
        }

        const parts = String(reportMonth).split('-');
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const date = new Date(Date.UTC(year, month - 1, 1));

        if (Number.isNaN(date.getTime())) {
            return reportMonth;
        }

        return new Intl.DateTimeFormat('en-PK', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC'
        }).format(date);
    }

    function getReportStatusBadge(reportItem) {
        const visibilityBadge = reportItem.hidden
            ? '<span class="lms-badge lms-badge-orange">Hidden</span>'
            : '<span class="lms-badge lms-badge-blue">Visible</span>';
        const activityBadge = reportItem.active
            ? '<span class="lms-badge lms-badge-green">Active</span>'
            : '<span class="lms-badge lms-badge-slate">Inactive</span>';
        return visibilityBadge + activityBadge;
    }

    function getCheckedValues(containerId) {
        const container = byId(containerId);
        if (!container) {
            return [];
        }

        return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
    }

    function ensureSelectedClass() {
        if (!state.selectedClassId) {
            throw new Error('Create or select a class first.');
        }

        return state.selectedClassId;
    }

    function hasPendingResetRequest(userId) {
        return state.resetRequests.some((requestItem) => requestItem && requestItem.status === 'pending' && requestItem.user && requestItem.user.id === userId);
    }

    function resetUserForm(prefix) {
        byId(prefix + '-id').value = '';
        byId(prefix + '-form').reset();
        byId(prefix + '-active').checked = true;
        byId(prefix + '-cancel').classList.add('hidden');
    }

    function resetClassForm() {
        byId('class-id').value = '';
        byId('class-form').reset();
        byId('class-active').checked = true;
        byId('class-cancel').classList.add('hidden');
        renderClassSelectors([], []);
    }

    function resetAssignmentForm() {
        byId('admin-assignment-form').reset();
        byId('admin-assignment-id').value = '';
        byId('admin-assignment-cancel').classList.add('hidden');
    }

    function resetQuizForm() {
        byId('admin-quiz-form').reset();
        byId('admin-quiz-id').value = '';
        byId('admin-quiz-cancel').classList.add('hidden');
    }

    function resetAttendanceForm() {
        byId('admin-attendance-form').reset();
        byId('admin-attendance-reset').classList.add('hidden');
        renderAttendanceRows();
    }

    function resetMarkForm() {
        const selectedStudentId = '';
        byId('admin-mark-form').reset();
        byId('admin-mark-id').value = '';
        byId('admin-mark-cancel').classList.add('hidden');
        renderMarkFormOptions(selectedStudentId);
    }

    function renderUserList(containerId, users, emptyLabel, badgeClass) {
        const helpers = window.TuitionSolutionLms;
        const container = byId(containerId);

        if (!users.length) {
            container.innerHTML = emptyState(emptyLabel);
            return;
        }

        container.innerHTML = users.map((user) => {
            const badge = user.active ? '<span class="lms-badge lms-badge-green">Active</span>' : '<span class="lms-badge lms-badge-slate">Inactive</span>';
            const resetBadge = hasPendingResetRequest(user.id) ? '<span class="lms-badge lms-badge-orange">Reset requested</span>' : '';
            const passwordBadge = user.mustChangePassword ? '<span class="lms-badge lms-badge-slate">Password change required</span>' : '';
            return '<article class="lms-dashboard-card p-5">'
                + '<div class="flex items-start justify-between gap-4">'
                + '<div>'
                + '<div class="flex items-center gap-3 flex-wrap">'
                + '<h3 class="font-semibold text-slate-900">' + helpers.escapeHtml(user.fullName || user.username) + '</h3>'
                + '<span class="lms-badge ' + badgeClass + '">' + helpers.escapeHtml(user.username) + '</span>'
                + badge
                + resetBadge
                + passwordBadge
                + '</div>'
                + '<p class="text-sm text-slate-500 mt-2">' + helpers.escapeHtml(user.email || 'No email saved') + '</p>'
                + '<p class="text-sm text-slate-500 mt-1">' + helpers.escapeHtml(user.phone || 'No phone saved') + '</p>'
                + '</div>'
                + '<div class="lms-inline-actions">'
                + '<button type="button" class="lms-inline-button" data-edit-user="' + helpers.escapeHtml(user.id) + '">'
                + '<i class="fas fa-pen" aria-hidden="true"></i>Edit'
                + '</button>'
                + '</div>'
                + '</div>'
                + '</article>';
        }).join('');
    }

    function renderResetRequests() {
        const helpers = window.TuitionSolutionLms;
        const container = byId('admin-reset-request-list');
        const countLabel = byId('admin-reset-request-count');
        const items = state.resetRequests || [];

        if (countLabel) {
            countLabel.textContent = String(items.length) + (items.length === 1 ? ' pending' : ' pending');
        }

        if (!items.length) {
            container.innerHTML = emptyState('No password reset requests pending right now.');
            return;
        }

        container.innerHTML = items.map((requestItem) => {
            const user = requestItem.user || {};
            const roleBadge = user.role === 'teacher' ? 'lms-badge-blue' : 'lms-badge-orange';
            const canReset = Boolean(user && user.id);
            return '<article class="lms-dashboard-card p-5">'
                + '<div class="flex items-start justify-between gap-4">'
                + '<div>'
                + '<div class="flex items-center gap-3 flex-wrap">'
                + '<h3 class="font-semibold text-slate-900">' + helpers.escapeHtml(user.fullName || user.username || requestItem.identifier || 'Unknown user') + '</h3>'
                + (user.role ? '<span class="lms-badge ' + roleBadge + '">' + helpers.escapeHtml(user.role) + '</span>' : '')
                + '</div>'
                + '<p class="text-sm text-slate-500 mt-2">Username: ' + helpers.escapeHtml(user.username || 'Unavailable') + '</p>'
                + '<p class="text-sm text-slate-500 mt-1">Requested with: ' + helpers.escapeHtml(requestItem.identifier || 'Unavailable') + '</p>'
                + '<p class="text-sm text-slate-500 mt-1">Requested on: ' + helpers.escapeHtml(helpers.formatDate(requestItem.requestedAt, true)) + '</p>'
                + '</div>'
                + (canReset
                    ? '<div class="lms-inline-actions"><button type="button" class="lms-inline-button lms-inline-button-danger" data-reset-request="' + helpers.escapeHtml(requestItem.id) + '">Issue Temp Password</button></div>'
                    : '')
                + '</div>'
                + '</article>';
        }).join('');
    }

    function renderClassSelectors(selectedTeacherIds, selectedStudentIds) {
        const helpers = window.TuitionSolutionLms;
        const teacherOptions = byId('class-teacher-options');
        const studentOptions = byId('class-student-options');

        teacherOptions.innerHTML = state.teachers.length
            ? state.teachers.map((teacher) => '<label class="lms-check-card flex items-start gap-3 cursor-pointer">'
                + '<input type="checkbox" value="' + helpers.escapeHtml(teacher.id) + '" ' + (selectedTeacherIds.includes(teacher.id) ? 'checked' : '') + ' class="mt-1 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500">'
                + '<span><span class="block font-semibold text-slate-900">' + helpers.escapeHtml(teacher.fullName || teacher.username) + '</span><span class="block text-sm text-slate-500">' + helpers.escapeHtml(teacher.username) + '</span></span>'
                + '</label>').join('')
            : emptyState('Create a teacher first.');

        studentOptions.innerHTML = state.students.length
            ? state.students.map((student) => '<label class="lms-check-card flex items-start gap-3 cursor-pointer">'
                + '<input type="checkbox" value="' + helpers.escapeHtml(student.id) + '" ' + (selectedStudentIds.includes(student.id) ? 'checked' : '') + ' class="mt-1 w-4 h-4 rounded border-slate-300 text-accent-500 focus:ring-accent-500">'
                + '<span><span class="block font-semibold text-slate-900">' + helpers.escapeHtml(student.fullName || student.username) + '</span><span class="block text-sm text-slate-500">' + helpers.escapeHtml(student.username) + '</span></span>'
                + '</label>').join('')
            : emptyState('Create a student first.');
    }

    function renderClassList() {
        const helpers = window.TuitionSolutionLms;
        const container = byId('class-list');

        if (!state.classes.length) {
            container.innerHTML = emptyState('No classes created yet.');
            return;
        }

        container.innerHTML = state.classes.map((classItem) => {
            const teacherNames = (classItem.teachers || []).map((teacher) => teacher.fullName || teacher.username).join(', ') || 'No teacher assigned';
            const isActive = classItem.id === state.selectedClassId;
            return '<article class="lms-dashboard-card p-5">'
                + '<div class="flex items-start justify-between gap-4">'
                + '<div>'
                + '<div class="flex items-center gap-3 flex-wrap">'
                + '<h3 class="font-semibold text-slate-900">' + helpers.escapeHtml(classItem.name) + '</h3>'
                + (classItem.code ? '<span class="lms-badge lms-badge-blue">' + helpers.escapeHtml(classItem.code) + '</span>' : '')
                + (classItem.active ? '<span class="lms-badge lms-badge-green">Active</span>' : '<span class="lms-badge lms-badge-slate">Inactive</span>')
                + '</div>'
                + '<p class="text-sm text-slate-500 mt-2">' + helpers.escapeHtml(classItem.subject || 'No subject set') + '</p>'
                + '<p class="text-sm text-slate-500 mt-1">' + helpers.escapeHtml(classItem.schedule || 'Schedule not set') + '</p>'
                + '<p class="text-sm text-slate-500 mt-1">Teacher: ' + helpers.escapeHtml(teacherNames) + '</p>'
                + '<p class="text-sm text-slate-500 mt-1">Students assigned: ' + helpers.escapeHtml(String((classItem.students || []).length)) + '</p>'
                + '</div>'
                + '<div class="lms-inline-actions">'
                + '<button type="button" class="lms-inline-button ' + (isActive ? 'is-active' : '') + '" data-open-class="' + helpers.escapeHtml(classItem.id) + '">'
                + '<i class="fas fa-grid-2" aria-hidden="true"></i>' + (isActive ? 'Opened' : 'Open')
                + '</button>'
                + '<button type="button" class="lms-inline-button" data-edit-class="' + helpers.escapeHtml(classItem.id) + '">'
                + '<i class="fas fa-pen" aria-hidden="true"></i>Edit'
                + '</button>'
                + '</div>'
                + '</div>'
                + '</article>';
        }).join('');
    }

    function renderOverview(stats) {
        byId('stat-teachers').textContent = String(stats.teachers || 0);
        byId('stat-students').textContent = String(stats.students || 0);
        byId('stat-classes').textContent = String(stats.classes || 0);
        byId('stat-assignments').textContent = String(stats.assignments || 0);
        byId('stat-quizzes').textContent = String(stats.quizzes || 0);
        byId('stat-attendance').textContent = String(stats.attendance || 0);
        byId('stat-marks').textContent = String(stats.marks || 0);
    }

    function renderWorkspaceSelector() {
        const helpers = window.TuitionSolutionLms;
        const select = byId('admin-workspace-class');
        const selectedClass = state.classes.find((item) => item.id === state.selectedClassId);

        if (!state.classes.length) {
            select.disabled = true;
            select.innerHTML = '<option value="">No classes available</option>';
            byId('admin-workspace-meta').textContent = 'Create a class to unlock the academic workspace.';
            return;
        }

        select.disabled = false;
        select.innerHTML = state.classes.map((classItem) => '<option value="' + helpers.escapeHtml(classItem.id) + '">' + helpers.escapeHtml(classItem.name + (classItem.code ? ' - ' + classItem.code : '')) + '</option>').join('');
        select.value = selectedClass ? selectedClass.id : state.classes[0].id;
        byId('admin-workspace-meta').textContent = selectedClass
            ? [selectedClass.subject, selectedClass.schedule, selectedClass.room].filter(Boolean).join(' | ') || 'Workspace ready for full review.'
            : 'Select any class to review assignments, quizzes, attendance, and marks.';
    }

    function renderWorkspaceSummary() {
        const helpers = window.TuitionSolutionLms;

        if (!state.workspace) {
            byId('admin-class-title').textContent = 'Select a class';
            byId('admin-class-subtitle').textContent = 'Choose a class to inspect every assignment, quiz, attendance sheet, and mark record.';
            byId('admin-class-summary').innerHTML = emptyState('No class workspace selected yet.', 'md:col-span-2 xl:col-span-4');
            return;
        }

        const classItem = state.workspace.classItem;
        byId('admin-class-title').textContent = classItem.name || 'Class workspace';
        byId('admin-class-subtitle').textContent = [classItem.code, classItem.subject, classItem.schedule].filter(Boolean).join(' | ') || 'Class workspace loaded';
        byId('admin-class-summary').innerHTML = [
            { label: 'Students', value: (classItem.students || []).length, tone: 'blue', icon: 'fa-users' },
            { label: 'Assignments', value: (state.workspace.assignments || []).length, tone: 'orange', icon: 'fa-file-lines' },
            { label: 'Quizzes', value: (state.workspace.quizzes || []).length, tone: 'green', icon: 'fa-list-check' },
            { label: 'Marks', value: (state.workspace.marks || []).length, tone: 'slate', icon: 'fa-square-poll-vertical' }
        ].map((item) => '<article class="lms-dashboard-card p-5">'
            + '<div class="flex items-center justify-between gap-4">'
            + '<div><p class="text-sm text-slate-500">' + helpers.escapeHtml(item.label) + '</p><p class="mt-2 text-3xl font-bold text-slate-900">' + helpers.escapeHtml(String(item.value)) + '</p></div>'
            + '<span class="w-12 h-12 rounded-2xl flex items-center justify-center text-lg ' + (item.tone === 'blue' ? 'bg-primary-50 text-primary-600' : item.tone === 'orange' ? 'bg-accent-50 text-accent-600' : item.tone === 'green' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-600') + '"><i class="fas ' + item.icon + '" aria-hidden="true"></i></span>'
            + '</div>'
            + '</article>').join('');
    }

    function renderWorkspaceOverview() {
        const helpers = window.TuitionSolutionLms;
        const container = byId('admin-workspace-overview');

        if (!state.workspace) {
            container.innerHTML = emptyState('Select a class to review its teachers, students, schedule, and records.');
            return;
        }

        const classItem = state.workspace.classItem;
        const teachers = classItem.teachers || [];
        const students = classItem.students || [];
        const visibleStudents = students.slice(0, 12);
        const remainingStudents = students.length - visibleStudents.length;

        container.innerHTML = '<article class="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-5">'
            + '<h3 class="lms-section-title">Class Details</h3>'
            + '<div class="grid sm:grid-cols-2 gap-4 mt-5 text-sm text-slate-600">'
            + '<div><p class="text-slate-400 uppercase tracking-[0.12em] text-xs">Subject</p><p class="mt-2 font-semibold text-slate-900">' + helpers.escapeHtml(classItem.subject || 'Not set') + '</p></div>'
            + '<div><p class="text-slate-400 uppercase tracking-[0.12em] text-xs">Room / batch</p><p class="mt-2 font-semibold text-slate-900">' + helpers.escapeHtml(classItem.room || 'Not set') + '</p></div>'
            + '<div><p class="text-slate-400 uppercase tracking-[0.12em] text-xs">Schedule</p><p class="mt-2 font-semibold text-slate-900">' + helpers.escapeHtml(classItem.schedule || 'Not set') + '</p></div>'
            + '<div><p class="text-slate-400 uppercase tracking-[0.12em] text-xs">Status</p><p class="mt-2 font-semibold text-slate-900">' + helpers.escapeHtml(classItem.active ? 'Active' : 'Inactive') + '</p></div>'
            + '</div>'
            + (classItem.description ? '<p class="text-sm text-slate-600 mt-5">' + helpers.escapeHtml(classItem.description) + '</p>' : '<p class="text-sm text-slate-500 mt-5">No class description added yet.</p>')
            + '</article>'
            + '<article class="rounded-[1.35rem] border border-slate-200 bg-white p-5">'
            + '<div class="flex items-center justify-between gap-3"><h3 class="lms-section-title">Roster Snapshot</h3><span class="lms-badge lms-badge-green">' + helpers.escapeHtml(String(students.length)) + ' students</span></div>'
            + '<div class="mt-5">'
            + '<p class="text-xs uppercase tracking-[0.12em] text-slate-400">Teachers</p>'
            + (teachers.length
                ? '<div class="lms-chip-list mt-3">' + teachers.map((teacher) => '<span class="lms-chip"><i class="fas fa-user-tie" aria-hidden="true"></i>' + helpers.escapeHtml(teacher.fullName || teacher.username) + '</span>').join('') + '</div>'
                : '<div class="mt-3">' + emptyState('No teachers assigned yet.') + '</div>')
            + '</div>'
            + '<div class="mt-5">'
            + '<p class="text-xs uppercase tracking-[0.12em] text-slate-400">Students</p>'
            + (students.length
                ? '<div class="lms-chip-list mt-3">' + visibleStudents.map((student) => '<span class="lms-chip"><i class="fas fa-user-graduate" aria-hidden="true"></i>' + helpers.escapeHtml(student.fullName || student.username) + '</span>').join('') + '</div>' + (remainingStudents > 0 ? '<p class="text-sm text-slate-500 mt-3">+' + helpers.escapeHtml(String(remainingStudents)) + ' more students assigned.</p>' : '')
                : '<div class="mt-3">' + emptyState('No students assigned yet.') + '</div>')
            + '</div>'
            + '</article>';
    }

    function renderAssignments() {
        const helpers = window.TuitionSolutionLms;
        const container = byId('admin-assignment-list');
        const items = state.workspace && Array.isArray(state.workspace.assignments) ? state.workspace.assignments : [];

        if (!state.workspace) {
            container.innerHTML = emptyState('Select a class to manage assignments.');
            return;
        }

        container.innerHTML = items.length
            ? items.map((item) => '<article class="lms-dashboard-card p-4">'
                + '<div class="flex items-start justify-between gap-4">'
                + '<div>'
                + '<div class="flex items-center gap-2 flex-wrap"><h4 class="font-semibold text-slate-900">' + helpers.escapeHtml(item.title) + '</h4><span class="lms-badge lms-badge-orange">Due ' + helpers.escapeHtml(helpers.formatDate(item.dueDate)) + '</span></div>'
                + '<p class="text-sm text-slate-500 mt-2">' + helpers.escapeHtml(item.description || 'No description added.') + '</p>'
                + (item.resourceLink ? '<a href="' + helpers.escapeHtml(item.resourceLink) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-sm text-primary-600 mt-3 hover:text-primary-700"><i class="fas fa-link" aria-hidden="true"></i> Resource</a>' : '')
                + '</div>'
                + '<div class="lms-inline-actions">'
                + '<button type="button" class="lms-inline-button" data-edit-assignment="' + helpers.escapeHtml(item.id) + '">Edit</button>'
                + '<button type="button" class="lms-inline-button lms-inline-button-danger" data-delete-assignment="' + helpers.escapeHtml(item.id) + '">Delete</button>'
                + '</div>'
                + '</div>'
                + '</article>').join('')
            : emptyState('No assignments added yet for this class.');
    }

    function renderQuizzes() {
        const helpers = window.TuitionSolutionLms;
        const container = byId('admin-quiz-list');
        const items = state.workspace && Array.isArray(state.workspace.quizzes) ? state.workspace.quizzes : [];

        if (!state.workspace) {
            container.innerHTML = emptyState('Select a class to manage quizzes.');
            return;
        }

        container.innerHTML = items.length
            ? items.map((item) => '<article class="lms-dashboard-card p-4">'
                + '<div class="flex items-start justify-between gap-4">'
                + '<div>'
                + '<div class="flex items-center gap-2 flex-wrap"><h4 class="font-semibold text-slate-900">' + helpers.escapeHtml(item.title) + '</h4><span class="lms-badge lms-badge-blue">' + helpers.escapeHtml(String(item.totalMarks)) + ' Marks</span></div>'
                + '<p class="text-sm text-slate-500 mt-2">Scheduled ' + helpers.escapeHtml(helpers.formatDate(item.scheduledFor)) + '</p>'
                + '<p class="text-sm text-slate-500 mt-1">' + helpers.escapeHtml(item.description || 'No description added.') + '</p>'
                + '</div>'
                + '<div class="lms-inline-actions">'
                + '<button type="button" class="lms-inline-button" data-edit-quiz="' + helpers.escapeHtml(item.id) + '">Edit</button>'
                + '<button type="button" class="lms-inline-button lms-inline-button-danger" data-delete-quiz="' + helpers.escapeHtml(item.id) + '">Delete</button>'
                + '</div>'
                + '</div>'
                + '</article>').join('')
            : emptyState('No quizzes added yet for this class.');
    }

    function renderAttendanceRows(recordToLoad) {
        const helpers = window.TuitionSolutionLms;
        const container = byId('admin-attendance-student-list');

        if (!state.workspace) {
            container.innerHTML = emptyState('Select a class to manage attendance.');
            return;
        }

        const classItem = state.workspace.classItem;
        const selectedEntries = new Map((recordToLoad && recordToLoad.entries ? recordToLoad.entries : []).map((entry) => [entry.studentId, entry]));

        container.innerHTML = (classItem.students || []).length
            ? classItem.students.map((student) => {
                const existing = selectedEntries.get(student.id);
                const selectedStatus = existing ? existing.status : 'present';
                return '<div class="grid sm:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)] gap-3 items-center rounded-2xl border border-slate-200 bg-white px-4 py-3">'
                    + '<div><p class="font-semibold text-slate-900">' + helpers.escapeHtml(student.fullName || student.username) + '</p><p class="text-sm text-slate-500">' + helpers.escapeHtml(student.username) + '</p></div>'
                    + '<select class="admin-attendance-status rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-primary-500" data-student-id="' + helpers.escapeHtml(student.id) + '">'
                    + ['present', 'absent', 'late', 'excused'].map((status) => '<option value="' + status + '" ' + (selectedStatus === status ? 'selected' : '') + '>' + status.charAt(0).toUpperCase() + status.slice(1) + '</option>').join('')
                    + '</select>'
                    + '<input type="text" class="admin-attendance-remarks rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-primary-500" data-remarks-student-id="' + helpers.escapeHtml(student.id) + '" placeholder="remarks (optional)" value="' + helpers.escapeHtml(existing && existing.remarks ? existing.remarks : '') + '">'
                    + '</div>';
            }).join('')
            : emptyState('No students assigned to this class yet.');
    }

    function renderAttendanceHistory() {
        const helpers = window.TuitionSolutionLms;
        const container = byId('admin-attendance-list');
        const items = state.workspace && Array.isArray(state.workspace.attendance) ? state.workspace.attendance : [];

        if (!state.workspace) {
            container.innerHTML = emptyState('Select a class to manage attendance history.');
            return;
        }

        container.innerHTML = items.length
            ? items.map((item) => '<article class="lms-dashboard-card p-4">'
                + '<div class="flex items-center justify-between gap-4">'
                + '<div><h4 class="font-semibold text-slate-900">' + helpers.escapeHtml(item.date) + '</h4><p class="text-sm text-slate-500 mt-2">' + helpers.escapeHtml(String(item.entries.length)) + ' students recorded</p></div>'
                + '<div class="lms-inline-actions">'
                + '<button type="button" class="lms-inline-button" data-load-attendance="' + helpers.escapeHtml(item.date) + '">Load</button>'
                + '<button type="button" class="lms-inline-button lms-inline-button-danger" data-delete-attendance="' + helpers.escapeHtml(item.date) + '">Delete</button>'
                + '</div>'
                + '</div>'
                + '</article>').join('')
            : emptyState('No attendance logs yet for this class.');
    }

    function renderMarkFormOptions(selectedStudentId) {
        const helpers = window.TuitionSolutionLms;
        const select = byId('admin-mark-student-id');
        const students = state.workspace && state.workspace.classItem ? (state.workspace.classItem.students || []) : [];

        if (!students.length) {
            select.disabled = true;
            select.innerHTML = '<option value="">No students assigned</option>';
            return;
        }

        select.disabled = false;
        select.innerHTML = '<option value="">Select student</option>' + students.map((student) => '<option value="' + helpers.escapeHtml(student.id) + '">' + helpers.escapeHtml(student.fullName || student.username) + '</option>').join('');
        if (selectedStudentId) {
            select.value = selectedStudentId;
        }
    }

    function renderMarks() {
        const helpers = window.TuitionSolutionLms;
        const container = byId('admin-mark-list');

        if (!state.workspace) {
            container.innerHTML = emptyState('Select a class to manage marks.');
            return;
        }

        const rows = state.workspace.marks || [];
        const studentMap = new Map((state.workspace.classItem.students || []).map((student) => [student.id, student]));
        container.innerHTML = rows.length
            ? '<div class="lms-table-wrap"><table class="lms-table"><thead><tr><th>Student</th><th>Assessment</th><th>Score</th><th>Month</th><th>Status</th><th>Actions</th></tr></thead><tbody>'
                + rows.map((row) => '<tr>'
                    + '<td>' + helpers.escapeHtml(((studentMap.get(row.studentId) || {}).fullName) || row.studentId) + '</td>'
                    + '<td>' + helpers.escapeHtml(row.title + ' (' + row.type + ')') + (row.sourceType === 'assignment' ? '<div class="text-xs text-slate-400 mt-1">Assignment linked</div>' : '') + '</td>'
                    + '<td>' + helpers.escapeHtml(String(row.score)) + ' / ' + helpers.escapeHtml(String(row.totalMarks)) + '</td>'
                    + '<td>' + helpers.escapeHtml(formatReportMonthLabel(row.reportMonth || String(row.recordedAt || '').slice(0, 7))) + '</td>'
                    + '<td>' + (row.status === 'posted' ? '<span class="lms-badge lms-badge-green">Posted</span>' : '<span class="lms-badge lms-badge-orange">Draft</span>') + '</td>'
                    + '<td><div class="lms-inline-actions"><button type="button" class="lms-inline-button" data-edit-mark="' + helpers.escapeHtml(row.id) + '">Edit</button><button type="button" class="lms-inline-button lms-inline-button-danger" data-delete-mark="' + helpers.escapeHtml(row.id) + '">Delete</button></div></td>'
                    + '</tr>').join('')
                + '</tbody></table></div>'
            : emptyState('No marks recorded yet for this class.');
    }

    function renderReportManager() {
        const helpers = window.TuitionSolutionLms;
        const classFilter = byId('admin-report-class-filter');
        const monthFilter = byId('admin-report-month-filter');
        const container = byId('admin-report-list');
        const reports = state.reports || [];
        const availableMonths = Array.from(new Set(reports.map((reportItem) => reportItem.reportMonth).filter(Boolean))).sort().reverse();

        if (classFilter) {
            if (state.reportClassFilter && !state.classes.some((item) => item.id === state.reportClassFilter)) {
                state.reportClassFilter = '';
            }

            classFilter.innerHTML = '<option value="">All classes</option>' + state.classes.map((item) => '<option value="' + helpers.escapeHtml(item.id) + '" ' + (state.reportClassFilter === item.id ? 'selected' : '') + '>' + helpers.escapeHtml(item.name) + '</option>').join('');
        }

        if (monthFilter) {
            if (state.reportMonthFilter && availableMonths.indexOf(state.reportMonthFilter) === -1) {
                state.reportMonthFilter = '';
            }

            monthFilter.innerHTML = '<option value="">All months</option>' + availableMonths.map((month) => '<option value="' + helpers.escapeHtml(month) + '" ' + (state.reportMonthFilter === month ? 'selected' : '') + '>' + helpers.escapeHtml(formatReportMonthLabel(month)) + '</option>').join('');
        }

        const filteredReports = reports.filter((reportItem) => {
            const classMatch = !state.reportClassFilter || reportItem.classId === state.reportClassFilter;
            const monthMatch = !state.reportMonthFilter || reportItem.reportMonth === state.reportMonthFilter;
            return classMatch && monthMatch;
        });

        container.innerHTML = filteredReports.length
            ? filteredReports.map((reportItem) => '<article class="lms-dashboard-card p-5">'
                + '<div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">'
                + '<div>'
                + '<div class="flex items-center gap-2 flex-wrap"><h3 class="font-semibold text-slate-900">' + helpers.escapeHtml(reportItem.className || 'Class report') + '</h3><span class="lms-badge lms-badge-slate">' + helpers.escapeHtml(formatReportMonthLabel(reportItem.reportMonth)) + '</span>' + getReportStatusBadge(reportItem) + '</div>'
                + '<p class="text-sm text-slate-500 mt-2">Top 1: ' + helpers.escapeHtml(reportItem.topStudent && (reportItem.topStudent.fullName || reportItem.topStudent.username) ? (reportItem.topStudent.fullName || reportItem.topStudent.username) : 'Not available') + (reportItem.topStudent ? ' (' + helpers.escapeHtml(String(reportItem.topStudent.averagePercentage || 0)) + '%)' : '') + '</p>'
                + '<p class="text-sm text-slate-500 mt-1">Posted on ' + helpers.escapeHtml(helpers.formatDate(reportItem.postedAt, true)) + ' | ' + helpers.escapeHtml(String((reportItem.summary && reportItem.summary.postedMarksCount) || 0)) + ' marks</p>'
                + (reportItem.announcementSummary ? '<p class="text-sm text-slate-500 mt-3 max-w-3xl">' + helpers.escapeHtml(reportItem.announcementSummary) + '</p>' : '')
                + '</div>'
                + '<div class="lms-inline-actions">'
                + '<button type="button" class="lms-inline-button" data-open-report-class="' + helpers.escapeHtml(reportItem.classId) + '">Open Marks</button>'
                + '<button type="button" class="lms-inline-button" data-toggle-report-active="' + helpers.escapeHtml(reportItem.id) + '">' + (reportItem.active ? 'Deactivate' : 'Activate') + '</button>'
                + '<button type="button" class="lms-inline-button" data-toggle-report-hidden="' + helpers.escapeHtml(reportItem.id) + '">' + (reportItem.hidden ? 'Show' : 'Hide') + '</button>'
                + '<button type="button" class="lms-inline-button lms-inline-button-danger" data-delete-report="' + helpers.escapeHtml(reportItem.id) + '">Delete</button>'
                + '</div>'
                + '</div>'
                + '</article>').join('')
            : emptyState('No monthly reports match the selected filters.');
    }

    function renderWorkspace() {
        renderWorkspaceSelector();
        renderWorkspaceSummary();
        renderWorkspaceOverview();
        renderAssignments();
        renderQuizzes();
        renderAttendanceRows();
        renderAttendanceHistory();
        renderMarkFormOptions('');
        renderMarks();
    }

    function populateUserForm(prefix, user) {
        byId(prefix + '-id').value = user.id;
        byId(prefix + '-full-name').value = user.fullName || '';
        byId(prefix + '-username').value = user.username || '';
        byId(prefix + '-email').value = user.email || '';
        byId(prefix + '-phone').value = user.phone || '';
        byId(prefix + '-password').value = '';
        byId(prefix + '-active').checked = Boolean(user.active);
        byId(prefix + '-cancel').classList.remove('hidden');
    }

    function populateClassForm(classItem) {
        byId('class-id').value = classItem.id;
        byId('class-name').value = classItem.name || '';
        byId('class-code').value = classItem.code || '';
        byId('class-subject').value = classItem.subject || '';
        byId('class-schedule').value = classItem.schedule || '';
        byId('class-room').value = classItem.room || '';
        byId('class-description').value = classItem.description || '';
        byId('class-active').checked = Boolean(classItem.active);
        byId('class-cancel').classList.remove('hidden');
        renderClassSelectors(classItem.teacherIds || [], classItem.studentIds || []);
    }

    function loadAssignmentIntoForm(id) {
        const item = state.workspace && (state.workspace.assignments || []).find((assignment) => assignment.id === id);
        if (!item) {
            return;
        }

        byId('admin-assignment-id').value = item.id;
        byId('admin-assignment-title').value = item.title || '';
        byId('admin-assignment-due-date').value = window.TuitionSolutionLms.formatDateInput(item.dueDate);
        byId('admin-assignment-resource-link').value = item.resourceLink || '';
        byId('admin-assignment-description').value = item.description || '';
        byId('admin-assignment-cancel').classList.remove('hidden');
    }

    function loadQuizIntoForm(id) {
        const item = state.workspace && (state.workspace.quizzes || []).find((quiz) => quiz.id === id);
        if (!item) {
            return;
        }

        byId('admin-quiz-id').value = item.id;
        byId('admin-quiz-title').value = item.title || '';
        byId('admin-quiz-scheduled-for').value = window.TuitionSolutionLms.formatDateInput(item.scheduledFor);
        byId('admin-quiz-total-marks').value = item.totalMarks || '';
        byId('admin-quiz-description').value = item.description || '';
        byId('admin-quiz-cancel').classList.remove('hidden');
    }

    function loadAttendanceRecord(date) {
        const helpers = window.TuitionSolutionLms;
        const record = state.workspace && (state.workspace.attendance || []).find((item) => item.date === date);
        if (!record) {
            return;
        }

        byId('admin-attendance-date').value = record.date;
        byId('admin-attendance-reset').classList.remove('hidden');
        renderAttendanceRows(record);
        helpers.renderNotice(byId('admin-notice'), 'Attendance record loaded into the form.', 'info');
    }

    function loadMarkIntoForm(id) {
        const item = state.workspace && (state.workspace.marks || []).find((mark) => mark.id === id);
        if (!item) {
            return;
        }

        byId('admin-mark-id').value = item.id;
        renderMarkFormOptions(item.studentId);
        byId('admin-mark-title').value = item.title || '';
        byId('admin-mark-type').value = item.type || 'assignment';
        byId('admin-mark-score').value = item.score || '';
        byId('admin-mark-total').value = item.totalMarks || '';
        byId('admin-mark-recorded-at').value = window.TuitionSolutionLms.formatDateInput(item.recordedAt);
        byId('admin-mark-notes').value = item.notes || '';
        byId('admin-mark-cancel').classList.remove('hidden');
    }

    async function loadWorkspace(classId) {
        const api = window.TuitionSolutionLms.getApi();

        state.selectedClassId = classId || '';
        renderClassList();

        if (!state.selectedClassId) {
            state.workspace = null;
            renderWorkspace();
            return;
        }

        state.workspace = await api.lmsClassWorkspace(state.selectedClassId);
        renderClassList();
        renderWorkspace();
    }

    async function loadDashboard() {
        const api = window.TuitionSolutionLms.getApi();
        const [overview, teachersResponse, studentsResponse, resetRequestsResponse, classesResponse, reportsResponse] = await Promise.all([
            api.lmsAdminOverview(),
            api.lmsUsers('teacher'),
            api.lmsUsers('student'),
            api.lmsPasswordResetRequests('pending'),
            api.lmsClasses(),
            api.lmsAdminMonthlyReports()
        ]);

        state.teachers = Array.isArray(teachersResponse.users) ? teachersResponse.users : [];
        state.students = Array.isArray(studentsResponse.users) ? studentsResponse.users : [];
        state.resetRequests = Array.isArray(resetRequestsResponse.requests) ? resetRequestsResponse.requests : [];
        state.classes = Array.isArray(classesResponse.classes) ? classesResponse.classes : [];
        state.reports = Array.isArray(reportsResponse.reports) ? reportsResponse.reports : [];

        renderOverview(overview.stats || {});
        renderUserList('teacher-list', state.teachers, 'No teachers created yet.', 'lms-badge-blue');
        renderUserList('student-list', state.students, 'No students created yet.', 'lms-badge-orange');
        renderResetRequests();
        renderClassSelectors([], []);
        renderReportManager();

        if (!state.classes.some((item) => item.id === state.selectedClassId)) {
            state.selectedClassId = state.classes.length ? state.classes[0].id : '';
        }

        renderClassList();
        await loadWorkspace(state.selectedClassId);
    }

    async function saveUser(role, event) {
        event.preventDefault();
        const api = window.TuitionSolutionLms.getApi();
        const helpers = window.TuitionSolutionLms;
        const prefix = role === 'teacher' ? 'teacher' : 'student';
        const userId = byId(prefix + '-id').value;
        const payload = {
            role,
            fullName: byId(prefix + '-full-name').value.trim(),
            username: byId(prefix + '-username').value.trim(),
            email: byId(prefix + '-email').value.trim(),
            phone: byId(prefix + '-phone').value.trim(),
            password: byId(prefix + '-password').value,
            active: byId(prefix + '-active').checked
        };

        try {
            if (userId) {
                await api.lmsUpdateUser(userId, payload);
                helpers.renderNotice(byId('admin-notice'), payload.password
                    ? 'Account updated successfully. User must change this password on next login.'
                    : 'Account updated successfully.', 'success');
            } else {
                await api.lmsCreateUser(payload);
                helpers.renderNotice(byId('admin-notice'), 'Account created successfully. Password change will be required on first login.', 'success');
            }

            resetUserForm(prefix);
            await loadDashboard();
        } catch (error) {
            helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to save account.', 'error');
        }
    }

    async function resetPasswordRequest(requestId) {
        const helpers = window.TuitionSolutionLms;

        if (!window.confirm('Issue a temporary password for this reset request?')) {
            return;
        }

        try {
            const response = await helpers.getApi().lmsResetPasswordRequest(requestId);
            await loadDashboard();
            helpers.renderNotice(byId('admin-notice'), 'Temporary password for ' + ((response && response.user && (response.user.fullName || response.user.username)) || 'the user') + ': ' + ((response && response.temporaryPassword) || ''), 'success');
        } catch (error) {
            helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to reset password request.', 'error');
        }
    }

    async function saveClass(event) {
        event.preventDefault();
        const api = window.TuitionSolutionLms.getApi();
        const helpers = window.TuitionSolutionLms;
        const classId = byId('class-id').value;
        const payload = {
            name: byId('class-name').value.trim(),
            code: byId('class-code').value.trim(),
            subject: byId('class-subject').value.trim(),
            schedule: byId('class-schedule').value.trim(),
            room: byId('class-room').value.trim(),
            description: byId('class-description').value.trim(),
            teacherIds: getCheckedValues('class-teacher-options'),
            studentIds: getCheckedValues('class-student-options'),
            active: byId('class-active').checked
        };

        try {
            let response;
            if (classId) {
                response = await api.lmsUpdateClass(classId, payload);
                helpers.renderNotice(byId('admin-notice'), 'Class updated successfully.', 'success');
            } else {
                response = await api.lmsCreateClass(payload);
                helpers.renderNotice(byId('admin-notice'), 'Class created successfully.', 'success');
            }

            state.selectedClassId = response && response.classItem ? response.classItem.id : state.selectedClassId;
            resetClassForm();
            await loadDashboard();
        } catch (error) {
            helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to save class.', 'error');
        }
    }

    async function saveAssignment(event) {
        event.preventDefault();
        const helpers = window.TuitionSolutionLms;

        try {
            const classId = ensureSelectedClass();
            await helpers.getApi().lmsSaveAssignment(classId, {
                id: byId('admin-assignment-id').value,
                title: byId('admin-assignment-title').value.trim(),
                dueDate: byId('admin-assignment-due-date').value,
                resourceLink: byId('admin-assignment-resource-link').value.trim(),
                description: byId('admin-assignment-description').value.trim()
            });
            resetAssignmentForm();
            await loadDashboard();
            helpers.renderNotice(byId('admin-notice'), 'Assignment saved successfully.', 'success');
        } catch (error) {
            helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to save assignment.', 'error');
        }
    }

    async function saveQuiz(event) {
        event.preventDefault();
        const helpers = window.TuitionSolutionLms;

        try {
            const classId = ensureSelectedClass();
            await helpers.getApi().lmsSaveQuiz(classId, {
                id: byId('admin-quiz-id').value,
                title: byId('admin-quiz-title').value.trim(),
                scheduledFor: byId('admin-quiz-scheduled-for').value,
                totalMarks: Number(byId('admin-quiz-total-marks').value),
                description: byId('admin-quiz-description').value.trim()
            });
            resetQuizForm();
            await loadDashboard();
            helpers.renderNotice(byId('admin-notice'), 'Quiz saved successfully.', 'success');
        } catch (error) {
            helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to save quiz.', 'error');
        }
    }

    async function saveAttendance(event) {
        event.preventDefault();
        const helpers = window.TuitionSolutionLms;

        try {
            const classId = ensureSelectedClass();
            const entries = Array.from(byId('admin-attendance-student-list').querySelectorAll('.admin-attendance-status')).map((select) => {
                const studentId = select.getAttribute('data-student-id');
                const remarksInput = byId('admin-attendance-student-list').querySelector('[data-remarks-student-id="' + studentId + '"]');
                return {
                    studentId,
                    status: select.value,
                    remarks: remarksInput ? remarksInput.value.trim() : ''
                };
            });

            await helpers.getApi().lmsSaveAttendance(classId, {
                date: byId('admin-attendance-date').value,
                entries
            });
            resetAttendanceForm();
            await loadDashboard();
            helpers.renderNotice(byId('admin-notice'), 'Attendance saved successfully.', 'success');
        } catch (error) {
            helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to save attendance.', 'error');
        }
    }

    async function saveMark(event) {
        event.preventDefault();
        const helpers = window.TuitionSolutionLms;

        try {
            const classId = ensureSelectedClass();
            await helpers.getApi().lmsSaveMark(classId, {
                id: byId('admin-mark-id').value,
                studentId: byId('admin-mark-student-id').value,
                title: byId('admin-mark-title').value.trim(),
                type: byId('admin-mark-type').value,
                score: Number(byId('admin-mark-score').value),
                totalMarks: Number(byId('admin-mark-total').value),
                recordedAt: byId('admin-mark-recorded-at').value,
                notes: byId('admin-mark-notes').value.trim()
            });
            resetMarkForm();
            await loadDashboard();
            helpers.renderNotice(byId('admin-notice'), 'Marks saved successfully.', 'success');
        } catch (error) {
            helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to save marks.', 'error');
        }
    }

    async function deleteAssignment(assignmentId) {
        const helpers = window.TuitionSolutionLms;
        if (!window.confirm('Delete this assignment?')) {
            return;
        }

        try {
            await helpers.getApi().lmsDeleteAssignment(ensureSelectedClass(), assignmentId);
            if (byId('admin-assignment-id').value === assignmentId) {
                resetAssignmentForm();
            }
            await loadDashboard();
            helpers.renderNotice(byId('admin-notice'), 'Assignment deleted successfully.', 'success');
        } catch (error) {
            helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to delete assignment.', 'error');
        }
    }

    async function deleteQuiz(quizId) {
        const helpers = window.TuitionSolutionLms;
        if (!window.confirm('Delete this quiz?')) {
            return;
        }

        try {
            await helpers.getApi().lmsDeleteQuiz(ensureSelectedClass(), quizId);
            if (byId('admin-quiz-id').value === quizId) {
                resetQuizForm();
            }
            await loadDashboard();
            helpers.renderNotice(byId('admin-notice'), 'Quiz deleted successfully.', 'success');
        } catch (error) {
            helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to delete quiz.', 'error');
        }
    }

    async function deleteAttendance(date) {
        const helpers = window.TuitionSolutionLms;
        if (!window.confirm('Delete the attendance record for ' + date + '?')) {
            return;
        }

        try {
            await helpers.getApi().lmsDeleteAttendance(ensureSelectedClass(), date);
            if (byId('admin-attendance-date').value === date) {
                resetAttendanceForm();
            }
            await loadDashboard();
            helpers.renderNotice(byId('admin-notice'), 'Attendance record deleted successfully.', 'success');
        } catch (error) {
            helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to delete attendance record.', 'error');
        }
    }

    async function deleteMark(markId) {
        const helpers = window.TuitionSolutionLms;
        if (!window.confirm('Delete this mark entry?')) {
            return;
        }

        try {
            await helpers.getApi().lmsDeleteMark(ensureSelectedClass(), markId);
            if (byId('admin-mark-id').value === markId) {
                resetMarkForm();
            }
            await loadDashboard();
            helpers.renderNotice(byId('admin-notice'), 'Mark entry deleted successfully.', 'success');
        } catch (error) {
            helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to delete mark entry.', 'error');
        }
    }

    async function updateReport(reportId, payload, successMessage) {
        const helpers = window.TuitionSolutionLms;

        try {
            await helpers.getApi().lmsUpdateMonthlyReport(reportId, payload);
            await loadDashboard();
            helpers.renderNotice(byId('admin-notice'), successMessage, 'success');
        } catch (error) {
            helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to update the monthly report.', 'error');
        }
    }

    async function deleteReport(reportId) {
        const helpers = window.TuitionSolutionLms;
        if (!window.confirm('Delete this monthly report from the public feed? Marks will remain posted in LMS.')) {
            return;
        }

        try {
            await helpers.getApi().lmsDeleteMonthlyReport(reportId);
            await loadDashboard();
            helpers.renderNotice(byId('admin-notice'), 'Monthly report deleted from the public feed.', 'success');
        } catch (error) {
            helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to delete the monthly report.', 'error');
        }
    }

    function bindListActions() {
        const helpers = window.TuitionSolutionLms;

        byId('teacher-list').addEventListener('click', (event) => {
            const button = event.target.closest('[data-edit-user]');
            if (!button) {
                return;
            }

            const user = state.teachers.find((item) => item.id === button.getAttribute('data-edit-user'));
            if (user) {
                populateUserForm('teacher', user);
                helpers.renderNotice(byId('admin-notice'), 'Teacher loaded into the form for editing.', 'info');
            }
        });

        byId('student-list').addEventListener('click', (event) => {
            const button = event.target.closest('[data-edit-user]');
            if (!button) {
                return;
            }

            const user = state.students.find((item) => item.id === button.getAttribute('data-edit-user'));
            if (user) {
                populateUserForm('student', user);
                helpers.renderNotice(byId('admin-notice'), 'Student loaded into the form for editing.', 'info');
            }
        });

        byId('admin-reset-request-list').addEventListener('click', (event) => {
            const button = event.target.closest('[data-reset-request]');
            if (!button) {
                return;
            }

            resetPasswordRequest(button.getAttribute('data-reset-request'));
        });

        byId('class-list').addEventListener('click', async (event) => {
            const openButton = event.target.closest('[data-open-class]');
            if (openButton) {
                try {
                    await loadWorkspace(openButton.getAttribute('data-open-class'));
                    resetAssignmentForm();
                    resetQuizForm();
                    resetAttendanceForm();
                    resetMarkForm();
                    if (viewNavigator) {
                        viewNavigator.setActiveView('admin-workspace-section');
                    }
                } catch (error) {
                    helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to load class workspace.', 'error');
                }
                return;
            }

            const editButton = event.target.closest('[data-edit-class]');
            if (!editButton) {
                return;
            }

            const classItem = state.classes.find((item) => item.id === editButton.getAttribute('data-edit-class'));
            if (classItem) {
                populateClassForm(classItem);
                helpers.renderNotice(byId('admin-notice'), 'Class loaded into the form for editing.', 'info');
            }
        });

        byId('admin-assignment-list').addEventListener('click', (event) => {
            const editButton = event.target.closest('[data-edit-assignment]');
            if (editButton) {
                loadAssignmentIntoForm(editButton.getAttribute('data-edit-assignment'));
                return;
            }

            const deleteButton = event.target.closest('[data-delete-assignment]');
            if (deleteButton) {
                deleteAssignment(deleteButton.getAttribute('data-delete-assignment'));
            }
        });

        byId('admin-quiz-list').addEventListener('click', (event) => {
            const editButton = event.target.closest('[data-edit-quiz]');
            if (editButton) {
                loadQuizIntoForm(editButton.getAttribute('data-edit-quiz'));
                return;
            }

            const deleteButton = event.target.closest('[data-delete-quiz]');
            if (deleteButton) {
                deleteQuiz(deleteButton.getAttribute('data-delete-quiz'));
            }
        });

        byId('admin-attendance-list').addEventListener('click', (event) => {
            const loadButton = event.target.closest('[data-load-attendance]');
            if (loadButton) {
                loadAttendanceRecord(loadButton.getAttribute('data-load-attendance'));
                return;
            }

            const deleteButton = event.target.closest('[data-delete-attendance]');
            if (deleteButton) {
                deleteAttendance(deleteButton.getAttribute('data-delete-attendance'));
            }
        });

        byId('admin-mark-list').addEventListener('click', (event) => {
            const editButton = event.target.closest('[data-edit-mark]');
            if (editButton) {
                loadMarkIntoForm(editButton.getAttribute('data-edit-mark'));
                return;
            }

            const deleteButton = event.target.closest('[data-delete-mark]');
            if (deleteButton) {
                deleteMark(deleteButton.getAttribute('data-delete-mark'));
            }
        });

        byId('admin-report-class-filter').addEventListener('change', (event) => {
            state.reportClassFilter = event.target.value;
            renderReportManager();
        });

        byId('admin-report-month-filter').addEventListener('change', (event) => {
            state.reportMonthFilter = event.target.value;
            renderReportManager();
        });

        byId('admin-report-list').addEventListener('click', async (event) => {
            const reportId = (event.target.closest('[data-toggle-report-active]') || event.target.closest('[data-toggle-report-hidden]') || event.target.closest('[data-delete-report]'))
                ? (event.target.closest('[data-toggle-report-active]') || event.target.closest('[data-toggle-report-hidden]') || event.target.closest('[data-delete-report]')).getAttribute('data-toggle-report-active')
                    || (event.target.closest('[data-toggle-report-hidden]') ? event.target.closest('[data-toggle-report-hidden]').getAttribute('data-toggle-report-hidden') : '')
                    || (event.target.closest('[data-delete-report]') ? event.target.closest('[data-delete-report]').getAttribute('data-delete-report') : '')
                : '';

            const reportItem = state.reports.find((item) => item.id === reportId);
            const openClassButton = event.target.closest('[data-open-report-class]');
            if (openClassButton) {
                try {
                    await loadWorkspace(openClassButton.getAttribute('data-open-report-class'));
                    if (viewNavigator) {
                        viewNavigator.setActiveView('admin-marks-section');
                    }
                } catch (error) {
                    helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to open the class marks view.', 'error');
                }
                return;
            }

            const activeButton = event.target.closest('[data-toggle-report-active]');
            if (activeButton && reportItem) {
                updateReport(reportItem.id, { active: !reportItem.active, hidden: reportItem.hidden }, reportItem.active ? 'Monthly report deactivated.' : 'Monthly report activated.');
                return;
            }

            const hiddenButton = event.target.closest('[data-toggle-report-hidden]');
            if (hiddenButton && reportItem) {
                updateReport(reportItem.id, { active: reportItem.active, hidden: !reportItem.hidden }, reportItem.hidden ? 'Monthly report is visible again.' : 'Monthly report hidden from the public page.');
                return;
            }

            const deleteButton = event.target.closest('[data-delete-report]');
            if (deleteButton && reportItem) {
                deleteReport(reportItem.id);
            }
        });
    }

    async function showDashboard(user) {
        state.currentUser = user;
        byId('admin-loading-screen').classList.add('hidden');
        byId('admin-dashboard-shell').classList.remove('hidden');
        byId('admin-name').textContent = user.fullName || user.username;
        await loadDashboard();
        resetAssignmentForm();
        resetQuizForm();
        resetAttendanceForm();
        resetMarkForm();
        if (viewNavigator) {
            viewNavigator.sync(state.activeView);
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const helpers = window.TuitionSolutionLms;

        viewNavigator = helpers.createViewNavigator({
            navRoot: byId('admin-view-nav'),
            panelRoot: byId('admin-view-stack'),
            defaultView: state.activeView,
            onChange: function (viewId) {
                state.activeView = viewId;
            }
        });
        viewNavigator.sync(state.activeView);

        bindListActions();

        byId('teacher-form').addEventListener('submit', saveUser.bind(null, 'teacher'));
        byId('student-form').addEventListener('submit', saveUser.bind(null, 'student'));
        byId('class-form').addEventListener('submit', saveClass);
        byId('admin-assignment-form').addEventListener('submit', saveAssignment);
        byId('admin-quiz-form').addEventListener('submit', saveQuiz);
        byId('admin-attendance-form').addEventListener('submit', saveAttendance);
        byId('admin-mark-form').addEventListener('submit', saveMark);

        byId('teacher-cancel').addEventListener('click', () => resetUserForm('teacher'));
        byId('student-cancel').addEventListener('click', () => resetUserForm('student'));
        byId('class-cancel').addEventListener('click', resetClassForm);
        byId('admin-assignment-cancel').addEventListener('click', resetAssignmentForm);
        byId('admin-quiz-cancel').addEventListener('click', resetQuizForm);
        byId('admin-attendance-reset').addEventListener('click', resetAttendanceForm);
        byId('admin-mark-cancel').addEventListener('click', resetMarkForm);
        byId('admin-logout').addEventListener('click', () => helpers.logout('lms.html'));

        byId('admin-workspace-class').addEventListener('change', async (event) => {
            try {
                await loadWorkspace(event.target.value);
                resetAssignmentForm();
                resetQuizForm();
                resetAttendanceForm();
                resetMarkForm();
                if (viewNavigator) {
                    viewNavigator.setActiveView('admin-workspace-section');
                }
            } catch (error) {
                helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to load class workspace.', 'error');
            }
        });

        resetUserForm('teacher');
        resetUserForm('student');
        resetClassForm();
        resetAssignmentForm();
        resetQuizForm();

        try {
            const user = await helpers.ensureRole('super_admin', 'lms.html');
            if (!user) {
                return;
            }

            await showDashboard(user);
        } catch (error) {
            byId('admin-loading-screen').classList.add('hidden');
            byId('admin-dashboard-shell').classList.remove('hidden');
            helpers.renderNotice(byId('admin-notice'), error.message || 'Unable to load the super admin dashboard.', 'error');
        }
    });
})();