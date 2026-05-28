(function () {
    'use strict';

    function byId(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function formatMonthLabel(reportMonth) {
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

    function formatDate(value) {
        if (!value) {
            return 'Not posted yet';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat('en-PK', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(date);
    }

    function renderEmptyState(message) {
        return '<div class="bg-white rounded-3xl border border-gray-100 shadow-lg p-8 text-center text-gray-500">'
            + escapeHtml(message)
            + '</div>';
    }

    function groupReportsByMonth(reports) {
        const grouped = new Map();

        reports.forEach((reportItem) => {
            const key = reportItem && reportItem.reportMonth ? reportItem.reportMonth : 'unknown';
            const existing = grouped.get(key) || { reportMonth: key, items: [] };
            existing.items.push(reportItem);
            grouped.set(key, existing);
        });

        return Array.from(grouped.values()).sort((left, right) => String(right.reportMonth).localeCompare(String(left.reportMonth)));
    }

    function getMonthLeader(items) {
        return items
            .map((reportItem) => ({
                reportItem: reportItem,
                topStudent: reportItem && reportItem.topStudent ? reportItem.topStudent : null
            }))
            .filter((item) => item.topStudent)
            .sort((left, right) => {
                if ((right.topStudent.averagePercentage || 0) !== (left.topStudent.averagePercentage || 0)) {
                    return (right.topStudent.averagePercentage || 0) - (left.topStudent.averagePercentage || 0);
                }

                return String(left.topStudent.fullName || left.topStudent.username || '').localeCompare(String(right.topStudent.fullName || right.topStudent.username || ''));
            })[0] || null;
    }

    function renderRankingRows(rankings) {
        return rankings.map((item) => '<tr>'
            + '<td class="px-4 py-3 text-sm font-semibold text-slate-700">#' + escapeHtml(String(item.rank || 0)) + '</td>'
            + '<td class="px-4 py-3 text-sm text-slate-700">' + escapeHtml(item.fullName || item.username || 'Student') + '</td>'
            + '<td class="px-4 py-3 text-sm text-slate-700">' + escapeHtml(String(item.averagePercentage || 0)) + '%</td>'
            + '<td class="px-4 py-3 text-sm text-slate-500">' + escapeHtml(String(item.entriesCount || 0)) + '</td>'
            + '</tr>').join('');
    }

    function renderReportCard(reportItem) {
        const topStudent = reportItem && reportItem.topStudent ? reportItem.topStudent : null;
        const summary = reportItem && reportItem.summary ? reportItem.summary : {};
        const rankings = reportItem && Array.isArray(reportItem.rankings) ? reportItem.rankings : [];

        return '<article class="bg-white rounded-3xl p-6 md:p-7 shadow-lg border border-gray-100">'
            + '<div class="flex items-start justify-between gap-4 flex-wrap">'
            + '<div>'
            + '<div class="flex items-center gap-2 flex-wrap"><h3 class="font-heading text-2xl font-bold text-gray-900">' + escapeHtml(reportItem.className || 'Class report') + '</h3>'
            + (reportItem.classCode ? '<span class="inline-flex items-center gap-1 bg-primary-50 text-primary-700 text-xs font-bold px-3 py-1 rounded-full border border-primary-100">' + escapeHtml(reportItem.classCode) + '</span>' : '')
            + '</div>'
            + '<p class="text-sm text-gray-500 mt-2">' + escapeHtml(reportItem.classSubject || 'General class') + '</p>'
            + '<p class="text-sm text-gray-400 mt-1">Posted on ' + escapeHtml(formatDate(reportItem.postedAt)) + '</p>'
            + '</div>'
            + (topStudent
                ? '<div class="w-full sm:w-auto sm:min-w-[220px] rounded-2xl bg-gradient-to-br from-accent-50 to-yellow-50 border border-accent-100 px-5 py-4"><p class="text-xs uppercase tracking-[0.2em] text-accent-600 font-semibold">Top 1</p><h4 class="font-heading text-xl font-bold text-gray-900 mt-3 break-words">' + escapeHtml(topStudent.fullName || topStudent.username || 'Student') + '</h4><p class="text-sm text-gray-500 mt-1 break-words">' + escapeHtml(topStudent.username || '') + '</p><p class="mt-3 text-3xl font-bold text-accent-600">' + escapeHtml(String(topStudent.averagePercentage || 0)) + '%</p></div>'
                : '<div class="w-full sm:w-auto sm:min-w-[220px] rounded-2xl bg-gray-50 border border-gray-200 px-5 py-4 text-sm text-gray-500">Top student data unavailable.</div>')
            + '</div>'
            + '<p class="text-sm text-gray-600 mt-5">' + escapeHtml(reportItem.announcementSummary || 'This class report is now live on the website.') + '</p>'
            + '<div class="grid sm:grid-cols-3 gap-3 mt-5">'
            + '<div class="rounded-2xl bg-gray-50 border border-gray-100 p-4"><p class="text-xs uppercase tracking-[0.15em] text-gray-400">Students</p><p class="mt-2 text-2xl font-bold text-gray-900">' + escapeHtml(String(summary.studentsCount || rankings.length || 0)) + '</p></div>'
            + '<div class="rounded-2xl bg-gray-50 border border-gray-100 p-4"><p class="text-xs uppercase tracking-[0.15em] text-gray-400">Posted Marks</p><p class="mt-2 text-2xl font-bold text-gray-900">' + escapeHtml(String(summary.postedMarksCount || 0)) + '</p></div>'
            + '<div class="rounded-2xl bg-gray-50 border border-gray-100 p-4"><p class="text-xs uppercase tracking-[0.15em] text-gray-400">Class Average</p><p class="mt-2 text-2xl font-bold text-gray-900">' + escapeHtml(String(summary.averagePercentage || 0)) + '%</p></div>'
            + '</div>'
            + (rankings.length
                ? '<div class="mt-6 overflow-hidden rounded-2xl border border-gray-100"><div class="overflow-x-auto"><table class="min-w-full"><thead class="bg-gray-50"><tr><th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">Rank</th><th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">Student</th><th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">Average</th><th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">Entries</th></tr></thead><tbody>' + renderRankingRows(rankings) + '</tbody></table></div></div>'
                : '<div class="mt-6 text-sm text-gray-500">No ranking rows are available for this report yet.</div>')
            + '</article>';
    }

    function renderMonthGroup(group, index) {
        const monthLeader = getMonthLeader(group.items);
        const leaderStudent = monthLeader && monthLeader.topStudent ? monthLeader.topStudent : null;

        return '<details class="report-accordion bg-white/90 rounded-3xl border border-gray-100 shadow-lg overflow-hidden" ' + (index === 0 ? 'open' : '') + '>'
            + '<summary class="list-none cursor-pointer px-6 py-5 md:px-8 md:py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white">'
            + '<div>'
            + '<div class="inline-flex items-center gap-2 bg-primary-50 text-primary-700 rounded-full px-4 py-1.5 border border-primary-100 text-xs font-semibold uppercase tracking-[0.18em]">'
            + escapeHtml(formatMonthLabel(group.reportMonth))
            + '</div>'
            + '<h3 class="font-heading text-2xl md:text-3xl font-bold text-gray-900 mt-4">Monthly Results</h3>'
            + '<p class="text-gray-500 mt-2">' + escapeHtml(String(group.items.length)) + ' class reports posted for this month.</p>'
            + '</div>'
            + '<div class="flex w-full min-w-0 items-center justify-between gap-4 flex-wrap lg:w-auto lg:justify-end">'
            + (leaderStudent
                ? '<div class="min-w-0 text-left lg:text-right"><p class="text-xs uppercase tracking-[0.15em] text-gray-400">Best Top 1</p><p class="font-semibold text-gray-900 mt-1 break-words">' + escapeHtml(leaderStudent.fullName || leaderStudent.username || 'Student') + '</p><p class="text-accent-500 font-bold mt-1">' + escapeHtml(String(leaderStudent.averagePercentage || 0)) + '%</p></div>'
                : '')
            + '<span class="report-chevron text-xl text-gray-400"><i class="fas fa-chevron-down" aria-hidden="true"></i></span>'
            + '</div>'
            + '</summary>'
            + '<div class="px-6 pb-6 md:px-8 md:pb-8 bg-gradient-to-b from-white to-gray-50">'
            + '<div class="grid xl:grid-cols-2 gap-6">'
            + group.items.map(renderReportCard).join('')
            + '</div>'
            + '</div>'
            + '</details>';
    }

    function bindAccordion(container) {
        Array.from(container.querySelectorAll('.report-accordion')).forEach((details) => {
            details.addEventListener('toggle', function () {
                if (!details.open) {
                    return;
                }

                Array.from(container.querySelectorAll('.report-accordion')).forEach((item) => {
                    if (item !== details) {
                        item.open = false;
                    }
                });
            });
        });
    }

    async function loadReports(retryCount) {
        const container = byId('monthly-reports-shell');
        if (!container) {
            return;
        }

        const attempt = Number(retryCount) || 0;

        try {
            if (!window.TuitionSolutionApi || typeof window.TuitionSolutionApi.lmsPublicMonthlyReports !== 'function') {
                throw new Error('Monthly reports API client unavailable.');
            }

            const response = await window.TuitionSolutionApi.lmsPublicMonthlyReports();
            const reports = response && Array.isArray(response.reports) ? response.reports : [];

            if (!reports.length) {
                container.innerHTML = renderEmptyState('No monthly reports have been posted yet.');
                return;
            }

            const groups = groupReportsByMonth(reports);
            container.innerHTML = groups.map(renderMonthGroup).join('');
            bindAccordion(container);

            if (window.AOS && typeof window.AOS.refresh === 'function') {
                window.AOS.refresh();
            }
        } catch (error) {
            if (attempt < 1) {
                window.setTimeout(function () {
                    loadReports(attempt + 1);
                }, 1200);
                return;
            }

            console.error('Unable to load monthly reports.', error);
            container.innerHTML = renderEmptyState('Monthly reports are temporarily unavailable. Please try again shortly.');
        }
    }

    document.addEventListener('DOMContentLoaded', loadReports);
})();
