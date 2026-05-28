/* ============================================
   TUITION SOLUTION & IT SOLUTION
   Common JavaScript - Shared across all pages
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // ============================================
    // Initialize AOS (Animate on Scroll)
    // ============================================
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-out-cubic',
            once: true,
            offset: 80,
            disable: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        });
    }

    // ============================================
    // Mobile Menu Toggle
    // ============================================
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    let isMenuOpen = false;

    const desktopContactLink = document.querySelector('.nav-link[data-nav="contact"]');
    if (desktopContactLink && !document.querySelector('.nav-link[data-nav="lms"]')) {
        desktopContactLink.insertAdjacentHTML('beforebegin', '<a href="lms.html" data-nav="lms" class="nav-link px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-primary-50 transition-all">LMS</a>');
    }

    const mobileContactLink = document.querySelector('.mobile-nav-link[data-nav="contact"]');
    if (mobileContactLink && !document.querySelector('.mobile-nav-link[data-nav="lms"]')) {
        mobileContactLink.insertAdjacentHTML('beforebegin', '<a href="lms.html" data-nav="lms" class="mobile-nav-link block px-4 py-3 rounded-lg text-gray-700 hover:text-primary-600 hover:bg-primary-50 font-medium transition-all">LMS</a>');
    }

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

        // Keyboard Trap Prevention (WCAG)
        const focusableSelectors = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
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

    // ============================================
    // Header Scroll Effect
    // ============================================
    const header = document.getElementById('header');

    if (header) {
        const handleScroll = () => {
            if (window.scrollY > 50) {
                header.classList.add('header-scrolled');
            } else {
                header.classList.remove('header-scrolled');
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Run on load
    }

    // ============================================
    // Active Navigation Highlight
    // ============================================
    const currentPage = document.body.getAttribute('data-page');
    if (currentPage) {
        document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
            const linkPage = link.getAttribute('data-nav');
            if (linkPage === currentPage) {
                link.classList.add('active');
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
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
                window.scrollTo({ top: targetPosition, behavior: 'smooth' });
                target.setAttribute('tabindex', '-1');
                target.focus({ preventScroll: true });
            }
        });
    });

    // ============================================
    // Image Lazy Loading & Animation
    // ============================================
    document.querySelectorAll('img').forEach(img => {
        if (img.complete) {
            img.classList.add('loaded');
        } else {
            img.addEventListener('load', () => img.classList.add('loaded'));
        }
    });

    // ============================================
    // Newsletter Form (in footer)
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
    // Prefers Reduced Motion Check
    // ============================================
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (prefersReducedMotion.matches) {
        document.querySelectorAll('[data-aos]').forEach(el => {
            el.removeAttribute('data-aos');
            el.removeAttribute('data-aos-delay');
            el.removeAttribute('data-aos-duration');
        });
    }

    console.log('✅ Tuition Solution - Page loaded successfully!');
});
