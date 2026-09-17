'use strict';
/** Rol bo'yicha ruxsat: SUPERADMIN / ADMIN (registratura) / DOCTOR. */

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, error: { code: 'NO_AUTH', message: 'Avtorizatsiya yo\'q' } });
    }
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Bu amal uchun ruxsat yo\'q' },
      });
    }
    return next();
  };
}

/**
 * DOCTOR roli faqat o'z bemorlarini ko'radi.
 * So'rovga majburiy doctorId filtri qo'shiladi.
 */
function scopeToOwnDoctor(req, res, next) {
  if (req.admin?.role === 'DOCTOR') {
    if (!req.admin.doctorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'NO_DOCTOR_LINK', message: 'Foydalanuvchi shifokorga bog\'lanmagan' },
      });
    }
    req.forcedDoctorId = req.admin.doctorId;
  }
  return next();
}

const isSuperadmin = requireRole('SUPERADMIN');
const isAdmin = requireRole('SUPERADMIN', 'ADMIN');
const isAnyStaff = requireRole('SUPERADMIN', 'ADMIN', 'DOCTOR');

module.exports = { requireRole, scopeToOwnDoctor, isSuperadmin, isAdmin, isAnyStaff };
