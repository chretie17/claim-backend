const db = require('../config/db');

// ============================================================================
// INSURANCE CLAIMS REPORTS CONTROLLER
// ============================================================================

// Overview Report - Main dashboard statistics
exports.getOverviewReport = (req, res) => {
  const { date_from, date_to, insurance_type, status } = req.query;
  
  let whereConditions = ["c.status != 'deleted'"];
  let queryParams = [];
  
  // Add date filters
  if (date_from) {
    whereConditions.push('c.created_at >= ?');
    queryParams.push(date_from);
  }
  
  if (date_to) {
    whereConditions.push('c.created_at <= ?');
    queryParams.push(date_to + ' 23:59:59');
  }
  
  if (insurance_type && insurance_type !== 'all') {
    whereConditions.push('c.insurance_type = ?');
    queryParams.push(insurance_type);
  }
  
  if (status && status !== 'all') {
    whereConditions.push('c.status = ?');
    queryParams.push(status);
  }
  
  const whereClause = 'WHERE ' + whereConditions.join(' AND ');
  
  const query = `
    SELECT 
      COUNT(*) as total_claims,
      COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as pending_claims,
      COUNT(CASE WHEN c.status = 'approved' THEN 1 END) as approved_claims,
      COUNT(CASE WHEN c.status = 'rejected' THEN 1 END) as rejected_claims,
      COUNT(CASE WHEN c.status = 'under_review' THEN 1 END) as under_review_claims,
      
      SUM(c.claim_amount) as total_claimed_amount,
      AVG(c.claim_amount) as average_claim_amount,
      SUM(CASE WHEN c.status = 'approved' THEN COALESCE(c.payout_amount, 0) ELSE 0 END) as total_payout,
      
      COUNT(CASE WHEN c.priority = 'urgent' THEN 1 END) as urgent_claims,
      COUNT(CASE WHEN c.priority = 'high' THEN 1 END) as high_priority_claims,
      
      COUNT(CASE WHEN c.risk_level = 'CRITICAL' THEN 1 END) as critical_risk_claims,
      COUNT(CASE WHEN c.risk_level = 'HIGH' THEN 1 END) as high_risk_claims,
      AVG(c.fraud_score) as average_fraud_score,
      
      COUNT(CASE WHEN c.assigned_to IS NULL THEN 1 END) as unassigned_claims,
      COUNT(DISTINCT c.user_id) as unique_customers
    FROM claims c
    ${whereClause}
  `;
  
  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const overview = results[0];
    
    // Calculate additional metrics
    const approval_rate = overview.total_claims > 0 ? 
      Math.round((overview.approved_claims / overview.total_claims) * 100) : 0;
    
    const rejection_rate = overview.total_claims > 0 ? 
      Math.round((overview.rejected_claims / overview.total_claims) * 100) : 0;
    
    const payout_ratio = overview.total_claimed_amount > 0 ? 
      Math.round((overview.total_payout / overview.total_claimed_amount) * 100) : 0;
    
    res.json({
      report_type: 'overview',
      date_range: { from: date_from, to: date_to },
      filters: { insurance_type, status },
      summary: {
        ...overview,
        approval_rate,
        rejection_rate,
        payout_ratio
      },
      generated_at: new Date().toISOString()
    });
  });
};

// Claims by Insurance Type Report
exports.getClaimsByTypeReport = (req, res) => {
  const { date_from, date_to, status } = req.query;
  
  let whereConditions = ["c.status != 'deleted'"];
  let queryParams = [];
  
  if (date_from) {
    whereConditions.push('c.created_at >= ?');
    queryParams.push(date_from);
  }
  
  if (date_to) {
    whereConditions.push('c.created_at <= ?');
    queryParams.push(date_to + ' 23:59:59');
  }
  
  if (status && status !== 'all') {
    whereConditions.push('c.status = ?');
    queryParams.push(status);
  }
  
  const whereClause = 'WHERE ' + whereConditions.join(' AND ');
  
  const query = `
    SELECT 
      c.insurance_type,
      c.insurance_category,
      COUNT(*) as total_claims,
      COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as pending_claims,
      COUNT(CASE WHEN c.status = 'approved' THEN 1 END) as approved_claims,
      COUNT(CASE WHEN c.status = 'rejected' THEN 1 END) as rejected_claims,
      SUM(c.claim_amount) as total_claimed,
      AVG(c.claim_amount) as average_amount,
      SUM(CASE WHEN c.status = 'approved' THEN COALESCE(c.payout_amount, 0) ELSE 0 END) as total_payout,
      AVG(c.fraud_score) as average_fraud_score,
      COUNT(CASE WHEN c.risk_level IN ('HIGH', 'CRITICAL') THEN 1 END) as high_risk_claims
    FROM claims c
    ${whereClause}
    GROUP BY c.insurance_type, c.insurance_category
    ORDER BY c.insurance_type, total_claims DESC
  `;
  
  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Group by insurance type
    const groupedData = results.reduce((acc, row) => {
      if (!acc[row.insurance_type]) {
        acc[row.insurance_type] = {
          insurance_type: row.insurance_type,
          categories: [],
          totals: {
            total_claims: 0,
            total_claimed: 0,
            total_payout: 0,
            approved_claims: 0,
            rejected_claims: 0
          }
        };
      }
      
      acc[row.insurance_type].categories.push({
        category: row.insurance_category,
        total_claims: row.total_claims,
        pending_claims: row.pending_claims,
        approved_claims: row.approved_claims,
        rejected_claims: row.rejected_claims,
        total_claimed: row.total_claimed,
        average_amount: row.average_amount,
        total_payout: row.total_payout,
        average_fraud_score: row.average_fraud_score,
        high_risk_claims: row.high_risk_claims,
        approval_rate: row.total_claims > 0 ? Math.round((row.approved_claims / row.total_claims) * 100) : 0
      });
      
      // Update totals
      acc[row.insurance_type].totals.total_claims += row.total_claims;
      acc[row.insurance_type].totals.total_claimed += row.total_claimed;
      acc[row.insurance_type].totals.total_payout += row.total_payout;
      acc[row.insurance_type].totals.approved_claims += row.approved_claims;
      acc[row.insurance_type].totals.rejected_claims += row.rejected_claims;
      
      return acc;
    }, {});
    
    res.json({
      report_type: 'claims_by_type',
      date_range: { from: date_from, to: date_to },
      filters: { status },
      data: Object.values(groupedData),
      generated_at: new Date().toISOString()
    });
  });
};

// Fraud Analysis Report
exports.getFraudAnalysisReport = (req, res) => {
  const { date_from, date_to, insurance_type } = req.query;
  
  let whereConditions = ["c.status != 'deleted'"];
  let queryParams = [];
  
  if (date_from) {
    whereConditions.push('c.created_at >= ?');
    queryParams.push(date_from);
  }
  
  if (date_to) {
    whereConditions.push('c.created_at <= ?');
    queryParams.push(date_to + ' 23:59:59');
  }
  
  if (insurance_type && insurance_type !== 'all') {
    whereConditions.push('c.insurance_type = ?');
    queryParams.push(insurance_type);
  }
  
  const whereClause = 'WHERE ' + whereConditions.join(' AND ');
  
  const query = `
    SELECT 
      c.risk_level,
      c.insurance_type,
      COUNT(*) as claim_count,
      AVG(c.fraud_score) as avg_fraud_score,
      MIN(c.fraud_score) as min_fraud_score,
      MAX(c.fraud_score) as max_fraud_score,
      SUM(c.claim_amount) as total_amount_at_risk,
      AVG(c.claim_amount) as avg_claim_amount,
      COUNT(CASE WHEN c.status = 'approved' THEN 1 END) as approved_count,
      COUNT(CASE WHEN c.status = 'rejected' THEN 1 END) as rejected_count,
      SUM(CASE WHEN c.status = 'approved' THEN COALESCE(c.payout_amount, 0) ELSE 0 END) as total_payout
    FROM claims c
    ${whereClause}
    GROUP BY c.risk_level, c.insurance_type
    ORDER BY 
      CASE c.risk_level 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3 
        WHEN 'LOW' THEN 4 
      END,
      c.insurance_type
  `;
  
  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Get fraud score distribution
    const distributionQuery = `
      SELECT 
        CASE 
          WHEN c.fraud_score >= 80 THEN '80-100'
          WHEN c.fraud_score >= 60 THEN '60-79'
          WHEN c.fraud_score >= 40 THEN '40-59'
          WHEN c.fraud_score >= 20 THEN '20-39'
          ELSE '0-19'
        END as score_range,
        COUNT(*) as count,
        AVG(c.claim_amount) as avg_amount
      FROM claims c
      ${whereClause}
      GROUP BY score_range
      ORDER BY score_range DESC
    `;
    
    db.query(distributionQuery, queryParams, (distErr, distResults) => {
      if (distErr) return res.status(500).json({ error: distErr.message });
      
      res.json({
        report_type: 'fraud_analysis',
        date_range: { from: date_from, to: date_to },
        filters: { insurance_type },
        risk_analysis: results,
        score_distribution: distResults,
        generated_at: new Date().toISOString()
      });
    });
  });
};

// Financial Report
exports.getFinancialReport = (req, res) => {
  const { date_from, date_to, insurance_type } = req.query;
  
  let whereConditions = ["c.status != 'deleted'"];
  let queryParams = [];
  
  if (date_from) {
    whereConditions.push('c.created_at >= ?');
    queryParams.push(date_from);
  }
  
  if (date_to) {
    whereConditions.push('c.created_at <= ?');
    queryParams.push(date_to + ' 23:59:59');
  }
  
  if (insurance_type && insurance_type !== 'all') {
    whereConditions.push('c.insurance_type = ?');
    queryParams.push(insurance_type);
  }
  
  const whereClause = 'WHERE ' + whereConditions.join(' AND ');
  
  const query = `
    SELECT 
      c.insurance_type,
      COUNT(*) as total_claims,
      SUM(c.claim_amount) as total_claimed,
      SUM(CASE WHEN c.status = 'approved' THEN COALESCE(c.payout_amount, 0) ELSE 0 END) as total_payout,
      SUM(CASE WHEN c.status = 'approved' THEN c.claim_amount ELSE 0 END) as approved_claimed_amount,
      AVG(CASE WHEN c.status = 'approved' THEN c.payout_amount ELSE NULL END) as avg_payout,
      MIN(CASE WHEN c.status = 'approved' THEN c.payout_amount ELSE NULL END) as min_payout,
      MAX(CASE WHEN c.status = 'approved' THEN c.payout_amount ELSE NULL END) as max_payout,
      COUNT(CASE WHEN c.status = 'approved' THEN 1 END) as approved_claims,
      COUNT(CASE WHEN c.status = 'rejected' THEN 1 END) as rejected_claims,
      SUM(CASE WHEN c.status = 'rejected' THEN c.claim_amount ELSE 0 END) as rejected_amount_saved
    FROM claims c
    ${whereClause}
    GROUP BY c.insurance_type
    ORDER BY total_payout DESC
  `;
  
  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Calculate financial metrics
    const financialData = results.map(row => ({
      ...row,
      payout_ratio: row.total_claimed > 0 ? Math.round((row.total_payout / row.total_claimed) * 100) : 0,
      approval_rate: row.total_claims > 0 ? Math.round((row.approved_claims / row.total_claims) * 100) : 0,
      savings_from_rejections: row.rejected_amount_saved
    }));
    
    // Get monthly breakdown
    const monthlyQuery = `
      SELECT 
        YEAR(c.created_at) as year,
        MONTH(c.created_at) as month,
        COUNT(*) as claims_count,
        SUM(c.claim_amount) as monthly_claimed,
        SUM(CASE WHEN c.status = 'approved' THEN COALESCE(c.payout_amount, 0) ELSE 0 END) as monthly_payout
      FROM claims c
      ${whereClause}
      GROUP BY YEAR(c.created_at), MONTH(c.created_at)
      ORDER BY year, month
    `;
    
    db.query(monthlyQuery, queryParams, (monthlyErr, monthlyResults) => {
      if (monthlyErr) return res.status(500).json({ error: monthlyErr.message });
      
      res.json({
        report_type: 'financial',
        date_range: { from: date_from, to: date_to },
        filters: { insurance_type },
        by_insurance_type: financialData,
        monthly_breakdown: monthlyResults,
        totals: {
          total_claimed: financialData.reduce((sum, row) => sum + row.total_claimed, 0),
          total_payout: financialData.reduce((sum, row) => sum + row.total_payout, 0),
          total_saved: financialData.reduce((sum, row) => sum + row.rejected_amount_saved, 0)
        },
        generated_at: new Date().toISOString()
      });
    });
  });
};

// Performance Report
exports.getPerformanceReport = (req, res) => {
  const { date_from, date_to } = req.query;
  
  let whereConditions = ["c.status != 'deleted'"];
  let queryParams = [];
  
  if (date_from) {
    whereConditions.push('c.created_at >= ?');
    queryParams.push(date_from);
  }
  
  if (date_to) {
    whereConditions.push('c.created_at <= ?');
    queryParams.push(date_to + ' 23:59:59');
  }
  
  const whereClause = 'WHERE ' + whereConditions.join(' AND ');
  
  // Processing time analysis
  const processingQuery = `
    SELECT 
      c.priority,
      c.status,
      COUNT(*) as claim_count,
      AVG(CASE WHEN c.processed_at IS NOT NULL AND c.created_at IS NOT NULL 
          THEN DATEDIFF(c.processed_at, c.created_at) ELSE NULL END) as avg_processing_days,
      MIN(CASE WHEN c.processed_at IS NOT NULL AND c.created_at IS NOT NULL 
          THEN DATEDIFF(c.processed_at, c.created_at) ELSE NULL END) as min_processing_days,
      MAX(CASE WHEN c.processed_at IS NOT NULL AND c.created_at IS NOT NULL 
          THEN DATEDIFF(c.processed_at, c.created_at) ELSE NULL END) as max_processing_days
    FROM claims c
    ${whereClause} AND c.processed_at IS NOT NULL
    GROUP BY c.priority, c.status
    ORDER BY 
      CASE c.priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END,
      c.status
  `;
  
  db.query(processingQuery, queryParams, (err, processingResults) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Admin workload analysis
    const workloadQuery = `
      SELECT 
        COALESCE(u.name, 'Unassigned') as admin_name,
        COUNT(*) as assigned_claims,
        COUNT(CASE WHEN c.status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN c.status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN c.status IN ('pending', 'under_review') THEN 1 END) as pending_count,
        AVG(CASE WHEN c.processed_at IS NOT NULL AND c.created_at IS NOT NULL 
            THEN DATEDIFF(c.processed_at, c.created_at) ELSE NULL END) as avg_processing_time
      FROM claims c
      LEFT JOIN users u ON c.assigned_to = u.id
      ${whereClause}
      GROUP BY c.assigned_to, u.name
      ORDER BY assigned_claims DESC
    `;
    
    db.query(workloadQuery, queryParams, (workloadErr, workloadResults) => {
      if (workloadErr) return res.status(500).json({ error: workloadErr.message });
      
      // Daily activity analysis
      const dailyQuery = `
        SELECT 
          DATE(c.created_at) as claim_date,
          COUNT(*) as claims_submitted,
          COUNT(CASE WHEN c.processed_at IS NOT NULL THEN 1 END) as claims_processed
        FROM claims c
        ${whereClause}
        GROUP BY DATE(c.created_at)
        ORDER BY claim_date DESC
        LIMIT 30
      `;
      
      db.query(dailyQuery, queryParams, (dailyErr, dailyResults) => {
        if (dailyErr) return res.status(500).json({ error: dailyErr.message });
        
        res.json({
          report_type: 'performance',
          date_range: { from: date_from, to: date_to },
          processing_times: processingResults,
          admin_workload: workloadResults,
          daily_activity: dailyResults,
          generated_at: new Date().toISOString()
        });
      });
    });
  });
};

// Customer Analysis Report
exports.getCustomerAnalysisReport = (req, res) => {
  const { date_from, date_to, insurance_type } = req.query;
  
  let whereConditions = ["c.status != 'deleted'"];
  let queryParams = [];
  
  if (date_from) {
    whereConditions.push('c.created_at >= ?');
    queryParams.push(date_from);
  }
  
  if (date_to) {
    whereConditions.push('c.created_at <= ?');
    queryParams.push(date_to + ' 23:59:59');
  }
  
  if (insurance_type && insurance_type !== 'all') {
    whereConditions.push('c.insurance_type = ?');
    queryParams.push(insurance_type);
  }
  
  const whereClause = 'WHERE ' + whereConditions.join(' AND ');
  
  const query = `
    SELECT 
      u.name as customer_name,
      u.email as customer_email,
      COUNT(c.id) as total_claims,
      SUM(c.claim_amount) as total_claimed,
      SUM(CASE WHEN c.status = 'approved' THEN COALESCE(c.payout_amount, 0) ELSE 0 END) as total_received,
      COUNT(CASE WHEN c.status = 'approved' THEN 1 END) as approved_claims,
      COUNT(CASE WHEN c.status = 'rejected' THEN 1 END) as rejected_claims,
      AVG(c.fraud_score) as avg_fraud_score,
      MAX(c.fraud_score) as max_fraud_score,
      COUNT(CASE WHEN c.risk_level IN ('HIGH', 'CRITICAL') THEN 1 END) as high_risk_claims,
      MIN(c.created_at) as first_claim_date,
      MAX(c.created_at) as last_claim_date
    FROM claims c
    JOIN users u ON c.user_id = u.id
    ${whereClause}
    GROUP BY u.id, u.name, u.email
    HAVING total_claims > 0
    ORDER BY total_claims DESC, avg_fraud_score DESC
    LIMIT 100
  `;
  
  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Calculate customer metrics
    const customerData = results.map(row => ({
      ...row,
      approval_rate: row.total_claims > 0 ? Math.round((row.approved_claims / row.total_claims) * 100) : 0,
      payout_ratio: row.total_claimed > 0 ? Math.round((row.total_received / row.total_claimed) * 100) : 0,
      risk_level: row.avg_fraud_score > 70 ? 'HIGH' : 
                 row.avg_fraud_score > 40 ? 'MEDIUM' : 'LOW',
      customer_lifetime: row.first_claim_date && row.last_claim_date ? 
                        Math.ceil((new Date(row.last_claim_date) - new Date(row.first_claim_date)) / (1000 * 60 * 60 * 24)) : 0
    }));
    
    // Get frequency analysis
    const frequencyQuery = `
      SELECT 
        CASE 
          WHEN claim_count = 1 THEN '1 claim'
          WHEN claim_count BETWEEN 2 AND 3 THEN '2-3 claims'
          WHEN claim_count BETWEEN 4 AND 5 THEN '4-5 claims'
          ELSE '6+ claims'
        END as frequency_group,
        COUNT(*) as customer_count,
        AVG(avg_fraud_score) as group_avg_fraud_score
      FROM (
        SELECT 
          c.user_id,
          COUNT(c.id) as claim_count,
          AVG(c.fraud_score) as avg_fraud_score
        FROM claims c
        ${whereClause}
        GROUP BY c.user_id
      ) customer_stats
      GROUP BY frequency_group
      ORDER BY customer_count DESC
    `;
    
    db.query(frequencyQuery, queryParams, (freqErr, freqResults) => {
      if (freqErr) return res.status(500).json({ error: freqErr.message });
      
      res.json({
        report_type: 'customer_analysis',
        date_range: { from: date_from, to: date_to },
        filters: { insurance_type },
        top_customers: customerData,
        frequency_analysis: freqResults,
        summary: {
          total_unique_customers: customerData.length,
          high_risk_customers: customerData.filter(c => c.risk_level === 'HIGH').length,
          frequent_claimers: customerData.filter(c => c.total_claims >= 4).length
        },
        generated_at: new Date().toISOString()
      });
    });
  });
};

// Comprehensive Report - All data combined
exports.getComprehensiveReport = async (req, res) => {
  try {
    // Get all report data concurrently
    const reportPromises = [
      new Promise((resolve, reject) => {
        exports.getOverviewReport({ query: req.query }, {
          json: resolve,
          status: () => ({ json: reject })
        });
      }),
      new Promise((resolve, reject) => {
        exports.getClaimsByTypeReport({ query: req.query }, {
          json: resolve,
          status: () => ({ json: reject })
        });
      }),
      new Promise((resolve, reject) => {
        exports.getFraudAnalysisReport({ query: req.query }, {
          json: resolve,
          status: () => ({ json: reject })
        });
      }),
      new Promise((resolve, reject) => {
        exports.getFinancialReport({ query: req.query }, {
          json: resolve,
          status: () => ({ json: reject })
        });
      })
    ];
    
    const [overview, claimsByType, fraudAnalysis, financial] = await Promise.all(reportPromises);
    
    res.json({
      report_type: 'comprehensive',
      date_range: { from: req.query.date_from, to: req.query.date_to },
      filters: req.query,
      overview: overview.summary,
      claims_by_type: claimsByType.data,
      fraud_analysis: fraudAnalysis.risk_analysis,
      financial_summary: financial.by_insurance_type,
      generated_at: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to generate comprehensive report',
      details: error.message 
    });
  }
};

// Export report data as CSV format
exports.exportReportCSV = (req, res) => {
  const { report_type, date_from, date_to, insurance_type, status } = req.query;
  
  let whereConditions = ["c.status != 'deleted'"];
  let queryParams = [];
  
  if (date_from) {
    whereConditions.push('c.created_at >= ?');
    queryParams.push(date_from);
  }
  
  if (date_to) {
    whereConditions.push('c.created_at <= ?');
    queryParams.push(date_to + ' 23:59:59');
  }
  
  if (insurance_type && insurance_type !== 'all') {
    whereConditions.push('c.insurance_type = ?');
    queryParams.push(insurance_type);
  }
  
  if (status && status !== 'all') {
    whereConditions.push('c.status = ?');
    queryParams.push(status);
  }
  
  const whereClause = 'WHERE ' + whereConditions.join(' AND ');
  
  const query = `
    SELECT 
      c.claim_number,
      c.created_at as claim_date,
      u.name as customer_name,
      u.email as customer_email,
      c.insurance_type,
      c.insurance_category,
      c.claim_amount,
      c.status,
      c.priority,
      c.risk_level,
      c.fraud_score,
      c.payout_amount,
      c.processed_at,
      COALESCE(admin.name, 'Unassigned') as assigned_to
    FROM claims c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN users admin ON c.assigned_to = admin.id
    ${whereClause}
    ORDER BY c.created_at DESC
  `;
  
  db.query(query, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Convert to CSV format
    const headers = Object.keys(results[0] || {});
    const csvContent = [
      headers.join(','),
      ...results.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        }).join(',')
      )
    ].join('\n');
    
    const filename = `${report_type || 'claims'}_report_${date_from || 'all'}_to_${date_to || 'all'}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  });
};

module.exports = exports;