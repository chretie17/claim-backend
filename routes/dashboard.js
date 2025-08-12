/**
 * @route   GET /api/admin/claims/identity/dashboard
 * @desc    Get identity verification dashboard data (admin overview)
 */
router.get('/admin/claims/identity/dashboard', async (req, res) => {
  try {
    const db = require('../config/db');
    
    // Get pending verifications
    const pendingQuery = `
      SELECT COUNT(*) as pending_count
      FROM claims 
      WHERE (identity_status IS NULL OR identity_status = 'pending') 
        AND status != 'deleted'
    `;
    
    // Get recent identity verifications
    const recentQuery = `
      SELECT c.id, c.claim_number, c.insurance_type, 
             u.name as user_name, c.identity_status, c.identity_verified_at
      FROM claims c
      JOIN users u ON c.user_id = u.id
      WHERE c.identity_verified_at IS NOT NULL
      ORDER BY c.identity_verified_at DESC
      LIMIT 10
    `;
    
    // Get AI recommendations
    const aiQuery = `
      SELECT ia.recommendation, COUNT(*) as count
      FROM identity_analysis ia
      JOIN claims c ON ia.claim_id = c.id
      WHERE c.identity_status IS NULL OR c.identity_status = 'pending'
      GROUP BY ia.recommendation
    `;
    
    const [pendingResults] = await db.promise().query(pendingQuery);
    const [recentResults] = await db.promise().query(recentQuery);
    const [aiResults] = await db.promise().query(aiQuery);
    
    res.json({
      pending_verifications: pendingResults[0].pending_count,
      recent_verifications: recentResults,
      ai_recommendations: aiResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Identity Dashboard Error:', error);
    res.status(500).json({
      error: 'Failed to get identity dashboard data',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/admin/claims/identity/auto-process
 * @desc    Auto-process claims with high-confidence AI recommendations
 */
router.post('/admin/claims/identity/auto-process', async (req, res) => {
  const { min_confidence = 0.9, max_claims = 50 } = req.body;
  const admin_id = req.user ? req.user.id : req.body.admin_id;
  
  try {
    const db = require('../config/db');
    
    // Get high-confidence recommendations
    const query = `
      SELECT ia.claim_id, ia.recommendation, ia.risk_score
      FROM identity_analysis ia
      JOIN claims c ON ia.claim_id = c.id
      WHERE (c.identity_status IS NULL OR c.identity_status = 'pending')
        AND ia.recommendation IN ('approve', 'reject')
        AND ((ia.recommendation = 'approve' AND ia.risk_score < ?) 
             OR (ia.recommendation = 'reject' AND ia.risk_score > ?))
      LIMIT ?
    `;
    
    const rejectThreshold = 1 - min_confidence;
    const [candidates] = await db.promise().query(query, [
      rejectThreshold, min_confidence, max_claims
    ]);
    
    let processedCount = 0;
    const results = [];
    
    for (const candidate of candidates) {
      const status = candidate.recommendation === 'approve' ? 'verified' : 'rejected';
      const notes = `Auto-processed by AI (confidence: ${(1-candidate.risk_score).toFixed(2)})`;
      
      const updateQuery = `
        UPDATE claims 
        SET identity_status = ?, identity_notes = ?, 
            identity_verified_by = ?, identity_verified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      await db.promise().query(updateQuery, [status, notes, admin_id, candidate.claim_id]);
      
      results.push({
        claim_id: candidate.claim_id,
        action: status,
        confidence: (1 - candidate.risk_score).toFixed(2)
      });
      
      processedCount++;
    }
    
    res.json({
      message: `Auto-processed ${processedCount} claims`,
      processed_count: processedCount,
      results: results,
      parameters: {
        min_confidence,
        max_claims
      }
    });
    
  } catch (error) {
    console.error('Auto-process Error:', error);
    res.status(500).json({
      error: 'Failed to auto-process claims',
      details: error.message
    });
  }
});