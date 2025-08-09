const db = require('../config/db');
const { INSURANCE_CONFIG } = require('./ClientsCLaimsController');

// ============================================================================
// POLICY MANAGEMENT FUNCTIONS
// ============================================================================

// Create new insurance policy
exports.createPolicy = (req, res) => {
  const {
    policy_number,
    user_id,
    insurance_type,
    insurance_category,
    start_date,
    end_date,
    premium_amount,
    coverage_amount,
    policy_details = {}
  } = req.body;

  // Validate insurance configuration
  if (!INSURANCE_CONFIG[insurance_type]) {
    return res.status(400).json({ error: 'Invalid insurance type' });
  }

  if (!INSURANCE_CONFIG[insurance_type].categories[insurance_category]) {
    return res.status(400).json({ error: 'Invalid insurance category' });
  }

  // Get coverage percentage from configuration
  const coveragePercentage = INSURANCE_CONFIG[insurance_type].categories[insurance_category].coverage_percentage;

  const query = `
    INSERT INTO insurance_policies (
      policy_number, user_id, insurance_type, insurance_category,
      start_date, end_date, premium_amount, coverage_amount,
      coverage_percentage, policy_details
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [
    policy_number, user_id, insurance_type, insurance_category,
    start_date, end_date, premium_amount, coverage_amount,
    coveragePercentage, JSON.stringify(policy_details)
  ], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Policy number already exists' });
      }
      return res.status(500).json({ error: err.message });
    }

    res.json({
      message: 'Policy created successfully',
      policy_id: result.insertId,
      policy_number
    });
  });
};

// Get user's policies
exports.getUserPolicies = (req, res) => {
  const user_id = req.user ? req.user.id : req.params.user_id;

  const query = `
    SELECT p.*, ip.category_name, ip.description as category_description
    FROM insurance_policies p
    LEFT JOIN insurance_plans ip ON p.insurance_type = ip.insurance_type 
      AND p.insurance_category = ip.category_code
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
  `;

  db.query(query, [user_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // Parse policy_details JSON for each result
    const policies = results.map(policy => ({
      ...policy,
      policy_details: typeof policy.policy_details === 'string' 
        ? JSON.parse(policy.policy_details) 
        : policy.policy_details
    }));

    res.json(policies);
  });
};

// Get single policy details
exports.getPolicyDetails = (req, res) => {
  const { policy_number } = req.params;

  const query = `
    SELECT p.*, u.name as user_name, u.email as user_email, u.phone as user_phone,
           ip.category_name, ip.description as category_description,
           ip.premium_multiplier
    FROM insurance_policies p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN insurance_plans ip ON p.insurance_type = ip.insurance_type 
      AND p.insurance_category = ip.category_code
    WHERE p.policy_number = ?
  `;

  db.query(query, [policy_number], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Policy not found' });

    const policy = results[0];
    policy.policy_details = typeof policy.policy_details === 'string' 
      ? JSON.parse(policy.policy_details) 
      : policy.policy_details;

    // Get claims history for this policy
    const claimsQuery = `
      SELECT id, claim_number, claim_type, claim_amount, status, 
             fraud_score, risk_level, created_at
      FROM claims 
      WHERE policy_number = ?
      ORDER BY created_at DESC
      LIMIT 10
    `;

    db.query(claimsQuery, [policy_number], (claimsErr, claimsResults) => {
      if (claimsErr) return res.status(500).json({ error: claimsErr.message });

      res.json({
        policy: policy,
        recent_claims: claimsResults
      });
    });
  });
};

// Update policy
exports.updatePolicy = (req, res) => {
  const { policy_number } = req.params;
  const {
    policy_status,
    end_date,
    premium_amount,
    coverage_amount,
    policy_details
  } = req.body;

  const updates = [];
  const values = [];

  if (policy_status) {
    updates.push('policy_status = ?');
    values.push(policy_status);
  }
  if (end_date) {
    updates.push('end_date = ?');
    values.push(end_date);
  }
  if (premium_amount) {
    updates.push('premium_amount = ?');
    values.push(premium_amount);
  }
  if (coverage_amount) {
    updates.push('coverage_amount = ?');
    values.push(coverage_amount);
  }
  if (policy_details) {
    updates.push('policy_details = ?');
    values.push(JSON.stringify(policy_details));
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  values.push(policy_number);

  const query = `UPDATE insurance_policies SET ${updates.join(', ')} WHERE policy_number = ?`;

  db.query(query, values, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Policy not found' });

    res.json({ message: 'Policy updated successfully' });
  });
};

// Renew policy
exports.renewPolicy = (req, res) => {
  const { policy_number } = req.params;
  const { new_end_date, new_premium_amount } = req.body;

  // First, get the current policy
  const selectQuery = 'SELECT * FROM insurance_policies WHERE policy_number = ?';

  db.query(selectQuery, [policy_number], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Policy not found' });

    const currentPolicy = results[0];

    // Generate new policy number for renewal
    const renewalNumber = policy_number + '_R' + Date.now();

    const renewalQuery = `
      INSERT INTO insurance_policies (
        policy_number, user_id, insurance_type, insurance_category,
        start_date, end_date, premium_amount, coverage_amount,
        coverage_percentage, policy_details, policy_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `;

    // Set old policy to expired
    const expireQuery = "UPDATE insurance_policies SET policy_status = 'expired' WHERE policy_number = ?";

    db.query(expireQuery, [policy_number], (expireErr) => {
      if (expireErr) return res.status(500).json({ error: expireErr.message });

      // Create renewal policy
      db.query(renewalQuery, [
        renewalNumber,
        currentPolicy.user_id,
        currentPolicy.insurance_type,
        currentPolicy.insurance_category,
        currentPolicy.end_date, // Start date is old end date
        new_end_date,
        new_premium_amount || currentPolicy.premium_amount,
        currentPolicy.coverage_amount,
        currentPolicy.coverage_percentage,
        currentPolicy.policy_details
      ], (renewErr, renewResult) => {
        if (renewErr) return res.status(500).json({ error: renewErr.message });

        res.json({
          message: 'Policy renewed successfully',
          old_policy_number: policy_number,
          new_policy_number: renewalNumber,
          new_policy_id: renewResult.insertId
        });
      });
    });
  });
};

// Get all policies (admin)
exports.getAllPolicies = (req, res) => {
  const { 
    insurance_type, 
    insurance_category, 
    policy_status, 
    page = 1, 
    limit = 20 
  } = req.query;

  let whereConditions = [];
  let queryParams = [];

  if (insurance_type) {
    whereConditions.push('p.insurance_type = ?');
    queryParams.push(insurance_type);
  }
  if (insurance_category) {
    whereConditions.push('p.insurance_category = ?');
    queryParams.push(insurance_category);
  }
  if (policy_status) {
    whereConditions.push('p.policy_status = ?');
    queryParams.push(policy_status);
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const query = `
    SELECT p.*, u.name as user_name, u.email as user_email,
           ip.category_name
    FROM insurance_policies p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN insurance_plans ip ON p.insurance_type = ip.insurance_type 
      AND p.insurance_category = ip.category_code
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  queryParams.push(parseInt(limit), parseInt(offset));

  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM insurance_policies p ${whereClause}`;
    const countParams = queryParams.slice(0, -2);

    db.query(countQuery, countParams, (countErr, countResults) => {
      if (countErr) return res.status(500).json({ error: countErr.message });

      // Parse policy details for each result
      const policies = results.map(policy => ({
        ...policy,
        policy_details: typeof policy.policy_details === 'string' 
          ? JSON.parse(policy.policy_details) 
          : policy.policy_details
      }));

      res.json({
        policies: policies,
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
// POLICY ANALYTICS
// ============================================================================

// Get policy statistics
exports.getPolicyStatistics = (req, res) => {
  const queries = {
    total: 'SELECT COUNT(*) as count FROM insurance_policies',
    active: 'SELECT COUNT(*) as count FROM insurance_policies WHERE policy_status = "active"',
    expired: 'SELECT COUNT(*) as count FROM insurance_policies WHERE policy_status = "expired"',
    totalPremiums: 'SELECT SUM(premium_amount) as total FROM insurance_policies WHERE policy_status = "active"',
    totalCoverage: 'SELECT SUM(coverage_amount) as total FROM insurance_policies WHERE policy_status = "active"'
  };

  const results = {};
  let completed = 0;
  const total = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    db.query(query, (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      
      results[key] = result[0].count || result[0].total || 0;
      completed++;

      if (completed === total) {
        res.json(results);
      }
    });
  });
};

// Get policies breakdown by type
exports.getPoliciesByType = (req, res) => {
  const query = `
    SELECT 
      insurance_type,
      insurance_category,
      policy_status,
      COUNT(*) as policy_count,
      SUM(premium_amount) as total_premiums,
      SUM(coverage_amount) as total_coverage,
      AVG(premium_amount) as avg_premium
    FROM insurance_policies
    GROUP BY insurance_type, insurance_category, policy_status
    ORDER BY insurance_type, insurance_category
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// Check policy validity
exports.checkPolicyValidity = (req, res) => {
  const { policy_number } = req.params;

  const query = `
    SELECT policy_number, policy_status, start_date, end_date,
           CASE 
             WHEN policy_status = 'active' AND CURDATE() BETWEEN start_date AND end_date THEN 'valid'
             WHEN policy_status = 'active' AND CURDATE() > end_date THEN 'expired'
             WHEN policy_status = 'active' AND CURDATE() < start_date THEN 'not_started'
             ELSE policy_status
           END as validity_status,
           DATEDIFF(end_date, CURDATE()) as days_until_expiry
    FROM insurance_policies
    WHERE policy_number = ?
  `;

  db.query(query, [policy_number], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Policy not found' });

    res.json(results[0]);
  });
};

// Search policies
exports.searchPolicies = (req, res) => {
  const { search_term, user_id } = req.query;
  
  if (!search_term) {
    return res.status(400).json({ error: 'Search term is required' });
  }

  let query = `
    SELECT p.*, u.name as user_name, u.email as user_email,
           ip.category_name
    FROM insurance_policies p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN insurance_plans ip ON p.insurance_type = ip.insurance_type 
      AND p.insurance_category = ip.category_code
    WHERE (p.policy_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)
  `;
  
  let queryParams = [`%${search_term}%`, `%${search_term}%`, `%${search_term}%`];

  if (user_id) {
    query += ' AND p.user_id = ?';
    queryParams.push(user_id);
  }

  query += ' ORDER BY p.created_at DESC LIMIT 50';

  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Parse policy details for each result
    const policies = results.map(policy => ({
      ...policy,
      policy_details: typeof policy.policy_details === 'string' 
        ? JSON.parse(policy.policy_details) 
        : policy.policy_details
    }));

    res.json(policies);
  });
};

// ============================================================================
// POLICY VALIDATION AND ELIGIBILITY
// ============================================================================

// Check claim eligibility for a policy
exports.checkClaimEligibility = (req, res) => {
  const { policy_number } = req.params;
  const { claim_amount, claim_type } = req.body;

  const query = `
    SELECT p.*, ip.max_claim_amount, ip.coverage_percentage
    FROM insurance_policies p
    LEFT JOIN insurance_plans ip ON p.insurance_type = ip.insurance_type 
      AND p.insurance_category = ip.category_code
    WHERE p.policy_number = ? AND p.policy_status = 'active'
      AND CURDATE() BETWEEN p.start_date AND p.end_date
  `;

  db.query(query, [policy_number], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) {
      return res.status(404).json({ 
        eligible: false,
        reason: 'Policy not found or not active' 
      });
    }

    const policy = results[0];
    
    // Check if claim type is valid for this insurance type
    const validClaimTypesQuery = `
      SELECT COUNT(*) as count 
      FROM claim_types 
      WHERE insurance_type = ? AND claim_type_code = ? AND is_active = TRUE
    `;

    db.query(validClaimTypesQuery, [policy.insurance_type, claim_type], (ctErr, ctResults) => {
      if (ctErr) return res.status(500).json({ error: ctErr.message });

      const isValidClaimType = ctResults[0].count > 0;
      
      if (!isValidClaimType) {
        return res.json({
          eligible: false,
          reason: 'Invalid claim type for this insurance',
          policy_details: {
            insurance_type: policy.insurance_type,
            category: policy.insurance_category,
            max_claim_amount: policy.max_claim_amount
          }
        });
      }

      // Check recent claims count
      const recentClaimsQuery = `
        SELECT COUNT(*) as recent_claims_count
        FROM claims
        WHERE policy_number = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      `;

      db.query(recentClaimsQuery, [policy_number], (rcErr, rcResults) => {
        if (rcErr) return res.status(500).json({ error: rcErr.message });

        const recentClaimsCount = rcResults[0].recent_claims_count;
        const maxClaimAmount = policy.max_claim_amount || 0;
        const coveragePercentage = policy.coverage_percentage || 0;

        // Calculate potential payout
        const eligibleAmount = Math.min(claim_amount, maxClaimAmount);
        const estimatedPayout = (eligibleAmount * coveragePercentage) / 100;
        const customerLiability = eligibleAmount - estimatedPayout;

        // Determine eligibility
        let eligible = true;
        let warnings = [];
        let reason = '';

        if (claim_amount > maxClaimAmount) {
          warnings.push(`Claim amount exceeds policy maximum of ${maxClaimAmount}`);
        }

        if (recentClaimsCount >= 3) {
          eligible = false;
          reason = 'Too many recent claims (3+ in last 6 months)';
        }

        res.json({
          eligible: eligible,
          reason: reason,
          warnings: warnings,
          policy_details: {
            policy_number: policy.policy_number,
            insurance_type: policy.insurance_type,
            insurance_category: policy.insurance_category,
            coverage_percentage: coveragePercentage,
            max_claim_amount: maxClaimAmount
          },
          claim_projection: {
            requested_amount: claim_amount,
            eligible_amount: eligibleAmount,
            estimated_payout: estimatedPayout,
            customer_liability: customerLiability,
            recent_claims_count: recentClaimsCount
          }
        });
      });
    });
  });
};

// Generate policy renewal quote
exports.generateRenewalQuote = (req, res) => {
  const { policy_number } = req.params;
  const { renewal_period_months = 12 } = req.body;

  const query = `
    SELECT p.*, ip.premium_multiplier,
           COUNT(c.id) as claims_count,
           SUM(c.claim_amount) as total_claimed,
           AVG(c.fraud_score) as avg_fraud_score
    FROM insurance_policies p
    LEFT JOIN insurance_plans ip ON p.insurance_type = ip.insurance_type 
      AND p.insurance_category = ip.category_code
    LEFT JOIN claims c ON p.policy_number = c.policy_number 
      AND c.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
    WHERE p.policy_number = ?
    GROUP BY p.id
  `;

  db.query(query, [policy_number], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Policy not found' });

    const policy = results[0];
    const basePremium = policy.premium_amount;
    const claimsCount = policy.claims_count || 0;
    const totalClaimed = policy.total_claimed || 0;
    const avgFraudScore = policy.avg_fraud_score || 0;

    // Calculate risk adjustment
    let riskMultiplier = 1.0;
    
    // Adjust based on claims history
    if (claimsCount > 2) riskMultiplier += 0.2;
    if (claimsCount > 4) riskMultiplier += 0.3;
    
    // Adjust based on claim amounts
    if (totalClaimed > policy.coverage_amount * 0.5) riskMultiplier += 0.25;
    
    // Adjust based on fraud risk
    if (avgFraudScore > 50) riskMultiplier += 0.15;
    if (avgFraudScore > 70) riskMultiplier += 0.25;

    // Apply loyalty discount for long-term customers
    const policyAgeMonths = Math.floor((Date.now() - new Date(policy.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (policyAgeMonths > 24 && claimsCount <= 1) {
      riskMultiplier *= 0.95; // 5% loyalty discount
    }

    // Calculate renewal premium
    const renewalPremium = Math.round(basePremium * riskMultiplier * (renewal_period_months / 12));
    
    // Calculate new end date
    const currentEndDate = new Date(policy.end_date);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + renewal_period_months);

    res.json({
      policy_number: policy_number,
      current_premium: basePremium,
      renewal_premium: renewalPremium,
      risk_multiplier: Math.round(riskMultiplier * 100) / 100,
      renewal_period_months: renewal_period_months,
      new_end_date: newEndDate.toISOString().split('T')[0],
      risk_factors: {
        claims_count: claimsCount,
        total_claimed: totalClaimed,
        avg_fraud_score: Math.round(avgFraudScore * 100) / 100,
        policy_age_months: policyAgeMonths
      },
      quote_valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days
    });
  });
};

// ============================================================================
// POLICY LIFECYCLE MANAGEMENT
// ============================================================================

// Cancel policy
exports.cancelPolicy = (req, res) => {
  const { policy_number } = req.params;
  const { cancellation_reason, cancellation_date } = req.body;

  // Check for active claims
  const activeClaimsQuery = `
    SELECT COUNT(*) as active_claims
    FROM claims
    WHERE policy_number = ? AND status IN ('pending', 'under_review')
  `;

  db.query(activeClaimsQuery, [policy_number], (err, claimsResults) => {
    if (err) return res.status(500).json({ error: err.message });

    if (claimsResults[0].active_claims > 0) {
      return res.status(400).json({ 
        error: 'Cannot cancel policy with active claims',
        active_claims_count: claimsResults[0].active_claims
      });
    }

    const updateQuery = `
      UPDATE insurance_policies 
      SET policy_status = 'cancelled',
          end_date = COALESCE(?, end_date),
          policy_details = JSON_SET(
            COALESCE(policy_details, '{}'),
            '$.cancellation_reason', ?,
            '$.cancellation_date', COALESCE(?, NOW()),
            '$.cancelled_by', ?
          )
      WHERE policy_number = ?
    `;

    const user_id = req.user ? req.user.id : null;

    db.query(updateQuery, [
      cancellation_date, 
      cancellation_reason, 
      cancellation_date || new Date().toISOString().split('T')[0],
      user_id,
      policy_number
    ], (updateErr, result) => {
      if (updateErr) return res.status(500).json({ error: updateErr.message });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Policy not found' });

      res.json({ 
        message: 'Policy cancelled successfully',
        cancellation_date: cancellation_date || new Date().toISOString().split('T')[0]
      });
    });
  });
};

// Suspend policy
exports.suspendPolicy = (req, res) => {
  const { policy_number } = req.params;
  const { suspension_reason, suspension_date } = req.body;

  const query = `
    UPDATE insurance_policies 
    SET policy_status = 'suspended',
        policy_details = JSON_SET(
          COALESCE(policy_details, '{}'),
          '$.suspension_reason', ?,
          '$.suspension_date', COALESCE(?, NOW()),
          '$.suspended_by', ?
        )
    WHERE policy_number = ? AND policy_status = 'active'
  `;

  const user_id = req.user ? req.user.id : null;

  db.query(query, [
    suspension_reason,
    suspension_date || new Date().toISOString().split('T')[0],
    user_id,
    policy_number
  ], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Policy not found or already suspended' });
    }

    res.json({ message: 'Policy suspended successfully' });
  });
};

// Reactivate policy
exports.reactivatePolicy = (req, res) => {
  const { policy_number } = req.params;

  // Check if policy is expired
  const checkQuery = `
    SELECT policy_status, end_date
    FROM insurance_policies
    WHERE policy_number = ?
  `;

  db.query(checkQuery, [policy_number], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Policy not found' });

    const policy = results[0];
    const today = new Date().toISOString().split('T')[0];

    if (new Date(policy.end_date) < new Date(today)) {
      return res.status(400).json({ 
        error: 'Cannot reactivate expired policy',
        end_date: policy.end_date
      });
    }

    if (policy.policy_status !== 'suspended') {
      return res.status(400).json({ 
        error: 'Policy must be suspended to reactivate',
        current_status: policy.policy_status
      });
    }

    const updateQuery = `
      UPDATE insurance_policies 
      SET policy_status = 'active',
          policy_details = JSON_SET(
            COALESCE(policy_details, '{}'),
            '$.reactivation_date', NOW(),
            '$.reactivated_by', ?
          )
      WHERE policy_number = ?
    `;

    const user_id = req.user ? req.user.id : null;

    db.query(updateQuery, [user_id, policy_number], (updateErr, result) => {
      if (updateErr) return res.status(500).json({ error: updateErr.message });

      res.json({ message: 'Policy reactivated successfully' });
    });
  });
};