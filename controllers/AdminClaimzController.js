const db = require('../config/db');
const emailCoordinator = require('./Email');

// ============================================================================
// ADMIN CLAIMS CONTROLLER
// ============================================================================

// Get all claims with filtering and pagination
exports.getAllClaims = (req, res) => {
  const { 
    status, 
    priority, 
    risk_level, 
    insurance_type,
    insurance_category,
    assigned_to,
    page = 1, 
    limit = 10 
  } = req.query;
  
  let whereConditions = [];
  let queryParams = [];

  // Build dynamic WHERE clause
  if (status) {
    whereConditions.push('c.status = ?');
    queryParams.push(status);
  }
  if (priority) {
    whereConditions.push('c.priority = ?');
    queryParams.push(priority);
  }
  if (risk_level) {
    whereConditions.push('c.risk_level = ?');
    queryParams.push(risk_level);
  }
  if (insurance_type) {
    whereConditions.push('c.insurance_type = ?');
    queryParams.push(insurance_type);
  }
  if (insurance_category) {
    whereConditions.push('c.insurance_category = ?');
    queryParams.push(insurance_category);
  }
  if (assigned_to) {
    whereConditions.push('c.assigned_to = ?');
    queryParams.push(assigned_to);
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const query = `
    SELECT c.*, u.name as user_name, u.email as user_email, u.phone as user_phone,
           admin.name as assigned_admin_name
    FROM claims c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN users admin ON c.assigned_to = admin.id
    ${whereClause}
    ORDER BY 
      CASE c.priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END,
      c.fraud_score DESC, 
      c.created_at DESC
    LIMIT ? OFFSET ?
  `;

  queryParams.push(parseInt(limit), parseInt(offset));

  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM claims c ${whereClause}`;
    const countParams = queryParams.slice(0, -2); // Remove limit and offset

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

// Process claim (approve/reject)
// Process claim (approve/reject)
exports.processClaim = (req, res) => {
  const { id } = req.params;
  const { 
    status, 
    decision_reason, 
    payout_amount, 
    admin_notes 
  } = req.body;
  
  const admin_id = req.user ? req.user.id : req.body.admin_id;
  
  if (!['approved', 'rejected', 'under_review'].includes(status)) {
    return res.status(400).json({ 
      error: 'Status must be approved, rejected, or under_review' 
    });
  }

  // If approving, validate payout_amount
  if (status === 'approved' && !payout_amount) {
    return res.status(400).json({ 
      error: 'Payout amount is required for approved claims' 
    });
  }

  // Handle payout_amount based on status
  let finalPayoutAmount;
  if (status === 'approved') {
    finalPayoutAmount = payout_amount;
  } else {
    // For rejected or under_review claims, set to NULL or 0
    finalPayoutAmount = null; // or use 0 if your DB doesn't allow NULL
  }

  const query = `
    UPDATE claims 
    SET status = ?, decision_reason = ?, payout_amount = ?, admin_notes = ?,
        processed_by = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  db.query(query, [status, decision_reason, finalPayoutAmount, admin_notes, admin_id, id], async (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    // SEND EMAIL NOTIFICATION BASED ON STATUS
    try {
      let emailResult;
      
      if (status === 'approved') {
        emailResult = await emailCoordinator.notifyClaimApproved(id);
      } else if (status === 'rejected') {
        emailResult = await emailCoordinator.notifyClaimRejected(id);
      } else if (status === 'under_review') {
        emailResult = await emailCoordinator.notifyClaimUnderReview(id);
      }
      
      console.log(`Email notification sent for claim ${id}:`, emailResult);
    } catch (emailError) {
      console.error(`Failed to send email for claim ${id}:`, emailError);
      // Don't fail the entire request if email fails
    }
    
    res.json({ 
      message: `Claim ${status} successfully`,
      claim_id: id,
      status: status,
      payout_amount: finalPayoutAmount
    });
  });
};

// Assign claim to admin/adjuster
exports.assignClaim = (req, res) => {
  const { id } = req.params;
  const { assigned_to } = req.body;
  const assigner_id = req.user ? req.user.id : req.body.assigner_id;
  
  if (!assigned_to) {
    return res.status(400).json({ error: 'assigned_to is required' });
  }

  const query = `
    UPDATE claims 
    SET assigned_to = ?, assigned_by = ?, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  db.query(query, [assigned_to, assigner_id, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    res.json({ 
      message: 'Claim assigned successfully',
      claim_id: id,
      assigned_to: assigned_to
    });
  });
};

// Update claim priority
exports.updateClaimPriority = (req, res) => {
  const { id } = req.params;
  const { priority, reason } = req.body;
  const admin_id = req.user ? req.user.id : req.body.admin_id;
  
  if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
    return res.status(400).json({ 
      error: 'Invalid priority level. Must be: low, medium, high, urgent' 
    });
  }

  const query = `
    UPDATE claims 
    SET priority = ?, priority_updated_by = ?, priority_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  db.query(query, [priority, admin_id, reason, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    res.json({ 
      message: 'Claim priority updated successfully',
      claim_id: id,
      new_priority: priority
    });
  });
};

// Delete claim (soft delete)
exports.deleteClaim = (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const admin_id = req.user ? req.user.id : req.body.admin_id;
  
  // Soft delete by updating status to 'deleted'
  const query = `
    UPDATE claims 
    SET status = 'deleted', deleted_by = ?, deletion_reason = ?, 
        deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  db.query(query, [admin_id, reason, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    res.json({ 
      message: 'Claim deleted successfully',
      claim_id: id
    });
  });
};

// Search all claims (admin version with more filters)
exports.searchClaims = (req, res) => {
  const { 
    query: searchQuery, 
    user_id, 
    insurance_type, 
    insurance_category,
    status, 
    priority,
    risk_level,
    date_from,
    date_to,
    assigned_to,
    page = 1, 
    limit = 10 
  } = req.query;
  
  let whereConditions = ['c.status != "deleted"']; // Exclude deleted claims
  let queryParams = [];

  if (searchQuery) {
    whereConditions.push('(c.claim_number LIKE ? OR c.description LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
    queryParams.push(`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`);
  }

  if (user_id) {
    whereConditions.push('c.user_id = ?');
    queryParams.push(user_id);
  }

  if (insurance_type) {
    whereConditions.push('c.insurance_type = ?');
    queryParams.push(insurance_type);
  }

  if (insurance_category) {
    whereConditions.push('c.insurance_category = ?');
    queryParams.push(insurance_category);
  }

  if (status) {
    whereConditions.push('c.status = ?');
    queryParams.push(status);
  }

  if (priority) {
    whereConditions.push('c.priority = ?');
    queryParams.push(priority);
  }

  if (risk_level) {
    whereConditions.push('c.risk_level = ?');
    queryParams.push(risk_level);
  }

  if (assigned_to) {
    whereConditions.push('c.assigned_to = ?');
    queryParams.push(assigned_to);
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
    SELECT c.*, u.name as user_name, u.email as user_email, u.phone as user_phone,
           admin.name as assigned_admin_name
    FROM claims c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN users admin ON c.assigned_to = admin.id
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `;

  queryParams.push(parseInt(limit), parseInt(offset));

  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM claims c JOIN users u ON c.user_id = u.id ${whereClause}`;
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

// Get claims statistics
exports.getClaimsStatistics = (req, res) => {
  const { date_from, date_to, insurance_type } = req.query;
  
  let whereConditions = ['status != "deleted"'];
  let queryParams = [];

  if (date_from) {
    whereConditions.push('created_at >= ?');
    queryParams.push(date_from);
  }

  if (date_to) {
    whereConditions.push('created_at <= ?');
    queryParams.push(date_to);
  }

  if (insurance_type) {
    whereConditions.push('insurance_type = ?');
    queryParams.push(insurance_type);
  }

  const whereClause = 'WHERE ' + whereConditions.join(' AND ');

  const query = `
    SELECT 
      COUNT(*) as total_claims,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_claims,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_claims,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_claims,
      COUNT(CASE WHEN status = 'under_review' THEN 1 END) as under_review_claims,
      SUM(claim_amount) as total_claimed_amount,
      SUM(CASE WHEN status = 'approved' THEN COALESCE(payout_amount, 0) ELSE 0 END) as total_payout,
      AVG(fraud_score) as avg_fraud_score,
      COUNT(CASE WHEN risk_level = 'HIGH' OR risk_level = 'CRITICAL' THEN 1 END) as high_risk_claims,
      COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_claims,
      COUNT(CASE WHEN assigned_to IS NULL THEN 1 END) as unassigned_claims
    FROM claims
    ${whereClause}
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results[0]);
  });
};

// Get fraud detection summary
exports.getFraudSummary = (req, res) => {
  const { insurance_type, date_from, date_to } = req.query;
  
  let whereConditions = ['status != "deleted"'];
  let queryParams = [];

  if (insurance_type) {
    whereConditions.push('insurance_type = ?');
    queryParams.push(insurance_type);
  }

  if (date_from) {
    whereConditions.push('created_at >= ?');
    queryParams.push(date_from);
  }

  if (date_to) {
    whereConditions.push('created_at <= ?');
    queryParams.push(date_to);
  }

  const whereClause = 'WHERE ' + whereConditions.join(' AND ');

  const query = `
    SELECT 
      risk_level,
      COUNT(*) as count,
      AVG(fraud_score) as avg_fraud_score,
      SUM(claim_amount) as total_amount_at_risk,
      AVG(claim_amount) as avg_claim_amount,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
    FROM claims 
    ${whereClause}
    GROUP BY risk_level
    ORDER BY avg_fraud_score DESC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// Get claims by admin (claims assigned to specific admin)
exports.getMyAssignedClaims = (req, res) => {
  const admin_id = req.user ? req.user.id : req.body.admin_id;
  const { status, priority, page = 1, limit = 10 } = req.query;
  
  if (!admin_id) {
    return res.status(400).json({ error: 'Admin ID is required' });
  }

  let whereConditions = ['c.assigned_to = ?', 'c.status != "deleted"'];
  let queryParams = [admin_id];

  if (status) {
    whereConditions.push('c.status = ?');
    queryParams.push(status);
  }

  if (priority) {
    whereConditions.push('c.priority = ?');
    queryParams.push(priority);
  }

  const whereClause = 'WHERE ' + whereConditions.join(' AND ');
  const offset = (page - 1) * limit;

  const query = `
    SELECT c.*, u.name as user_name, u.email as user_email, u.phone as user_phone
    FROM claims c
    JOIN users u ON c.user_id = u.id
    ${whereClause}
    ORDER BY c.priority DESC, c.created_at DESC
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
// ADMIN IDENTITY VERIFICATION FUNCTIONS (SIMPLE VERSION)
// ============================================================================

// Get identification data for a specific claim
// Get identification data for a specific claim
exports.getClaimIdentityData = (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT c.identification_data, c.identification_documents, c.insurance_type,
           u.name as user_name, u.email as user_email
    FROM claims c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `;
  
  db.query(query, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    const claim = results[0];
    
    // Safe JSON parsing function
    const safeJsonParse = (data, defaultValue) => {
      if (!data) return defaultValue;
      if (typeof data === 'object') return data;
      if (typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch (error) {
          console.error('JSON parse error:', error);
          return defaultValue;
        }
      }
      return defaultValue;
    };
    
    res.json({
      claim_id: id,
      user_name: claim.user_name,
      user_email: claim.user_email,
      insurance_type: claim.insurance_type,
      identification_data: safeJsonParse(claim.identification_data, {}),
      identification_documents: safeJsonParse(claim.identification_documents, [])
    });
  });
};

// Verify identity documents - simple approve/reject
exports.verifyIdentity = (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body; // status: 'verified' or 'rejected'
  const admin_id = req.user ? req.user.id : req.body.admin_id;
  
  if (!['verified', 'rejected'].includes(status)) {
    return res.status(400).json({ 
      error: 'Status must be verified or rejected' 
    });
  }
  
  const query = `
    UPDATE claims 
    SET identity_status = ?,
        identity_notes = ?,
        identity_verified_by = ?,
        identity_verified_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.query(query, [status, notes, admin_id, id], async (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    // SEND EMAIL NOTIFICATION FOR IDENTITY VERIFICATION - ADD THIS BLOCK
    try {
      let emailResult;
      
      if (status === 'verified') {
        emailResult = await emailCoordinator.notifyIdentityVerified(id);
      } else if (status === 'rejected') {
        emailResult = await emailCoordinator.notifyIdentityRejected(id);
      }
      
      console.log(`Identity verification email sent for claim ${id}:`, emailResult);
    } catch (emailError) {
      console.error(`Failed to send identity verification email for claim ${id}:`, emailError);
    }
    
    res.json({
      message: `Identity ${status} successfully`,
      claim_id: id,
      status: status
    });
  });
};

// Get all claims that need identity verification
exports.getClaimsNeedingIdentityCheck = (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  
  const query = `
    SELECT c.id, c.claim_number, c.insurance_type, c.claim_amount,
           c.created_at, u.name as user_name, u.email as user_email,
           c.identity_status
    FROM claims c
    JOIN users u ON c.user_id = u.id
    WHERE (c.identity_status IS NULL OR c.identity_status = 'pending')
      AND c.status != 'deleted'
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `;
  
  db.query(query, [parseInt(limit), parseInt(offset)], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM claims c
      WHERE (c.identity_status IS NULL OR c.identity_status = 'pending')
        AND c.status != 'deleted'
    `;
    
    db.query(countQuery, (countErr, countResults) => {
      if (countErr) return res.status(500).json({ error: countErr.message });
      
      res.json({
        claims: results,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(countResults[0].total / limit),
          total_records: countResults[0].total
        }
      });
    });
  });
};

// Simple identity verification statistics
exports.getIdentityStats = (req, res) => {
  const query = `
    SELECT 
      COUNT(*) as total_claims,
      COUNT(CASE WHEN identity_status = 'verified' THEN 1 END) as verified_count,
      COUNT(CASE WHEN identity_status = 'rejected' THEN 1 END) as rejected_count,
      COUNT(CASE WHEN identity_status IS NULL OR identity_status = 'pending' THEN 1 END) as pending_count
    FROM claims
    WHERE status != 'deleted'
  `;
  
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const stats = results[0];
    
    res.json({
      total_claims: stats.total_claims,
      verified: stats.verified_count,
      rejected: stats.rejected_count,
      pending: stats.pending_count,
      verification_rate: stats.total_claims > 0 ? 
        Math.round((stats.verified_count / stats.total_claims) * 100) : 0
    });
  });
};

// Bulk update claims
exports.bulkUpdateClaims = (req, res) => {
  const { claim_ids, updates } = req.body;
  const admin_id = req.user ? req.user.id : req.body.admin_id;
  
  if (!claim_ids || !Array.isArray(claim_ids) || claim_ids.length === 0) {
    return res.status(400).json({ error: 'claim_ids array is required' });
  }

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'updates object is required' });
  }

  // Build dynamic update query
  const allowedFields = ['status', 'priority', 'assigned_to'];
  const updateFields = [];
  const updateValues = [];

  Object.keys(updates).forEach(field => {
    if (allowedFields.includes(field)) {
      updateFields.push(`${field} = ?`);
      updateValues.push(updates[field]);
    }
  });

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updateFields.push('updated_by = ?', 'updated_at = CURRENT_TIMESTAMP');
  updateValues.push(admin_id);

  const placeholders = claim_ids.map(() => '?').join(',');
  const query = `
    UPDATE claims 
    SET ${updateFields.join(', ')}
    WHERE id IN (${placeholders})
  `;

  db.query(query, [...updateValues, ...claim_ids], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    res.json({ 
      message: 'Claims updated successfully',
      updated_count: result.affectedRows,
      claim_ids: claim_ids
    });
  });
};

module.exports = exports;