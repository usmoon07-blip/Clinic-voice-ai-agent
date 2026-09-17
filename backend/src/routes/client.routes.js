'use strict';
/** Client API — Telegram Mini App. Har bir so'rov initData imzosi bilan tekshiriladi. */
const express = require('express');
const ctrl = require('../controllers/bookingController');
const { attachTelegramUser, requirePatient } = require('../middlewares/auth.middleware');
const { bookingLimiter } = require('../middlewares/rateLimit.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

const router = express.Router();

// ── Ochiq ma'lumotnoma (Telegram tekshiruvi shart emas) ──
router.get('/clinic', asyncHandler(ctrl.getClinicInfo));
router.get('/specialties', asyncHandler(ctrl.listSpecialties));
router.get('/services', asyncHandler(ctrl.listServices));
router.get('/services/:id', asyncHandler(ctrl.getService));
router.get('/doctors', asyncHandler(ctrl.listDoctors));
router.get('/doctors/:id', asyncHandler(ctrl.getDoctor));
router.get('/availability/dates', asyncHandler(ctrl.getAvailableDates));
router.get('/availability/slots', asyncHandler(ctrl.getAvailableSlots));
router.post('/route-complaint', asyncHandler(ctrl.routeComplaint));

// ── Shaxsiy (Telegram initData majburiy) ──
router.use(asyncHandler(attachTelegramUser));

router.get('/profile', asyncHandler(ctrl.getProfile));
router.post('/profile', asyncHandler(ctrl.upsertProfile));
router.post('/family', requirePatient, asyncHandler(ctrl.addFamilyMember));

router.get('/appointments', requirePatient, asyncHandler(ctrl.listMyAppointments));
router.post('/appointments', requirePatient, bookingLimiter, asyncHandler(ctrl.createAppointment));
router.get('/appointments/:id/cancellation', requirePatient, asyncHandler(ctrl.checkCancellation));
router.post('/appointments/:id/cancel', requirePatient, asyncHandler(ctrl.cancelAppointment));
router.post('/appointments/:id/reschedule', requirePatient, bookingLimiter, asyncHandler(ctrl.rescheduleAppointment));
router.post('/appointments/:id/on-the-way', requirePatient, asyncHandler(ctrl.markOnTheWay));

router.post('/waitlist', requirePatient, asyncHandler(ctrl.joinWaitlist));
router.post('/waitlist/:id/accept', requirePatient, asyncHandler(ctrl.acceptWaitlistOffer));
router.post('/reviews', requirePatient, asyncHandler(ctrl.createReview));

module.exports = router;
