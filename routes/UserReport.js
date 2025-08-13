const express = require('express');
const router = express.Router();
const userReportController = require('../controllers/UserReportController');

// ============================================================================
// USER REPORT ROUTES
// ============================================================================

// Get all users for admin to choose from
// GET /api/reports/users
router.get('/users',userReportController.getAllUsersForSelection);

// Get comprehensive report for a specific user
// GET /api/reports/user/:user_id
router.get('/user/:user_id',  userReportController.getUserReport);

// Get user's claims timeline
// GET /api/reports/user/:user_id/timeline
router.get('/user/:user_id/timeline',  userReportController.getUserClaimsTimeline);

// Export user report as CSV
// GET /api/reports/user/:user_id/export
router.get('/user/:user_id/export',  userReportController.exportUserReportCSV);

module.exports = router;