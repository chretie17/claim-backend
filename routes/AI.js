const express = require('express');
const router = express.Router();
const aiAnalysisController = require('../controllers/AIController');

// ============================================================================
// AI ANALYSIS ROUTES
// ============================================================================

/**
 * @route   POST /api/claims/ai-analysis/:id
 * @desc    Perform comprehensive AI analysis on a specific claim
 */
router.post('/ai-analysis/:id', aiAnalysisController.performAIAnalysis);

/**
 * @route   POST /api/claims/ai-analysis/:id/action
 * @desc    Execute an AI recommendation action
 */
router.post('/ai-analysis/:id/action', aiAnalysisController.executeAIRecommendation);

/**
 * @route   GET /api/claims/ai-analysis/:id/history
 * @desc    Get AI analysis history for a specific claim
 */
router.get('/ai-analysis/:id/history', aiAnalysisController.getAnalysisHistory);

/**
 * @route   POST /api/claims/ai-analysis/batch
 * @desc    Perform AI analysis on multiple claims
 */
router.post('/ai-analysis/batch', async (req, res) => {
  const { claim_ids, analysis_options = {} } = req.body;
  
  if (!claim_ids || !Array.isArray(claim_ids) || claim_ids.length === 0) {
    return res.status(400).json({ 
      error: 'claim_ids array is required' 
    });
  }

  if (claim_ids.length > 50) {
    return res.status(400).json({ 
      error: 'Maximum 50 claims can be analyzed in a batch' 
    });
  }

  try {
    const results = [];
    const errors = [];

    // Process claims in parallel but with limited concurrency
    const batchSize = 5;
    for (let i = 0; i < claim_ids.length; i += batchSize) {
      const batch = claim_ids.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (claimId) => {
        try {
          const mockReq = {
            params: { id: claimId },
            body: analysis_options
          };
          
          let analysisResult = null;
          const mockRes = {
            json: (data) => { analysisResult = data; },
            status: (code) => ({
              json: (data) => { 
                if (code !== 200) throw new Error(data.error || 'Analysis failed');
                analysisResult = data;
              }
            })
          };

          await aiAnalysisController.performAIAnalysis(mockReq, mockRes);
          
          return {
            claim_id: claimId,
            success: true,
            data: analysisResult
          };
        } catch (error) {
          return {
            claim_id: claimId,
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            results.push(result.value);
          } else {
            errors.push(result.value);
          }
        } else {
          errors.push({
            claim_id: batch[index],
            success: false,
            error: result.reason.message
          });
        }
      });
    }

    res.json({
      message: `Batch AI analysis completed`,
      total_claims: claim_ids.length,
      successful_analyses: results.length,
      failed_analyses: errors.length,
      results: results,
      errors: errors
    });

  } catch (error) {
    console.error('Batch AI Analysis Error:', error);
    res.status(500).json({ 
      error: 'Failed to perform batch AI analysis',
      details: error.message 
    });
  }
});

/**
 * @route   GET /api/claims/ai-analysis/stats
 * @desc    Get AI analysis statistics and performance metrics
 */
router.get('/ai-analysis/stats', async (req, res) => {
  const { date_from, date_to, risk_level, confidence_threshold = 70 } = req.query;
  
  try {
    const db = require('../config/db');
    
    let whereClause = '1=1';
    const queryParams = [];
    
    if (date_from) {
      whereClause += ' AND aa.created_at >= ?';
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereClause += ' AND aa.created_at <= ?';
      queryParams.push(date_to);
    }
    
    if (risk_level) {
      whereClause += ' AND aa.risk_level = ?';
      queryParams.push(risk_level);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_analyses,
        AVG(aa.confidence_score) as avg_confidence,
        AVG(aa.fraud_score) as avg_fraud_score,
        COUNT(CASE WHEN aa.risk_level = 'CRITICAL' THEN 1 END) as critical_risk,
        COUNT(CASE WHEN aa.risk_level = 'HIGH' THEN 1 END) as high_risk,
        COUNT(CASE WHEN aa.risk_level = 'MEDIUM' THEN 1 END) as medium_risk,
        COUNT(CASE WHEN aa.risk_level = 'LOW' THEN 1 END) as low_risk,
        COUNT(CASE WHEN aa.confidence_score >= ? THEN 1 END) as high_confidence_analyses,
        COUNT(CASE WHEN JSON_LENGTH(JSON_EXTRACT(aa.analysis_data, '$.recommendations')) > 0 THEN 1 END) as analyses_with_recommendations
      FROM ai_analysis aa
      WHERE ${whereClause}
    `;
    
    queryParams.push(confidence_threshold);
    
    const [stats] = await db.promise().query(statsQuery, queryParams);
    
    // Get recent trend data
    const trendQuery = `
      SELECT 
        DATE(aa.created_at) as analysis_date,
        COUNT(*) as daily_count,
        AVG(aa.confidence_score) as avg_confidence,
        AVG(aa.fraud_score) as avg_fraud_score
      FROM ai_analysis aa
      WHERE aa.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(aa.created_at)
      ORDER BY analysis_date DESC
      LIMIT 30
    `;
    
    const [trendData] = await db.promise().query(trendQuery);

    res.json({
      summary: stats[0],
      trend_data: trendData,
      parameters: {
        date_from: date_from || null,
        date_to: date_to || null,
        risk_level: risk_level || 'all',
        confidence_threshold: parseInt(confidence_threshold)
      }
    });

  } catch (error) {
    console.error('AI Stats Error:', error);
    res.status(500).json({ 
      error: 'Failed to get AI analysis statistics',
      details: error.message 
    });
  }
});

module.exports = router;