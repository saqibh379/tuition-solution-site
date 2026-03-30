/* ============================================
   CONTACT PAGE - Enrollment Form Validation
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // ============================================
    // Enrollment Form Validation
    // ============================================
    const enrollmentForm = document.getElementById('enrollment-form');
    const formSuccess = document.getElementById('form-success');

    if (enrollmentForm && formSuccess) {
        enrollmentForm.addEventListener('submit', (e) => {
            e.preventDefault();

            let isValid = true;
            const name = document.getElementById('student-name');
            const phone = document.getElementById('student-phone');
            const course = document.getElementById('student-course');

            // Clear previous errors
            enrollmentForm.querySelectorAll('.error-message').forEach(el => {
                el.classList.add('hidden');
                el.classList.remove('visible');
                el.textContent = '';
            });

            // Validate name
            if (!name.value.trim()) {
                showError(name, 'Please enter your full name.');
                isValid = false;
            }

            // Validate phone
            const phoneRegex = /^(03\d{2}[\s-]?\d{7}|\+92\s?\d{3}[\s-]?\d{7})$/;
            if (!phone.value.trim()) {
                showError(phone, 'Please enter your phone number.');
                isValid = false;
            } else if (!phoneRegex.test(phone.value.trim())) {
                showError(phone, 'Please enter a valid Pakistani phone number.');
                isValid = false;
            }

            // Validate course
            if (!course.value) {
                showError(course, 'Please select a course or service.');
                isValid = false;
            }

            if (isValid) {
                const submitBtn = enrollmentForm.querySelector('button[type="submit"]');
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Submitting...';
                submitBtn.disabled = true;

                setTimeout(() => {
                    enrollmentForm.classList.add('hidden');
                    formSuccess.classList.remove('hidden');
                    formSuccess.classList.add('animate-fade-in');

                    const announcer = document.createElement('div');
                    announcer.setAttribute('role', 'status');
                    announcer.setAttribute('aria-live', 'polite');
                    announcer.className = 'sr-only';
                    announcer.textContent = 'Enrollment form submitted successfully. We will contact you within 24 hours.';
                    document.body.appendChild(announcer);
                    setTimeout(() => announcer.remove(), 3000);
                }, 1500);
            }
        });

        function showError(input, message) {
            const errorEl = input.parentElement.querySelector('.error-message');
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.classList.remove('hidden');
                errorEl.classList.add('visible');
            }
            input.classList.add('border-red-500');
            input.setAttribute('aria-invalid', 'true');
            input.focus();
        }

        enrollmentForm.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', () => {
                const errorEl = input.parentElement.querySelector('.error-message');
                if (errorEl) {
                    errorEl.classList.add('hidden');
                    errorEl.classList.remove('visible');
                }
                input.classList.remove('border-red-500');
                input.removeAttribute('aria-invalid');
            });
        });
    }
});
