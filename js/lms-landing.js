(function () {
    'use strict';

    function redirectByRole(role) {
        if (role === 'teacher') {
            window.location.href = 'teacher-portal.html';
            return;
        }

        if (role === 'student') {
            window.location.href = 'student-portal.html';
            return;
        }

        if (role === 'super_admin') {
            window.location.href = 'lms-admin.html';
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const helpers = window.TuitionSolutionLms;
        const api = helpers.getApi();
        const form = document.getElementById('lms-login-form');
        const notice = document.getElementById('lms-login-notice');
        const button = document.getElementById('lms-login-btn');
        const resetForm = document.getElementById('lms-reset-request-form');
        const resetNotice = document.getElementById('lms-reset-request-notice');
        const resetButton = document.getElementById('lms-reset-request-btn');

        try {
            const session = await api.lmsSession();
            if (session && session.authenticated && session.user) {
                redirectByRole(session.user.role);
                return;
            }
        } catch {
            // Ignore initial session failures and keep login forms usable.
        }

        if (!form) {
            return;
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = form.querySelector('input[name="username"]').value.trim();
            const password = form.querySelector('input[name="password"]').value;

            helpers.renderNotice(notice, '', 'info');
            helpers.setBusy(button, true, button.innerHTML, 'Signing in...');

            try {
                const response = await api.lmsLogin({ username, password });
                helpers.renderNotice(notice, response && response.user && response.user.mustChangePassword
                    ? 'Password update required. Redirecting...'
                    : 'Portal ready. Redirecting...', 'success');
                redirectByRole(response && response.user ? response.user.role : '');
            } catch (error) {
                helpers.renderNotice(notice, error.message || 'Login failed. Please check your credentials.', 'error');
            } finally {
                helpers.setBusy(button, false, '<i class="fas fa-right-to-bracket mr-2" aria-hidden="true"></i> Open My Portal');
            }
        });

        if (!resetForm) {
            return;
        }

        resetForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const identifier = resetForm.querySelector('input[name="identifier"]').value.trim();

            helpers.renderNotice(resetNotice, '', 'info');
            helpers.setBusy(resetButton, true, resetButton.innerHTML, 'Sending request...');

            try {
                const response = await api.lmsForgotPasswordRequest({ identifier: identifier });
                helpers.renderNotice(resetNotice, (response && response.message) || 'Request sent to the super admin.', 'success');
                resetForm.reset();
            } catch (error) {
                helpers.renderNotice(resetNotice, error.message || 'Unable to send password reset request.', 'error');
            } finally {
                helpers.setBusy(resetButton, false, '<i class="fas fa-paper-plane mr-2" aria-hidden="true"></i> Send Reset Request');
            }
        });
    });
})();