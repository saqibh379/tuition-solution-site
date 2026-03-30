/* ============================================
   ADMIN PANEL - Form Builder JavaScript
   ============================================
   Uses localStorage to persist forms & submissions.
   Admin creates forms → saved to localStorage →
   Registration page reads and renders them dynamically.
   ============================================ */

(function () {
    'use strict';

    // ============================================
    // Constants & State
    // ============================================
    const STORAGE_KEY_FORMS = 'ts_registration_forms';
    const STORAGE_KEY_SUBMISSIONS = 'ts_form_submissions';
    const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin123' };

    let currentFields = [];
    let editingFormId = null;
    let editingFieldIndex = null;

    // ============================================
    // DOM References
    // ============================================
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('admin-dashboard');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    const togglePasswordBtn = document.getElementById('toggle-password');

    const formBuilder = document.getElementById('form-builder');
    const formBuilderTitle = document.getElementById('form-builder-title');
    const formNameInput = document.getElementById('form-name');
    const formDescInput = document.getElementById('form-desc');
    const formIconInput = document.getElementById('form-icon');
    const formColorInput = document.getElementById('form-color');
    const fieldsContainer = document.getElementById('fields-container');
    const noFieldsMsg = document.getElementById('no-fields-msg');
    const addFieldBtn = document.getElementById('add-field-btn');
    const saveFormBtn = document.getElementById('save-form-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const savedFormsList = document.getElementById('saved-forms-list');
    const noFormsMsg = document.getElementById('no-forms-msg');

    const fieldModal = document.getElementById('field-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const cancelFieldBtn = document.getElementById('cancel-field-btn');
    const saveFieldBtn = document.getElementById('save-field-btn');
    const fieldLabel = document.getElementById('field-label');
    const fieldType = document.getElementById('field-type');
    const fieldPlaceholder = document.getElementById('field-placeholder');
    const fieldOptionsGroup = document.getElementById('field-options-group');
    const fieldOptions = document.getElementById('field-options');
    const fieldWidth = document.getElementById('field-width');
    const fieldRequired = document.getElementById('field-required');

    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toast-icon');
    const toastMessage = document.getElementById('toast-message');

    const submissionsContainer = document.getElementById('submissions-container');
    const clearSubmissionsBtn = document.getElementById('clear-submissions-btn');

    // Stats
    const statTotalForms = document.getElementById('stat-total-forms');
    const statActiveForms = document.getElementById('stat-active-forms');
    const statRegistrations = document.getElementById('stat-registrations');
    const statTotalFields = document.getElementById('stat-total-fields');

    // ============================================
    // Utility Functions
    // ============================================
    function generateId() {
        return 'form_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function getForms() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY_FORMS)) || [];
        } catch {
            return [];
        }
    }

    function saveForms(forms) {
        localStorage.setItem(STORAGE_KEY_FORMS, JSON.stringify(forms));
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

    function showToast(message, type = 'success') {
        const colors = {
            success: { bg: 'bg-green-100', text: 'text-green-600', icon: 'fa-check-circle' },
            error: { bg: 'bg-red-100', text: 'text-red-600', icon: 'fa-exclamation-circle' },
            info: { bg: 'bg-blue-100', text: 'text-blue-600', icon: 'fa-info-circle' },
            warning: { bg: 'bg-yellow-100', text: 'text-yellow-600', icon: 'fa-exclamation-triangle' }
        };
        const c = colors[type] || colors.success;
        toastIcon.className = `w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${c.bg}`;
        toastIcon.innerHTML = `<i class="fas ${c.icon} ${c.text}"></i>`;
        toastMessage.textContent = message;
        toast.classList.remove('hidden');
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hidden');
        }, 3000);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ============================================
    // Authentication
    // ============================================
    function checkAuth() {
        const isLoggedIn = sessionStorage.getItem('ts_admin_auth') === 'true';
        if (isLoggedIn) {
            loginScreen.classList.add('hidden');
            dashboard.classList.remove('hidden');
            initDashboard();
        }
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('admin-username').value.trim();
        const password = document.getElementById('admin-password').value;

        if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
            sessionStorage.setItem('ts_admin_auth', 'true');
            loginError.classList.add('hidden');
            loginScreen.classList.add('hidden');
            dashboard.classList.remove('hidden');
            initDashboard();
        } else {
            loginError.classList.remove('hidden');
            document.getElementById('admin-password').value = '';
        }
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('ts_admin_auth');
        location.reload();
    });

    togglePasswordBtn.addEventListener('click', () => {
        const passInput = document.getElementById('admin-password');
        const icon = togglePasswordBtn.querySelector('i');
        if (passInput.type === 'password') {
            passInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            passInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });

    // ============================================
    // Dashboard Init
    // ============================================
    function initDashboard() {
        renderSavedForms();
        renderSubmissions();
        updateStats();
        setupDefaultForms();
    }

    function setupDefaultForms() {
        const forms = getForms();
        if (forms.length > 0) return; // already has forms

        // Create default sample forms
        const defaults = [
            {
                id: generateId(),
                name: 'Tuition Classes Registration',
                description: 'Register for tuition classes (Primary to Intermediate)',
                icon: 'fas fa-chalkboard-teacher',
                color: 'primary',
                active: true,
                createdAt: new Date().toISOString(),
                fields: [
                    { label: 'Student Name', type: 'text', placeholder: 'Enter student full name', required: true, width: 'half', options: [] },
                    { label: "Father's Name", type: 'text', placeholder: "Enter father's name", required: true, width: 'half', options: [] },
                    { label: 'Phone Number', type: 'tel', placeholder: '03XX XXXXXXX', required: true, width: 'half', options: [] },
                    { label: 'Email Address', type: 'email', placeholder: 'your@email.com', required: false, width: 'half', options: [] },
                    { label: 'Class / Grade', type: 'select', placeholder: '', required: true, width: 'half', options: ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9 (Matric)', 'Class 10 (Matric)', '1st Year (FSc/FA)', '2nd Year (FSc/FA)'] },
                    { label: 'Subjects', type: 'checkbox', placeholder: '', required: true, width: 'full', options: ['Mathematics', 'English', 'Urdu', 'Science', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Islamiat', 'Pak Studies'] },
                    { label: 'Preferred Time', type: 'radio', placeholder: '', required: true, width: 'full', options: ['Morning (9 AM - 12 PM)', 'Afternoon (2 PM - 5 PM)', 'Evening (5 PM - 8 PM)'] },
                    { label: 'Address', type: 'textarea', placeholder: 'Enter your complete address', required: false, width: 'full', options: [] },
                ]
            },
            {
                id: generateId(),
                name: 'Computer Course Registration',
                description: 'SDC Certified Computer Courses Registration',
                icon: 'fas fa-laptop-code',
                color: 'accent',
                active: true,
                createdAt: new Date().toISOString(),
                fields: [
                    { label: 'Full Name', type: 'text', placeholder: 'Enter your full name', required: true, width: 'half', options: [] },
                    { label: 'CNIC Number', type: 'text', placeholder: 'XXXXX-XXXXXXX-X', required: true, width: 'half', options: [] },
                    { label: 'Phone Number', type: 'tel', placeholder: '03XX XXXXXXX', required: true, width: 'half', options: [] },
                    { label: 'Email Address', type: 'email', placeholder: 'your@email.com', required: true, width: 'half', options: [] },
                    { label: 'Date of Birth', type: 'date', placeholder: '', required: true, width: 'half', options: [] },
                    { label: 'Gender', type: 'radio', placeholder: '', required: true, width: 'half', options: ['Male', 'Female', 'Other'] },
                    { label: 'Select Course', type: 'select', placeholder: '', required: true, width: 'full', options: ['Computer Basics & MS Office (3 Months)', 'Advanced Excel & Data Analysis (4 Months)', 'Graphic Design - Adobe Suite (6 Months)', 'Web Development (6 Months)', 'Digital Marketing (3 Months)', 'Python Programming (4 Months)'] },
                    { label: 'Education Level', type: 'select', placeholder: '', required: true, width: 'half', options: ['Matric', 'Intermediate', 'Graduation', 'Masters', 'Other'] },
                    { label: 'Preferred Timing', type: 'radio', placeholder: '', required: true, width: 'full', options: ['Morning (9 AM - 12 PM)', 'Afternoon (2 PM - 5 PM)', 'Evening (5 PM - 8 PM)'] },
                    { label: 'Photo (Passport Size)', type: 'file', placeholder: '', required: false, width: 'half', options: [] },
                    { label: 'Additional Message', type: 'textarea', placeholder: 'Any specific requirements or questions...', required: false, width: 'full', options: [] },
                ]
            },
            {
                id: generateId(),
                name: 'Nazra-e-Quran Registration',
                description: 'Register for Nazra-e-Quran classes with Tajweed',
                icon: 'fas fa-book-quran',
                color: 'green',
                active: true,
                createdAt: new Date().toISOString(),
                fields: [
                    { label: 'Student Name', type: 'text', placeholder: 'Enter student name', required: true, width: 'half', options: [] },
                    { label: "Father's Name", type: 'text', placeholder: "Enter father's name", required: true, width: 'half', options: [] },
                    { label: 'Age', type: 'number', placeholder: 'Enter age', required: true, width: 'half', options: [] },
                    { label: 'Phone Number', type: 'tel', placeholder: '03XX XXXXXXX', required: true, width: 'half', options: [] },
                    { label: 'Current Level', type: 'radio', placeholder: '', required: true, width: 'full', options: ['Qaida (Beginner)', 'Nazra (Reading)', 'Tajweed (Advanced)', 'Hifz (Memorization)'] },
                    { label: 'Preferred Time', type: 'radio', placeholder: '', required: true, width: 'full', options: ['After Fajr', 'Morning', 'After Zuhr', 'After Asr', 'After Maghrib'] },
                    { label: 'Message', type: 'textarea', placeholder: 'Any special requirements...', required: false, width: 'full', options: [] },
                ]
            },
            {
                id: generateId(),
                name: 'Personal / Home Tuition',
                description: 'Request personalized home tuition service',
                icon: 'fas fa-user-graduate',
                color: 'purple',
                active: true,
                createdAt: new Date().toISOString(),
                fields: [
                    { label: 'Student Name', type: 'text', placeholder: 'Enter student name', required: true, width: 'half', options: [] },
                    { label: 'Parent/Guardian Name', type: 'text', placeholder: 'Enter parent name', required: true, width: 'half', options: [] },
                    { label: 'Phone Number', type: 'tel', placeholder: '03XX XXXXXXX', required: true, width: 'half', options: [] },
                    { label: 'Email', type: 'email', placeholder: 'your@email.com', required: false, width: 'half', options: [] },
                    { label: 'Class / Grade', type: 'select', placeholder: '', required: true, width: 'half', options: ['Class 1-5 (Primary)', 'Class 6-8 (Middle)', 'Class 9-10 (Matric)', '1st Year', '2nd Year', 'O-Levels', 'A-Levels'] },
                    { label: 'Subjects Required', type: 'checkbox', placeholder: '', required: true, width: 'full', options: ['Mathematics', 'English', 'Urdu', 'Science', 'Physics', 'Chemistry', 'Biology', 'Computer', 'Accounting', 'Economics'] },
                    { label: 'Tuition Type', type: 'radio', placeholder: '', required: true, width: 'full', options: ['Home Tuition (We come to you)', 'At Our Center', 'Online'] },
                    { label: 'Home Address', type: 'textarea', placeholder: 'Complete address for home tuition...', required: false, width: 'full', options: [] },
                    { label: 'Preferred Timing', type: 'radio', placeholder: '', required: true, width: 'full', options: ['Morning', 'Afternoon', 'Evening'] },
                    { label: 'Budget Range (Monthly)', type: 'select', placeholder: '', required: false, width: 'half', options: ['Rs. 3,000 - 5,000', 'Rs. 5,000 - 8,000', 'Rs. 8,000 - 12,000', 'Rs. 12,000 - 15,000', 'Rs. 15,000+'] },
                ]
            }
        ];

        saveForms(defaults);
        renderSavedForms();
        updateStats();
        showToast('Default forms created successfully!', 'success');
    }

    // ============================================
    // Stats
    // ============================================
    function updateStats() {
        const forms = getForms();
        const subs = getSubmissions();
        let totalFields = 0;
        let activeForms = 0;

        forms.forEach(f => {
            totalFields += f.fields.length;
            if (f.active) activeForms++;
        });

        statTotalForms.textContent = forms.length;
        statActiveForms.textContent = activeForms;
        statRegistrations.textContent = subs.length;
        statTotalFields.textContent = totalFields;
    }

    // ============================================
    // Field Modal
    // ============================================
    function openFieldModal(editIndex = null) {
        editingFieldIndex = editIndex;

        if (editIndex !== null) {
            const field = currentFields[editIndex];
            fieldLabel.value = field.label;
            fieldType.value = field.type;
            fieldPlaceholder.value = field.placeholder || '';
            fieldOptions.value = (field.options || []).join(', ');
            fieldWidth.value = field.width || 'full';
            fieldRequired.checked = field.required || false;
            document.getElementById('modal-title').textContent = 'Edit Field';
            saveFieldBtn.innerHTML = '<i class="fas fa-save"></i> Update Field';
        } else {
            fieldLabel.value = '';
            fieldType.value = 'text';
            fieldPlaceholder.value = '';
            fieldOptions.value = '';
            fieldWidth.value = 'full';
            fieldRequired.checked = false;
            document.getElementById('modal-title').textContent = 'Add New Field';
            saveFieldBtn.innerHTML = '<i class="fas fa-plus"></i> Add Field';
        }

        toggleOptionsVisibility();
        fieldModal.classList.remove('hidden');
        fieldModal.classList.add('show');
        fieldLabel.focus();
    }

    function closeFieldModal() {
        fieldModal.classList.remove('show');
        fieldModal.classList.add('hidden');
        editingFieldIndex = null;
    }

    function toggleOptionsVisibility() {
        const needsOptions = ['select', 'radio', 'checkbox'].includes(fieldType.value);
        fieldOptionsGroup.classList.toggle('hidden', !needsOptions);
    }

    addFieldBtn.addEventListener('click', () => openFieldModal());
    closeModalBtn.addEventListener('click', closeFieldModal);
    cancelFieldBtn.addEventListener('click', closeFieldModal);
    fieldType.addEventListener('change', toggleOptionsVisibility);

    // Close modal on backdrop click
    fieldModal.addEventListener('click', (e) => {
        if (e.target === fieldModal) closeFieldModal();
    });

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && fieldModal.classList.contains('show')) {
            closeFieldModal();
        }
    });

    // Save field
    saveFieldBtn.addEventListener('click', () => {
        const label = fieldLabel.value.trim();
        const type = fieldType.value;
        const placeholder = fieldPlaceholder.value.trim();
        const required = fieldRequired.checked;
        const width = fieldWidth.value;
        let options = [];

        if (!label) {
            showToast('Please enter a field label.', 'error');
            fieldLabel.focus();
            return;
        }

        if (['select', 'radio', 'checkbox'].includes(type)) {
            const optText = fieldOptions.value.trim();
            if (!optText) {
                showToast('Please enter options for this field type.', 'error');
                fieldOptions.focus();
                return;
            }
            options = optText.split(',').map(o => o.trim()).filter(o => o);
            if (options.length < 2) {
                showToast('Please enter at least 2 options.', 'error');
                fieldOptions.focus();
                return;
            }
        }

        const fieldData = { label, type, placeholder, required, width, options };

        if (editingFieldIndex !== null) {
            currentFields[editingFieldIndex] = fieldData;
            showToast('Field updated successfully!', 'success');
        } else {
            currentFields.push(fieldData);
            showToast('Field added!', 'success');
        }

        renderFieldsList();
        closeFieldModal();
    });

    // ============================================
    // Render Fields List (in builder)
    // ============================================
    function renderFieldsList() {
        if (currentFields.length === 0) {
            noFieldsMsg.classList.remove('hidden');
            fieldsContainer.innerHTML = '';
            fieldsContainer.appendChild(noFieldsMsg);
            return;
        }

        noFieldsMsg.classList.add('hidden');
        fieldsContainer.innerHTML = '';

        currentFields.forEach((field, index) => {
            const div = document.createElement('div');
            div.className = 'field-item flex items-start gap-3';
            div.setAttribute('draggable', 'true');
            div.dataset.index = index;

            const typeIcons = {
                text: 'fa-font', email: 'fa-envelope', tel: 'fa-phone', number: 'fa-hashtag',
                date: 'fa-calendar', select: 'fa-caret-down', radio: 'fa-circle-dot',
                checkbox: 'fa-check-square', textarea: 'fa-align-left', file: 'fa-file-upload'
            };

            div.innerHTML = `
                <div class="field-drag-handle mt-1 cursor-grab" aria-hidden="true">
                    <i class="fas fa-grip-vertical"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                        <span class="font-semibold text-gray-800 text-sm">${escapeHtml(field.label)}</span>
                        ${field.required ? '<span class="text-red-500 text-xs font-bold">Required</span>' : ''}
                        <span class="field-type-badge type-${field.type}">
                            <i class="fas ${typeIcons[field.type] || 'fa-font'}"></i>
                            ${field.type}
                        </span>
                        <span class="text-xs text-gray-400">${field.width === 'half' ? '½ width' : 'Full width'}</span>
                    </div>
                    ${field.options && field.options.length > 0 ? `<p class="text-xs text-gray-400 truncate">Options: ${field.options.join(', ')}</p>` : ''}
                    ${field.placeholder ? `<p class="text-xs text-gray-400">Placeholder: ${escapeHtml(field.placeholder)}</p>` : ''}
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                    <button type="button" class="edit-field-btn w-8 h-8 rounded-lg hover:bg-blue-50 text-blue-500 hover:text-blue-700 flex items-center justify-center transition-colors" data-index="${index}" aria-label="Edit field">
                        <i class="fas fa-pen text-xs" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="delete-field-btn w-8 h-8 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 flex items-center justify-center transition-colors" data-index="${index}" aria-label="Delete field">
                        <i class="fas fa-trash text-xs" aria-hidden="true"></i>
                    </button>
                </div>
            `;

            // Edit field
            div.querySelector('.edit-field-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openFieldModal(parseInt(e.currentTarget.dataset.index));
            });

            // Delete field
            div.querySelector('.delete-field-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(e.currentTarget.dataset.index);
                currentFields.splice(idx, 1);
                renderFieldsList();
                showToast('Field removed.', 'info');
            });

            // Drag & Drop
            div.addEventListener('dragstart', handleDragStart);
            div.addEventListener('dragover', handleDragOver);
            div.addEventListener('drop', handleDrop);
            div.addEventListener('dragend', handleDragEnd);

            fieldsContainer.appendChild(div);
        });
    }

    // ============================================
    // Drag & Drop for Fields Reorder
    // ============================================
    let draggedIndex = null;

    function handleDragStart(e) {
        draggedIndex = parseInt(this.dataset.index);
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDrop(e) {
        e.preventDefault();
        const targetIndex = parseInt(this.dataset.index);
        if (draggedIndex !== null && draggedIndex !== targetIndex) {
            const [moved] = currentFields.splice(draggedIndex, 1);
            currentFields.splice(targetIndex, 0, moved);
            renderFieldsList();
        }
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
        draggedIndex = null;
    }

    // ============================================
    // Save Form
    // ============================================
    formBuilder.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = formNameInput.value.trim();
        const desc = formDescInput.value.trim();
        const icon = formIconInput.value.trim() || 'fas fa-file-alt';
        const color = formColorInput.value;

        if (!name) {
            showToast('Please enter a form name.', 'error');
            formNameInput.focus();
            return;
        }

        if (currentFields.length === 0) {
            showToast('Please add at least one field.', 'error');
            return;
        }

        const forms = getForms();

        if (editingFormId) {
            // Update existing
            const idx = forms.findIndex(f => f.id === editingFormId);
            if (idx !== -1) {
                forms[idx].name = name;
                forms[idx].description = desc;
                forms[idx].icon = icon;
                forms[idx].color = color;
                forms[idx].fields = [...currentFields];
                forms[idx].updatedAt = new Date().toISOString();
            }
            showToast('Form updated successfully!', 'success');
        } else {
            // Create new
            forms.push({
                id: generateId(),
                name,
                description: desc,
                icon,
                color,
                active: true,
                createdAt: new Date().toISOString(),
                fields: [...currentFields]
            });
            showToast('Form created successfully!', 'success');
        }

        saveForms(forms);
        resetFormBuilder();
        renderSavedForms();
        updateStats();
    });

    function resetFormBuilder() {
        formNameInput.value = '';
        formDescInput.value = '';
        formIconInput.value = 'fas fa-file-alt';
        formColorInput.value = 'primary';
        currentFields = [];
        editingFormId = null;
        renderFieldsList();
        formBuilderTitle.textContent = 'Create New Form';
        cancelEditBtn.classList.add('hidden');
        saveFormBtn.innerHTML = '<i class="fas fa-save"></i> Save Form';

        // Remove editing highlight from saved forms
        document.querySelectorAll('.saved-form-card').forEach(c => c.classList.remove('editing'));
    }

    cancelEditBtn.addEventListener('click', resetFormBuilder);

    // ============================================
    // Render Saved Forms
    // ============================================
    function renderSavedForms() {
        const forms = getForms();

        if (forms.length === 0) {
            savedFormsList.innerHTML = '';
            const noMsg = noFormsMsg.cloneNode(true);
            noMsg.classList.remove('hidden');
            savedFormsList.appendChild(noMsg);
            return;
        }

        savedFormsList.innerHTML = '';

        forms.forEach(form => {
            const card = document.createElement('div');
            card.className = `saved-form-card ${editingFormId === form.id ? 'editing' : ''}`;
            card.dataset.formId = form.id;

            const colorClasses = {
                primary: 'bg-primary-100 text-primary-600',
                accent: 'bg-accent-100 text-accent-600',
                green: 'bg-green-100 text-green-600',
                purple: 'bg-purple-100 text-purple-600',
                red: 'bg-red-100 text-red-600',
                indigo: 'bg-indigo-100 text-indigo-600'
            };

            const iconColor = colorClasses[form.color] || colorClasses.primary;

            card.innerHTML = `
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-lg ${iconColor} flex items-center justify-center flex-shrink-0">
                        <i class="${escapeHtml(form.icon)}" aria-hidden="true"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-semibold text-gray-800 text-sm truncate">${escapeHtml(form.name)}</h4>
                        <p class="text-xs text-gray-400 mt-0.5">${form.fields.length} fields</p>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="w-2 h-2 rounded-full ${form.active ? 'bg-green-400' : 'bg-gray-300'}" title="${form.active ? 'Active' : 'Inactive'}"></span>
                    </div>
                </div>
                <div class="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button type="button" class="edit-form-btn flex-1 text-xs font-semibold text-primary-600 hover:text-primary-800 py-1.5 rounded-lg hover:bg-primary-50 transition-colors" data-id="${form.id}">
                        <i class="fas fa-pen mr-1"></i> Edit
                    </button>
                    <button type="button" class="toggle-form-btn text-xs font-semibold ${form.active ? 'text-yellow-600 hover:text-yellow-800' : 'text-green-600 hover:text-green-800'} py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors" data-id="${form.id}">
                        <i class="fas ${form.active ? 'fa-eye-slash' : 'fa-eye'} mr-1"></i>${form.active ? 'Hide' : 'Show'}
                    </button>
                    <button type="button" class="duplicate-form-btn text-xs font-semibold text-gray-500 hover:text-gray-700 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors" data-id="${form.id}">
                        <i class="fas fa-copy mr-1"></i>
                    </button>
                    <button type="button" class="delete-form-btn text-xs font-semibold text-red-500 hover:text-red-700 py-1.5 px-2 rounded-lg hover:bg-red-50 transition-colors" data-id="${form.id}">
                        <i class="fas fa-trash mr-1"></i>
                    </button>
                </div>
            `;

            // Edit
            card.querySelector('.edit-form-btn').addEventListener('click', () => {
                loadFormForEditing(form.id);
            });

            // Toggle active
            card.querySelector('.toggle-form-btn').addEventListener('click', () => {
                toggleFormActive(form.id);
            });

            // Duplicate
            card.querySelector('.duplicate-form-btn').addEventListener('click', () => {
                duplicateForm(form.id);
            });

            // Delete
            card.querySelector('.delete-form-btn').addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete "${form.name}"?`)) {
                    deleteForm(form.id);
                }
            });

            savedFormsList.appendChild(card);
        });
    }

    function loadFormForEditing(formId) {
        const forms = getForms();
        const form = forms.find(f => f.id === formId);
        if (!form) return;

        editingFormId = formId;
        formNameInput.value = form.name;
        formDescInput.value = form.description || '';
        formIconInput.value = form.icon || 'fas fa-file-alt';
        formColorInput.value = form.color || 'primary';
        currentFields = [...form.fields];

        renderFieldsList();
        formBuilderTitle.textContent = 'Edit Form';
        cancelEditBtn.classList.remove('hidden');
        saveFormBtn.innerHTML = '<i class="fas fa-save"></i> Update Form';

        // Highlight editing card
        document.querySelectorAll('.saved-form-card').forEach(c => {
            c.classList.toggle('editing', c.dataset.formId === formId);
        });

        // Scroll to builder
        formBuilder.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast('Form loaded for editing.', 'info');
    }

    function toggleFormActive(formId) {
        const forms = getForms();
        const form = forms.find(f => f.id === formId);
        if (form) {
            form.active = !form.active;
            saveForms(forms);
            renderSavedForms();
            updateStats();
            showToast(form.active ? 'Form is now visible.' : 'Form is now hidden.', 'info');
        }
    }

    function duplicateForm(formId) {
        const forms = getForms();
        const form = forms.find(f => f.id === formId);
        if (form) {
            const dup = {
                ...form,
                id: generateId(),
                name: form.name + ' (Copy)',
                fields: [...form.fields],
                createdAt: new Date().toISOString()
            };
            forms.push(dup);
            saveForms(forms);
            renderSavedForms();
            updateStats();
            showToast('Form duplicated!', 'success');
        }
    }

    function deleteForm(formId) {
        let forms = getForms();
        forms = forms.filter(f => f.id !== formId);
        saveForms(forms);

        if (editingFormId === formId) resetFormBuilder();
        renderSavedForms();
        updateStats();
        showToast('Form deleted.', 'info');
    }

    // ============================================
    // Submissions Viewer
    // ============================================
    function renderSubmissions() {
        const subs = getSubmissions();

        if (subs.length === 0) {
            submissionsContainer.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <i class="fas fa-clipboard-list text-3xl mb-2" aria-hidden="true"></i>
                    <p class="text-sm">No registrations yet.</p>
                </div>`;
            return;
        }

        submissionsContainer.innerHTML = '';

        // Show latest first
        const sorted = [...subs].reverse();
        sorted.forEach((sub, i) => {
            const card = document.createElement('div');
            card.className = 'submission-card';

            const date = new Date(sub.submittedAt).toLocaleString('en-PK', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            let fieldsHtml = '';
            Object.entries(sub.data).forEach(([key, value]) => {
                const val = Array.isArray(value) ? value.join(', ') : value;
                fieldsHtml += `
                    <div class="flex gap-2 text-sm">
                        <span class="font-medium text-gray-600 min-w-[120px]">${escapeHtml(key)}:</span>
                        <span class="text-gray-800">${escapeHtml(val || '—')}</span>
                    </div>`;
            });

            card.innerHTML = `
                <div class="flex items-center justify-between mb-3">
                    <div>
                        <span class="font-semibold text-primary-700 text-sm">${escapeHtml(sub.formName || 'Unknown Form')}</span>
                        <span class="text-xs text-gray-400 ml-2">${date}</span>
                    </div>
                    <span class="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">#${subs.length - i}</span>
                </div>
                <div class="space-y-1.5">${fieldsHtml}</div>
            `;

            submissionsContainer.appendChild(card);
        });
    }

    clearSubmissionsBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all registration submissions?')) {
            saveSubmissions([]);
            renderSubmissions();
            updateStats();
            showToast('All submissions cleared.', 'info');
        }
    });

    // ============================================
    // Initialize
    // ============================================
    checkAuth();

})();