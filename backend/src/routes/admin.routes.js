'use strict';
/** Admin API — login majburiy, rollar bo'yicha cheklangan. */
const express = require('express');
const ctrl = require('../controllers/adminController');
const { requireAdmin } = require('../middlewares/auth.middleware');
const { isSuperadmin, isAdmin, isAnyStaff, scopeToOwnDoctor } = require('../middlewares/rbac.middleware');
const { loginLimiter } = require('../middlewares/rateLimit.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

const router = express.Router();

router.post('/login', loginLimiter, asyncHandler(ctrl.login));

// Bundan keyingi hamma narsa avtorizatsiya talab qiladi
router.use(asyncHandler(requireAdmin), scopeToOwnDoctor);

router.get('/me', asyncHandler(ctrl.me));
router.get('/dashboard', isAnyStaff, asyncHandler(ctrl.dashboard));
router.get('/dashboard/heatmap', isAnyStaff, asyncHandler(ctrl.heatmap));

// Navbatlar
router.get('/appointments', isAnyStaff, asyncHandler(ctrl.listAppointments));
router.post('/appointments', isAdmin, asyncHandler(ctrl.createAppointment));
router.get('/appointments/slots', isAnyStaff, asyncHandler(ctrl.getAvailableSlotsAdmin));
router.patch('/appointments/:id/status', isAnyStaff, asyncHandler(ctrl.updateAppointmentStatus));
router.post('/appointments/:id/reschedule', isAdmin, asyncHandler(ctrl.rescheduleAppointment));

// Shifokorlar
router.get('/doctors', isAnyStaff, asyncHandler(ctrl.listDoctors));
router.post('/doctors', isAdmin, asyncHandler(ctrl.createDoctor));
router.patch('/doctors/:id', isAnyStaff, asyncHandler(ctrl.updateDoctor));
router.post('/doctors/:id/calendar-toggle', isAnyStaff, asyncHandler(ctrl.toggleCalendar));
router.post('/doctors/:id/cancel-day', isAnyStaff, asyncHandler(ctrl.cancelDoctorDay));

// Xizmatlar / mutaxassisliklar / kabinetlar
router.get('/services', isAnyStaff, asyncHandler(ctrl.listServices));
router.post('/services', isAdmin, asyncHandler(ctrl.upsertService));
router.patch('/services/:id', isAdmin, asyncHandler(ctrl.upsertService));
router.delete('/services/:id', isAdmin, asyncHandler(ctrl.deleteService));
router.get('/specialties', isAnyStaff, asyncHandler(ctrl.listSpecialties));
router.post('/specialties', isAdmin, asyncHandler(ctrl.upsertSpecialty));
router.patch('/specialties/:id', isAdmin, asyncHandler(ctrl.upsertSpecialty));
router.get('/rooms', isAnyStaff, asyncHandler(ctrl.listRooms));
router.post('/rooms', isAdmin, asyncHandler(ctrl.upsertRoom));
router.patch('/rooms/:id', isAdmin, asyncHandler(ctrl.upsertRoom));

// Ish vaqti
router.get('/working-hours', isAnyStaff, asyncHandler(ctrl.listWorkingHours));
router.post('/working-hours', isAnyStaff, asyncHandler(ctrl.saveWorkingHours));
router.post('/exceptions', isAnyStaff, asyncHandler(ctrl.saveException));
router.delete('/exceptions/:id', isAnyStaff, asyncHandler(ctrl.deleteException));

// Bemorlar
router.get('/patients', isAnyStaff, asyncHandler(ctrl.listPatients));
router.get('/patients/:id', isAnyStaff, asyncHandler(ctrl.getPatient));
router.patch('/patients/:id', isAdmin, asyncHandler(ctrl.updatePatient));

// Qo'ng'iroqlar
router.get('/calls', isAdmin, asyncHandler(ctrl.listCallLogs));
router.get('/calls/:id', isAdmin, asyncHandler(ctrl.getCallLog));
router.get('/callbacks', isAdmin, asyncHandler(ctrl.listCallbackRequests));
router.post('/callbacks/:id/handle', isAdmin, asyncHandler(ctrl.handleCallbackRequest));

// Kutish ro'yxati
router.get('/waitlist', isAdmin, asyncHandler(ctrl.listWaitlist));
router.delete('/waitlist/:id', isAdmin, asyncHandler(ctrl.deleteWaitlistEntry));

// Baholar
router.get('/reviews', isAdmin, asyncHandler(ctrl.listReviews));
router.patch('/reviews/:id', isAdmin, asyncHandler(ctrl.moderateReview));

// Sozlamalar va foydalanuvchilar — faqat SUPERADMIN
router.get('/settings', isAdmin, asyncHandler(ctrl.getSettings));
router.patch('/settings', isSuperadmin, asyncHandler(ctrl.updateSettings));
router.get('/users', isSuperadmin, asyncHandler(ctrl.listAdminUsers));
router.post('/users', isSuperadmin, asyncHandler(ctrl.upsertAdminUser));
router.patch('/users/:id', isSuperadmin, asyncHandler(ctrl.upsertAdminUser));
router.get('/audit', isSuperadmin, asyncHandler(ctrl.listAuditLogs));

module.exports = router;
