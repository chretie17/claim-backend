// CONTROLLER FILE (controllers/DashboardController.js) - FIXED VERSION
// ============================================================================
const db = require('../config/db');

// ============================================================================
// ADMIN DASHBOARD CONTROLLER - Simple Dashboard with Graphs
// ============================================================================

// Main Dashboard Overview
exports.getDashboardOverview = (req, res) => {
  const { date_from, date_to } = req.query;
  
  let dateFilter = '';
  let params = [];
  
  if (date_from && date_to) {
    dateFilter = 'AND created_at BETWEEN ? AND ?';
    params = [date_from, date_to];
  } else if (date_from) {
    dateFilter = 'AND created_at >= ?';
    params = [date_from];
  } else if (date_to) {
    dateFilter = 'AND created_at <= ?';
    params = [date_to];
  }

  const query = `
    SELECT 
      -- Basic Counts
      COUNT(*) as total_claims,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_claims,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_claims,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_claims,
      COUNT(CASE WHEN status = 'under_review' THEN 1 END) as under_review_claims,
      
      -- Priority Breakdown
      COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_claims,
      COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_claims,
      COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_claims,
      COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_claims,
      
      -- Financial Data
      COALESCE(SUM(claim_amount), 0) as total_claim_amount,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN COALESCE(payout_amount, 0) ELSE 0 END), 0) as total_payout,
      COALESCE(AVG(claim_amount), 0) as avg_claim_amount,
      
      -- Risk Data
      COUNT(CASE WHEN risk_level = 'HIGH' THEN 1 END) as high_risk_claims,
      COUNT(CASE WHEN risk_level = 'CRITICAL' THEN 1 END) as critical_risk_claims,
      COALESCE(AVG(fraud_score), 0) as avg_fraud_score,
      
      -- Assignment Data
      COUNT(CASE WHEN assigned_to IS NULL THEN 1 END) as unassigned_claims,
      COUNT(DISTINCT assigned_to) as active_admins
      
    FROM claims 
    WHERE status != 'deleted' ${dateFilter}
  `;

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Dashboard Overview Error:', err);
      return res.status(500).json({ error: 'Database query failed', details: err.message });
    }
    
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'No data found' });
    }
    
    const data = results[0];
    
    // Calculate additional metrics with safe division
    const approval_rate = data.total_claims > 0 ? 
      Math.round((data.approved_claims / data.total_claims) * 100) : 0;
    
    const rejection_rate = data.total_claims > 0 ? 
      Math.round((data.rejected_claims / data.total_claims) * 100) : 0;

    res.json({
      overview: {
        total_claims: data.total_claims || 0,
        pending_claims: data.pending_claims || 0,
        approved_claims: data.approved_claims || 0,
        rejected_claims: data.rejected_claims || 0,
        under_review_claims: data.under_review_claims || 0,
        unassigned_claims: data.unassigned_claims || 0,
        active_admins: data.active_admins || 0
      },
      priority_breakdown: {
        urgent: data.urgent_claims || 0,
        high: data.high_claims || 0,
        medium: data.medium_claims || 0,
        low: data.low_claims || 0
      },
      financial: {
        total_claim_amount: parseFloat(data.total_claim_amount || 0),
        total_payout: parseFloat(data.total_payout || 0),
        avg_claim_amount: parseFloat(data.avg_claim_amount || 0),
        savings: parseFloat((data.total_claim_amount || 0) - (data.total_payout || 0))
      },
      risk_analysis: {
        high_risk_claims: data.high_risk_claims || 0,
        critical_risk_claims: data.critical_risk_claims || 0,
        avg_fraud_score: parseFloat(data.avg_fraud_score || 0).toFixed(2)
      },
      rates: {
        approval_rate: approval_rate,
        rejection_rate: rejection_rate,
        pending_rate: Math.max(0, 100 - approval_rate - rejection_rate)
      }
    });
  });
};

// Claims by Status (for pie chart)
exports.getClaimsByStatus = (req, res) => {
  const query = `
    SELECT 
      status,
      COUNT(*) as count,
      ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM claims WHERE status != 'deleted')), 2) as percentage
    FROM claims 
    WHERE status != 'deleted'
    GROUP BY status
    ORDER BY count DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Claims by Status Error:', err);
      return res.status(500).json({ error: 'Failed to fetch claims by status', details: err.message });
    }
    res.json(results || []);
  });
};

// Claims by Insurance Type (for bar chart)
exports.getClaimsByInsuranceType = (req, res) => {
  const query = `
    SELECT 
      COALESCE(insurance_type, 'Unknown') as insurance_type,
      COUNT(*) as total_claims,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COALESCE(SUM(claim_amount), 0) as total_amount,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN COALESCE(payout_amount, 0) ELSE 0 END), 0) as total_payout
    FROM claims 
    WHERE status != 'deleted'
    GROUP BY insurance_type
    ORDER BY total_claims DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Claims by Insurance Type Error:', err);
      return res.status(500).json({ error: 'Failed to fetch claims by insurance type', details: err.message });
    }
    res.json(results || []);
  });
};

// Daily Claims Trend (for line chart)
exports.getDailyClaimsTrend = (req, res) => {
  const { days = 30 } = req.query;
  const daysLimit = Math.min(Math.max(parseInt(days) || 30, 1), 365); // Limit between 1-365 days
  
  const query = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as total_claims,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
      COALESCE(SUM(claim_amount), 0) as daily_amount
    FROM claims 
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      AND status != 'deleted'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
    LIMIT ?
  `;

  db.query(query, [daysLimit, daysLimit], (err, results) => {
    if (err) {
      console.error('Daily Claims Trend Error:', err);
      return res.status(500).json({ error: 'Failed to fetch daily claims trend', details: err.message });
    }
    res.json(results || []);
  });
};

// Monthly Claims Summary (for bar chart)
// Monthly Claims Summary (for bar chart) - FIXED VERSION
exports.getMonthlySummary = (req, res) => {
  const { months = 12 } = req.query;
  const monthsLimit = Math.min(Math.max(parseInt(months) || 12, 1), 24); // Limit between 1-24 months
  
  const query = `
    SELECT 
      DATE_FORMAT(created_at, '%Y-%m') as month,
      DATE_FORMAT(MIN(created_at), '%M %Y') as month_name,
      COUNT(*) as total_claims,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
      COALESCE(SUM(claim_amount), 0) as total_amount,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN COALESCE(payout_amount, 0) ELSE 0 END), 0) as total_payout
    FROM claims 
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      AND status != 'deleted'
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
    ORDER BY month ASC
    LIMIT ?
  `;

  db.query(query, [monthsLimit, monthsLimit], (err, results) => {
    if (err) {
      console.error('Monthly Summary Error:', err);
      return res.status(500).json({ error: 'Failed to fetch monthly summary', details: err.message });
    }
    res.json(results || []);
  });
};

// Risk Level Distribution (for doughnut chart)
exports.getRiskDistribution = (req, res) => {
  const query = `
    SELECT 
      COALESCE(risk_level, 'UNKNOWN') as risk_level,
      COUNT(*) as count,
      COALESCE(AVG(fraud_score), 0) as avg_fraud_score,
      COALESCE(SUM(claim_amount), 0) as total_amount,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count
    FROM claims 
    WHERE status != 'deleted'
    GROUP BY risk_level
    ORDER BY 
      CASE risk_level 
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
        ELSE 5
      END
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Risk Distribution Error:', err);
      return res.status(500).json({ error: 'Failed to fetch risk distribution', details: err.message });
    }
    res.json(results || []);
  });
};

// Top Performing Admins (for leaderboard)
exports.getAdminPerformance = (req, res) => {
  const { limit = 10 } = req.query;
  const limitValue = Math.min(Math.max(parseInt(limit) || 10, 1), 100); // Limit between 1-100
  
  const query = `
    SELECT 
      u.name as admin_name,
      u.email as admin_email,
      COUNT(c.id) as total_processed,
      COUNT(CASE WHEN c.status = 'approved' THEN 1 END) as approved,
      COUNT(CASE WHEN c.status = 'rejected' THEN 1 END) as rejected,
      COALESCE(AVG(TIMESTAMPDIFF(HOUR, c.created_at, c.processed_at)), 0) as avg_processing_hours,
      COALESCE(SUM(CASE WHEN c.status = 'approved' THEN COALESCE(c.payout_amount, 0) ELSE 0 END), 0) as total_payouts
    FROM claims c
    JOIN users u ON c.processed_by = u.id
    WHERE c.processed_at IS NOT NULL
      AND c.status IN ('approved', 'rejected')
      AND c.processed_by IS NOT NULL
    GROUP BY c.processed_by, u.name, u.email
    HAVING total_processed > 0
    ORDER BY total_processed DESC
    LIMIT ?
  `;

  db.query(query, [limitValue], (err, results) => {
    if (err) {
      console.error('Admin Performance Error:', err);
      return res.status(500).json({ error: 'Failed to fetch admin performance', details: err.message });
    }
    res.json(results || []);
  });
};

// Recent Activity Feed
exports.getRecentActivity = (req, res) => {
  const { limit = 20 } = req.query;
  const limitValue = Math.min(Math.max(parseInt(limit) || 20, 1), 100); // Limit between 1-100
  
  const query = `
    SELECT 
      c.id as claim_id,
      c.claim_number,
      c.status,
      c.priority,
      COALESCE(c.claim_amount, 0) as claim_amount,
      c.updated_at,
      u.name as user_name,
      admin.name as admin_name,
      CASE 
        WHEN c.processed_at IS NOT NULL THEN 'processed'
        WHEN c.created_at IS NOT NULL THEN 'assigned'
        ELSE 'created'
      END as activity_type
    FROM claims c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN users admin ON c.processed_by = admin.id
    WHERE c.status != 'deleted'
    ORDER BY c.updated_at DESC
    LIMIT ?
  `;

  db.query(query, [limitValue], (err, results) => {
    if (err) {
      console.error('Recent Activity Error:', err);
      return res.status(500).json({ error: 'Failed to fetch recent activity', details: err.message });
    }
    res.json(results || []);
  });
};

// Quick Stats for Cards - FIXED VERSION
exports.getQuickStats = (req, res) => {
  // Use Promise-based approach for better error handling
  const executeQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
      db.query(query, params, (err, results) => {
        if (err) reject(err);
        else resolve(results[0] || {});
      });
    });
  };

  const queries = {
    // Today's stats
    today: `
      SELECT 
        COUNT(*) as new_claims_today,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_today,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN COALESCE(payout_amount, 0) ELSE 0 END), 0) as payouts_today
      FROM claims 
      WHERE DATE(created_at) = CURDATE() AND status != 'deleted'
    `,
    
    // Pending urgent claims
    urgent: `
      SELECT COUNT(*) as urgent_pending
      FROM claims 
      WHERE priority = 'urgent' AND status = 'pending'
    `,
    
    // Average processing time
    processing: `
      SELECT COALESCE(AVG(TIMESTAMPDIFF(HOUR, created_at, processed_at)), 0) as avg_processing_hours
      FROM claims 
      WHERE processed_at IS NOT NULL 
        AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND status != 'deleted'
    `
  };

  // Execute all queries using Promise.all for better error handling
  Promise.all([
    executeQuery(queries.today),
    executeQuery(queries.urgent),
    executeQuery(queries.processing)
  ]).then(([todayResult, urgentResult, processingResult]) => {
    res.json({
      today: {
        new_claims: todayResult.new_claims_today || 0,
        approved: todayResult.approved_today || 0,
        payouts: parseFloat(todayResult.payouts_today || 0)
      },
      urgent_pending: urgentResult.urgent_pending || 0,
      avg_processing_hours: parseFloat(processingResult.avg_processing_hours || 0).toFixed(1)
    });
  }).catch(err => {
    console.error('Quick Stats Error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch quick stats', 
      details: err.message,
      // Provide fallback data
      today: { new_claims: 0, approved: 0, payouts: 0 },
      urgent_pending: 0,
      avg_processing_hours: '0.0'
    });
  });
};

// System Health Check - IMPROVED VERSION
exports.getSystemHealth = (req, res) => {
  const query = `
    SELECT 
      COUNT(*) as total_active_claims,
      COUNT(CASE WHEN assigned_to IS NULL THEN 1 END) as unassigned_claims,
      COUNT(CASE WHEN priority = 'urgent' AND status = 'pending' THEN 1 END) as urgent_backlog,
      COUNT(CASE WHEN created_at < DATE_SUB(NOW(), INTERVAL 48 HOUR) AND status = 'pending' THEN 1 END) as overdue_claims,
      COUNT(CASE WHEN identity_status IS NULL OR identity_status = 'pending' THEN 1 END) as identity_pending
    FROM claims 
    WHERE status NOT IN ('deleted', 'approved', 'rejected')
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('System Health Error:', err);
      return res.status(500).json({ 
        error: 'Failed to fetch system health', 
        details: err.message,
        // Provide fallback health data
        status: 'unknown',
        total_active_claims: 0,
        unassigned_claims: 0,
        urgent_backlog: 0,
        overdue_claims: 0,
        identity_pending: 0,
        issues: ['Unable to fetch system health data']
      });
    }
    
    const data = results[0] || {};
    
    // Determine system health status
    let health_status = 'good';
    const issues = [];
    
    if ((data.urgent_backlog || 0) > 5) {
      health_status = 'warning';
      issues.push(`${data.urgent_backlog} urgent claims pending`);
    }
    
    if ((data.overdue_claims || 0) > 10) {
      health_status = 'critical';
      issues.push(`${data.overdue_claims} claims overdue (>48h)`);
    }
    
    const unassignedRatio = (data.total_active_claims || 0) > 0 ? 
      (data.unassigned_claims || 0) / (data.total_active_claims || 1) : 0;
    
    if (unassignedRatio > 0.3) {
      health_status = 'warning';
      issues.push(`${data.unassigned_claims} unassigned claims`);
    }

    res.json({
      status: health_status,
      total_active_claims: data.total_active_claims || 0,
      unassigned_claims: data.unassigned_claims || 0,
      urgent_backlog: data.urgent_backlog || 0,
      overdue_claims: data.overdue_claims || 0,
      identity_pending: data.identity_pending || 0,
      issues: issues
    });
  });
};