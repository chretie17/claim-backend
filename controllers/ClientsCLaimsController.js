const db = require('../config/db');

// ============================================================================
// INSURANCE CONFIGURATION SYSTEM (from original controller)
// ============================================================================

const INSURANCE_CONFIG = {
  motor: {
    name: 'Motor Insurance',
    categories: {
      silver: { 
        name: 'Silver Plan', 
        coverage_percentage: 50, 
        premium_multiplier: 1.0,
        max_claim_amount: 500000,
        description: 'Basic motor coverage - 50% damage coverage'
      },
      bronze: { 
        name: 'Bronze Plan', 
        coverage_percentage: 70, 
        premium_multiplier: 1.4,
        max_claim_amount: 750000,
        description: 'Enhanced motor coverage - 70% damage coverage'
      },
      gold: { 
        name: 'Gold Plan', 
        coverage_percentage: 100, 
        premium_multiplier: 2.0,
        max_claim_amount: 1000000,
        description: 'Premium motor coverage - 100% damage coverage'
      }
    },
    claim_types: ['accident', 'theft', 'vandalism', 'natural_disaster', 'third_party']
  },
  property: {
    name: 'Property Insurance',
    categories: {
      basic: { 
        name: 'Basic Property', 
        coverage_percentage: 60, 
        premium_multiplier: 1.0,
        max_claim_amount: 2000000,
        description: 'Basic property coverage - 60% damage coverage'
      },
      comprehensive: { 
        name: 'Comprehensive', 
        coverage_percentage: 85, 
        premium_multiplier: 1.6,
        max_claim_amount: 5000000,
        description: 'Comprehensive property coverage - 85% damage coverage'
      },
      premium: { 
        name: 'Premium Property', 
        coverage_percentage: 100, 
        premium_multiplier: 2.2,
        max_claim_amount: 10000000,
        description: 'Premium property coverage - 100% damage coverage'
      }
    },
    claim_types: ['fire', 'flood', 'earthquake', 'burglary', 'structural_damage', 'natural_disaster']
  },
  life: {
    name: 'Life Insurance',
    categories: {
      term: { 
        name: 'Term Life', 
        coverage_percentage: 100, 
        premium_multiplier: 1.0,
        max_claim_amount: 5000000,
        description: 'Term life insurance - Full coverage for specified term'
      },
      whole: { 
        name: 'Whole Life', 
        coverage_percentage: 100, 
        premium_multiplier: 2.5,
        max_claim_amount: 10000000,
        description: 'Whole life insurance - Lifetime coverage with investment'
      },
      universal: { 
        name: 'Universal Life', 
        coverage_percentage: 100, 
        premium_multiplier: 2.0,
        max_claim_amount: 15000000,
        description: 'Universal life insurance - Flexible premiums and coverage'
      }
    },
    claim_types: ['death', 'terminal_illness', 'disability', 'accidental_death']
  },
  health: {
    name: 'Health Insurance',
    categories: {
      basic: { 
        name: 'Basic Health', 
        coverage_percentage: 70, 
        premium_multiplier: 1.0,
        max_claim_amount: 1000000,
        description: 'Basic health coverage - 70% medical expenses'
      },
      family: { 
        name: 'Family Health', 
        coverage_percentage: 85, 
        premium_multiplier: 1.8,
        max_claim_amount: 2000000,
        description: 'Family health coverage - 85% medical expenses'
      },
      premium: { 
        name: 'Premium Health', 
        coverage_percentage: 95, 
        premium_multiplier: 2.5,
        max_claim_amount: 5000000,
        description: 'Premium health coverage - 95% medical expenses'
      }
    },
    claim_types: ['hospitalization', 'surgery', 'medication', 'emergency', 'specialist_consultation']
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Enhanced fraud detection
const detectFraud = (claimData) => {
  let fraudScore = 0;
  let riskLevel = 'LOW';

  const insuranceType = claimData.insurance_type;
  const category = claimData.insurance_category;
  const config = INSURANCE_CONFIG[insuranceType]?.categories[category];

  if (!config) {
    fraudScore += 50;
  } else {
    if (claimData.claim_amount > config.max_claim_amount) {
      fraudScore += 40;
    }

    switch (insuranceType) {
      case 'motor':
        if (claimData.claim_amount > 500000) fraudScore += 25;
        if (claimData.claim_amount > 1000000) fraudScore += 35;
        break;
      case 'property':
        if (claimData.claim_amount > 1000000) fraudScore += 20;
        if (claimData.claim_amount > 5000000) fraudScore += 40;
        break;
      case 'life':
        if (claimData.claim_amount > 2000000) fraudScore += 15;
        if (claimData.days_since_policy_start < 730) fraudScore += 25;
        break;
      case 'health':
        if (claimData.claim_amount > 500000) fraudScore += 30;
        if (claimData.frequent_claimer) fraudScore += 25;
        break;
    }
  }

  if (!claimData.description || claimData.description.length < 20) fraudScore += 20;
  
  const submitTime = new Date();
  const hour = submitTime.getHours();
  const day = submitTime.getDay();
  if (hour < 8 || hour > 18 || day === 0 || day === 6) fraudScore += 10;

  if (claimData.recent_claims_count > 2) fraudScore += 30;

  if (fraudScore >= 80) riskLevel = 'CRITICAL';
  else if (fraudScore >= 60) riskLevel = 'HIGH';
  else if (fraudScore >= 35) riskLevel = 'MEDIUM';

  return { fraudScore, riskLevel };
};

// Calculate priority
const calculatePriority = (claimData) => {
  let priority = 'medium';
  const insuranceType = claimData.insurance_type;
  
  if (claimData.claim_amount > 1000000) priority = 'urgent';
  else if (claimData.claim_amount > 500000) priority = 'high';
  else if (claimData.claim_amount < 50000) priority = 'low';
  
  switch (insuranceType) {
    case 'life':
      if (priority === 'low') priority = 'medium';
      else if (priority === 'medium') priority = 'high';
      else if (priority === 'high') priority = 'urgent';
      break;
    case 'health':
      if (priority === 'low') priority = 'medium';
      break;
    case 'motor':
      if (claimData.claim_subtype === 'accident' && priority === 'low') {
        priority = 'medium';
      }
      break;
  }
  
  return priority;
};

// Calculate coverage amount
const calculateCoverageAmount = (claimData) => {
  const insuranceType = claimData.insurance_type;
  const category = claimData.insurance_category;
  const config = INSURANCE_CONFIG[insuranceType]?.categories[category];
  
  if (!config) {
    return {
      error: 'Invalid insurance configuration',
      covered_amount: 0,
      coverage_percentage: 0
    };
  }

  const claimAmount = parseFloat(claimData.claim_amount);
  const maxClaimAmount = config.max_claim_amount;
  const coveragePercentage = config.coverage_percentage;

  const eligibleAmount = Math.min(claimAmount, maxClaimAmount);
  const coveredAmount = (eligibleAmount * coveragePercentage) / 100;

  return {
    claimed_amount: claimAmount,
    eligible_amount: eligibleAmount,
    coverage_percentage: coveragePercentage,
    covered_amount: coveredAmount,
    customer_liability: eligibleAmount - coveredAmount,
    exceeded_limit: claimAmount > maxClaimAmount
  };
};

// ============================================================================
// CLIENT CLAIMS CONTROLLER
// ============================================================================

// Submit new claim
exports.submitClaim = async (req, res) => {
  const { 
    policy_number, 
    insurance_type,
    insurance_category,
    claim_type, 
    incident_date, 
    claim_amount, 
    description,
    additional_details = {}
  } = req.body;
  
  const user_id = req.user ? req.user.id : req.body.user_id;

  // Validation
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (!policy_number || !insurance_type || !insurance_category || !claim_type || 
      !incident_date || !claim_amount || !description) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  // Validate insurance configuration
  if (!INSURANCE_CONFIG[insurance_type]) {
    return res.status(400).json({ error: 'Invalid insurance type' });
  }
  
  if (!INSURANCE_CONFIG[insurance_type].categories[insurance_category]) {
    return res.status(400).json({ error: 'Invalid insurance category' });
  }

  // Validate claim type
  const validClaimTypes = INSURANCE_CONFIG[insurance_type].claim_types;
  if (!validClaimTypes.includes(claim_type)) {
    return res.status(400).json({ 
      error: 'Invalid claim type', 
      valid_types: validClaimTypes 
    });
  }

  // Generate unique claim number
  const typePrefix = insurance_type.toUpperCase().substring(0, 3);
  const claim_number = `${typePrefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
  
  // Calculate coverage
  const coverageDetails = calculateCoverageAmount({
    insurance_type,
    insurance_category,
    claim_amount
  });

  // Enhanced fraud detection
  const fraudResult = detectFraud({
    insurance_type,
    insurance_category,
    claim_amount,
    description,
    ...additional_details
  });
  
  // Calculate priority
  const priority = calculatePriority({
    insurance_type,
    claim_amount,
    claim_subtype: claim_type
  });

  const query = `
    INSERT INTO claims (
      claim_number, user_id, policy_number, insurance_type, insurance_category,
      claim_type, incident_date, claim_amount, description, priority, 
      fraud_score, risk_level, coverage_percentage, max_coverage_amount,
      estimated_payout, additional_details, status, created_at
    ) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
  `;

  db.query(query, [
    claim_number, user_id, policy_number, insurance_type, insurance_category,
    claim_type, incident_date, claim_amount, description, priority,
    fraudResult.fraudScore, fraudResult.riskLevel, coverageDetails.coverage_percentage,
    coverageDetails.eligible_amount, coverageDetails.covered_amount,
    JSON.stringify(additional_details)
  ], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    res.json({
      message: 'Claim submitted successfully',
      claim_id: result.insertId,
      claim_number,
      priority,
      fraud_assessment: {
        score: fraudResult.fraudScore,
        risk_level: fraudResult.riskLevel
      },
      coverage_details: coverageDetails
    });
  });
};

// Get user's own claims
exports.getUserClaims = (req, res) => {
  const user_id = req.params.user_id || req.user?.id || req.query.user_id;
  const { status, insurance_type, page = 1, limit = 10 } = req.query;
  
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  let whereConditions = ['c.user_id = ?', 'c.status != "deleted"'];
  let queryParams = [user_id];

  if (status) {
    whereConditions.push('c.status = ?');
    queryParams.push(status);
  }

  if (insurance_type) {
    whereConditions.push('c.insurance_type = ?');
    queryParams.push(insurance_type);
  }

  const whereClause = 'WHERE ' + whereConditions.join(' AND ');
  const offset = (page - 1) * limit;

  const query = `
    SELECT c.*, 
           CASE 
             WHEN c.insurance_type IS NOT NULL THEN c.insurance_type
             ELSE 'Unknown'
           END as insurance_type,
           CASE 
             WHEN c.insurance_category IS NOT NULL THEN c.insurance_category
             ELSE 'Unknown'
           END as insurance_category
    FROM claims c 
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `;

  queryParams.push(parseInt(limit), parseInt(offset));

  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM claims c ${whereClause}`;
    const countParams = queryParams.slice(0, -2);

    db.query(countQuery, countParams, (countErr, countResults) => {
      if (countErr) return res.status(500).json({ error: countErr.message });

      res.json({
        claims: results,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(countResults[0].total / limit),
          total_records: countResults[0].total,
          per_page: parseInt(limit)
        }
      });
    });
  });
};

// Get specific claim details
exports.getClaimDetails = (req, res) => {
  const { id } = req.params;
  const user_id = req.user?.id || req.query.user_id;
  
  let query = `
    SELECT c.*, u.name as user_name, u.email as user_email, u.phone as user_phone
    FROM claims c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = ? AND c.status != "deleted"
  `;
  
  let queryParams = [id];

  // If user_id is provided, ensure user can only see their own claims
  if (user_id) {
    query += ' AND c.user_id = ?';
    queryParams.push(user_id);
  }

  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    res.json(results[0]);
  });
};

// Update claim (limited fields for clients)
exports.updateClientClaim = (req, res) => {
  const { id } = req.params;
  const { description, additional_details } = req.body;
  const user_id = req.user?.id || req.body.user_id;
  
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // Only allow updating if claim is still pending and belongs to user
  const query = `
    UPDATE claims 
    SET description = ?, additional_details = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND status IN ('pending', 'under_review')
  `;

  db.query(query, [description, JSON.stringify(additional_details), id, user_id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Claim not found or cannot be updated (may be already processed)' 
      });
    }
    
    res.json({ 
      message: 'Claim updated successfully',
      claim_id: id
    });
  });
};

// Cancel claim (client can cancel only pending claims)
exports.cancelClaim = (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user_id = req.user?.id || req.body.user_id;
  
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const query = `
    UPDATE claims 
    SET status = 'cancelled', cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND status = 'pending'
  `;

  db.query(query, [reason, id, user_id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Claim not found or cannot be cancelled (may be already processed)' 
      });
    }
    
    res.json({ 
      message: 'Claim cancelled successfully',
      claim_id: id
    });
  });
};

// Upload documents for a claim
exports.uploadClaimDocuments = (req, res) => {
  const { claim_id, document_type, file_path, file_name } = req.body;
  const user_id = req.user?.id || req.body.user_id;
  
  if (!claim_id || !document_type || !file_path || !file_name || !user_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // First, verify the claim belongs to the user
  const verifyQuery = 'SELECT id FROM claims WHERE id = ? AND user_id = ?';
  
  db.query(verifyQuery, [claim_id, user_id], (verifyErr, verifyResults) => {
    if (verifyErr) return res.status(500).json({ error: verifyErr.message });
    
    if (verifyResults.length === 0) {
      return res.status(403).json({ error: 'Access denied or claim not found' });
    }

    const insertQuery = `
      INSERT INTO claim_documents (claim_id, document_type, file_path, file_name, uploaded_by, uploaded_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    db.query(insertQuery, [claim_id, document_type, file_path, file_name, user_id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      
      res.json({
        message: 'Document uploaded successfully',
        document_id: result.insertId
      });
    });
  });
};

// Get claim documents
exports.getClaimDocuments = (req, res) => {
  const { claim_id } = req.params;
  const user_id = req.user?.id || req.query.user_id;
  
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // Verify claim belongs to user first
  const verifyQuery = 'SELECT id FROM claims WHERE id = ? AND user_id = ?';
  
  db.query(verifyQuery, [claim_id, user_id], (verifyErr, verifyResults) => {
    if (verifyErr) return res.status(500).json({ error: verifyErr.message });
    
    if (verifyResults.length === 0) {
      return res.status(403).json({ error: 'Access denied or claim not found' });
    }

    const query = `
      SELECT id, document_type, file_name, uploaded_at
      FROM claim_documents 
      WHERE claim_id = ?
      ORDER BY uploaded_at DESC
    `;

    db.query(query, [claim_id], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    });
  });
};

// Search user's claims
exports.searchUserClaims = (req, res) => {
  const { 
    query: searchQuery, 
    insurance_type, 
    status, 
    date_from,
    date_to,
    page = 1, 
    limit = 10 
  } = req.query;
  
  const user_id = req.user?.id || req.query.user_id;
  
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  let whereConditions = ['c.user_id = ?', 'c.status != "deleted"'];
  let queryParams = [user_id];

  if (searchQuery) {
    whereConditions.push('(c.claim_number LIKE ? OR c.description LIKE ?)');
    queryParams.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }

  if (insurance_type) {
    whereConditions.push('c.insurance_type = ?');
    queryParams.push(insurance_type);
  }

  if (status) {
    whereConditions.push('c.status = ?');
    queryParams.push(status);
  }

  if (date_from) {
    whereConditions.push('c.created_at >= ?');
    queryParams.push(date_from);
  }

  if (date_to) {
    whereConditions.push('c.created_at <= ?');
    queryParams.push(date_to);
  }

  const whereClause = 'WHERE ' + whereConditions.join(' AND ');
  const offset = (page - 1) * limit;

  const query = `
    SELECT c.*
    FROM claims c
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `;

  queryParams.push(parseInt(limit), parseInt(offset));

  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM claims c ${whereClause}`;
    const countParams = queryParams.slice(0, -2);

    db.query(countQuery, countParams, (countErr, countResults) => {
      if (countErr) return res.status(500).json({ error: countErr.message });

      res.json({
        claims: results,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(countResults[0].total / limit),
          total_records: countResults[0].total,
          per_page: parseInt(limit)
        }
      });
    });
  });
};

// ============================================================================
// INSURANCE CONFIGURATION ENDPOINTS
// ============================================================================

// Get all insurance types and categories
exports.getInsuranceConfig = (req, res) => {
  res.json(INSURANCE_CONFIG);
};

// Get specific insurance type configuration
exports.getInsuranceTypeConfig = (req, res) => {
  const { type } = req.params;
  
  if (!INSURANCE_CONFIG[type]) {
    return res.status(404).json({ error: 'Insurance type not found' });
  }
  
  res.json(INSURANCE_CONFIG[type]);
};

// Calculate coverage for a potential claim (quote)
exports.calculateCoverageQuote = (req, res) => {
  const { insurance_type, insurance_category, claim_amount } = req.body;
  
  const coverageDetails = calculateCoverageAmount({
    insurance_type,
    insurance_category,
    claim_amount
  });
  
  if (coverageDetails.error) {
    return res.status(400).json(coverageDetails);
  }
  
  res.json(coverageDetails);
};

// Get user's claim summary/statistics
exports.getUserClaimsSummary = (req, res) => {
  const user_id = req.user?.id || req.params.user_id || req.query.user_id;
  
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const query = `
    SELECT 
      COUNT(*) as total_claims,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_claims,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_claims,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_claims,
      COUNT(CASE WHEN status = 'under_review' THEN 1 END) as under_review_claims,
      SUM(claim_amount) as total_claimed_amount,
      SUM(CASE WHEN status = 'approved' THEN COALESCE(payout_amount, 0) ELSE 0 END) as total_received,
      insurance_type,
      COUNT(*) as claims_by_type
    FROM claims 
    WHERE user_id = ? AND status != 'deleted'
    GROUP BY insurance_type
  `;

  db.query(query, [user_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Also get overall summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_claims,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_claims,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_claims,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_claims,
        COUNT(CASE WHEN status = 'under_review' THEN 1 END) as under_review_claims,
        SUM(claim_amount) as total_claimed_amount,
        SUM(CASE WHEN status = 'approved' THEN COALESCE(payout_amount, 0) ELSE 0 END) as total_received
      FROM claims 
      WHERE user_id = ? AND status != 'deleted'
    `;

    db.query(summaryQuery, [user_id], (summaryErr, summaryResults) => {
      if (summaryErr) return res.status(500).json({ error: summaryErr.message });

      res.json({
        overall_summary: summaryResults[0],
        by_insurance_type: results
      });
    });
  });
};

// ============================================================================
// ANALYTICS METHODS (from original controller)
// ============================================================================

// Get claims statistics by insurance type
exports.getClaimsStatisticsByType = (req, res) => {
  const query = `
    SELECT 
      insurance_type,
      insurance_category,
      COUNT(*) as total_claims,
      SUM(claim_amount) as total_claimed,
      SUM(estimated_payout) as total_estimated_payout,
      AVG(fraud_score) as avg_fraud_score,
      AVG(claim_amount) as avg_claim_amount
    FROM claims 
    WHERE status != 'deleted'
    GROUP BY insurance_type, insurance_category
    ORDER BY insurance_type, insurance_category
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Group results by insurance type
    const groupedResults = results.reduce((acc, row) => {
      if (!acc[row.insurance_type]) {
        acc[row.insurance_type] = [];
      }
      acc[row.insurance_type].push(row);
      return acc;
    }, {});
    
    res.json(groupedResults);
  });
};

// Get fraud analysis by insurance type
exports.getFraudAnalysisByType = (req, res) => {
  const query = `
    SELECT 
      insurance_type,
      risk_level,
      COUNT(*) as count,
      AVG(fraud_score) as avg_fraud_score,
      SUM(claim_amount) as total_amount_at_risk
    FROM claims 
    WHERE status != 'deleted'
    GROUP BY insurance_type, risk_level
    ORDER BY insurance_type, avg_fraud_score DESC
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

module.exports = exports;