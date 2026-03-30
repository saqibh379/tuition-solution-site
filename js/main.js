/* ============================================
   TUITION SOLUTION & IT SOLUTION
   Main JavaScript File
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // ============================================
    // Initialize AOS (Animate on Scroll)
    // ============================================
    AOS.init({
        duration: 800,
        easing: 'ease-out-cubic',
        once: true,
        offset: 80,
        disable: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    });

    // ============================================
    // Mobile Menu Toggle
    // ============================================
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    let isMenuOpen = false;

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            isMenuOpen = !isMenuOpen;
            mobileMenu.classList.toggle('hidden', !isMenuOpen);
            mobileMenuBtn.setAttribute('aria-expanded', isMenuOpen.toString());

            const icon = mobileMenuBtn.querySelector('i');
            if (isMenuOpen) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });

        // Close mobile menu on link click
        const mobileNavLinks = mobileMenu.querySelectorAll('.mobile-nav-link');
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                isMenuOpen = false;
                mobileMenu.classList.add('hidden');
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
                const icon = mobileMenuBtn.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            });
        });

        // Close on escape key (WCAG)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isMenuOpen) {
                isMenuOpen = false;
                mobileMenu.classList.add('hidden');
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
                const icon = mobileMenuBtn.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
                mobileMenuBtn.focus();
            }
        });
    }

    // ============================================
    // Header Scroll Effect
    // ============================================
    const header = document.getElementById('header');

    const handleScroll = () => {
        if (window.scrollY > 50) {
            header.classList.add('header-scrolled');
        } else {
            header.classList.remove('header-scrolled');
        }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // ============================================
    // Active Navigation Highlight
    // ============================================
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');

    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0
    };

    const observerCallback = (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');

                navLinks.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });

                mobileLinks.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    sections.forEach(section => observer.observe(section));

    // ============================================
    // Counter Animation
    // ============================================
    const counters = document.querySelectorAll('.counter');

    const animateCounter = (counter) => {
        const target = parseInt(counter.getAttribute('data-target'));
        const duration = 2000;
        const startTime = performance.now();

        const updateCounter = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(easeOut * target);

            counter.textContent = current + '+';

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        };

        requestAnimationFrame(updateCounter);
    };

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => counterObserver.observe(counter));

    // ============================================
    // Course Filter
    // ============================================
    const filterBtns = document.querySelectorAll('.course-filter-btn');
    const courseCards = document.querySelectorAll('.course-card');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter');

            // Update active button
            filterBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');

            // Filter cards
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
            if (currentSlide >= maxSlide) {
                goToSlide(0);
            } else {
                goToSlide(currentSlide + 1);
            }
        }

        function prevSlide() {
            if (currentSlide <= 0) {
                goToSlide(maxSlide);
            } else {
                goToSlide(currentSlide - 1);
            }
        }

        // Auto play
        function startAutoPlay() {
            autoPlayInterval = setInterval(nextSlide, 5000);
        }

        function stopAutoPlay() {
            clearInterval(autoPlayInterval);
        }

        prevBtn.addEventListener('click', () => {
            prevSlide();
            stopAutoPlay();
            startAutoPlay();
        });

        nextBtn.addEventListener('click', () => {
            nextSlide();
            stopAutoPlay();
            startAutoPlay();
        });

        // Touch / Swipe support
        let touchStartX = 0;
        let touchEndX = 0;

        testimonialsTrack.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            stopAutoPlay();
        }, { passive: true });

        testimonialsTrack.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;

            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    nextSlide();
                } else {
                    prevSlide();
                }
            }
            startAutoPlay();
        }, { passive: true });

        // Keyboard navigation (WCAG)
        const sliderContainer = document.getElementById('testimonials-slider');
        if (sliderContainer) {
            sliderContainer.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') {
                    prevSlide();
                    stopAutoPlay();
                    startAutoPlay();
                } else if (e.key === 'ArrowRight') {
                    nextSlide();
                    stopAutoPlay();
                    startAutoPlay();
                }
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

        // Initialize
        createDots();
        startAutoPlay();
    }

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
                // Simulate form submission
                const submitBtn = enrollmentForm.querySelector('button[type="submit"]');
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Submitting...';
                submitBtn.disabled = true;

                setTimeout(() => {
                    enrollmentForm.classList.add('hidden');
                    formSuccess.classList.remove('hidden');
                    formSuccess.classList.add('animate-fade-in');

                    // Announce success to screen readers
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

        // Clear error on input
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

    // ============================================
    // Newsletter Form
    // ============================================
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('newsletter-email');
            const btn = newsletterForm.querySelector('button');

            if (emailInput.value.trim()) {
                btn.innerHTML = '<i class="fas fa-check mr-1"></i> Subscribed!';
                btn.classList.remove('bg-accent-500', 'hover:bg-accent-600');
                btn.classList.add('bg-green-500');
                emailInput.value = '';

                setTimeout(() => {
                    btn.innerHTML = 'Subscribe <i class="fas fa-paper-plane ml-1"></i>';
                    btn.classList.remove('bg-green-500');
                    btn.classList.add('bg-accent-500', 'hover:bg-accent-600');
                }, 3000);
            }
        });
    }

    // ============================================
    // Back to Top Button
    // ============================================
    const backToTop = document.getElementById('back-to-top');

    if (backToTop) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 500) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        }, { passive: true });

        backToTop.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // ============================================
    // Footer Year
    // ============================================
    const footerYear = document.getElementById('footer-year');
    if (footerYear) {
        footerYear.textContent = new Date().getFullYear();
    }

    // ============================================
    // Smooth Scroll for Anchor Links
    // ============================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();

                const headerHeight = header ? header.offsetHeight : 0;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Update focus for accessibility
                target.setAttribute('tabindex', '-1');
                target.focus({ preventScroll: true });
            }
        });
    });

    // ============================================
    // Image Lazy Loading & Animation
    // ============================================
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        if (img.complete) {
            img.classList.add('loaded');
        } else {
            img.addEventListener('load', () => {
                img.classList.add('loaded');
            });
        }
    });

    // ============================================
    // Prefers Reduced Motion Check
    // ============================================
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (prefersReducedMotion.matches) {
        // Disable animations for users who prefer reduced motion
        document.querySelectorAll('[data-aos]').forEach(el => {
            el.removeAttribute('data-aos');
            el.removeAttribute('data-aos-delay');
            el.removeAttribute('data-aos-duration');
        });
    }

    // ============================================
    // Keyboard Trap Prevention (WCAG)
    // ============================================
    // Ensure focus doesn't get trapped in mobile menu
    const focusableSelectors = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

    if (mobileMenu) {
        const focusableElements = mobileMenu.querySelectorAll(focusableSelectors);
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        mobileMenu.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        e.preventDefault();
                        mobileMenuBtn.focus();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        e.preventDefault();
                        mobileMenuBtn.focus();
                    }
                }
            }
        });
    }

    console.log('✅ Tuition Solution & IT Solution website loaded successfully!');
});