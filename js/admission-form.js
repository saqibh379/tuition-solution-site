/**
 * Admission Form — Google Sheets Integration
 * Tuition Solution & IT Solution
 */

(function () {
    'use strict';

    // ── Google Apps Script Web App URL ──
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzt7Zdevz8cb5AE2yHgq669FRyox6FEY8JkD6i3vmYLcMLn6dxfB5-5GKiASeGfjpCx/exec';

    // ── DOM References ──
    const form = document.getElementById('admission-form');
    const step1 = document.getElementById('form-step-1');
    const step2 = document.getElementById('form-step-2');
    const step3 = document.getElementById('form-step-3');
    const overlay = document.getElementById('loading-overlay');
    const nextBtn = document.getElementById('next-step-1');
    const prevBtn = document.getElementById('prev-step-2');
    const applyAgainBtn = document.getElementById('apply-again-btn');

    // ── Regex patterns ──
    const PHONE_REGEX = /^(03\d{2}[\s-]?\d{7}|\+92\s?\d{3}[\s-]?\d{7}|0\d{2,3}[\s-]?\d{7,8})$/;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const CNIC_REGEX = /^\d{5}-?\d{7}-?\d{1}$/;

    // ── Pre-select course from URL param ──
    function preselectCourse() {
        var params = new URLSearchParams(window.location.search);
        var course = params.get('course');
        if (course) {
            var select = document.getElementById('course');
            for (var i = 0; i < select.options.length; i++) {
                if (select.options[i].value === course) {
                    select.selectedIndex = i;
                    break;
                }
            }
        }
    }

    // ── Validation helpers ──
    function showError(field, message) {
        field.classList.add('error');
        field.classList.remove('success');
        var errEl = field.closest('div').querySelector('.field-error-msg');
        if (errEl) {
            errEl.textContent = message;
            errEl.classList.add('visible');
        }
    }

    function showRadioError(errorId, message) {
        var errEl = document.getElementById(errorId);
        if (errEl) {
            errEl.textContent = message;
            errEl.classList.add('visible');
        }
    }

    function clearError(field) {
        field.classList.remove('error');
        field.classList.add('success');
        var errEl = field.closest('div').querySelector('.field-error-msg');
        if (errEl) {
            errEl.textContent = '';
            errEl.classList.remove('visible');
        }
    }

    function clearRadioError(errorId) {
        var errEl = document.getElementById(errorId);
        if (errEl) {
            errEl.textContent = '';
            errEl.classList.remove('visible');
        }
    }

    function validateField(field) {
        var value = field.value.trim();
        var name = field.name;

        // Required check
        if (field.hasAttribute('required') && !value) {
            showError(field, 'This field is required.');
            return false;
        }

        // Phone format
        if ((name === 'phone') && value && !PHONE_REGEX.test(value)) {
            showError(field, 'Enter a valid Pakistani phone number (e.g. 0321-3825799).');
            return false;
        }
        if (name === 'whatsapp' && value && !PHONE_REGEX.test(value)) {
            showError(field, 'Enter a valid phone number.');
            return false;
        }

        // Email format
        if (name === 'email' && value && !EMAIL_REGEX.test(value)) {
            showError(field, 'Enter a valid email address.');
            return false;
        }

        // CNIC format
        if (name === 'cnic' && value && !CNIC_REGEX.test(value)) {
            showError(field, 'Enter a valid CNIC (e.g. 42101-1234567-1).');
            return false;
        }

        if (value) clearError(field);
        return true;
    }

    function validateRadioGroup(name, errorId) {
        var checked = document.querySelector('input[name="' + name + '"]:checked');
        if (!checked) {
            showRadioError(errorId, 'Please select an option.');
            return false;
        }
        clearRadioError(errorId);
        return true;
    }

    // ── Step 1 Validation ──
    function validateStep1() {
        var fields = step1.querySelectorAll('input[required], textarea[required]');
        var valid = true;

        fields.forEach(function (f) {
            if (f.type === 'radio') return; // handle separately
            if (!validateField(f)) valid = false;
        });

        // Gender radio
        if (!validateRadioGroup('gender', 'gender-error')) valid = false;

        // Optional fields with format validation
        var cnic = document.getElementById('cnic');
        if (cnic.value.trim() && !CNIC_REGEX.test(cnic.value.trim())) {
            showError(cnic, 'Enter a valid CNIC (e.g. 42101-1234567-1).');
            valid = false;
        }

        var email = document.getElementById('email');
        if (email.value.trim() && !EMAIL_REGEX.test(email.value.trim())) {
            showError(email, 'Enter a valid email address.');
            valid = false;
        }

        var whatsapp = document.getElementById('whatsapp');
        if (whatsapp.value.trim() && !PHONE_REGEX.test(whatsapp.value.trim())) {
            showError(whatsapp, 'Enter a valid phone number.');
            valid = false;
        }

        return valid;
    }

    // ── Step 2 Validation ──
    function validateStep2() {
        var valid = true;

        var course = document.getElementById('course');
        if (!course.value) {
            showError(course, 'Please select a course.');
            valid = false;
        } else {
            clearError(course);
        }

        var education = document.getElementById('education');
        if (!education.value) {
            showError(education, 'Please select your qualification.');
            valid = false;
        } else {
            clearError(education);
        }

        if (!validateRadioGroup('shift', 'shift-error')) valid = false;

        return valid;
    }

    // ── Step navigation UI ──
    function updateStepUI(currentStep) {
        for (var i = 1; i <= 3; i++) {
            var badge = document.getElementById('step-badge-' + i);
            var label = document.getElementById('step-label-' + i);
            if (i < currentStep) {
                badge.className = 'step-badge completed';
                badge.innerHTML = '<i class="fas fa-check text-xs"></i>';
                if (label) { label.className = 'text-sm font-medium text-green-600 hidden sm:inline'; }
            } else if (i === currentStep) {
                badge.className = 'step-badge active';
                badge.textContent = i;
                badge.setAttribute('aria-current', 'step');
                if (label) { label.className = 'text-sm font-medium text-primary-700 hidden sm:inline'; }
            } else {
                badge.className = 'step-badge pending';
                badge.textContent = i;
                badge.removeAttribute('aria-current');
                if (label) { label.className = 'text-sm font-medium text-gray-400 hidden sm:inline'; }
            }
        }
        // Step lines
        var line1 = document.getElementById('step-line-1');
        var line2 = document.getElementById('step-line-2');
        if (line1) line1.className = currentStep > 1 ? 'w-8 sm:w-12 h-0.5 bg-green-400' : 'w-8 sm:w-12 h-0.5 bg-gray-200';
        if (line2) line2.className = currentStep > 2 ? 'w-8 sm:w-12 h-0.5 bg-green-400' : 'w-8 sm:w-12 h-0.5 bg-gray-200';
    }

    function goToStep(n) {
        step1.classList.toggle('hidden', n !== 1);
        step2.classList.toggle('hidden', n !== 2);
        step3.classList.toggle('hidden', n !== 3);
        if (n === 3) form.classList.add('hidden');
        updateStepUI(n);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ── Collect form data ──
    function collectData() {
        var getVal = function (id) {
            var el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };
        var getRadio = function (name) {
            var checked = document.querySelector('input[name="' + name + '"]:checked');
            return checked ? checked.value : '';
        };

        return {
            studentName: getVal('studentName'),
            fatherName: getVal('fatherName'),
            dob: getVal('dob'),
            gender: getRadio('gender'),
            cnic: getVal('cnic'),
            phone: getVal('phone'),
            whatsapp: getVal('whatsapp') || getVal('phone'),
            email: getVal('email'),
            address: getVal('address'),
            course: getVal('course'),
            shift: getRadio('shift'),
            education: getVal('education'),
            siblingDiscount: getRadio('siblingDiscount'),
            source: getVal('source'),
            remarks: getVal('remarks')
        };
    }

    // ── Submit to Google Sheets ──
    function submitToSheet(data) {
        return fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(data)
        });
    }

    async function submitAdmission(data) {
        overlay.classList.remove('hidden');

        try {
            if (window.TuitionSolutionApi) {
                await window.TuitionSolutionApi.submitAdmission(data);
            } else {
                await submitToSheet(data);
            }
            overlay.classList.add('hidden');
            goToStep(3);
        } catch (error) {
            try {
                await submitToSheet(data);
                overlay.classList.add('hidden');
                goToStep(3);
            } catch {
                overlay.classList.add('hidden');
                alert(error.message || 'Network error! Please check your internet connection and try again.');
            }
        }
    }

    // ── Live validation on blur ──
    function setupLiveValidation() {
        var inputs = form.querySelectorAll('input:not([type="radio"]), textarea, select');
        inputs.forEach(function (input) {
            input.addEventListener('blur', function () {
                if (input.value.trim()) validateField(input);
            });
            input.addEventListener('input', function () {
                if (input.classList.contains('error') && input.value.trim()) {
                    validateField(input);
                }
            });
        });
    }

    // ── Event Listeners ──
    nextBtn.addEventListener('click', function () {
        if (validateStep1()) goToStep(2);
    });

    prevBtn.addEventListener('click', function () {
        goToStep(1);
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validateStep2()) return;
        var data = collectData();
        submitAdmission(data);
    });

    applyAgainBtn.addEventListener('click', function () {
        form.reset();
        form.classList.remove('hidden');
        // Clear all validation states
        form.querySelectorAll('.error').forEach(function (el) { el.classList.remove('error'); });
        form.querySelectorAll('.success').forEach(function (el) { el.classList.remove('success'); });
        form.querySelectorAll('.field-error-msg.visible').forEach(function (el) {
            el.classList.remove('visible');
            el.textContent = '';
        });
        goToStep(1);
        preselectCourse();
    });

    // ── Init ──
    preselectCourse();
    setupLiveValidation();

})();
