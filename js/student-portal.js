(function () {
    'use strict';

    const state = {
        currentUser: null,
        dashboard: null,
        selectedClassId: '',
        activeView: 'student-overview-panel',
        portalReady: false
    };

    let viewNavigator = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function renderSummary(summary) {
        byId('student-stat-classes').textContent = String(summary.classes || 0);
        byId('student-stat-assignments').textContent = String(summary.assignments || 0);
        byId('student-stat-quizzes').textContent = String(summary.quizzes || 0);
        byId('student-stat-attendance').textContent = String(summary.attendance || 0) + '%';
        byId('student-stat-score').textContent = String(summary.averageScore || 0) + '%';
    }

    function renderClassTabs() {
        const helpers = window.TuitionSolutionLms;
        const container = byId('student-class-tabs');
        const classes = state.dashboard.classes || [];

        if (!classes.length) {
            container.innerHTML = '<div class="lms-empty"><p>No classes assigned to this student yet.</p></div>';
            return;
        }

        container.innerHTML = classes.map((classItem) => '<button type="button" class="lms-sidebar-item ' + (classItem.id === state.selectedClassId ? 'is-active' : '') + '" data-student-class-id="' + helpers.escapeHtml(classItem.id) + '">'
            + '<span class="block font-semibold">' + helpers.escapeHtml(classItem.name) + '</span>'
            + '<span class="block text-sm text-slate-500 mt-1">' + helpers.escapeHtml(classItem.subject || 'General class') + '</span>'
            + '</button>').join('');
    }

    function showPasswordGate() {
        const message = state.currentUser && state.currentUser.passwordChangeReason === 'temporary_password'
            ? 'You signed in with a temporary password. Set your permanent password now.'
            : 'This is your first login. You must change your password before using the LMS.';

        byId('student-password-gate-message').textContent = message;
        byId('student-password-gate').classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    }

    function hidePasswordGate() {
        const helpers = window.TuitionSolutionLms;
        byId('student-password-gate').classList.add('hidden');
        byId('student-password-form').reset();
        helpers.renderNotice(byId('student-password-gate-notice'), '', 'info');
        document.body.classList.remove('overflow-hidden');
    }

    async function initializePortal() {
        const helpers = window.TuitionSolutionLms;

        if (state.portalReady) {
            return;
        }

        state.dashboard = await helpers.getApi().lmsStudentDashboard();
        renderSummary(state.dashboard.summary || {});

        if ((state.dashboard.classes || []).length) {
            if (!state.selectedClassId || !(state.dashboard.classes || []).some((item) => item.id === state.selectedClassId)) {
                state.selectedClassId = state.dashboard.classes[0].id;
            }
        } else {
            state.selectedClassId = '';
        }

        renderClassTabs();
        renderCurrentClass();
        state.portalReady = true;
    }

    async function submitPasswordChange(event) {
        event.preventDefault();
        const helpers = window.TuitionSolutionLms;
        const currentPassword = byId('student-current-password').value;
        const newPassword = byId('student-new-password').value;
        const confirmPassword = byId('student-confirm-password').value;
        const notice = byId('student-password-gate-notice');
        const button = byId('student-password-submit');

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
            helpers.renderNotice(byId('student-notice'), 'Password updated successfully. Portal unlocked.', 'success');
        } catch (error) {
            helpers.renderNotice(notice, error.message || 'Unable to update password.', 'error');
        } finally {
            helpers.setBusy(button, false, 'Update Password');
        }
    }

    function renderCurrentClass() {
        const helpers = window.TuitionSolutionLms;
        const container = byId('student-view-stack');
        const currentClass = (state.dashboard.classes || []).find((item) => item.id === state.selectedClassId);

        if (!currentClass) {
            container.innerHTML = '<div class="lms-empty"><p>Select a class to view progress.</p></div>';
            if (viewNavigator) {
                viewNavigator.sync(state.activeView);
            }
            return;
        }

        const teacherNames = (currentClass.teachers || []).map((teacher) => teacher.fullName || teacher.username).join(', ') || 'Teacher pending';
        const assignments = currentClass.assignments || [];
        const quizzes = currentClass.quizzes || [];
        const marks = currentClass.marks || [];
        const attendanceSummary = currentClass.attendanceSummary || { percentage: 0, present: 0, absent: 0, late: 0, excused: 0 };
        const markSummary = currentClass.markSummary || { averagePercentage: 0 };

        container.innerHTML = '<section id="student-overview-panel" class="lms-dashboard-card p-6 lms-view-panel lms-anchor-section">'
            + '<div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">'
            + '<div>'
            + '<div class="flex items-center gap-3 flex-wrap">'
            + '<h2 class="font-heading text-3xl font-bold text-slate-900">' + helpers.escapeHtml(currentClass.name) + '</h2>'
            + (currentClass.code ? '<span class="lms-badge lms-badge-blue">' + helpers.escapeHtml(currentClass.code) + '</span>' : '')
            + '</div>'
            + '<p class="text-slate-500 mt-3">' + helpers.escapeHtml(currentClass.subject || 'General class') + ' | ' + helpers.escapeHtml(currentClass.schedule || 'Schedule pending') + '</p>'
            + '<p class="text-slate-500 mt-2">Teacher: ' + helpers.escapeHtml(teacherNames) + '</p>'
            + (currentClass.description ? '<p class="text-slate-600 mt-4 max-w-3xl">' + helpers.escapeHtml(currentClass.description) + '</p>' : '')
            + '</div>'
            + '<div class="grid sm:grid-cols-2 gap-3 min-w-[260px]">'
            + '<div class="rounded-2xl bg-primary-50 border border-primary-100 p-4"><p class="text-sm text-primary-700">Attendance</p><p class="mt-2 text-3xl font-bold text-primary-900">' + helpers.escapeHtml(String(attendanceSummary.percentage || 0)) + '%</p></div>'
            + '<div class="rounded-2xl bg-accent-50 border border-accent-100 p-4"><p class="text-sm text-accent-700">Average Score</p><p class="mt-2 text-3xl font-bold text-accent-900">' + helpers.escapeHtml(String(markSummary.averagePercentage || 0)) + '%</p></div>'
            + '</div>'
            + '</div>'
            + '</section>'
            + '<section id="student-assignments-panel" class="lms-dashboard-card p-6 lms-view-panel lms-anchor-section">'
            + '<div class="flex items-center justify-between gap-3"><h3 class="lms-section-title">Assignments</h3><span class="lms-badge lms-badge-orange">' + helpers.escapeHtml(String(assignments.length)) + ' items</span></div>'
            + '<p class="text-slate-500 mt-2">Current class: ' + helpers.escapeHtml(currentClass.name) + '</p>'
            + (assignments.length ? '<div class="lms-mini-list mt-5">' + assignments.map((item) => '<article class="rounded-2xl border border-slate-200 bg-white p-4"><div class="flex items-center justify-between gap-3 flex-wrap"><h4 class="font-semibold text-slate-900">' + helpers.escapeHtml(item.title) + '</h4><span class="text-sm text-slate-500">Due ' + helpers.escapeHtml(helpers.formatDate(item.dueDate)) + '</span></div><p class="text-sm text-slate-500 mt-2">' + helpers.escapeHtml(item.description || 'No description added.') + '</p></article>').join('') + '</div>' : '<div class="lms-empty mt-5"><p>No assignments available for this class yet.</p></div>')
            + '</section>'
            + '<section id="student-quizzes-panel" class="lms-dashboard-card p-6 lms-view-panel lms-anchor-section">'
            + '<div class="flex items-center justify-between gap-3"><h3 class="lms-section-title">Quizzes</h3><span class="lms-badge lms-badge-blue">' + helpers.escapeHtml(String(quizzes.length)) + ' items</span></div>'
            + '<p class="text-slate-500 mt-2">Current class: ' + helpers.escapeHtml(currentClass.name) + '</p>'
            + (quizzes.length ? '<div class="lms-mini-list mt-5">' + quizzes.map((item) => '<article class="rounded-2xl border border-slate-200 bg-white p-4"><div class="flex items-center justify-between gap-3 flex-wrap"><h4 class="font-semibold text-slate-900">' + helpers.escapeHtml(item.title) + '</h4><span class="text-sm text-slate-500">' + helpers.escapeHtml(String(item.totalMarks)) + ' marks</span></div><p class="text-sm text-slate-500 mt-2">Scheduled ' + helpers.escapeHtml(helpers.formatDate(item.scheduledFor)) + '</p><p class="text-sm text-slate-500 mt-1">' + helpers.escapeHtml(item.description || 'No description added.') + '</p></article>').join('') + '</div>' : '<div class="lms-empty mt-5"><p>No quizzes available for this class yet.</p></div>')
            + '</section>'
            + '<section id="student-attendance-panel" class="grid xl:grid-cols-2 gap-6 lms-view-panel lms-anchor-section">'
            + '<article class="lms-dashboard-card p-6"><div class="flex items-center justify-between gap-3"><h3 class="lms-section-title">Attendance Snapshot</h3><span class="lms-badge lms-badge-blue">' + helpers.escapeHtml(String(attendanceSummary.percentage || 0)) + '%</span></div><p class="text-slate-500 mt-2">Current class: ' + helpers.escapeHtml(currentClass.name) + '</p><div class="grid grid-cols-2 gap-3 mt-5">'
            + '<div class="rounded-2xl bg-slate-50 p-4 border border-slate-200"><p class="text-sm text-slate-500">Present</p><p class="mt-2 text-2xl font-bold text-slate-900">' + helpers.escapeHtml(String(attendanceSummary.present || 0)) + '</p></div>'
            + '<div class="rounded-2xl bg-slate-50 p-4 border border-slate-200"><p class="text-sm text-slate-500">Absent</p><p class="mt-2 text-2xl font-bold text-slate-900">' + helpers.escapeHtml(String(attendanceSummary.absent || 0)) + '</p></div>'
            + '<div class="rounded-2xl bg-slate-50 p-4 border border-slate-200"><p class="text-sm text-slate-500">Late</p><p class="mt-2 text-2xl font-bold text-slate-900">' + helpers.escapeHtml(String(attendanceSummary.late || 0)) + '</p></div>'
            + '<div class="rounded-2xl bg-slate-50 p-4 border border-slate-200"><p class="text-sm text-slate-500">Excused</p><p class="mt-2 text-2xl font-bold text-slate-900">' + helpers.escapeHtml(String(attendanceSummary.excused || 0)) + '</p></div>'
            + '</div></article>'
            + '<article class="lms-dashboard-card p-6"><h3 class="lms-section-title">Attendance Notes</h3><p class="text-slate-500 mt-4">Your attendance percentage is calculated from the class records shared by your teacher and the super admin.</p></article>'
            + '</section>'
            + '<section id="student-marks-panel" class="lms-dashboard-card p-6 lms-view-panel lms-anchor-section">'
            + '<div class="flex items-center justify-between gap-3"><h3 class="lms-section-title">Marks</h3><span class="lms-badge lms-badge-green">Average ' + helpers.escapeHtml(String(markSummary.averagePercentage || 0)) + '%</span></div>'
            + '<p class="text-slate-500 mt-2">Current class: ' + helpers.escapeHtml(currentClass.name) + '</p>'
            + (marks.length ? '<div class="lms-table-wrap mt-5"><table class="lms-table"><thead><tr><th>Title</th><th>Type</th><th>Score</th><th>Date</th></tr></thead><tbody>' + marks.map((mark) => '<tr><td>' + helpers.escapeHtml(mark.title) + '</td><td>' + helpers.escapeHtml(mark.type) + '</td><td>' + helpers.escapeHtml(String(mark.score)) + ' / ' + helpers.escapeHtml(String(mark.totalMarks)) + '</td><td>' + helpers.escapeHtml(helpers.formatDate(mark.recordedAt)) + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="lms-empty mt-5"><p>No marks recorded for this class yet.</p></div>')
            + '</section>';

        if (viewNavigator) {
            viewNavigator.sync(state.activeView);
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const helpers = window.TuitionSolutionLms;

        viewNavigator = helpers.createViewNavigator({
            navRoot: byId('student-view-nav'),
            panelRoot: byId('student-view-stack'),
            defaultView: state.activeView,
            onChange: function (viewId) {
                state.activeView = viewId;
            }
        });
        viewNavigator.sync(state.activeView);

        try {
            state.currentUser = await helpers.ensureRole('student', 'lms.html');
            if (!state.currentUser) {
                return;
            }

            byId('student-name').textContent = state.currentUser.fullName || state.currentUser.username;
            byId('student-logout').addEventListener('click', () => helpers.logout('lms.html'));
            byId('student-password-form').addEventListener('submit', submitPasswordChange);

            byId('student-class-tabs').addEventListener('click', (event) => {
                const button = event.target.closest('[data-student-class-id]');
                if (!button || !state.dashboard) {
                    return;
                }

                state.selectedClassId = button.getAttribute('data-student-class-id');
                renderClassTabs();
                renderCurrentClass();
            });

            if (state.currentUser.mustChangePassword) {
                showPasswordGate();
                return;
            }

            await initializePortal();
        } catch (error) {
            helpers.renderNotice(byId('student-notice'), error.message || 'Unable to load student portal.', 'error');
        }
    });
})();