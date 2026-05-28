function generateId() {
    return 'form_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
}

function createDefaultForms() {
    const createdAt = new Date().toISOString();

    return [
        {
            id: generateId(),
            name: 'Tuition Classes Registration',
            description: 'Register for tuition classes (Primary to Intermediate)',
            icon: 'fas fa-chalkboard-teacher',
            color: 'primary',
            active: true,
            createdAt,
            fields: [
                { label: 'Student Name', type: 'text', placeholder: 'Enter student full name', required: true, width: 'half', options: [] },
                { label: "Father's Name", type: 'text', placeholder: "Enter father's name", required: true, width: 'half', options: [] },
                { label: 'Phone Number', type: 'tel', placeholder: '03XX XXXXXXX', required: true, width: 'half', options: [] },
                { label: 'Email Address', type: 'email', placeholder: 'your@email.com', required: false, width: 'half', options: [] },
                { label: 'Class / Grade', type: 'select', placeholder: '', required: true, width: 'half', options: ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9 (Matric)', 'Class 10 (Matric)', '1st Year (FSc/FA)', '2nd Year (FSc/FA)'] },
                { label: 'Subjects', type: 'checkbox', placeholder: '', required: true, width: 'full', options: ['Mathematics', 'English', 'Urdu', 'Science', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Islamiat', 'Pak Studies'] },
                { label: 'Preferred Time', type: 'radio', placeholder: '', required: true, width: 'full', options: ['Morning (9 AM - 12 PM)', 'Afternoon (2 PM - 5 PM)', 'Evening (5 PM - 8 PM)'] },
                { label: 'Address', type: 'textarea', placeholder: 'Enter your complete address', required: false, width: 'full', options: [] }
            ]
        },
        {
            id: generateId(),
            name: 'Computer Course Registration',
            description: 'SDC Certified Computer Courses Registration',
            icon: 'fas fa-laptop-code',
            color: 'accent',
            active: true,
            createdAt,
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
                { label: 'Additional Message', type: 'textarea', placeholder: 'Any specific requirements or questions...', required: false, width: 'full', options: [] }
            ]
        },
        {
            id: generateId(),
            name: 'Nazra-e-Quran Registration',
            description: 'Register for Nazra-e-Quran classes with Tajweed',
            icon: 'fas fa-book-quran',
            color: 'green',
            active: true,
            createdAt,
            fields: [
                { label: 'Student Name', type: 'text', placeholder: 'Enter student name', required: true, width: 'half', options: [] },
                { label: "Father's Name", type: 'text', placeholder: "Enter father's name", required: true, width: 'half', options: [] },
                { label: 'Age', type: 'number', placeholder: 'Enter age', required: true, width: 'half', options: [] },
                { label: 'Phone Number', type: 'tel', placeholder: '03XX XXXXXXX', required: true, width: 'half', options: [] },
                { label: 'Current Level', type: 'radio', placeholder: '', required: true, width: 'full', options: ['Qaida (Beginner)', 'Nazra (Reading)', 'Tajweed (Advanced)', 'Hifz (Memorization)'] },
                { label: 'Preferred Time', type: 'radio', placeholder: '', required: true, width: 'full', options: ['After Fajr', 'Morning', 'After Zuhr', 'After Asr', 'After Maghrib'] },
                { label: 'Message', type: 'textarea', placeholder: 'Any special requirements...', required: false, width: 'full', options: [] }
            ]
        },
        {
            id: generateId(),
            name: 'Personal / Home Tuition',
            description: 'Request personalized home tuition service',
            icon: 'fas fa-user-graduate',
            color: 'purple',
            active: true,
            createdAt,
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
                { label: 'Budget Range (Monthly)', type: 'select', placeholder: '', required: false, width: 'half', options: ['Rs. 3,000 - 5,000', 'Rs. 5,000 - 8,000', 'Rs. 8,000 - 12,000', 'Rs. 12,000 - 15,000', 'Rs. 15,000+'] }
            ]
        }
    ];
}

module.exports = {
    createDefaultForms
};