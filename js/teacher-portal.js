(function () {
    'use strict';

    const state = {
        currentUser: null,
        classes: [],
        selectedClassId: '',
        workspace: null,
        activeView: 'teacher-overview-section',
        portalReady: false,
        selectedAssignmentId: '',
        selectedMarkStudentId: '',
        marksFilterMonth: '',
        marksFilterType: '',
        selectedReportMonth: ''
    };

    let viewNavigator = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function emptyState(message) {
        const helpers = window.TuitionSolutionLms;
        return '<div class="lms-empty"><p>' + helpers.escapeHtml(message) + '</p></div>';
    }

    function resetAssignmentForm() {
        byId('assignment-form').reset();
        byId('assignment-id').value = '';
        byId('assignment-cancel').classList.add('hidden');
    }

    function resetQuizForm() {
        byId('quiz-form').reset();
        byId('quiz-id').value = '';
        byId('quiz-cancel').classList.add('hidden');
    }

    function resetAttendanceForm() {
        byId('attendance-form').reset();
        byId('attendance-reset').classList.add('hidden');
        renderAttendanceRows();
    }

    function resetMarkForm() {
        byId('mark-form').reset();
        byId('mark-id').value = '';
        byId('mark-cancel').classList.add('hidden');
        renderMarkFormOptions('');
    }

    function showPasswordGate() {
        const message = state.currentUser && state.currentUser.passwordChangeReason === 'temporary_password'
            ? 'You signed in with a temporary password. Set your permanent password now.'
            : 'This is your first login. You must change your password before using the LMS.';

        byId('teacher-password-gate-message').textContent = message;
        byId('teacher-password-gate').classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    }

    function hidePasswordGate() {
        const helpers = window.TuitionSolutionLms;
        byId('teacher-password-gate').classList.add('hidden');
        byId('teacher-password-form').reset();
        helpers.renderNotice(byId('teacher-password-gate-notice'), '', 'info');
        document.body.classList.remove('overflow-hidden');
    }

    async function initializePortal() {
        if (state.portalReady) {
            return;
        }

        resetAssignmentForm();
        resetQuizForm();
        await loadClasses();
        resetAttendanceForm();
        resetMarkForm();
        state.portalReady = true;
    }

    async function submitPasswordChange(event) {
        event.preventDefault();
        const helpers = window.TuitionSolutionLms;
        const currentPassword = byId('teacher-current-password').value;
        const newPassword = byId('teacher-new-password').value;
        const confirmPassword = byId('teacher-confirm-password').value;
        const notice = byId('teacher-password-gate-notice');
        const button = byId('teacher-password-submit');

        if (newPassword !== confirmPassword) {
            helpers.renderNotice(notice, 'New password and confirm password must match.', 'error');
            return;
        }

        helpers.renderNotice(notice, '', 'info');
        helpers.setBusy(button, true, 'Update Password', 'Updating password...');

        try {
            const response = await helpers.getApi().lmsChangePassword({
                currentPassword: currentPassword,
                newPassword: newPassword
            });
            state.currentUser = response && response.user ? response.user : state.currentUser;
            state.portalReady = false;
            hidePasswordGate();
            await initializePortal();
            helpers.renderNotice(byId('teacher-notice'), 'Password updated successfully. Portal unlocked.', 'success');
        } catch (error) {
            helpers.renderNotice(notice, error.message || 'Unable to update password.', 'error');
        } finally {
            helpers.setBusy(button, false, 'Update Password');
        }
    }

    function renderClassList() {
        const helpers = window.TuitionSolutionLms;
        const container = byId('teacher-class-list');

        if (!state.classes.length) {
            container.innerHTML = emptyState('No classes assigned yet.');
            return;
        }

        container.innerHTML = state.classes.map((classItem) => {
            const isActive = classItem.id === state.selectedClassId;
            return '<button type="button" class="lms-sidebar-item ' + (isActive ? 'is-active' : '') + '" data-class-id="' + helpers.escapeHtml(classItem.id) + '">'
                + '<span class="block font-semibold">' + helpers.escapeHtml(classItem.name) + '</span>'
                + '<span class="block text-sm text-slate-500 mt-1">' + helpers.escapeHtml(classItem.subject || 'General class') + '</span>'
                + '<span class="block text-xs text-slate-400 mt-2">' + helpers.escapeHtml(classItem.schedule || 'Schedule pending') + '</span>'
                + '</button>';
        }).join('');
    }

    function renderSummary(workspace) {
        const classItem = workspace.classItem;
        byId('teacher-class-title').textContent = classItem.name;
        byId('teacher-class-subtitle').textContent = [classItem.code, classItem.subject, classItem.schedule].filter(Boolean).join(' | ') || 'Assigned classroom';
        byId('teacher-summary').innerHTML = [
            { label: 'Students', value: (classItem.students || []).length, tone: 'blue', icon: 'fa-users' },
            { label: 'Assignments', value: workspace.assignments.length, tone: 'orange', icon: 'fa-file-lines' },
            { label: 'Quizzes', value: workspace.quizzes.length, tone: 'green', icon: 'fa-list-check' },
            { label: 'Attendance Logs', value: workspace.attendance.length, tone: 'slate', icon: 'fa-calendar-check' }
        ].map((item) => '<article class="lms-dashboard-card p-5">'
            + '<div class="flex items-center justify-between gap-4">'
            + '<div><p class="text-sm text-slate-500">' + item.label + '</p><p class="mt-2 text-3xl font-bold text-slate-900">' + item.value + '</p></div>'
            + '<span class="w-12 h-12 rounded-2xl flex items-center justify-center text-lg ' + (item.tone === 'blue' ? 'bg-primary-50 text-primary-600' : item.tone === 'orange' ? 'bg-accent-50 text-accent-600' : item.tone === 'green' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-600') + '"><i class="fas ' + item.icon + '" aria-hidden="true"></i></span>'
            + '</div>'
            + '</article>').join('');
    }

    function normalizeReportMonth(value) {
        const date = value ? new Date(value) : new Date();
        if (Number.isNaN(date.getTime())) {
            return '';
        }

        return date.toISOString().slice(0, 7);
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

    function getMarkStatus(mark) {
        return mark && mark.status === 'posted' ? 'posted' : 'draft';
    }

    function isTeacherLockedMark(mark) {
        return getMarkStatus(mark) === 'posted';
    }

    function renderStatusBadge(status) {
        return status === 'posted'
            ? '<span class="lms-badge lms-badge-green">Posted</span>'
            : '<span class="lms-badge lms-badge-orange">Draft</span>';
    }

    function buildStudentMap() {
        return new Map((state.workspace && state.workspace.classItem && state.workspace.classItem.students ? state.workspace.classItem.students : []).map((student) => [student.id, student]));
    }

    function getAssignmentMarks(assignmentId) {
        return (state.workspace && state.workspace.marks ? state.workspace.marks : []).filter((mark) => mark.sourceType === 'assignment' && mark.sourceId === assignmentId);
    }

    function getAvailableReportMonths() {
        const months = new Set();

        (state.workspace && state.workspace.marks ? state.workspace.marks : []).forEach((mark) => {
            const reportMonth = normalizeReportMonth(mark.recordedAt);
            if (reportMonth) {
                months.add(reportMonth);
            }
        });

        (state.workspace && state.workspace.monthlyReports ? state.workspace.monthlyReports : []).forEach((reportItem) => {
            if (reportItem && reportItem.reportMonth) {
                months.add(reportItem.reportMonth);
            }
        });

        return Array.from(months).sort().reverse();
    }

    function formatMarkTypeLabel(type) {
        const normalizedType = String(type || 'other');
        return normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);
    }

    function getActiveMarksMonth(months) {
        if (!months.length) {
            state.marksFilterMonth = '';
            return '';
        }

        if (!state.marksFilterMonth || months.indexOf(state.marksFilterMonth) === -1) {
            state.marksFilterMonth = months[0];
        }

        return state.marksFilterMonth;
    }

    function getFilteredMarkRows(rows, activeMonth) {
        return rows.filter((mark) => {
            const monthMatch = !activeMonth || normalizeReportMonth(mark.recordedAt) === activeMonth;
            const typeMatch = !state.marksFilterType || mark.type === state.marksFilterType;
            return monthMatch && typeMatch;
        });
    }

    function buildStudentMarkSummaries(records) {
        const studentMap = buildStudentMap();
        const summaryMap = new Map();

        studentMap.forEach((student, studentId) => {
            summaryMap.set(studentId, {
                studentId: studentId,
                fullName: student.fullName || '',
                username: student.username || '',
                obtainedMarks: 0,
                possibleMarks: 0,
                totalPercentage: 0,
                entriesCount: 0,
                hasPostedMarks: false,
                entries: [],
                types: new Set()
            });
        });

        records.forEach((mark) => {
            const student = studentMap.get(mark.studentId);
            const percentage = mark.totalMarks > 0 ? (mark.score / mark.totalMarks) * 100 : 0;
            const existing = summaryMap.get(mark.studentId) || {
                studentId: mark.studentId,
                fullName: student ? (student.fullName || '') : '',
                username: student ? (student.username || '') : '',
                obtainedMarks: 0,
                possibleMarks: 0,
                totalPercentage: 0,
                entriesCount: 0,
                hasPostedMarks: false,
                entries: [],
                types: new Set()
            };

            existing.obtainedMarks += Number(mark.score || 0);
            existing.possibleMarks += Number(mark.totalMarks || 0);
            existing.totalPercentage += percentage;
            existing.entriesCount += 1;
            existing.hasPostedMarks = existing.hasPostedMarks || getMarkStatus(mark) === 'posted';
            existing.entries.push(mark);
            existing.types.add(mark.type || 'other');
            summaryMap.set(mark.studentId, existing);
        });

        return Array.from(summaryMap.values()).map((summary) => ({
            studentId: summary.studentId,
            fullName: summary.fullName,
            username: summary.username,
            obtainedMarks: summary.obtainedMarks,
            possibleMarks: summary.possibleMarks,
            averagePercentage: summary.entriesCount ? Math.round(summary.totalPercentage / summary.entriesCount) : 0,
            entriesCount: summary.entriesCount,
            status: summary.entriesCount ? (summary.hasPostedMarks ? 'posted' : 'draft') : 'empty',
            types: Array.from(summary.types).sort(),
            entries: summary.entries.sort((left, right) => String(right.recordedAt || '').localeCompare(String(left.recordedAt || '')))
        })).sort((left, right) => {
            const leftHasEntries = left.entriesCount > 0 ? 1 : 0;
            const rightHasEntries = right.entriesCount > 0 ? 1 : 0;

            if (rightHasEntries !== leftHasEntries) {
                return rightHasEntries - leftHasEntries;
            }

            if (right.averagePercentage !== left.averagePercentage) {
                return right.averagePercentage - left.averagePercentage;
            }

            if (right.obtainedMarks !== left.obtainedMarks) {
                return right.obtainedMarks - left.obtainedMarks;
            }

            return String(left.fullName || left.username || left.studentId || '').localeCompare(String(right.fullName || right.username || right.studentId || ''));
        });
    }

    function getEligibleMarksForMonth(reportMonth) {
        const allowedTypes = new Set(['assignment', 'quiz', 'exam', 'project']);
        return (state.workspace && state.workspace.marks ? state.workspace.marks : []).filter((mark) => normalizeReportMonth(mark.recordedAt) === reportMonth && allowedTypes.has(mark.type));
    }

    function buildMonthlyPreviewRanking(records) {
        const studentMap = buildStudentMap();
        const summaryMap = new Map();

        records.forEach((mark) => {
            const student = studentMap.get(mark.studentId);
            if (!student) {
                return;
            }

            const percentage = mark.totalMarks > 0 ? (mark.score / mark.totalMarks) * 100 : 0;
            const existing = summaryMap.get(mark.studentId) || {
                studentId: mark.studentId,
                fullName: student.fullName || '',
                username: student.username || '',
                obtainedMarks: 0,
                possibleMarks: 0,
                totalPercentage: 0,
                entriesCount: 0
            };

            existing.obtainedMarks += mark.score;
            existing.possibleMarks += mark.totalMarks;
            existing.totalPercentage += percentage;
            existing.entriesCount += 1;
            summaryMap.set(mark.studentId, existing);
        });

        return Array.from(summaryMap.values())
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

                return String(left.fullName || left.username || '').localeCompare(String(right.fullName || right.username || ''));
            })
            .map((item, index) => ({ ...item, rank: index + 1 }));
    }

    function openAssignmentMarks(assignmentId) {
        state.selectedAssignmentId = assignmentId;
        renderAssignmentMarksPanel();
        if (viewNavigator) {
            viewNavigator.setActiveView('teacher-assignments-section');
        }
    }

    function renderAssignments() {
        const helpers = window.TuitionSolutionLms;
        const items = state.workspace.assignments || [];
        byId('assignment-list').innerHTML = items.length
            ? items.map((item) => '<article class="lms-dashboard-card p-4">'
                + '<div class="flex items-start justify-between gap-4">'
                + '<div>'
                + '<div class="flex items-center gap-2 flex-wrap"><h4 class="font-semibold text-slate-900">' + helpers.escapeHtml(item.title) + '</h4><span class="lms-badge lms-badge-orange">Due ' + helpers.escapeHtml(helpers.formatDate(item.dueDate)) + '</span>'
                + (function () {
                    const linkedMarks = getAssignmentMarks(item.id);
                    if (!linkedMarks.length) {
                        return '<span class="lms-badge lms-badge-slate">No marks yet</span>';
                    }

                    const postedCount = linkedMarks.filter((mark) => getMarkStatus(mark) === 'posted').length;
                    return postedCount === linkedMarks.length
                        ? '<span class="lms-badge lms-badge-green">Marks posted</span>'
                        : '<span class="lms-badge lms-badge-blue">' + helpers.escapeHtml(String(linkedMarks.length)) + ' marks saved</span>';
                }())
                + '</div>'
                + '<p class="text-sm text-slate-500 mt-2">' + helpers.escapeHtml(item.description || 'No description added.') + '</p>'
                + '<p class="text-sm text-slate-400 mt-2">Use the Marks action to enter scores for all assigned students.</p>'
                + (item.resourceLink ? '<a href="' + helpers.escapeHtml(item.resourceLink) + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-sm text-primary-600 mt-3 hover:text-primary-700"><i class="fas fa-link" aria-hidden="true"></i> Resource</a>' : '')
                + '</div>'
                + '<div class="lms-inline-actions">'
                + '<button type="button" class="lms-inline-button" data-open-assignment-marks="' + helpers.escapeHtml(item.id) + '">Marks</button>'
                + '<button type="button" class="lms-inline-button" data-edit-assignment="' + helpers.escapeHtml(item.id) + '">Edit</button>'
                + '<button type="button" class="lms-inline-button lms-inline-button-danger" data-delete-assignment="' + helpers.escapeHtml(item.id) + '">Delete</button>'
                + '</div>'
                + '</div>'
                + '</article>').join('')
            : emptyState('No assignments added yet.');
    }

    function renderAssignmentMarksPanel() {
        const helpers = window.TuitionSolutionLms;
        const container = byId('assignment-marks-panel');

        if (!state.workspace) {
            container.innerHTML = emptyState('Assignment grading controls will appear here once a class is assigned.');
            return;
        }

        const assignments = state.workspace.assignments || [];
        const students = state.workspace.classItem.students || [];

        if (!assignments.length) {
            state.selectedAssignmentId = '';
            container.innerHTML = emptyState('Create an assignment first, then click Marks to open the student grading grid.');
            return;
        }

        if (state.selectedAssignmentId && !assignments.some((item) => item.id === state.selectedAssignmentId)) {
            state.selectedAssignmentId = '';
        }

        if (!state.selectedAssignmentId) {
            container.innerHTML = emptyState('Choose an assignment from the list and click Marks to enter student scores.');
            return;
        }

        const assignment = assignments.find((item) => item.id === state.selectedAssignmentId);
        const marksByStudent = new Map(getAssignmentMarks(assignment.id).map((mark) => [mark.studentId, mark]));
        const canEditAny = students.some((student) => !isTeacherLockedMark(marksByStudent.get(student.id)));
        const gradedCount = Array.from(marksByStudent.values()).length;
        const postedCount = Array.from(marksByStudent.values()).filter((mark) => getMarkStatus(mark) === 'posted').length;

        container.innerHTML = '<div class="space-y-5">'
            + '<div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5">'
            + '<div>'
            + '<div class="flex items-center gap-2 flex-wrap"><h4 class="font-heading text-2xl font-bold text-slate-900">' + helpers.escapeHtml(assignment.title) + '</h4><span class="lms-badge lms-badge-orange">Due ' + helpers.escapeHtml(helpers.formatDate(assignment.dueDate)) + '</span></div>'
            + '<p class="text-sm text-slate-500 mt-3">' + helpers.escapeHtml(assignment.description || 'Assignment detail marks for all students in this class.') + '</p>'
            + '</div>'
            + '<div class="flex items-center gap-2 flex-wrap">'
            + '<span class="lms-badge lms-badge-blue">Graded ' + helpers.escapeHtml(String(gradedCount)) + '/' + helpers.escapeHtml(String(students.length)) + '</span>'
            + (postedCount ? '<span class="lms-badge lms-badge-green">' + helpers.escapeHtml(String(postedCount)) + ' posted</span>' : '<span class="lms-badge lms-badge-slate">Editable before monthly post</span>')
            + '</div>'
            + '</div>'
            + (students.length
                ? '<div class="space-y-3">' + students.map((student) => {
                    const existing = marksByStudent.get(student.id);
                    const locked = isTeacherLockedMark(existing);
                    const defaultDate = helpers.formatDateInput(existing && existing.recordedAt ? existing.recordedAt : assignment.dueDate);
                    return '<div class="grid md:grid-cols-[minmax(0,1.15fr)_minmax(76px,110px)_minmax(76px,110px)_minmax(120px,150px)_minmax(0,1.4fr)] gap-3 items-center rounded-2xl border border-slate-200 bg-white px-4 py-4" data-assignment-mark-row data-student-id="' + helpers.escapeHtml(student.id) + '" data-mark-id="' + helpers.escapeHtml(existing && existing.id ? existing.id : '') + '">'
                        + '<div><div class="flex items-center gap-2 flex-wrap"><p class="font-semibold text-slate-900">' + helpers.escapeHtml(student.fullName || student.username) + '</p>' + renderStatusBadge(getMarkStatus(existing)) + '</div><p class="text-sm text-slate-500 mt-1">' + helpers.escapeHtml(student.username) + '</p></div>'
                        + '<input type="number" min="0" class="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-accent-500 disabled:bg-slate-100 disabled:text-slate-400" data-assignment-score value="' + helpers.escapeHtml(existing != null && existing.score != null ? String(existing.score) : '') + '" ' + (locked ? 'disabled' : '') + '>'
                        + '<input type="number" min="1" class="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-accent-500 disabled:bg-slate-100 disabled:text-slate-400" data-assignment-total value="' + helpers.escapeHtml(existing != null && existing.totalMarks != null ? String(existing.totalMarks) : '') + '" ' + (locked ? 'disabled' : '') + '>'
                        + '<input type="date" class="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-accent-500 disabled:bg-slate-100 disabled:text-slate-400" data-assignment-recorded-at value="' + helpers.escapeHtml(defaultDate) + '" ' + (locked ? 'disabled' : '') + '>'
                        + '<input type="text" class="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-accent-500 disabled:bg-slate-100 disabled:text-slate-400" data-assignment-notes placeholder="notes (optional)" value="' + helpers.escapeHtml(existing && existing.notes ? existing.notes : '') + '" ' + (locked ? 'disabled' : '') + '>'
                        + '</div>';
                }).join('') + '</div>'
                : emptyState('No students are assigned to this class yet.'))
            + '<div class="flex items-center gap-3 flex-wrap">'
            + '<button type="button" class="rounded-2xl bg-accent-500 text-white font-bold px-6 py-3 hover:bg-accent-600 transition-colors disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed" data-save-assignment-marks ' + (canEditAny ? '' : 'disabled') + '>Save Assignment Marks</button>'
            + '<button type="button" class="px-5 rounded-2xl border border-slate-200 text-slate-600 font-semibold hover:border-slate-300 transition-colors" data-close-assignment-marks>Close</button>'
            + '<p class="text-sm text-slate-500">Once the monthly report is posted, teacher edits will be locked here.</p>'
            + '</div>'
            + '</div>';
    }

    function renderQuizzes() {
        const helpers = window.TuitionSolutionLms;
        const items = state.workspace.quizzes || [];
        byId('quiz-list').innerHTML = items.length
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
            : emptyState('No quizzes added yet.');
    }

    function renderAttendanceRows(recordToLoad) {
        const helpers = window.TuitionSolutionLms;
        const container = byId('attendance-student-list');

        if (!state.workspace) {
            container.innerHTML = emptyState('Attendance controls will appear here once a class is assigned.');
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
                    + '<select class="attendance-status rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-primary-500" data-student-id="' + helpers.escapeHtml(student.id) + '">'
                    + ['present', 'absent', 'late', 'excused'].map((status) => '<option value="' + status + '" ' + (selectedStatus === status ? 'selected' : '') + '>' + status.charAt(0).toUpperCase() + status.slice(1) + '</option>').join('')
                    + '</select>'
                    + '<input type="text" class="attendance-remarks rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-primary-500" data-remarks-student-id="' + helpers.escapeHtml(student.id) + '" placeholder="remarks (optional)" value="' + helpers.escapeHtml(existing && existing.remarks ? existing.remarks : '') + '">'
                    + '</div>';
            }).join('')
            : emptyState('No students assigned to this class yet.');
    }

    function renderAttendanceHistory() {
        const helpers = window.TuitionSolutionLms;
        const items = state.workspace.attendance || [];
        byId('attendance-list').innerHTML = items.length
            ? items.map((item) => '<article class="lms-dashboard-card p-4">'
                + '<div class="flex items-center justify-between gap-4">'
                + '<div><h4 class="font-semibold text-slate-900">' + helpers.escapeHtml(item.date) + '</h4><p class="text-sm text-slate-500 mt-2">' + helpers.escapeHtml(String(item.entries.length)) + ' students recorded</p></div>'
                + '<div class="lms-inline-actions">'
                + '<button type="button" class="lms-inline-button" data-load-attendance="' + helpers.escapeHtml(item.date) + '">Load</button>'
                + '<button type="button" class="lms-inline-button lms-inline-button-danger" data-delete-attendance="' + helpers.escapeHtml(item.date) + '">Delete</button>'
                + '</div>'
                + '</div>'
                + '</article>').join('')
            : emptyState('No attendance logs yet.');
    }

    function renderMarkFormOptions(selectedStudentId) {
        const helpers = window.TuitionSolutionLms;
        const select = byId('mark-student-id');
        const students = state.workspace ? (state.workspace.classItem.students || []) : [];

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

    function renderStudentSummaryStatus(summary) {
        if (!summary.entriesCount) {
            return '<span class="lms-badge lms-badge-slate">No marks yet</span>';
        }

        return renderStatusBadge(summary.status);
    }

    function closeStudentMarksModal() {
        state.selectedMarkStudentId = '';
        byId('student-marks-modal').classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }

    function openStudentMarksModal(studentId) {
        state.selectedMarkStudentId = studentId;
        renderStudentMarksModal();
    }

    function renderStudentMarksModal() {
        const helpers = window.TuitionSolutionLms;
        const modal = byId('student-marks-modal');
        const title = byId('student-marks-modal-title');
        const context = byId('student-marks-modal-context');
        const body = byId('student-marks-modal-body');
        const rows = state.workspace ? (state.workspace.marks || []) : [];
        const months = getAvailableReportMonths();
        const activeMonth = getActiveMarksMonth(months);
        const filteredRows = getFilteredMarkRows(rows, activeMonth);
        const summaries = buildStudentMarkSummaries(filteredRows);
        const summary = summaries.find((item) => item.studentId === state.selectedMarkStudentId);

        if (!state.selectedMarkStudentId || !summary) {
            modal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
            return;
        }

        title.textContent = summary.fullName || summary.username || 'Student marks';
        context.textContent = (activeMonth ? formatReportMonthLabel(activeMonth) : 'No month selected') + ' • ' + (state.marksFilterType ? formatMarkTypeLabel(state.marksFilterType) : 'All mark types');
        body.innerHTML = '<div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">'
            + '<article class="lms-student-mark-stat rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Total marks</p><p class="mt-2 text-lg font-bold text-slate-900">' + helpers.escapeHtml(summary.entriesCount ? (String(summary.obtainedMarks) + ' / ' + String(summary.possibleMarks)) : '--') + '</p></article>'
            + '<article class="lms-student-mark-stat rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Average</p><p class="mt-2 text-lg font-bold text-slate-900">' + helpers.escapeHtml(summary.entriesCount ? (String(summary.averagePercentage) + '%') : '--') + '</p></article>'
            + '<article class="lms-student-mark-stat rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Entries</p><p class="mt-2 text-lg font-bold text-slate-900">' + helpers.escapeHtml(String(summary.entriesCount)) + '</p></article>'
            + '<article class="lms-student-mark-stat rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Status</p><div class="mt-2">' + renderStudentSummaryStatus(summary) + '</div></article>'
            + '</div>'
            + '<div class="mt-4 flex flex-wrap gap-2">' + (summary.types.length
                ? summary.types.map((type) => '<span class="lms-chip">' + helpers.escapeHtml(formatMarkTypeLabel(type)) + '</span>').join('')
                : '<span class="lms-chip">No marks recorded for the current filters</span>')
            + '</div>'
            + '<div class="mt-5">'
            + (summary.entries.length
                ? '<div class="space-y-3">' + summary.entries.map((entry) => {
                    const locked = isTeacherLockedMark(entry);
                    const isAssignmentLinked = entry.sourceType === 'assignment' && entry.sourceId;
                    const actionMarkup = isAssignmentLinked
                        ? '<button type="button" class="lms-inline-button" data-open-modal-assignment-grid="' + helpers.escapeHtml(entry.sourceId) + '">Open Assignment Grid</button>'
                        : locked
                            ? '<span class="text-xs font-semibold text-slate-400">Locked after posting</span>'
                            : '<div class="lms-inline-actions"><button type="button" class="lms-inline-button" data-edit-modal-mark="' + helpers.escapeHtml(entry.id) + '">Edit</button><button type="button" class="lms-inline-button lms-inline-button-danger" data-delete-modal-mark="' + helpers.escapeHtml(entry.id) + '">Delete</button></div>';

                    return '<article class="lms-student-mark-entry rounded-2xl border border-slate-200 bg-white px-4 py-4">'
                        + '<div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">'
                        + '<div class="min-w-0">'
                        + '<div class="flex items-center gap-2 flex-wrap"><h4 class="font-semibold text-slate-900">' + helpers.escapeHtml(entry.title || 'Mark entry') + '</h4><span class="lms-badge lms-badge-blue">' + helpers.escapeHtml(formatMarkTypeLabel(entry.type)) + '</span>' + renderStatusBadge(getMarkStatus(entry)) + '</div>'
                        + '<p class="text-sm text-slate-500 mt-2">Recorded ' + helpers.escapeHtml(helpers.formatDate(entry.recordedAt)) + '</p>'
                        + '<p class="text-sm text-slate-500 mt-2">' + helpers.escapeHtml(entry.notes || 'No notes added.') + '</p>'
                        + '</div>'
                        + '<div class="grid grid-cols-2 gap-3 lg:min-w-[220px]">'
                        + '<div class="lms-student-mark-stat rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Score</p><p class="mt-1 text-sm font-semibold text-slate-900">' + helpers.escapeHtml(String(entry.score)) + ' / ' + helpers.escapeHtml(String(entry.totalMarks)) + '</p></div>'
                        + '<div class="lms-student-mark-stat rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Source</p><p class="mt-1 text-sm font-semibold text-slate-900">' + helpers.escapeHtml(entry.sourceType === 'manual' ? 'Manual' : formatMarkTypeLabel(entry.sourceType)) + '</p></div>'
                        + '</div>'
                        + '</div>'
                        + '<div class="mt-4 flex flex-wrap gap-2">' + actionMarkup + '</div>'
                        + '</article>';
                }).join('') + '</div>'
                : emptyState('No marks are available for this student in the current filters.'))
            + '</div>';

        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    }

    function renderMarks() {
        const helpers = window.TuitionSolutionLms;
        const rows = state.workspace ? (state.workspace.marks || []) : [];
        const students = state.workspace ? (state.workspace.classItem.students || []) : [];
        const months = getAvailableReportMonths();
        const allTypes = ['assignment', 'quiz', 'exam', 'project', 'other'];
        const activeMonth = getActiveMarksMonth(months);

        if (state.marksFilterType && allTypes.indexOf(state.marksFilterType) === -1) {
            state.marksFilterType = '';
        }

        const filteredRows = getFilteredMarkRows(rows, activeMonth);
        const summaries = buildStudentMarkSummaries(filteredRows);
        const studentsWithMarks = summaries.filter((item) => item.entriesCount > 0).length;
        const totalObtainedMarks = summaries.reduce((acc, item) => acc + item.obtainedMarks, 0);
        const totalPossibleMarks = summaries.reduce((acc, item) => acc + item.possibleMarks, 0);

        byId('mark-list').innerHTML = '<div class="space-y-5">'
            + '<div class="grid lg:grid-cols-[minmax(0,1fr)_220px] gap-3">'
            + '<label class="block"><span class="block text-sm font-semibold text-slate-700 mb-1.5">Month</span><select id="marks-filter-month" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20" ' + (months.length ? '' : 'disabled') + '>' + (months.length
                ? months.map((month) => '<option value="' + helpers.escapeHtml(month) + '" ' + (activeMonth === month ? 'selected' : '') + '>' + helpers.escapeHtml(formatReportMonthLabel(month)) + '</option>').join('')
                : '<option value="">No marks available</option>') + '</select></label>'
            + '<label class="block"><span class="block text-sm font-semibold text-slate-700 mb-1.5">Type</span><select id="marks-filter-type" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"><option value="">All types</option>' + allTypes.map((type) => '<option value="' + type + '" ' + (state.marksFilterType === type ? 'selected' : '') + '>' + formatMarkTypeLabel(type) + '</option>').join('') + '</select></label>'
            + '</div>'
            + '<div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">'
            + '<article class="lms-student-mark-stat rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Selected month</p><p class="mt-2 text-base font-semibold text-slate-900">' + helpers.escapeHtml(activeMonth ? formatReportMonthLabel(activeMonth) : 'No marks yet') + '</p></article>'
            + '<article class="lms-student-mark-stat rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Students with marks</p><p class="mt-2 text-base font-semibold text-slate-900">' + helpers.escapeHtml(String(studentsWithMarks)) + ' / ' + helpers.escapeHtml(String(students.length)) + '</p></article>'
            + '<article class="lms-student-mark-stat rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Total score</p><p class="mt-2 text-base font-semibold text-slate-900">' + helpers.escapeHtml(String(totalObtainedMarks)) + ' / ' + helpers.escapeHtml(String(totalPossibleMarks)) + '</p></article>'
            + '<article class="lms-student-mark-stat rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Filtered entries</p><p class="mt-2 text-base font-semibold text-slate-900">' + helpers.escapeHtml(String(filteredRows.length)) + '</p></article>'
            + '</div>'
            + (students.length
                ? '<div class="space-y-3">' + summaries.map((summary) => '<button type="button" class="lms-student-mark-row w-full text-left rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4 transition-all hover:border-primary-200 hover:shadow-sm" data-open-student-marks="' + helpers.escapeHtml(summary.studentId) + '">'
                    + '<div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">'
                    + '<div class="min-w-0">'
                    + '<div class="flex items-center gap-2 flex-wrap"><h4 class="font-semibold text-slate-900 text-sm sm:text-base">' + helpers.escapeHtml(summary.fullName || summary.username || summary.studentId) + '</h4>' + renderStudentSummaryStatus(summary) + '</div>'
                    + '<p class="text-sm text-slate-500 mt-1">' + helpers.escapeHtml(summary.username || summary.studentId) + '</p>'
                    + '<div class="lms-chip-list mt-3">' + (summary.types.length
                        ? summary.types.map((type) => '<span class="lms-chip">' + helpers.escapeHtml(formatMarkTypeLabel(type)) + '</span>').join('')
                        : '<span class="lms-chip">No marks recorded for this view</span>') + '</div>'
                    + '</div>'
                    + '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 xl:min-w-[400px]">'
                    + '<div class="lms-student-mark-stat rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Total</p><p class="mt-1 text-sm font-semibold text-slate-900">' + helpers.escapeHtml(summary.entriesCount ? (String(summary.obtainedMarks) + ' / ' + String(summary.possibleMarks)) : '--') + '</p></div>'
                    + '<div class="lms-student-mark-stat rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Average</p><p class="mt-1 text-sm font-semibold text-slate-900">' + helpers.escapeHtml(summary.entriesCount ? (String(summary.averagePercentage) + '%') : '--') + '</p></div>'
                    + '<div class="lms-student-mark-stat rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Entries</p><p class="mt-1 text-sm font-semibold text-slate-900">' + helpers.escapeHtml(String(summary.entriesCount)) + '</p></div>'
                    + '<div class="lms-student-mark-stat rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"><p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Details</p><p class="mt-1 text-sm font-semibold text-primary-700">Open breakdown</p></div>'
                    + '</div>'
                    + '</div>'
                    + '</button>').join('') + '</div>'
                : emptyState('No students are assigned to this class yet.'))
            + '</div>';

        renderStudentMarksModal();
    }

    function renderMonthlyReportPanel() {
        const helpers = window.TuitionSolutionLms;
        const container = byId('teacher-monthly-report-panel');

        if (!state.workspace) {
            container.innerHTML = emptyState('Monthly report controls will appear here once a class is assigned.');
            return;
        }

        const months = getAvailableReportMonths().filter((month) => getEligibleMarksForMonth(month).length > 0 || (state.workspace.monthlyReports || []).some((reportItem) => reportItem.reportMonth === month));
        if (!months.length) {
            state.selectedReportMonth = '';
            container.innerHTML = emptyState('Record assignment, quiz, exam, or project marks first. Then you can post a monthly report.');
            return;
        }

        if (!state.selectedReportMonth || months.indexOf(state.selectedReportMonth) === -1) {
            state.selectedReportMonth = months[0];
        }

        const reportMonth = state.selectedReportMonth;
        const postedReport = (state.workspace.monthlyReports || []).find((item) => item.reportMonth === reportMonth);
        const previewMarks = getEligibleMarksForMonth(reportMonth);
        const rankings = postedReport && Array.isArray(postedReport.rankings) && postedReport.rankings.length
            ? postedReport.rankings
            : buildMonthlyPreviewRanking(previewMarks);
        const topStudent = postedReport && postedReport.topStudent ? postedReport.topStudent : rankings[0] || null;
        const isPosted = Boolean(postedReport) || previewMarks.some((mark) => getMarkStatus(mark) === 'posted');

        container.innerHTML = '<div class="lms-monthly-report-shell grid xl:grid-cols-[240px_minmax(0,1fr)] gap-4">'
            + '<article class="lms-monthly-report-panel rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">'
            + '<label class="block"><span class="block text-sm font-semibold text-slate-700 mb-1.5">Report month</span><select id="teacher-report-month-select" class="w-full rounded-2xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20">' + months.map((month) => '<option value="' + helpers.escapeHtml(month) + '" ' + (reportMonth === month ? 'selected' : '') + '>' + helpers.escapeHtml(formatReportMonthLabel(month)) + '</option>').join('') + '</select></label>'
            + '<div class="mt-4 flex items-center gap-2 flex-wrap">' + renderStatusBadge(isPosted ? 'posted' : 'draft') + '<span class="lms-badge lms-badge-blue">' + helpers.escapeHtml(String(previewMarks.length)) + ' eligible marks</span></div>'
            + '<p class="text-sm text-slate-500 mt-3 leading-6">Posting locks teacher edits for assignment, quiz, exam, and project marks in this class-month. Students will still see marks in LMS as usual.</p>'
            + '<button type="button" class="w-full mt-4 rounded-2xl bg-primary-600 text-white text-sm font-bold py-2.5 hover:bg-primary-700 transition-colors disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed" data-post-monthly-report ' + (!rankings.length || isPosted ? 'disabled' : '') + '>' + (isPosted ? 'Already Posted' : 'Post Monthly Report') + '</button>'
            + '</article>'
            + '<article class="lms-monthly-report-panel rounded-[1.25rem] border border-slate-200 bg-white p-4">'
            + (topStudent
                ? '<div class="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-4">'
                    + '<div class="lms-monthly-top-card rounded-[1.25rem] bg-gradient-to-br from-accent-50 to-yellow-50 border border-accent-100 p-4"><p class="text-xs uppercase tracking-[0.18em] text-accent-600 font-semibold">Top 1</p><h4 class="font-heading text-xl font-bold text-slate-900 mt-3">' + helpers.escapeHtml(topStudent.fullName || topStudent.username) + '</h4><p class="text-sm text-slate-500 mt-1">' + helpers.escapeHtml(topStudent.username || '') + '</p><p class="mt-3 text-3xl font-bold text-accent-600">' + helpers.escapeHtml(String(topStudent.averagePercentage || 0)) + '%</p><p class="text-sm text-slate-500 mt-2">' + helpers.escapeHtml(String(topStudent.obtainedMarks || 0)) + ' / ' + helpers.escapeHtml(String(topStudent.possibleMarks || 0)) + ' obtained marks</p></div>'
                    + '<div><div class="flex items-center justify-between gap-3 flex-wrap"><h4 class="text-base font-semibold text-slate-900">' + helpers.escapeHtml(formatReportMonthLabel(reportMonth)) + ' Ranking</h4><span class="lms-badge lms-badge-slate">Monthly average percentage</span></div><div class="lms-table-wrap mt-3"><table class="lms-table"><thead><tr><th>Rank</th><th>Student</th><th>Average</th><th>Entries</th></tr></thead><tbody>' + rankings.map((item) => '<tr><td>#' + helpers.escapeHtml(String(item.rank)) + '</td><td>' + helpers.escapeHtml(item.fullName || item.username) + '</td><td>' + helpers.escapeHtml(String(item.averagePercentage || 0)) + '%</td><td>' + helpers.escapeHtml(String(item.entriesCount || 0)) + '</td></tr>').join('') + '</tbody></table></div>' + (postedReport && postedReport.announcementSummary ? '<p class="text-sm text-slate-500 mt-3">' + helpers.escapeHtml(postedReport.announcementSummary) + '</p>' : '') + '</div>'
                    + '</div>'
                : emptyState('No eligible marks are available for this month yet.'))
            + '</article>'
            + '</div>';
    }

    function renderWorkspace() {
        renderSummary(state.workspace);
        renderAssignments();
        renderAssignmentMarksPanel();
        renderQuizzes();
        renderAttendanceRows();
        renderAttendanceHistory();
        renderMarkFormOptions('');
        renderMarks();
        renderMonthlyReportPanel();
    }

    function loadAssignmentIntoForm(id) {
        const item = (state.workspace.assignments || []).find((assignment) => assignment.id === id);
        if (!item) {
            return;
        }

        byId('assignment-id').value = item.id;
        byId('assignment-title').value = item.title || '';
        byId('assignment-due-date').value = window.TuitionSolutionLms.formatDateInput(item.dueDate);
        byId('assignment-resource-link').value = item.resourceLink || '';
        byId('assignment-description').value = item.description || '';
        byId('assignment-cancel').classList.remove('hidden');
    }

    function loadQuizIntoForm(id) {
        const item = (state.workspace.quizzes || []).find((quiz) => quiz.id === id);
        if (!item) {
            return;
        }

        byId('quiz-id').value = item.id;
        byId('quiz-title').value = item.title || '';
        byId('quiz-scheduled-for').value = window.TuitionSolutionLms.formatDateInput(item.scheduledFor);
        byId('quiz-total-marks').value = item.totalMarks || '';
        byId('quiz-description').value = item.description || '';
        byId('quiz-cancel').classList.remove('hidden');
    }

    function loadAttendanceRecord(date) {
        const helpers = window.TuitionSolutionLms;
        const record = (state.workspace.attendance || []).find((item) => item.date === date);
        if (!record) {
            return;
        }

        byId('attendance-date').value = record.date;
        byId('attendance-reset').classList.remove('hidden');
        renderAttendanceRows(record);
        helpers.renderNotice(byId('teacher-notice'), 'Attendance record loaded into the form.', 'info');
    }

    function loadMarkIntoForm(id) {
        const helpers = window.TuitionSolutionLms;
        const item = (state.workspace.marks || []).find((mark) => mark.id === id);
        if (!item) {
            return;
        }

        if (item.sourceType === 'assignment' && item.sourceId) {
            openAssignmentMarks(item.sourceId);
            helpers.renderNotice(byId('teacher-notice'), 'Edit assignment-linked marks from the assignment grading grid.', 'info');
            return;
        }

        if (isTeacherLockedMark(item)) {
            helpers.renderNotice(byId('teacher-notice'), 'Posted marks can now only be updated by the super admin.', 'error');
            return;
        }

        byId('mark-id').value = item.id;
        renderMarkFormOptions(item.studentId);
        byId('mark-title').value = item.title || '';
        byId('mark-type').value = item.type || 'assignment';
        byId('mark-score').value = item.score || '';
        byId('mark-total').value = item.totalMarks || '';
        byId('mark-recorded-at').value = window.TuitionSolutionLms.formatDateInput(item.recordedAt);
        byId('mark-notes').value = item.notes || '';
        byId('mark-cancel').classList.remove('hidden');
    }

    async function loadWorkspace(classId) {
        const api = window.TuitionSolutionLms.getApi();
        const classChanged = state.selectedClassId && state.selectedClassId !== classId;
        state.selectedClassId = classId;

        if (classChanged) {
            state.selectedAssignmentId = '';
            state.selectedMarkStudentId = '';
            state.marksFilterMonth = '';
            state.marksFilterType = '';
            state.selectedReportMonth = '';
            closeStudentMarksModal();
        }

        renderClassList();
        state.workspace = await api.lmsClassWorkspace(classId);
        renderWorkspace();
    }

    async function loadClasses() {
        const api = window.TuitionSolutionLms.getApi();
        const response = await api.lmsTeacherClasses();
        state.classes = Array.isArray(response.classes) ? response.classes : [];

        if (!state.classes.length) {
            closeStudentMarksModal();
            renderClassList();
            byId('teacher-class-title').textContent = 'No assigned classes yet';
            byId('teacher-class-subtitle').textContent = 'Ask the super admin to assign a class to this teacher account.';
            byId('teacher-summary').innerHTML = '<div class="md:col-span-2 xl:col-span-4">' + emptyState('Class summary will appear here once a class is assigned.') + '</div>';
            byId('assignment-list').innerHTML = emptyState('Assignments will appear here once a class is assigned.');
            byId('quiz-list').innerHTML = emptyState('Quizzes will appear here once a class is assigned.');
            byId('attendance-student-list').innerHTML = emptyState('Attendance controls will appear here once a class is assigned.');
            byId('attendance-list').innerHTML = emptyState('Attendance logs will appear here once a class is assigned.');
            byId('assignment-marks-panel').innerHTML = emptyState('Assignment grading controls will appear here once a class is assigned.');
            byId('mark-list').innerHTML = emptyState('Mark records will appear here once a class is assigned.');
            byId('teacher-monthly-report-panel').innerHTML = emptyState('Monthly report controls will appear here once a class is assigned.');
            renderMarkFormOptions('');
            return;
        }

        if (!state.selectedClassId || !state.classes.some((item) => item.id === state.selectedClassId)) {
            state.selectedClassId = state.classes[0].id;
        }

        renderClassList();
        await loadWorkspace(state.selectedClassId);
    }

    async function deleteAssignment(assignmentId) {
        const helpers = window.TuitionSolutionLms;
        if (!window.confirm('Delete this assignment?')) {
            return;
        }

        try {
            await helpers.getApi().lmsDeleteAssignment(state.selectedClassId, assignmentId);
            if (byId('assignment-id').value === assignmentId) {
                resetAssignmentForm();
            }
            await loadWorkspace(state.selectedClassId);
            helpers.renderNotice(byId('teacher-notice'), 'Assignment deleted successfully.', 'success');
        } catch (error) {
            helpers.renderNotice(byId('teacher-notice'), error.message || 'Unable to delete assignment.', 'error');
        }
    }

    async function deleteQuiz(quizId) {
        const helpers = window.TuitionSolutionLms;
        if (!window.confirm('Delete this quiz?')) {
            return;
        }

        try {
            await helpers.getApi().lmsDeleteQuiz(state.selectedClassId, quizId);
            if (byId('quiz-id').value === quizId) {
                resetQuizForm();
            }
            await loadWorkspace(state.selectedClassId);
            helpers.renderNotice(byId('teacher-notice'), 'Quiz deleted successfully.', 'success');
        } catch (error) {
            helpers.renderNotice(byId('teacher-notice'), error.message || 'Unable to delete quiz.', 'error');
        }
    }

    async function deleteAttendance(date) {
        const helpers = window.TuitionSolutionLms;
        if (!window.confirm('Delete the attendance record for ' + date + '?')) {
            return;
        }

        try {
            await helpers.getApi().lmsDeleteAttendance(state.selectedClassId, date);
            if (byId('attendance-date').value === date) {
                resetAttendanceForm();
            }
            await loadWorkspace(state.selectedClassId);
            helpers.renderNotice(byId('teacher-notice'), 'Attendance record deleted successfully.', 'success');
        } catch (error) {
            helpers.renderNotice(byId('teacher-notice'), error.message || 'Unable to delete attendance record.', 'error');
        }
    }

    async function deleteMark(markId) {
        const helpers = window.TuitionSolutionLms;
        const existing = (state.workspace && state.workspace.marks ? state.workspace.marks : []).find((mark) => mark.id === markId);

        if (existing && isTeacherLockedMark(existing)) {
            helpers.renderNotice(byId('teacher-notice'), 'Posted marks can now only be updated by the super admin.', 'error');
            return;
        }

        if (!window.confirm('Delete this mark entry?')) {
            return;
        }

        try {
            await helpers.getApi().lmsDeleteMark(state.selectedClassId, markId);
            if (byId('mark-id').value === markId) {
                resetMarkForm();
            }
            if (existing && existing.sourceType === 'assignment' && existing.sourceId === state.selectedAssignmentId) {
                renderAssignmentMarksPanel();
            }
            await loadWorkspace(state.selectedClassId);
            helpers.renderNotice(byId('teacher-notice'), 'Mark entry deleted successfully.', 'success');
        } catch (error) {
            helpers.renderNotice(byId('teacher-notice'), error.message || 'Unable to delete mark entry.', 'error');
        }
    }

    function collectAssignmentMarkEntries() {
        return Array.from(byId('assignment-marks-panel').querySelectorAll('[data-assignment-mark-row]')).map((row) => {
            const score = row.querySelector('[data-assignment-score]').value.trim();
            const totalMarks = row.querySelector('[data-assignment-total]').value.trim();
            const recordedAt = row.querySelector('[data-assignment-recorded-at]').value;
            const notes = row.querySelector('[data-assignment-notes]').value.trim();

            if (!score && !totalMarks) {
                return null;
            }

            if (!score || !totalMarks) {
                throw new Error('Each filled assignment mark row needs score and total marks.');
            }

            return {
                id: row.getAttribute('data-mark-id') || '',
                studentId: row.getAttribute('data-student-id'),
                score: Number(score),
                totalMarks: Number(totalMarks),
                recordedAt,
                notes
            };
        }).filter(Boolean);
    }

    async function saveAssignmentMarks() {
        const helpers = window.TuitionSolutionLms;
        const entries = collectAssignmentMarkEntries();

        if (!state.selectedAssignmentId) {
            throw new Error('Choose an assignment first.');
        }

        if (!entries.length) {
            throw new Error('Enter at least one student mark before saving.');
        }

        await helpers.getApi().lmsSaveAssignmentMarks(state.selectedClassId, state.selectedAssignmentId, entries);
        await loadWorkspace(state.selectedClassId);
        helpers.renderNotice(byId('teacher-notice'), 'Assignment marks saved successfully.', 'success');
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const helpers = window.TuitionSolutionLms;

        viewNavigator = helpers.createViewNavigator({
            navRoot: byId('teacher-view-nav'),
            panelRoot: byId('teacher-view-stack'),
            defaultView: state.activeView,
            onChange: function (viewId) {
                state.activeView = viewId;
            }
        });
        viewNavigator.sync(state.activeView);

        try {
            state.currentUser = await helpers.ensureRole('teacher', 'lms.html');
            if (!state.currentUser) {
                return;
            }

            byId('teacher-name').textContent = state.currentUser.fullName || state.currentUser.username;
            byId('teacher-logout').addEventListener('click', () => helpers.logout('lms.html'));
            byId('teacher-password-form').addEventListener('submit', submitPasswordChange);

            byId('teacher-class-list').addEventListener('click', async (event) => {
                const button = event.target.closest('[data-class-id]');
                if (!button) {
                    return;
                }

                try {
                    await loadWorkspace(button.getAttribute('data-class-id'));
                    resetAssignmentForm();
                    resetQuizForm();
                    resetAttendanceForm();
                    resetMarkForm();
                } catch (error) {
                    helpers.renderNotice(byId('teacher-notice'), error.message || 'Unable to load class workspace.', 'error');
                }
            });

            byId('assignment-form').addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    await helpers.getApi().lmsSaveAssignment(state.selectedClassId, {
                        id: byId('assignment-id').value,
                        title: byId('assignment-title').value.trim(),
                        dueDate: byId('assignment-due-date').value,
                        resourceLink: byId('assignment-resource-link').value.trim(),
                        description: byId('assignment-description').value.trim()
                    });
                    resetAssignmentForm();
                    await loadWorkspace(state.selectedClassId);
                    helpers.renderNotice(byId('teacher-notice'), 'Assignment saved successfully.', 'success');
                } catch (error) {
                    helpers.renderNotice(byId('teacher-notice'), error.message || 'Unable to save assignment.', 'error');
                }
            });

            byId('quiz-form').addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    await helpers.getApi().lmsSaveQuiz(state.selectedClassId, {
                        id: byId('quiz-id').value,
                        title: byId('quiz-title').value.trim(),
                        scheduledFor: byId('quiz-scheduled-for').value,
                        totalMarks: Number(byId('quiz-total-marks').value),
                        description: byId('quiz-description').value.trim()
                    });
                    resetQuizForm();
                    await loadWorkspace(state.selectedClassId);
                    helpers.renderNotice(byId('teacher-notice'), 'Quiz saved successfully.', 'success');
                } catch (error) {
                    helpers.renderNotice(byId('teacher-notice'), error.message || 'Unable to save quiz.', 'error');
                }
            });

            byId('attendance-form').addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const entries = Array.from(byId('attendance-student-list').querySelectorAll('.attendance-status')).map((select) => {
                        const studentId = select.getAttribute('data-student-id');
                        const remarksInput = byId('attendance-student-list').querySelector('[data-remarks-student-id="' + studentId + '"]');
                        return {
                            studentId,
                            status: select.value,
                            remarks: remarksInput ? remarksInput.value.trim() : ''
                        };
                    });

                    await helpers.getApi().lmsSaveAttendance(state.selectedClassId, {
                        date: byId('attendance-date').value,
                        entries
                    });
                    resetAttendanceForm();
                    await loadWorkspace(state.selectedClassId);
                    helpers.renderNotice(byId('teacher-notice'), 'Attendance saved successfully.', 'success');
                } catch (error) {
                    helpers.renderNotice(byId('teacher-notice'), error.message || 'Unable to save attendance.', 'error');
                }
            });

            byId('mark-form').addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    await helpers.getApi().lmsSaveMark(state.selectedClassId, {
                        id: byId('mark-id').value,
                        studentId: byId('mark-student-id').value,
                        title: byId('mark-title').value.trim(),
                        type: byId('mark-type').value,
                        score: Number(byId('mark-score').value),
                        totalMarks: Number(byId('mark-total').value),
                        recordedAt: byId('mark-recorded-at').value,
                        notes: byId('mark-notes').value.trim()
                    });
                    resetMarkForm();
                    await loadWorkspace(state.selectedClassId);
                    helpers.renderNotice(byId('teacher-notice'), 'Marks saved successfully.', 'success');
                } catch (error) {
                    helpers.renderNotice(byId('teacher-notice'), error.message || 'Unable to record marks.', 'error');
                }
            });

            byId('assignment-cancel').addEventListener('click', resetAssignmentForm);
            byId('quiz-cancel').addEventListener('click', resetQuizForm);
            byId('attendance-reset').addEventListener('click', resetAttendanceForm);
            byId('mark-cancel').addEventListener('click', resetMarkForm);

            byId('assignment-list').addEventListener('click', (event) => {
                const marksButton = event.target.closest('[data-open-assignment-marks]');
                if (marksButton) {
                    openAssignmentMarks(marksButton.getAttribute('data-open-assignment-marks'));
                    return;
                }

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

            byId('assignment-marks-panel').addEventListener('click', async (event) => {
                const saveButton = event.target.closest('[data-save-assignment-marks]');
                if (saveButton) {
                    try {
                        await saveAssignmentMarks();
                    } catch (error) {
                        helpers.renderNotice(byId('teacher-notice'), error.message || 'Unable to save assignment marks.', 'error');
                    }
                    return;
                }

                const closeButton = event.target.closest('[data-close-assignment-marks]');
                if (closeButton) {
                    state.selectedAssignmentId = '';
                    renderAssignmentMarksPanel();
                }
            });

            byId('quiz-list').addEventListener('click', (event) => {
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

            byId('attendance-list').addEventListener('click', (event) => {
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

            byId('mark-list').addEventListener('change', (event) => {
                if (event.target.id === 'marks-filter-month') {
                    state.marksFilterMonth = event.target.value;
                    renderMarks();
                    return;
                }

                if (event.target.id === 'marks-filter-type') {
                    state.marksFilterType = event.target.value;
                    renderMarks();
                }
            });

            byId('mark-list').addEventListener('click', (event) => {
                const studentButton = event.target.closest('[data-open-student-marks]');
                if (studentButton) {
                    openStudentMarksModal(studentButton.getAttribute('data-open-student-marks'));
                }
            });

            byId('student-marks-modal').addEventListener('click', async (event) => {
                if (event.target === byId('student-marks-modal') || event.target.closest('[data-close-student-marks-modal]')) {
                    closeStudentMarksModal();
                    return;
                }

                const assignmentGridButton = event.target.closest('[data-open-modal-assignment-grid]');
                if (assignmentGridButton) {
                    closeStudentMarksModal();
                    openAssignmentMarks(assignmentGridButton.getAttribute('data-open-modal-assignment-grid'));
                    return;
                }

                const editButton = event.target.closest('[data-edit-modal-mark]');
                if (editButton) {
                    closeStudentMarksModal();
                    if (viewNavigator) {
                        viewNavigator.setActiveView('teacher-marks-section');
                    }
                    loadMarkIntoForm(editButton.getAttribute('data-edit-modal-mark'));
                    return;
                }

                const deleteButton = event.target.closest('[data-delete-modal-mark]');
                if (deleteButton) {
                    await deleteMark(deleteButton.getAttribute('data-delete-modal-mark'));
                }
            });

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && !byId('student-marks-modal').classList.contains('hidden')) {
                    closeStudentMarksModal();
                }
            });

            byId('teacher-monthly-report-panel').addEventListener('change', (event) => {
                if (event.target.id === 'teacher-report-month-select') {
                    state.selectedReportMonth = event.target.value;
                    renderMonthlyReportPanel();
                }
            });

            byId('teacher-monthly-report-panel').addEventListener('click', async (event) => {
                const postButton = event.target.closest('[data-post-monthly-report]');
                if (!postButton) {
                    return;
                }

                if (!state.selectedReportMonth) {
                    helpers.renderNotice(byId('teacher-notice'), 'Select a month before posting the report.', 'error');
                    return;
                }

                if (!window.confirm('Post the monthly report for ' + formatReportMonthLabel(state.selectedReportMonth) + '? Teacher edits for this month will be locked afterwards.')) {
                    return;
                }

                try {
                    await helpers.getApi().lmsPostMonthlyReport(state.selectedClassId, state.selectedReportMonth);
                    await loadWorkspace(state.selectedClassId);
                    helpers.renderNotice(byId('teacher-notice'), 'Monthly report posted successfully. Teacher edits are now locked for that month.', 'success');
                } catch (error) {
                    helpers.renderNotice(byId('teacher-notice'), error.message || 'Unable to post the monthly report.', 'error');
                }
            });

            if (state.currentUser.mustChangePassword) {
                showPasswordGate();
                return;
            }

            await initializePortal();
        } catch (error) {
            helpers.renderNotice(byId('teacher-notice'), error.message || 'Unable to load teacher portal.', 'error');
        }
    });
})();