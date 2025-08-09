const express = require('express');
const router = express.Router();

// Import the new controllers
const clientClaimsController = require('../controllers/ClientsCLaimsController');
const adminClaimsController = require('../controllers/AdminClaimzController');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/claims/') // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5 // Maximum 5 files
  },
  fileFilter: function (req, file, cb) {
    // Accept images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDF files are allowed!'), false);
    }
  }
});

router.get('/documents/:filename/view', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads/claims', filename);
  
  console.log('Attempting to serve file:', filePath);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // Get file stats to set proper headers
  const stat = fs.statSync(filePath);
  const fileExtension = path.extname(filename).toLowerCase();
  
  // Set appropriate content type based on file extension
  let contentType = 'application/octet-stream'; // default
  
  if (fileExtension === '.pdf') {
    contentType = 'application/pdf';
  } else if (['.jpg', '.jpeg'].includes(fileExtension)) {
    contentType = 'image/jpeg';
  } else if (fileExtension === '.png') {
    contentType = 'image/png';
  } else if (fileExtension === '.gif') {
    contentType = 'image/gif';
  } else if (fileExtension === '.webp') {
    contentType = 'image/webp';
  }
  
  // Set headers for inline viewing
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', 'inline'); // Display in browser instead of download
  
  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
  
  fileStream.on('error', (error) => {
    console.error('Error streaming file:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error serving file' });
    }
  });
});

// Download document
router.get('/documents/:filename/download', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads/claims', filename);
  
  console.log('Attempting to download file:', filePath);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // Get original filename from the database or construct it
  // For now, we'll extract it from the filename pattern
  const originalName = filename.includes('-') ? 
    filename.split('-').slice(2).join('-') : filename;
  
  // Set headers for download
  res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  
  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
  
  fileStream.on('error', (error) => {
    console.error('Error downloading file:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error downloading file' });
    }
  });
});

// Get document metadata (optional - for security/access control)
router.get('/documents/:filename/info', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads/claims', filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  const stat = fs.statSync(filePath);
  const fileExtension = path.extname(filename).toLowerCase();
  
  res.json({
    filename: filename,
    size: stat.size,
    extension: fileExtension,
    created: stat.birthtime,
    modified: stat.mtime,
    exists: true
  });
});

// Update your route to handle file uploads
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
router.post('/submit', upload.array('supporting_documents', 5), clientClaimsController.submitClaim);

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