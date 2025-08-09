const express = require('express');
const router = express.Router();

// Import the new controllers
const clientClaimsController = require('../controllers/ClientsCLaimsController');
const adminClaimsController = require('../controllers/AdminClaimzController');

// ============================================================================
// PUBLIC ROUTES - Insurance Configuration
// ============================================================================

// Get all insurance types and their configurations
router.get('/config', clientClaimsController.getInsuranceConfig);

// Get specific insurance type configuration
router.get('/config/:type', clientClaimsController.getInsuranceTypeConfig);

// Calculate coverage quote
router.post('/quote', clientClaimsController.calculateCoverageQuote);

// ============================================================================
// CLIENT ROUTES - Claim Management (No Authentication Required)
// ============================================================================

// Submit new claim
router.post('/submit', clientClaimsController.submitClaim);

// Get user's own claims
router.get('/my-claims', clientClaimsController.getUserClaims);
router.get('/user/:user_id', clientClaimsController.getUserClaims);

// Get user's claims summary/statistics
router.get('/user/:user_id/summary', clientClaimsController.getUserClaimsSummary);
router.get('/my-claims/summary', clientClaimsController.getUserClaimsSummary);

// Get specific claim details
router.get('/:id', clientClaimsController.getClaimDetails);

// Update claim (limited fields for clients)
router.patch('/:id', clientClaimsController.updateClientClaim);

// Cancel claim
router.patch('/:id/cancel', clientClaimsController.cancelClaim);

// Upload documents for a claim
router.post('/documents', clientClaimsController.uploadClaimDocuments);

// Get claim documents
router.get('/:claim_id/documents', clientClaimsController.getClaimDocuments);

// Search user's claims
router.get('/search/my-claims', clientClaimsController.searchUserClaims);

// ============================================================================
// ADMIN ROUTES - Claims Administration (Now Public for Testing)
// ============================================================================

// Get all claims with filtering and pagination
router.get('/admin/all', adminClaimsController.getAllClaims);

// Get claims assigned to specific admin
router.get('/admin/my-assigned', adminClaimsController.getMyAssignedClaims);

// Process claim (approve/reject)
router.patch('/admin/:id/process', adminClaimsController.processClaim);

// Assign claim to admin/adjuster
router.patch('/admin/:id/assign', adminClaimsController.assignClaim);

// Update claim priority
router.patch('/admin/:id/priority', adminClaimsController.updateClaimPriority);

// Delete claim (soft delete)
router.delete('/admin/:id', adminClaimsController.deleteClaim);

// Bulk update claims
router.patch('/admin/bulk-update', adminClaimsController.bulkUpdateClaims);

// Search all claims (admin version)
router.get('/admin/search', adminClaimsController.searchClaims);

// ============================================================================
// ANALYTICS & REPORTING ROUTES (Now Public for Testing)
// ============================================================================

// General claims statistics
router.get('/admin/analytics/statistics', adminClaimsController.getClaimsStatistics);

// Claims statistics by insurance type (from original controller)
router.get('/admin/analytics/by-type', clientClaimsController.getClaimsStatisticsByType);

// Fraud detection summary
router.get('/admin/analytics/fraud-summary', adminClaimsController.getFraudSummary);

// Fraud analysis by insurance type (from original controller)  
router.get('/admin/analytics/fraud-by-type', clientClaimsController.getFraudAnalysisByType);

module.exports = router;