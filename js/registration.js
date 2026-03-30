/* ============================================
   REGISTRATION PAGE - Dynamic Form Renderer
   ============================================
   Reads forms from localStorage (created by admin)
   and renders them dynamically for student registration.
   ============================================ */

(function () {
    'use strict';

    const STORAGE_KEY_FORMS = 'ts_registration_forms';
    const STORAGE_KEY_SUBMISSIONS = 'ts_form_submissions';

    // DOM
    const formSelectorSection = document.getElementById('form-selector-section');
    const formSelectorGrid = document.getElementById('form-selector-grid');
    const formContainer = document.getElementById('registration-form-container');
    const formTitle = document.getElementById('form-title');
    const formDescription = document.getElementById('form-description');
    const backToFormsBtn = document.getElementById('back-to-forms');
    const fieldsContainer = document.getElementById('form-fields-container');
    const dynamicForm = document.getElementById('dynamic-registration-form');
    const progressBar = document.getElementById('form-progress-bar');
    const progressText = document.getElementById('form-progress-text');
    const successScreen = document.getElementById('registration-success');
    const registerAnotherBtn = document.getElementById('register-another');
    const footerYear = document.getElementById('footer-year');

    let currentForm = null;

    // ============================================
    // Utility
    // ============================================
    function getForms() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY_FORMS)) || [];
        } catch {
            return [];
        }
    }

    function getSubmissions() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY_SUBMISSIONS)) || [];
        } catch {
            return [];
        }
    }

    function saveSubmissions(subs) {
        localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(subs));
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function slugify(str) {
        return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    // ============================================
    // Load Available Forms
    // ============================================
    function loadFormSelector() {
        const forms = getForms().filter(f => f.active);

        if (forms.length === 0) {
            formSelectorGrid.innerHTML = `
                <div class="col-span-full no-forms-state">
                    <i class="fas fa-folder-open" aria-hidden="true"></i>
                    <h3 class="font-heading text-xl font-bold text-gray-600 mb-2">No Registration Forms Available</h3>
                    <p class="text-gray-400">Registration forms are being set up. Please check back soon or contact us directly.</p>
                    <div class="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                        <a href="tel:+923001234567" class="inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-primary-700 transition-all">
                            <i class="fas fa-phone" aria-hidden="true"></i> Call Us
                        </a>
                        <a href="https://wa.me/923001234567" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 bg-green-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-green-600 transition-all">
                            <i class="fab fa-whatsapp" aria-hidden="true"></i> WhatsApp
                        </a>
                    </div>
                </div>`;
            return;
        }

        formSelectorGrid.innerHTML = '';

        forms.forEach(form => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'form-select-card';
            card.setAttribute('data-color', form.color || 'primary');
            card.setAttribute('aria-label', `Register for ${form.name}`);

            card.innerHTML = `
                <div class="card-icon">
                    <i class="${escapeHtml(form.icon || 'fas fa-file-alt')}" aria-hidden="true"></i>
                </div>
                <h3 class="font-heading font-bold text-gray-800 text-sm mb-1">${escapeHtml(form.name)}</h3>
                <p class="text-gray-400 text-xs">${escapeHtml(form.description || '')}</p>
                <div class="mt-3 text-xs text-gray-400">
                    <i class="fas fa-list mr-1" aria-hidden="true"></i>${form.fields.length} fields
                </div>
            `;

            card.addEventListener('click', () => {
                selectForm(form);
            });

            formSelectorGrid.appendChild(card);
        });
    }

    // ============================================
    // Select and Render Form
    // ============================================
    function selectForm(form) {
        currentForm = form;
        formTitle.textContent = form.name;
        formDescription.textContent = form.description || 'Please fill all required fields.';

        renderFormFields(form.fields);
        updateProgress();

        formSelectorSection.classList.add('hidden');
        formContainer.classList.remove('hidden');
        successScreen.classList.add('hidden');

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderFormFields(fields) {
        fieldsContainer.innerHTML = '';

        let currentRow = null;
        let currentRowHasHalf = false;

        fields.forEach((field, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'form-field-animate';
            wrapper.style.animationDelay = `${index * 50}ms`;

            const fieldId = `field-${slugify(field.label)}-${index}`;

            // Handle half-width layout
            if (field.width === 'half') {
                if (!currentRowHasHalf) {
                    currentRow = document.createElement('div');
                    currentRow.className = 'grid sm:grid-cols-2 gap-5';
                    fieldsContainer.appendChild(currentRow);
                    currentRowHasHalf = true;
                } else {
                    currentRowHasHalf = false;
                }
                wrapper.innerHTML = buildFieldHtml(field, fieldId, index);
                currentRow.appendChild(wrapper);
            } else {
                currentRowHasHalf = false;
                currentRow = null;
                wrapper.innerHTML = buildFieldHtml(field, fieldId, index);
                fieldsContainer.appendChild(wrapper);
            }
        });
    }

    function buildFieldHtml(field, fieldId, index) {
        const reqNote = field.required ? '<span class="text-red-500 ml-0.5" aria-hidden="true">*</span>' : '';
        const reqAttr = field.required ? 'required aria-required="true"' : '';
        const phAttr = field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : '';
        const inputClass = 'w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all text-gray-700 text-sm';

        let html = `<label for="${fieldId}" class="block text-sm font-semibold text-gray-700 mb-1.5">${escapeHtml(field.label)}${reqNote}</label>`;

        switch (field.type) {
            case 'text':
            case 'email':
            case 'tel':
            case 'number':
            case 'date':
                html += `<input type="${field.type}" id="${fieldId}" name="${fieldId}" class="${inputClass}" ${phAttr} ${reqAttr} data-label="${escapeHtml(field.label)}">`;
                break;

            case 'textarea':
                html += `<textarea id="${fieldId}" name="${fieldId}" rows="3" class="${inputClass} resize-none" ${phAttr} ${reqAttr} data-label="${escapeHtml(field.label)}"></textarea>`;
                break;

            case 'select':
                html += `<select id="${fieldId}" name="${fieldId}" class="${inputClass} bg-white" ${reqAttr} data-label="${escapeHtml(field.label)}">`;
                html += `<option value="" disabled selected>Select ${escapeHtml(field.label)}</option>`;
                (field.options || []).forEach(opt => {
                    html += `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`;
                });
                html += '</select>';
                break;

            case 'radio':
                html += `<div class="grid sm:grid-cols-2 gap-2 mt-1" role="radiogroup" aria-labelledby="${fieldId}-label" data-label="${escapeHtml(field.label)}">`;
                html = `<span id="${fieldId}-label" class="block text-sm font-semibold text-gray-700 mb-1.5">${escapeHtml(field.label)}${reqNote}</span>` +
                    `<div class="grid sm:grid-cols-2 gap-2 mt-1" role="radiogroup" aria-labelledby="${fieldId}-label" data-type="radio" data-label="${escapeHtml(field.label)}" data-required="${field.required}">`;
                (field.options || []).forEach((opt, oi) => {
                    const radioId = `${fieldId}-opt-${oi}`;
                    html += `
                        <label class="radio-option" for="${radioId}">
                            <input type="radio" id="${radioId}" name="${fieldId}" value="${escapeHtml(opt)}" class="w-4 h-4 text-primary-600 focus:ring-primary-500" ${field.required && oi === 0 ? '' : ''}>
                            <span class="text-sm text-gray-700">${escapeHtml(opt)}</span>
                        </label>`;
                });
                html += '</div>';
                return html; // Return early, different label structure

            case 'checkbox':
                html = `<span class="block text-sm font-semibold text-gray-700 mb-1.5">${escapeHtml(field.label)}${reqNote}</span>`;
                html += `<div class="grid sm:grid-cols-2 gap-2 mt-1" data-type="checkbox" data-label="${escapeHtml(field.label)}" data-required="${field.required}">`;
                (field.options || []).forEach((opt, oi) => {
                    const cbId = `${fieldId}-opt-${oi}`;
                    html += `
                        <label class="checkbox-option" for="${cbId}">
                            <input type="checkbox" id="${cbId}" name="${fieldId}" value="${escapeHtml(opt)}" class="w-4 h-4 text-primary-600 rounded focus:ring-primary-500">
                            <span class="text-sm text-gray-700">${escapeHtml(opt)}</span>
                        </label>`;
                });
                html += '</div>';
                return html;

            case 'file':
                html += `
                    <div class="file-input-wrapper">
                        <input type="file" id="${fieldId}" name="${fieldId}" ${reqAttr} data-label="${escapeHtml(field.label)}" accept="image/*,.pdf,.doc,.docx">
                        <div class="pointer-events-none">
                            <i class="fas fa-cloud-upload-alt text-2xl text-gray-300 mb-2" aria-hidden="true"></i>
                            <p class="text-sm text-gray-500">Click to upload or drag & drop</p>
                            <p class="text-xs text-gray-400 mt-1">Images, PDF, DOC (Max 5MB)</p>
                        </div>
                    </div>`;
                break;
        }

        // Add error container
        html += `<div class="field-error text-red-500 text-xs mt-1 hidden" role="alert"></div>`;
        return html;
    }

    // ============================================
    // Progress Bar
    // ============================================
    function updateProgress() {
        if (!currentForm) return;

        const totalRequired = currentForm.fields.filter(f => f.required).length;
        if (totalRequired === 0) {
            progressBar.style.width = '100%';
            progressText.textContent = '100% completed';
            return;
        }

        let filled = 0;
        currentForm.fields.forEach((field, index) => {
            if (!field.required) return;
            const fieldId = `field-${slugify(field.label)}-${index}`;

            if (field.type === 'radio') {
                const checked = fieldsContainer.querySelector(`input[name="${fieldId}"]:checked`);
                if (checked) filled++;
            } else if (field.type === 'checkbox') {
                const checked = fieldsContainer.querySelectorAll(`input[name="${fieldId}"]:checked`);
                if (checked.length > 0) filled++;
            } else {
                const input = document.getElementById(fieldId);
                if (input && input.value.trim()) filled++;
            }
        });

        const pct = Math.round((filled / totalRequired) * 100);
        progressBar.style.width = pct + '%';
        progressText.textContent = pct + '% completed';
        progressBar.parentElement.setAttribute('aria-valuenow', pct);
    }

    // Listen for input changes to update progress
    fieldsContainer.addEventListener('input', updateProgress);
    fieldsContainer.addEventListener('change', updateProgress);

    // ============================================
    // Form Submission
    // ============================================
    dynamicForm.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!currentForm) return;

        // Validate
        let isValid = true;
        let firstError = null;
        const formData = {};

        // Clear previous errors
        fieldsContainer.querySelectorAll('.field-error').forEach(el => {
            el.classList.add('hidden');
            el.textContent = '';
        });

        currentForm.fields.forEach((field, index) => {
            const fieldId = `field-${slugify(field.label)}-${index}`;
            let value = '';

            if (field.type === 'radio') {
                const checked = fieldsContainer.querySelector(`input[name="${fieldId}"]:checked`);
                value = checked ? checked.value : '';

                if (field.required && !value) {
                    isValid = false;
                    const group = fieldsContainer.querySelector(`[data-label="${field.label}"][data-type="radio"]`);
                    if (group) {
                        const err = group.parentElement.querySelector('.field-error') || createErrorEl(group);
                        showFieldError(err, `Please select a ${field.label}`);
                        if (!firstError) firstError = group;
                    }
                }

            } else if (field.type === 'checkbox') {
                const checked = fieldsContainer.querySelectorAll(`input[name="${fieldId}"]:checked`);
                value = Array.from(checked).map(c => c.value);

                if (field.required && value.length === 0) {
                    isValid = false;
                    const group = fieldsContainer.querySelector(`[data-label="${field.label}"][data-type="checkbox"]`);
                    if (group) {
                        const err = group.parentElement.querySelector('.field-error') || createErrorEl(group);
                        showFieldError(err, `Please select at least one ${field.label}`);
                        if (!firstError) firstError = group;
                    }
                }

            } else if (field.type === 'file') {
                const input = document.getElementById(fieldId);
                value = input && input.files.length > 0 ? input.files[0].name : '';

                if (field.required && !value) {
                    isValid = false;
                    const err = input.closest('.file-input-wrapper')?.parentElement.querySelector('.field-error') || input.parentElement.querySelector('.field-error');
                    if (err) {
                        showFieldError(err, `Please upload ${field.label}`);
                        if (!firstError) firstError = input;
                    }
                }

            } else {
                const input = document.getElementById(fieldId);
                value = input ? input.value.trim() : '';

                if (field.required && !value) {
                    isValid = false;
                    const err = input?.parentElement.querySelector('.field-error');
                    if (err) {
                        showFieldError(err, `${field.label} is required`);
                        if (!firstError) firstError = input;
                    }
                    if (input) input.classList.add('border-red-400');
                }

                // Email validation
                if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    isValid = false;
                    const err = input?.parentElement.querySelector('.field-error');
                    if (err) showFieldError(err, 'Please enter a valid email address');
                    if (input) input.classList.add('border-red-400');
                    if (!firstError) firstError = input;
                }

                // Phone validation
                if (field.type === 'tel' && value && !/^(03\d{2}[\s-]?\d{7}|\+92\s?\d{3}[\s-]?\d{7}|0\d{2,3}[\s-]?\d{7,8})$/.test(value)) {
                    isValid = false;
                    const err = input?.parentElement.querySelector('.field-error');
                    if (err) showFieldError(err, 'Please enter a valid phone number');
                    if (input) input.classList.add('border-red-400');
                    if (!firstError) firstError = input;
                }
            }

            formData[field.label] = value;
        });

        if (!isValid) {
            if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // Submit - add loading state
        const submitBtn = document.getElementById('submit-registration');
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Submitting...';
        submitBtn.disabled = true;

        // Save submission
        setTimeout(() => {
            const subs = getSubmissions();
            subs.push({
                formId: currentForm.id,
                formName: currentForm.name,
                data: formData,
                submittedAt: new Date().toISOString()
            });
            saveSubmissions(subs);

            // Show success
            formContainer.classList.add('hidden');
            successScreen.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Reset
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Registration';
            submitBtn.disabled = false;

            // Announce for screen readers
            const announcer = document.createElement('div');
            announcer.setAttribute('role', 'status');
            announcer.setAttribute('aria-live', 'polite');
            announcer.className = 'sr-only';
            announcer.textContent = 'Registration submitted successfully.';
            document.body.appendChild(announcer);
            setTimeout(() => announcer.remove(), 3000);
        }, 1500);
    });

    function showFieldError(errorEl, message) {
        if (!errorEl) return;
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }

    function createErrorEl(afterElement) {
        const err = document.createElement('div');
        err.className = 'field-error text-red-500 text-xs mt-1 hidden';
        err.setAttribute('role', 'alert');
        afterElement.parentElement.appendChild(err);
        return err;
    }

    // Clear error styling on input
    fieldsContainer.addEventListener('input', (e) => {
        const input = e.target;
        input.classList.remove('border-red-400');
        const err = input.closest('div')?.querySelector('.field-error');
        if (err) {
            err.classList.add('hidden');
            err.textContent = '';
        }
    });

    fieldsContainer.addEventListener('change', (e) => {
        const input = e.target;
        const err = input.closest('[data-type]')?.parentElement?.querySelector('.field-error');
        if (err) {
            err.classList.add('hidden');
            err.textContent = '';
        }
    });

    // Reset form
    dynamicForm.addEventListener('reset', () => {
        setTimeout(() => {
            fieldsContainer.querySelectorAll('.field-error').forEach(el => {
                el.classList.add('hidden');
                el.textContent = '';
            });
            fieldsContainer.querySelectorAll('.border-red-400').forEach(el => {
                el.classList.remove('border-red-400');
            });
            updateProgress();
        }, 10);
    });

    // ============================================
    // Navigation
    // ============================================
    backToFormsBtn.addEventListener('click', () => {
        formContainer.classList.add('hidden');
        formSelectorSection.classList.remove('hidden');
        successScreen.classList.add('hidden');
        currentForm = null;
        dynamicForm.reset();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    registerAnotherBtn.addEventListener('click', () => {
        successScreen.classList.add('hidden');
        formSelectorSection.classList.remove('hidden');
        formContainer.classList.add('hidden');
        currentForm = null;
        dynamicForm.reset();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ============================================
    // Footer Year
    // ============================================
    if (footerYear) {
        footerYear.textContent = new Date().getFullYear();
    }

    // ============================================
    // Init
    // ============================================
    loadFormSelector();

})();