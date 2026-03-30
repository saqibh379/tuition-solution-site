/* ============================================
   ABOUT PAGE - Testimonials Slider
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // ============================================
    // Testimonials Slider
    // ============================================
    const testimonialsTrack = document.getElementById('testimonials-track');
    const prevBtn = document.getElementById('testimonial-prev');
    const nextBtn = document.getElementById('testimonial-next');
    const dotsContainer = document.getElementById('testimonial-dots');

    if (testimonialsTrack && prevBtn && nextBtn && dotsContainer) {
        let currentSlide = 0;
        let slidesPerView = getSlidesPerView();
        const totalSlides = testimonialsTrack.children.length;
        let maxSlide = Math.max(0, totalSlides - slidesPerView);
        let autoPlayInterval;

        function getSlidesPerView() {
            if (window.innerWidth >= 1024) return 3;
            if (window.innerWidth >= 768) return 2;
            return 1;
        }

        function createDots() {
            dotsContainer.innerHTML = '';
            const dotCount = maxSlide + 1;
            for (let i = 0; i < dotCount; i++) {
                const dot = document.createElement('button');
                dot.classList.add('testimonial-dot');
                if (i === 0) dot.classList.add('active');
                dot.setAttribute('aria-label', `Go to testimonial group ${i + 1}`);
                dot.setAttribute('role', 'tab');
                dot.addEventListener('click', () => goToSlide(i));
                dotsContainer.appendChild(dot);
            }
        }

        function updateDots() {
            const dots = dotsContainer.querySelectorAll('.testimonial-dot');
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentSlide);
                dot.setAttribute('aria-selected', (i === currentSlide).toString());
            });
        }

        function goToSlide(index) {
            currentSlide = Math.max(0, Math.min(index, maxSlide));
            const slideWidth = 100 / slidesPerView;
            testimonialsTrack.style.transform = `translateX(-${currentSlide * slideWidth}%)`;
            updateDots();
        }

        function nextSlide() {
            goToSlide(currentSlide >= maxSlide ? 0 : currentSlide + 1);
        }

        function prevSlide() {
            goToSlide(currentSlide <= 0 ? maxSlide : currentSlide - 1);
        }

        function startAutoPlay() {
            autoPlayInterval = setInterval(nextSlide, 5000);
        }

        function stopAutoPlay() {
            clearInterval(autoPlayInterval);
        }

        prevBtn.addEventListener('click', () => { prevSlide(); stopAutoPlay(); startAutoPlay(); });
        nextBtn.addEventListener('click', () => { nextSlide(); stopAutoPlay(); startAutoPlay(); });

        // Touch / Swipe support
        let touchStartX = 0;
        testimonialsTrack.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            stopAutoPlay();
        }, { passive: true });

        testimonialsTrack.addEventListener('touchend', (e) => {
            const diff = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 50) {
                diff > 0 ? nextSlide() : prevSlide();
            }
            startAutoPlay();
        }, { passive: true });

        // Keyboard navigation (WCAG)
        const sliderContainer = document.getElementById('testimonials-slider');
        if (sliderContainer) {
            sliderContainer.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') { prevSlide(); stopAutoPlay(); startAutoPlay(); }
                else if (e.key === 'ArrowRight') { nextSlide(); stopAutoPlay(); startAutoPlay(); }
            });
        }

        // Pause on hover
        testimonialsTrack.addEventListener('mouseenter', stopAutoPlay);
        testimonialsTrack.addEventListener('mouseleave', startAutoPlay);

        // Handle resize
        window.addEventListener('resize', () => {
            slidesPerView = getSlidesPerView();
            maxSlide = Math.max(0, totalSlides - slidesPerView);
            currentSlide = Math.min(currentSlide, maxSlide);
            createDots();
            goToSlide(currentSlide);
        });

        createDots();
        startAutoPlay();
    }
});
