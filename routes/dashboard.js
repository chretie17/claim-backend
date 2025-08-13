// ============================================================================
// ROUTES FILE (routes/dashboard.js or similar)
// ============================================================================
const express = require('express');
const router = express.Router();
const adminDashboardController = require('../controllers/DashboardController');

// ============================================================================
// ADMIN DASHBOARD ROUTES - Simple & Clean
// ============================================================================

// Main Dashboard Data
router.get('/overview', adminDashboardController.getDashboardOverview);
router.get('/quick-stats', adminDashboardController.getQuickStats);
router.get('/system-health', adminDashboardController.getSystemHealth);

// Chart Data Routes
router.get('/charts/status', adminDashboardController.getClaimsByStatus);
router.get('/charts/insurance-type', adminDashboardController.getClaimsByInsuranceType);
router.get('/charts/daily-trend', adminDashboardController.getDailyClaimsTrend);
router.get('/charts/monthly-summary', adminDashboardController.getMonthlySummary);
router.get('/charts/risk-distribution', adminDashboardController.getRiskDistribution);

// Performance & Activity Routes
router.get('/admin-performance', adminDashboardController.getAdminPerformance);
router.get('/recent-activity', adminDashboardController.getRecentActivity);

module.exports = router;