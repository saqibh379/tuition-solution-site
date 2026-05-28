(function (window) {
    'use strict';

    const baseUrl = String(window.TUITION_SOLUTION_API_BASE_URL || '').replace(/\/$/, '');

    function buildUrl(path) {
        return baseUrl ? baseUrl + path : path;
    }

    async function request(path, options) {
        const response = await fetch(buildUrl(path), {
            credentials: baseUrl ? 'include' : 'same-origin',
            headers: {
                Accept: 'application/json',
                ...(options && options.body ? { 'Content-Type': 'application/json' } : {}),
                ...(options && options.headers ? options.headers : {})
            },
            ...options
        });

        if (response.status === 204) {
            return null;
        }

        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('application/json') ? await response.json() : await response.text();

        if (!response.ok) {
            throw new Error((payload && payload.message) || 'Request failed with status ' + response.status + '.');
        }

        return payload;
    }

    function getForms(options) {
        const activeOnly = !options || options.activeOnly !== false;
        return request(activeOnly ? '/api/forms' : '/api/forms?all=true');
    }

    window.TuitionSolutionApi = {
        health: function () {
            return request('/api/health');
        },
        lmsLogin: function (credentials) {
            return request('/api/lms/auth/login', {
                method: 'POST',
                body: JSON.stringify(credentials)
            });
        },
        lmsSession: function () {
            return request('/api/lms/auth/session');
        },
        lmsLogout: function () {
            return request('/api/lms/auth/logout', {
                method: 'POST'
            });
        },
        lmsForgotPasswordRequest: function (payload) {
            return request('/api/lms/auth/forgot-password-request', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        },
        lmsChangePassword: function (payload) {
            return request('/api/lms/auth/change-password', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        },
        lmsAdminOverview: function () {
            return request('/api/lms/admin/overview');
        },
        lmsPasswordResetRequests: function (status) {
            const query = status ? '?status=' + encodeURIComponent(status) : '';
            return request('/api/lms/admin/password-reset-requests' + query);
        },
        lmsResetPasswordRequest: function (requestId) {
            return request('/api/lms/admin/password-reset-requests/' + encodeURIComponent(requestId) + '/reset', {
                method: 'POST'
            });
        },
        lmsUsers: function (role) {
            const query = role ? '?role=' + encodeURIComponent(role) : '';
            return request('/api/lms/admin/users' + query);
        },
        lmsCreateUser: function (payload) {
            return request('/api/lms/admin/users', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        },
        lmsUpdateUser: function (id, payload) {
            return request('/api/lms/admin/users/' + encodeURIComponent(id), {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        },
        lmsClasses: function () {
            return request('/api/lms/admin/classes');
        },
        lmsCreateClass: function (payload) {
            return request('/api/lms/admin/classes', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        },
        lmsUpdateClass: function (id, payload) {
            return request('/api/lms/admin/classes/' + encodeURIComponent(id), {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        },
        lmsTeacherClasses: function () {
            return request('/api/lms/teacher/classes');
        },
        lmsClassWorkspace: function (classId) {
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/workspace');
        },
        lmsTeacherWorkspace: function (classId) {
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/workspace');
        },
        lmsSaveAssignment: function (classId, payload) {
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/assignments', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        },
        lmsDeleteAssignment: function (classId, assignmentId) {
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/assignments/' + encodeURIComponent(assignmentId), {
                method: 'DELETE'
            });
        },
        lmsSaveQuiz: function (classId, payload) {
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/quizzes', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        },
        lmsDeleteQuiz: function (classId, quizId) {
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/quizzes/' + encodeURIComponent(quizId), {
                method: 'DELETE'
            });
        },
        lmsSaveAttendance: function (classId, payload) {
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/attendance', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        },
        lmsDeleteAttendance: function (classId, date) {
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/attendance/' + encodeURIComponent(date), {
                method: 'DELETE'
            });
        },
        lmsSaveMark: function (classId, payload) {
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/marks', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        },
        lmsClassMarks: function (classId, filters) {
            const params = new URLSearchParams();
            const options = filters || {};

            if (options.reportMonth) {
                params.set('reportMonth', options.reportMonth);
            }
            if (options.type) {
                params.set('type', options.type);
            }
            if (options.sourceType) {
                params.set('sourceType', options.sourceType);
            }
            if (options.sourceId) {
                params.set('sourceId', options.sourceId);
            }
            if (options.status) {
                params.set('status', options.status);
            }

            const query = params.toString();
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/marks' + (query ? '?' + query : ''));
        },
        lmsAssignmentMarks: function (classId, assignmentId) {
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/assignments/' + encodeURIComponent(assignmentId) + '/marks');
        },
        lmsSaveAssignmentMarks: function (classId, assignmentId, entries) {
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/assignments/' + encodeURIComponent(assignmentId) + '/marks', {
                method: 'POST',
                body: JSON.stringify({ entries: entries })
            });
        },
        lmsDeleteMark: function (classId, markId) {
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/marks/' + encodeURIComponent(markId), {
                method: 'DELETE'
            });
        },
        lmsClassMonthlyReports: function (classId, options) {
            const params = new URLSearchParams();
            const filters = options || {};

            if (filters.reportMonth) {
                params.set('reportMonth', filters.reportMonth);
            }
            if (filters.includeDeleted) {
                params.set('includeDeleted', 'true');
            }

            const query = params.toString();
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/monthly-reports' + (query ? '?' + query : ''));
        },
        lmsPostMonthlyReport: function (classId, reportMonth) {
            return request('/api/lms/classes/' + encodeURIComponent(classId) + '/monthly-reports/' + encodeURIComponent(reportMonth) + '/post', {
                method: 'POST',
                body: JSON.stringify({})
            });
        },
        lmsAdminMonthlyReports: function (options) {
            const params = new URLSearchParams();
            const filters = options || {};

            if (filters.classId) {
                params.set('classId', filters.classId);
            }
            if (filters.reportMonth) {
                params.set('reportMonth', filters.reportMonth);
            }
            if (filters.includeDeleted) {
                params.set('includeDeleted', 'true');
            }

            const query = params.toString();
            return request('/api/lms/admin/monthly-reports' + (query ? '?' + query : ''));
        },
        lmsUpdateMonthlyReport: function (id, payload) {
            return request('/api/lms/admin/monthly-reports/' + encodeURIComponent(id), {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        },
        lmsDeleteMonthlyReport: function (id) {
            return request('/api/lms/admin/monthly-reports/' + encodeURIComponent(id), {
                method: 'DELETE'
            });
        },
        lmsPublicMonthlyReports: function (options) {
            const params = new URLSearchParams();
            const filters = options || {};

            if (filters.classId) {
                params.set('classId', filters.classId);
            }
            if (filters.reportMonth) {
                params.set('reportMonth', filters.reportMonth);
            }

            const query = params.toString();
            return request('/api/lms/public/monthly-reports' + (query ? '?' + query : ''));
        },
        lmsStudentDashboard: function () {
            return request('/api/lms/student/dashboard');
        },
        lmsStudentClass: function (classId) {
            return request('/api/lms/student/classes/' + encodeURIComponent(classId));
        },
        adminLogin: function (credentials) {
            return request('/api/admin/login', {
                method: 'POST',
                body: JSON.stringify(credentials)
            });
        },
        adminSession: function () {
            return request('/api/admin/session');
        },
        adminLogout: function () {
            return request('/api/admin/logout', {
                method: 'POST'
            });
        },
        getForms,
        replaceForms: function (forms) {
            return request('/api/forms', {
                method: 'PUT',
                body: JSON.stringify({ forms: forms })
            });
        },
        getSubmissions: function () {
            return request('/api/submissions');
        },
        replaceSubmissions: function (submissions) {
            return request('/api/submissions', {
                method: 'PUT',
                body: JSON.stringify({ submissions: submissions })
            });
        },
        submitRegistration: function (submission) {
            return request('/api/submissions', {
                method: 'POST',
                body: JSON.stringify(submission)
            });
        },
        submitAdmission: function (admission) {
            return request('/api/admissions', {
                method: 'POST',
                body: JSON.stringify(admission)
            });
        },
        submitContactMessage: function (message) {
            return request('/api/contact-messages', {
                method: 'POST',
                body: JSON.stringify(message)
            });
        }
    };
})(window);