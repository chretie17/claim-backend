const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/ReportsController');

// ============================================================================
// REPORTS ROUTES
// ============================================================================

// Overview Report - Main dashboard statistics
// GET /api/reports/overview?date_from=2024-01-01&date_to=2024-12-31&insurance_type=motor&status=approved
router.get('/overview', reportsController.getOverviewReport);

// Claims by Insurance Type Report
// GET /api/reports/claims-by-type?date_from=2024-01-01&date_to=2024-12-31&status=all
router.get('/claims-by-type', reportsController.getClaimsByTypeReport);

// Fraud Analysis Report
// GET /api/reports/fraud-analysis?date_from=2024-01-01&date_to=2024-12-31&insurance_type=all
router.get('/fraud-analysis', reportsController.getFraudAnalysisReport);

// Financial Report
// GET /api/reports/financial?date_from=2024-01-01&date_to=2024-12-31&insurance_type=motor
router.get('/financial', reportsController.getFinancialReport);

// Performance Report
// GET /api/reports/performance?date_from=2024-01-01&date_to=2024-12-31
router.get('/performance', reportsController.getPerformanceReport);

// Customer Analysis Report
// GET /api/reports/customer-analysis?date_from=2024-01-01&date_to=2024-12-31&insurance_type=all
router.get('/customer-analysis', reportsController.getCustomerAnalysisReport);

// Comprehensive Report - All data combined
// GET /api/reports/comprehensive?date_from=2024-01-01&date_to=2024-12-31
router.get('/comprehensive', reportsController.getComprehensiveReport);

// Export Reports as CSV
// GET /api/reports/export?report_type=overview&date_from=2024-01-01&date_to=2024-12-31&format=csv
router.get('/export', reportsController.exportReportCSV);

module.exports = router;