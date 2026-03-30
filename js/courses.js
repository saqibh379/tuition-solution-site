/* ============================================
   COURSES PAGE - Course Filter
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const filterBtns = document.querySelectorAll('.course-filter-btn');
    const courseCards = document.querySelectorAll('.course-card');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter');

            filterBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');

            courseCards.forEach(card => {
                const category = card.getAttribute('data-category');

                if (filter === 'all' || category === filter) {
                    card.classList.remove('hidden-card');
                    card.classList.add('visible-card');
                    card.style.display = '';
                } else {
                    card.classList.add('hidden-card');
                    card.classList.remove('visible-card');
                    setTimeout(() => {
                        if (card.classList.contains('hidden-card')) {
                            card.style.display = 'none';
                        }
                    }, 400);
                }
            });
        });
    });
});
