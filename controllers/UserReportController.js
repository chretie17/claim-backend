const db = require('../config/db');

// ============================================================================
// INDIVIDUAL USER REPORT CONTROLLER
// ============================================================================

// Get all users with basic claims info for admin to choose from
exports.getAllUsersForSelection = (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  
  let whereConditions = [];
  let queryParams = [];
  
  if (search) {
    whereConditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  
  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  const offset = (page - 1) * limit;
  
  const query = `
    SELECT 
      u.id,
      u.name,
      u.email,
      u.phone,
      u.created_at as registration_date,
      COUNT(c.id) as total_claims,
      COUNT(CASE WHEN c.status = 'approved' THEN 1 END) as approved_claims,
      COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as pending_claims,
      SUM(c.claim_amount) as total_claimed,
      SUM(CASE WHEN c.status = 'approved' THEN COALESCE(c.payout_amount, 0) ELSE 0 END) as total_received,
      AVG(c.fraud_score) as avg_fraud_score,
      MAX(c.created_at) as last_claim_date
    FROM users u
    LEFT JOIN claims c ON u.id = c.user_id AND c.status != 'deleted'
    ${whereClause}
    GROUP BY u.id, u.name, u.email, u.phone, u.created_at
    ORDER BY total_claims DESC, last_claim_date DESC
    LIMIT ? OFFSET ?
  `;
  
  queryParams.push(parseInt(limit), parseInt(offset));
  
  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Get total count for pagination
    const countQuery = `SELECT COUNT(DISTINCT u.id) as total FROM users u ${whereClause}`;
    const countParams = queryParams.slice(0, -2);
    
    db.query(countQuery, countParams, (countErr, countResults) => {
      if (countErr) return res.status(500).json({ error: countErr.message });
      
      // Add calculated fields
      const usersWithMetrics = results.map(user => ({
        ...user,
        approval_rate: user.total_claims > 0 ? Math.round((user.approved_claims / user.total_claims) * 100) : 0,
        risk_level: user.avg_fraud_score > 70 ? 'HIGH' : 
                   user.avg_fraud_score > 40 ? 'MEDIUM' : 'LOW',
        has_claims: user.total_claims > 0
      }));
      
      res.json({
        users: usersWithMetrics,
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

// Get comprehensive report for a specific user
exports.getUserReport = (req, res) => {
  const { user_id } = req.params;
  
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // First, get user basic info and claims summary
  const summaryQuery = `
    SELECT 
      u.id as user_id,
      u.name as user_name,
      u.email as user_email,
      u.phone as user_phone,
      u.created_at as registration_date,
      
      COUNT(c.id) as total_claims,
      COUNT(CASE WHEN c.status = 'approved' THEN 1 END) as approved_claims,
      COUNT(CASE WHEN c.status = 'rejected' THEN 1 END) as rejected_claims,
      COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as pending_claims,
      
      SUM(c.claim_amount) as total_claimed,
      SUM(CASE WHEN c.status = 'approved' THEN COALESCE(c.payout_amount, 0) ELSE 0 END) as total_received,
      AVG(c.fraud_score) as average_fraud_score,
      
      MIN(c.created_at) as first_claim_date,
      MAX(c.created_at) as last_claim_date
      
    FROM users u
    LEFT JOIN claims c ON u.id = c.user_id AND c.status != 'deleted'
    WHERE u.id = ?
    GROUP BY u.id, u.name, u.email, u.phone, u.created_at
  `;
  
  db.query(summaryQuery, [user_id], (err, summaryResults) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (summaryResults.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userSummary = summaryResults[0];
    
    // Get all user's claims details
    const claimsQuery = `
      SELECT 
        c.id,
        c.claim_number,
        c.created_at,
        c.insurance_type,
        c.insurance_category,
        c.claim_amount,
        c.status,
        c.priority,
        c.risk_level,
        c.fraud_score,
        c.payout_amount,
        c.description,
        c.processed_at,
        c.identity_status,
        COALESCE(admin.name, 'Unassigned') as assigned_to,
        COALESCE(processor.name, 'Not Processed') as processed_by
      FROM claims c
      LEFT JOIN users admin ON c.assigned_to = admin.id
      LEFT JOIN users processor ON c.processed_by = processor.id
      WHERE c.user_id = ? AND c.status != 'deleted'
      ORDER BY c.created_at DESC
    `;
    
    db.query(claimsQuery, [user_id], (claimsErr, claimsResults) => {
      if (claimsErr) return res.status(500).json({ error: claimsErr.message });
      
      // Get claims by insurance type breakdown
      const typeQuery = `
        SELECT 
          c.insurance_type,
          COUNT(*) as count,
          SUM(c.claim_amount) as total_amount,
          SUM(CASE WHEN c.status = 'approved' THEN COALESCE(c.payout_amount, 0) ELSE 0 END) as total_payout,
          AVG(c.fraud_score) as avg_fraud_score
        FROM claims c
        WHERE c.user_id = ? AND c.status != 'deleted'
        GROUP BY c.insurance_type
        ORDER BY count DESC
      `;
      
      db.query(typeQuery, [user_id], (typeErr, typeResults) => {
        if (typeErr) return res.status(500).json({ error: typeErr.message });
        
        // Calculate metrics
        const approvalRate = userSummary.total_claims > 0 ? 
          Math.round((userSummary.approved_claims / userSummary.total_claims) * 100) : 0;
        
        const payoutRatio = userSummary.total_claimed > 0 ? 
          Math.round((userSummary.total_received / userSummary.total_claimed) * 100) : 0;
        
        const riskLevel = userSummary.average_fraud_score > 70 ? 'HIGH' :
                         userSummary.average_fraud_score > 40 ? 'MEDIUM' : 'LOW';
        
        res.json({
          report_type: 'individual_user',
          user_profile: {
            user_id: userSummary.user_id,
            name: userSummary.user_name,
            email: userSummary.user_email,
            phone: userSummary.user_phone,
            registration_date: userSummary.registration_date,
            first_claim_date: userSummary.first_claim_date,
            last_claim_date: userSummary.last_claim_date
          },
          claims_summary: {
            total_claims: userSummary.total_claims,
            approved_claims: userSummary.approved_claims,
            rejected_claims: userSummary.rejected_claims,
            pending_claims: userSummary.pending_claims,
            approval_rate: approvalRate,
            total_claimed: userSummary.total_claimed,
            total_received: userSummary.total_received,
            payout_ratio: payoutRatio,
            average_fraud_score: Math.round(userSummary.average_fraud_score || 0),
            risk_level: riskLevel
          },
          claims_by_type: typeResults,
          recent_claims: claimsResults,
          generated_at: new Date().toISOString()
        });
      });
    });
  });
};

// Get user's claims timeline (simplified)
exports.getUserClaimsTimeline = (req, res) => {
  const { user_id } = req.params;
  
  const query = `
    SELECT 
      c.id,
      c.claim_number,
      c.created_at,
      c.insurance_type,
      c.claim_amount,
      c.status,
      c.fraud_score,
      c.processed_at
    FROM claims c
    WHERE c.user_id = ? AND c.status != 'deleted'
    ORDER BY c.created_at ASC
  `;
  
  db.query(query, [user_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    res.json({
      user_id: user_id,
      timeline: results,
      total_claims: results.length
    });
  });
};

// Export user report as CSV
exports.exportUserReportCSV = (req, res) => {
  const { user_id } = req.params;
  
  const query = `
    SELECT 
      c.claim_number,
      c.created_at as claim_date,
      c.insurance_type,
      c.insurance_category,
      c.claim_amount,
      c.status,
      c.priority,
      c.fraud_score,
      c.payout_amount,
      c.processed_at,
      c.identity_status
    FROM claims c
    WHERE c.user_id = ? AND c.status != 'deleted'
    ORDER BY c.created_at DESC
  `;
  
  db.query(query, [user_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'No claims found for this user' });
    }
    
    // Convert to CSV
    const headers = Object.keys(results[0]);
    const csvContent = [
      headers.join(','),
      ...results.map(row => 
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        }).join(',')
      )
    ].join('\n');
    
    const filename = `user_${user_id}_claims_report.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  });
};

module.exports = exports;