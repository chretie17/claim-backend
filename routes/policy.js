const express = require('express');
const router = express.Router();
const policiesController = require('../controllers/PolicyController');

// ============================================================================
// CLIENT ROUTES - Policy Management (No Authentication)
// ============================================================================

// Get user's own policies
router.get('/my-policies', policiesController.getUserPolicies);
router.get('/user/:user_id', policiesController.getUserPolicies);

// Get specific policy details
router.get('/:policy_number', policiesController.getPolicyDetails);

// Check policy validity
router.get('/:policy_number/validity', policiesController.checkPolicyValidity);

// Check claim eligibility for a policy
router.post('/:policy_number/check-eligibility', policiesController.checkClaimEligibility);

// Generate renewal quote
router.post('/:policy_number/renewal-quote', policiesController.generateRenewalQuote);

// Search user's policies
router.get('/search/my-policies', (req, res) => {
  policiesController.searchPolicies(req, res);
});

// ============================================================================
// ADMIN ROUTES - Policy Administration (Now Public)
// ============================================================================

// Create new policy
router.post('/', policiesController.createPolicy);

// Get all policies with filtering and pagination
router.get('/admin/all', policiesController.getAllPolicies);

// Update policy
router.patch('/admin/:policy_number', policiesController.updatePolicy);

// Renew policy
router.post('/admin/:policy_number/renew', policiesController.renewPolicy);

// Cancel policy
router.patch('/admin/:policy_number/cancel', policiesController.cancelPolicy);

// Suspend policy
router.patch('/admin/:policy_number/suspend', policiesController.suspendPolicy);

// Reactivate policy
router.patch('/admin/:policy_number/reactivate', policiesController.reactivatePolicy);

// Search all policies
router.get('/admin/search', policiesController.searchPolicies);

// ============================================================================
// ANALYTICS & REPORTING ROUTES (Now Public)
// ============================================================================

// Policy statistics
router.get('/admin/analytics/statistics', policiesController.getPolicyStatistics);

// Policies breakdown by type
router.get('/admin/analytics/by-type', policiesController.getPoliciesByType);

module.exports = router;
