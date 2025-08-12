const db = require('../config/db');

// ============================================================================
// AI ANALYSIS CONTROLLER
// ============================================================================

// Perform comprehensive AI analysis on a claim
exports.performAIAnalysis = async (req, res) => {
  const { id } = req.params;
  const { 
    perform_full_analysis = true,
    include_recommendations = true,
    include_risk_factors = true,
    include_document_verification = true
  } = req.body;
  
  try {
    // Get claim data with related information
    const claimQuery = `
      SELECT c.*, u.name as user_name, u.email as user_email, u.phone as user_phone,
             u.created_at as user_registration_date,
             COUNT(c2.id) as user_total_claims,
             AVG(c2.fraud_score) as user_avg_fraud_score
      FROM claims c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN claims c2 ON c.user_id = c2.user_id AND c2.id != c.id
      WHERE c.id = ?
      GROUP BY c.id
    `;
    
    const [claimResults] = await db.promise().query(claimQuery, [id]);
    
    if (claimResults.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    const claim = claimResults[0];
    
    // Perform AI Analysis
    const analysisResult = await performComprehensiveAnalysis(claim, {
      perform_full_analysis,
      include_recommendations,
      include_risk_factors,
      include_document_verification
    });
    
    // Store analysis results
    await storeAnalysisResults(id, analysisResult);
    
    res.json({
      claim_id: id,
      timestamp: new Date().toISOString(),
      ...analysisResult
    });
    
  } catch (error) {
    console.error('AI Analysis Error:', error);
    res.status(500).json({ 
      error: 'Failed to perform AI analysis',
      details: error.message 
    });
  }
};

// Execute AI recommendation action
exports.executeAIRecommendation = async (req, res) => {
  const { id } = req.params;
  const { recommendation_id, action, admin_id } = req.body;
  
  try {
    // Get the recommendation details
    const recommendation = await getRecommendationById(recommendation_id);
    
    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    
    let result = {};
    
    switch (action) {
      case 'accept':
        result = await executeRecommendation(id, recommendation, admin_id);
        break;
      case 'review':
        result = await markForReview(id, recommendation, admin_id);
        break;
      case 'dismiss':
        result = await dismissRecommendation(recommendation_id, admin_id);
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Log the action
    await logAIAction(id, recommendation_id, action, admin_id);
    
    res.json({
      message: `Recommendation ${action} successfully`,
      claim_id: id,
      recommendation_id,
      action,
      result
    });
    
  } catch (error) {
    console.error('AI Recommendation Action Error:', error);
    res.status(500).json({ 
      error: 'Failed to execute recommendation',
      details: error.message 
    });
  }
};

// Get AI analysis history for a claim
exports.getAnalysisHistory = async (req, res) => {
  const { id } = req.params;
  const { limit = 10 } = req.query;
  
  try {
    const query = `
      SELECT aa.*, u.name as performed_by_name
      FROM ai_analysis aa
      LEFT JOIN users u ON aa.performed_by = u.id
      WHERE aa.claim_id = ?
      ORDER BY aa.created_at DESC
      LIMIT ?
    `;
    
    const [results] = await db.promise().query(query, [id, parseInt(limit)]);
    
    res.json({
      claim_id: id,
      analysis_history: results.map(analysis => ({
        ...analysis,
        analysis_data: JSON.parse(analysis.analysis_data)
      }))
    });
    
  } catch (error) {
    console.error('Get Analysis History Error:', error);
    res.status(500).json({ 
      error: 'Failed to get analysis history',
      details: error.message 
    });
  }
};

// ============================================================================
// AI ANALYSIS HELPER FUNCTIONS
// ============================================================================

async function performComprehensiveAnalysis(claim, options) {
  const analysis = {
    overall_confidence: 0,
    fraud_risk_level: 'LOW',
    legitimacy_score: 0,
    recommended_payout: 0,
    key_findings: [],
    risk_analysis: null,
    recommendations: [],
    document_analysis: [],
    pattern_detection: []
  };
  
  try {
    // 1. Fraud Detection Analysis
    const fraudAnalysis = await performFraudDetection(claim);
    analysis.fraud_risk_level = fraudAnalysis.risk_level;
    analysis.legitimacy_score = fraudAnalysis.legitimacy_score;
    
    // 2. Risk Factor Analysis
    if (options.include_risk_factors) {
      analysis.risk_analysis = await performRiskAnalysis(claim);
    }
    
    // 3. Pattern Detection
    analysis.pattern_detection = await performPatternDetection(claim);
    
    // 4. Document Verification
    if (options.include_document_verification) {
      analysis.document_analysis = await performDocumentVerification(claim);
    }
    
    // 5. Generate Key Findings
    analysis.key_findings = await generateKeyFindings(claim, fraudAnalysis, analysis);
    
    // 6. Generate Recommendations
    if (options.include_recommendations) {
      analysis.recommendations = await generateRecommendations(claim, analysis);
    }
    
    // 7. Calculate overall confidence
    analysis.overall_confidence = calculateOverallConfidence(analysis);
    
    // 8. Calculate recommended payout
    analysis.recommended_payout = calculateRecommendedPayout(claim, analysis);
    
    return analysis;
    
  } catch (error) {
    console.error('Comprehensive Analysis Error:', error);
    throw error;
  }
}

async function performFraudDetection(claim) {
  // Advanced fraud detection algorithm
  let fraudScore = 0;
  let legitimacyScore = 1.0;
  let riskFactors = [];
  
  // 1. Amount Analysis
  const amountRisk = analyzeClaimAmount(claim);
  fraudScore += amountRisk.score * 0.25;
  if (amountRisk.isRisky) riskFactors.push(amountRisk.reason);
  
  // 2. Timing Analysis
  const timingRisk = analyzeClaimTiming(claim);
  fraudScore += timingRisk.score * 0.20;
  if (timingRisk.isRisky) riskFactors.push(timingRisk.reason);
  
  // 3. Customer History Analysis
  const historyRisk = await analyzeCustomerHistory(claim);
  fraudScore += historyRisk.score * 0.30;
  if (historyRisk.isRisky) riskFactors.push(historyRisk.reason);
  
  // 4. Geographic Analysis
  const geoRisk = analyzeGeographicFactors(claim);
  fraudScore += geoRisk.score * 0.15;
  if (geoRisk.isRisky) riskFactors.push(geoRisk.reason);
  
  // 5. Description Analysis (NLP)
  const descriptionRisk = analyzeClaimDescription(claim);
  fraudScore += descriptionRisk.score * 0.10;
  if (descriptionRisk.isRisky) riskFactors.push(descriptionRisk.reason);
  
  legitimacyScore = Math.max(0, 1 - fraudScore);
  
  let riskLevel = 'LOW';
  if (fraudScore > 0.8) riskLevel = 'CRITICAL';
  else if (fraudScore > 0.6) riskLevel = 'HIGH';
  else if (fraudScore > 0.4) riskLevel = 'MEDIUM';
  
  return {
    fraud_score: fraudScore,
    legitimacy_score: legitimacyScore,
    risk_level: riskLevel,
    risk_factors: riskFactors
  };
}

async function performRiskAnalysis(claim) {
  const riskFactors = [];
  
  // Customer Risk Profile
  const customerRisk = await analyzeCustomerRiskProfile(claim);
  if (customerRisk.factors.length > 0) {
    riskFactors.push(...customerRisk.factors);
  }
  
  // Policy Risk Analysis
  const policyRisk = analyzePolicyRisk(claim);
  if (policyRisk.factors.length > 0) {
    riskFactors.push(...policyRisk.factors);
  }
  
  // External Risk Factors
  const externalRisk = await analyzeExternalRiskFactors(claim);
  if (externalRisk.factors.length > 0) {
    riskFactors.push(...externalRisk.factors);
  }
  
  // Historical Patterns
  const historicalPatterns = await findHistoricalPatterns(claim);
  
  return {
    risk_factors: riskFactors,
    historical_patterns: historicalPatterns,
    overall_risk_score: calculateRiskScore(riskFactors)
  };
}

async function performPatternDetection(claim) {
  const patterns = [];
  
  // Similar claims pattern
  const similarClaims = await findSimilarClaims(claim);
  if (similarClaims.length > 2) {
    patterns.push({
      pattern_type: 'Similar Claims',
      description: `Found ${similarClaims.length} similar claims from this customer`,
      frequency: similarClaims.length,
      confidence: 85,
      severity: similarClaims.length > 5 ? 'HIGH' : 'MEDIUM'
    });
  }
  
  // Time-based patterns
  const timePatterns = await analyzeTimePatterns(claim);
  patterns.push(...timePatterns);
  
  // Amount patterns
  const amountPatterns = await analyzeAmountPatterns(claim);
  patterns.push(...amountPatterns);
  
  return patterns;
}

async function performDocumentVerification(claim) {
  const documents = await getClaimDocuments(claim.id);
  const verificationResults = [];
  
  for (const doc of documents) {
    const verification = await verifyDocument(doc);
    verificationResults.push({
      document_id: doc.id,
      document_type: doc.type,
      authenticity_score: verification.authenticity,
      quality_score: verification.quality,
      completeness_score: verification.completeness,
      issues: verification.issues,
      metadata: verification.metadata
    });
  }
  
  return verificationResults;
}

async function generateKeyFindings(claim, fraudAnalysis, fullAnalysis) {
  const findings = [];
  
  // High fraud score finding
  if (fraudAnalysis.fraud_score > 0.7) {
    findings.push({
      title: 'High Fraud Risk Detected',
      description: `This claim shows multiple fraud indicators with a ${(fraudAnalysis.fraud_score * 100).toFixed(1)}% fraud probability.`,
      severity: 'high',
      confidence: 92
    });
  }
  
  // Customer history findings
  if (claim.user_total_claims > 3) {
    findings.push({
      title: 'Frequent Claims History',
      description: `Customer has filed ${claim.user_total_claims} claims previously. Average fraud score: ${(claim.user_avg_fraud_score * 100).toFixed(1)}%`,
      severity: claim.user_total_claims > 5 ? 'high' : 'medium',
      confidence: 88
    });
  }
  
  // Amount analysis finding
  if (claim.claim_amount > 100000) {
    findings.push({
      title: 'High-Value Claim',
      description: `Claim amount of ${claim.claim_amount.toLocaleString()} requires additional verification.`,
      severity: 'medium',
      confidence: 95
    });
  }
  
  // Document issues
  const docIssues = fullAnalysis.document_analysis?.filter(doc => doc.issues?.length > 0);
  if (docIssues && docIssues.length > 0) {
    findings.push({
      title: 'Document Verification Issues',
      description: `${docIssues.length} documents have verification issues that need attention.`,
      severity: 'medium',
      confidence: 90
    });
  }
  
  return findings;
}

async function generateRecommendations(claim, analysis) {
  const recommendations = [];
  
  // Auto-approve low risk claims
  if (analysis.fraud_risk_level === 'LOW' && analysis.legitimacy_score > 0.8) {
    recommendations.push({
      id: generateRecommendationId(),
      title: 'Auto-Approve Recommendation',
      description: 'This claim shows low fraud risk and high legitimacy. Recommend automatic approval.',
      action_type: 'approve',
      priority: 'high',
      confidence: 92,
      expected_impact: 'Faster processing, improved customer satisfaction',
      supporting_evidence: [
        `Low fraud score: ${(analysis.legitimacy_score * 100).toFixed(1)}%`,
        'No significant risk factors identified',
        'Customer has good history'
      ]
    });
  }
  
  // Investigate high-risk claims
  if (analysis.fraud_risk_level === 'HIGH' || analysis.fraud_risk_level === 'CRITICAL') {
    recommendations.push({
      id: generateRecommendationId(),
      title: 'Investigation Required',
      description: 'This claim shows high fraud indicators and requires detailed investigation.',
      action_type: 'investigate',
      priority: 'urgent',
      confidence: 95,
      expected_impact: 'Prevent fraudulent payouts, protect company assets',
      supporting_evidence: [
        `High fraud risk level: ${analysis.fraud_risk_level}`,
        'Multiple risk factors detected',
        'Pattern similarities with known fraud cases'
      ]
    });
  }
  
  // Partial payout recommendation
  if (analysis.legitimacy_score > 0.5 && analysis.legitimacy_score < 0.8) {
    const partialAmount = Math.round(claim.claim_amount * analysis.legitimacy_score);
    recommendations.push({
      id: generateRecommendationId(),
      title: 'Partial Payout Recommendation',
      description: `Consider partial payout of ${partialAmount.toLocaleString()} based on legitimacy assessment.`,
      action_type: 'partial_approve',
      priority: 'medium',
      confidence: 78,
      expected_impact: 'Balance risk mitigation with customer satisfaction',
      supporting_evidence: [
        `Legitimacy score: ${(analysis.legitimacy_score * 100).toFixed(1)}%`,
        'Some risk factors present but not conclusive',
        'Partial settlement reduces exposure'
      ]
    });
  }
  
  return recommendations;
}

// Helper functions for specific analyses
function analyzeClaimAmount(claim) {
  const amount = claim.claim_amount;
  let score = 0;
  let isRisky = false;
  let reason = '';
  
  // Very high amounts are suspicious
  if (amount > 500000) {
    score = 0.8;
    isRisky = true;
    reason = 'Extremely high claim amount';
  } else if (amount > 100000) {
    score = 0.4;
    isRisky = true;
    reason = 'High claim amount requires verification';
  } else if (amount < 100) {
    score = 0.2;
    isRisky = true;
    reason = 'Unusually low claim amount';
  }
  
  return { score, isRisky, reason };
}

function analyzeClaimTiming(claim) {
  const claimDate = new Date(claim.created_at);
  const now = new Date();
  const daysSince = (now - claimDate) / (1000 * 60 * 60 * 24);
  
  let score = 0;
  let isRisky = false;
  let reason = '';
  
  // Claims filed immediately after policy start might be suspicious
  if (daysSince < 7) {
    score = 0.6;
    isRisky = true;
    reason = 'Claim filed very soon after policy activation';
  }
  
  // Weekend/holiday filings might have higher fraud rates
  const dayOfWeek = claimDate.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    score += 0.1;
    if (!isRisky) {
      isRisky = true;
      reason = 'Claim filed during weekend';
    }
  }
  
  return { score, isRisky, reason };
}

async function analyzeCustomerHistory(claim) {
  const query = `
    SELECT COUNT(*) as total_claims, 
           AVG(fraud_score) as avg_fraud,
           COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_claims
    FROM claims 
    WHERE user_id = ? AND id != ?
  `;
  
  try {
    const [results] = await db.promise().query(query, [claim.user_id, claim.id]);
    const history = results[0];
    
    let score = 0;
    let isRisky = false;
    let reason = '';
    
    if (history.total_claims > 5) {
      score += 0.3;
      isRisky = true;
      reason = 'Customer has high number of previous claims';
    }
    
    if (history.avg_fraud > 0.6) {
      score += 0.4;
      isRisky = true;
      reason = 'Customer has history of high fraud scores';
    }
    
    if (history.rejected_claims > 2) {
      score += 0.3;
      isRisky = true;
      reason = 'Customer has multiple rejected claims';
    }
    
    return { score, isRisky, reason };
  } catch (error) {
    return { score: 0, isRisky: false, reason: '' };
  }
}

function analyzeGeographicFactors(claim) {
  // This would integrate with geographic risk databases
  let score = 0;
  let isRisky = false;
  let reason = '';
  
  // Placeholder for geographic analysis
  // In real implementation, this would check:
  // - High crime areas
  // - Natural disaster zones
  // - Known fraud hotspots
  
  return { score, isRisky, reason };
}

function analyzeClaimDescription(claim) {
  // NLP analysis of claim description
  const description = claim.description?.toLowerCase() || '';
  let score = 0;
  let isRisky = false;
  let reason = '';
  
  // Check for suspicious keywords
  const suspiciousWords = ['urgent', 'emergency', 'immediate', 'cash', 'desperate'];
  const foundSuspicious = suspiciousWords.filter(word => description.includes(word));
  
  if (foundSuspicious.length > 2) {
    score = 0.3;
    isRisky = true;
    reason = 'Description contains multiple urgent/suspicious keywords';
  }
  
  // Check description length (too short or too long can be suspicious)
  if (description.length < 20) {
    score += 0.2;
    isRisky = true;
    reason = 'Very brief description lacks detail';
  } else if (description.length > 2000) {
    score += 0.1;
    isRisky = true;
    reason = 'Extremely detailed description may indicate fabrication';
  }
  
  return { score, isRisky, reason };
}

// Additional helper functions
async function storeAnalysisResults(claimId, analysis) {
  const query = `
    INSERT INTO ai_analysis (claim_id, analysis_data, fraud_score, risk_level, confidence_score, created_at)
    VALUES (?, ?, ?, ?, ?, NOW())
  `;
  
  await db.promise().query(query, [
    claimId,
    JSON.stringify(analysis),
    analysis.legitimacy_score,
    analysis.fraud_risk_level,
    analysis.overall_confidence
  ]);
}

function calculateOverallConfidence(analysis) {
  // Complex calculation based on various factors
  let confidence = 70; // Base confidence
  
  if (analysis.document_analysis && analysis.document_analysis.length > 0) {
    const avgDocScore = analysis.document_analysis.reduce((sum, doc) => 
      sum + (doc.authenticity_score + doc.quality_score) / 2, 0) / analysis.document_analysis.length;
    confidence += avgDocScore * 20;
  }
  
  if (analysis.risk_analysis && analysis.risk_analysis.risk_factors) {
    const highRiskFactors = analysis.risk_analysis.risk_factors.filter(f => f.severity === 'HIGH' || f.severity === 'CRITICAL');
    confidence -= highRiskFactors.length * 5;
  }
  
  return Math.max(0, Math.min(100, Math.round(confidence)));
}

function calculateRecommendedPayout(claim, analysis) {
  const baseAmount = claim.claim_amount;
  const legitimacyScore = analysis.legitimacy_score;
  
  if (legitimacyScore > 0.9) return baseAmount;
  if (legitimacyScore > 0.7) return Math.round(baseAmount * 0.8);
  if (legitimacyScore > 0.5) return Math.round(baseAmount * 0.6);
  if (legitimacyScore > 0.3) return Math.round(baseAmount * 0.3);
  return 0;
}

function generateRecommendationId() {
  return 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
// Add these missing functions to your AI controller file

async function analyzeCustomerRiskProfile(claim) {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_claims,
        AVG(claim_amount) as avg_claim_amount,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_claims,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_claims,
        MAX(created_at) as last_claim_date,
        MIN(created_at) as first_claim_date
      FROM claims 
      WHERE user_id = ? AND id != ?
    `;
    
    const [results] = await db.promise().query(query, [claim.user_id, claim.id]);
    const profile = results[0];
    
    const factors = [];
    
    if (profile.total_claims > 3) {
      factors.push({
        factor_name: 'High Claim Frequency',
        description: `Customer has ${profile.total_claims} previous claims`,
        severity: profile.total_claims > 5 ? 'HIGH' : 'MEDIUM',
        score: Math.min(profile.total_claims / 10, 1),
        weight: 25
      });
    }
    
    if (profile.rejected_claims > 1) {
      factors.push({
        factor_name: 'Previous Claim Rejections',
        description: `${profile.rejected_claims} claims were previously rejected`,
        severity: profile.rejected_claims > 2 ? 'HIGH' : 'MEDIUM',
        score: Math.min(profile.rejected_claims / 5, 1),
        weight: 30
      });
    }
    
    return { factors };
  } catch (error) {
    console.error('Customer risk profile analysis error:', error);
    return { factors: [] };
  }
}

function analyzePolicyRisk(claim) {
  const factors = [];
  
  // Policy age analysis
  if (claim.created_at) {
    const claimDate = new Date(claim.created_at);
    const now = new Date();
    const daysSincePolicy = (now - claimDate) / (1000 * 60 * 60 * 24);
    
    if (daysSincePolicy < 30) {
      factors.push({
        factor_name: 'New Policy Claim',
        description: 'Claim filed within 30 days of policy start',
        severity: 'MEDIUM',
        score: 0.6,
        weight: 15
      });
    }
  }
  
  // High-value policy analysis
  if (claim.claim_amount > 100000) {
    factors.push({
      factor_name: 'High Value Claim',
      description: `Claim amount exceeds ${claim.claim_amount.toLocaleString()}`,
      severity: claim.claim_amount > 500000 ? 'HIGH' : 'MEDIUM',
      score: Math.min(claim.claim_amount / 1000000, 0.8),
      weight: 20
    });
  }
  
  return { factors };
}

async function analyzeExternalRiskFactors(claim) {
  const factors = [];
  
  // Geographic risk (placeholder - would integrate with real geo data)
  factors.push({
    factor_name: 'Geographic Risk Assessment',
    description: 'Location-based risk evaluation',
    severity: 'LOW',
    score: 0.1,
    weight: 10
  });
  
  // Time-based risk
  const claimDate = new Date(claim.created_at);
  const isWeekend = claimDate.getDay() === 0 || claimDate.getDay() === 6;
  
  if (isWeekend) {
    factors.push({
      factor_name: 'Weekend Filing',
      description: 'Claim filed during weekend',
      severity: 'LOW',
      score: 0.2,
      weight: 5
    });
  }
  
  return { factors };
}

async function findHistoricalPatterns(claim) {
  try {
    const query = `
      SELECT 
        insurance_type,
        insurance_category,
        COUNT(*) as pattern_count,
        AVG(claim_amount) as avg_amount,
        AVG(fraud_score) as avg_fraud_score
      FROM claims 
      WHERE user_id = ? 
        AND id != ?
        AND (insurance_type = ? OR insurance_category = ?)
      GROUP BY insurance_type, insurance_category
      HAVING pattern_count > 1
    `;
    
    const [results] = await db.promise().query(query, [
      claim.user_id, 
      claim.id, 
      claim.insurance_type, 
      claim.insurance_category
    ]);
    
    return results.map(pattern => ({
      pattern_type: `${pattern.insurance_type} - ${pattern.insurance_category}`,
      description: `Customer has ${pattern.pattern_count} similar claims`,
      frequency: pattern.pattern_count,
      confidence: Math.min(pattern.pattern_count * 20, 95),
      avg_amount: pattern.avg_amount,
      avg_fraud_score: pattern.avg_fraud_score
    }));
    
  } catch (error) {
    console.error('Historical patterns analysis error:', error);
    return [];
  }
}

async function findSimilarClaims(claim) {
  try {
    const query = `
      SELECT id, claim_number, claim_amount, created_at, fraud_score
      FROM claims 
      WHERE user_id = ? 
        AND id != ?
        AND (
          insurance_type = ? 
          OR insurance_category = ?
          OR ABS(claim_amount - ?) < ?
        )
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const amountThreshold = claim.claim_amount * 0.2; // 20% variance
    
    const [results] = await db.promise().query(query, [
      claim.user_id,
      claim.id,
      claim.insurance_type,
      claim.insurance_category,
      claim.claim_amount,
      amountThreshold
    ]);
    
    return results;
  } catch (error) {
    console.error('Similar claims analysis error:', error);
    return [];
  }
}

async function analyzeTimePatterns(claim) {
  try {
    const query = `
      SELECT 
        DAYOFWEEK(created_at) as day_of_week,
        HOUR(created_at) as hour_of_day,
        COUNT(*) as frequency
      FROM claims 
      WHERE user_id = ? AND id != ?
      GROUP BY DAYOFWEEK(created_at), HOUR(created_at)
      HAVING frequency > 1
      ORDER BY frequency DESC
    `;
    
    const [results] = await db.promise().query(query, [claim.user_id, claim.id]);
    
    return results.map(pattern => ({
      pattern_type: 'Time Pattern',
      description: `Claims frequently filed on day ${pattern.day_of_week} at hour ${pattern.hour_of_day}`,
      frequency: pattern.frequency,
      confidence: Math.min(pattern.frequency * 15, 85)
    }));
    
  } catch (error) {
    console.error('Time patterns analysis error:', error);
    return [];
  }
}

async function analyzeAmountPatterns(claim) {
  try {
    const query = `
     SELECT 
  ROUND(claim_amount/1000)*1000 as amount_range,
  COUNT(*) as frequency,
  AVG(fraud_score) as avg_fraud_score
FROM claims 
WHERE user_id = ? AND id != ?
GROUP BY ROUND(claim_amount/1000)*1000
HAVING frequency > 1
ORDER BY frequency DESC
    `;
    
    const [results] = await db.promise().query(query, [claim.user_id, claim.id]);
    
    return results.map(pattern => ({
      pattern_type: 'Amount Pattern',
      description: `Claims frequently around ${pattern.amount_range.toLocaleString()} amount range`,
      frequency: pattern.frequency,
      confidence: Math.min(pattern.frequency * 20, 90),
      avg_fraud_score: pattern.avg_fraud_score
    }));
    
  } catch (error) {
    console.error('Amount patterns analysis error:', error);
    return [];
  }
}

async function getClaimDocuments(claimId) {
  try {
    const query = `
      SELECT id, file_name, file_path, document_type as type, uploaded_at
      FROM claim_documents 
      WHERE claim_id = ?
    `;
    
    const [results] = await db.promise().query(query, [claimId]);
    return results;
  } catch (error) {
    console.error('Get claim documents error:', error);
    return [];
  }
}


async function verifyDocument(doc) {
  // Mock document verification - in real implementation would use AI/ML services
  return {
    authenticity: Math.random() * 0.3 + 0.7, // 70-100%
    quality: Math.random() * 0.2 + 0.8, // 80-100%
    completeness: Math.random() * 0.25 + 0.75, // 75-100%
    issues: Math.random() > 0.8 ? ['Low image quality', 'Missing signature'] : [],
    metadata: {
      file_size: 1024000,
      format: doc.type,
      creation_date: doc.uploaded_at
    }
  };
}

function calculateRiskScore(riskFactors) {
  if (riskFactors.length === 0) return 0;
  
  const totalWeight = riskFactors.reduce((sum, factor) => sum + factor.weight, 0);
  const weightedScore = riskFactors.reduce((sum, factor) => 
    sum + (factor.score * factor.weight), 0);
    
  return weightedScore / totalWeight;
}

async function getRecommendationById(recommendationId) {
  // Mock implementation - in real app would query database
  return {
    id: recommendationId,
    title: 'Sample Recommendation',
    action_type: 'approve',
    description: 'Sample recommendation description'
  };
}

async function executeRecommendation(claimId, recommendation, adminId) {
  // Implementation for executing recommendations
  if (recommendation.action_type === 'approve') {
    const query = `
      UPDATE claims 
      SET status = 'approved', 
          processed_by = ?,
          processed_at = NOW()
      WHERE id = ?
    `;
    await db.promise().query(query, [adminId, claimId]);
    return { action: 'approved', claim_id: claimId };
  }
  
  return { action: 'executed', recommendation_id: recommendation.id };
}

async function markForReview(claimId, recommendation, adminId) {
  const query = `
    UPDATE claims 
    SET status = 'under_review',
        priority = 'high',
        admin_notes = CONCAT(COALESCE(admin_notes, ''), '\n', 'AI Recommendation: Marked for review')
    WHERE id = ?
  `;
  
  await db.promise().query(query, [claimId]);
  return { action: 'marked_for_review', claim_id: claimId };
}

async function dismissRecommendation(recommendationId, adminId) {
  // Log dismissal in database
  return { action: 'dismissed', recommendation_id: recommendationId };
}

async function logAIAction(claimId, recommendationId, action, adminId) {
  const query = `
    INSERT INTO ai_actions (claim_id, recommendation_id, action, admin_id, created_at)
    VALUES (?, ?, ?, ?, NOW())
  `;
  
  try {
    await db.promise().query(query, [claimId, recommendationId, action, adminId]);
  } catch (error) {
    console.error('Failed to log AI action:', error);
  }
}
// ============================================================================
// AI IDENTITY ANALYSIS FUNCTIONS (SIMPLE VERSION)
// ============================================================================

// Analyze identity documents for a claim
exports.analyzeIdentityDocuments = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get claim with identity data
    const query = `
      SELECT c.identification_data, c.identification_documents, c.insurance_type,
             u.name as user_name, u.email as user_email
      FROM claims c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `;
    
    const [results] = await db.promise().query(query, [id]);
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    const claim = results[0];
    
    // Simple AI analysis
    const analysis = await performSimpleIdentityAnalysis(claim);
    
    // Save analysis results
    await saveIdentityAnalysis(id, analysis);
    
    res.json({
      claim_id: id,
      analysis_date: new Date().toISOString(),
      ...analysis
    });
    
  } catch (error) {
    console.error('Identity Analysis Error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze identity documents',
      details: error.message 
    });
  }
};

// Get identity analysis results
exports.getIdentityAnalysis = (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT analysis_data, created_at
    FROM identity_analysis
    WHERE claim_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  db.query(query, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'No analysis found for this claim' });
    }
    
    const analysis = JSON.parse(results[0].analysis_data);
    
    res.json({
      claim_id: id,
      analysis_date: results[0].created_at,
      ...analysis
    });
  });
};

// Bulk identity analysis for multiple claims
exports.bulkAnalyzeIdentity = async (req, res) => {
  const { claim_ids } = req.body;
  
  if (!claim_ids || !Array.isArray(claim_ids)) {
    return res.status(400).json({ error: 'claim_ids array is required' });
  }
  
  try {
    const results = [];
    
    for (const claimId of claim_ids) {
      try {
        const query = `
          SELECT c.identification_data, c.identification_documents, c.insurance_type
          FROM claims c
          WHERE c.id = ?
        `;
        
        const [claimResults] = await db.promise().query(query, [claimId]);
        
        if (claimResults.length > 0) {
          const analysis = await performSimpleIdentityAnalysis(claimResults[0]);
          await saveIdentityAnalysis(claimId, analysis);
          
          results.push({
            claim_id: claimId,
            status: 'analyzed',
            risk_score: analysis.risk_score,
            recommendation: analysis.recommendation
          });
        } else {
          results.push({
            claim_id: claimId,
            status: 'not_found'
          });
        }
      } catch (error) {
        results.push({
          claim_id: claimId,
          status: 'error',
          error: error.message
        });
      }
    }
    
    res.json({
      message: 'Bulk identity analysis completed',
      results: results,
      analyzed_count: results.filter(r => r.status === 'analyzed').length
    });
    
  } catch (error) {
    console.error('Bulk Identity Analysis Error:', error);
    res.status(500).json({ 
      error: 'Failed to perform bulk analysis',
      details: error.message 
    });
  }
};

// ============================================================================
// SIMPLE AI HELPER FUNCTIONS
// ============================================================================

async function performSimpleIdentityAnalysis(claim) {
  const analysis = {
    risk_score: 0,
    confidence_level: 'medium',
    recommendation: 'manual_review',
    issues_found: [],
    positive_indicators: []
  };
  
  // Parse identity data
  const identityData = claim.identification_data ? 
    JSON.parse(claim.identification_data) : {};
  
  const identityDocs = claim.identification_documents ? 
    JSON.parse(claim.identification_documents) : [];
  
  // Simple checks based on insurance type
  if (claim.insurance_type === 'motor') {
    analysis = analyzeMotorIdentity(identityData, identityDocs, analysis);
  } else if (claim.insurance_type === 'property') {
    analysis = analyzePropertyIdentity(identityData, identityDocs, analysis);
  } else if (claim.insurance_type === 'health') {
    analysis = analyzeHealthIdentity(identityData, identityDocs, analysis);
  } else if (claim.insurance_type === 'life') {
    analysis = analyzeLifeIdentity(identityData, identityDocs, analysis);
  }
  
  // Calculate final recommendation
  if (analysis.risk_score < 0.3) {
    analysis.recommendation = 'approve';
    analysis.confidence_level = 'high';
  } else if (analysis.risk_score > 0.7) {
    analysis.recommendation = 'reject';
    analysis.confidence_level = 'high';
  } else {
    analysis.recommendation = 'manual_review';
    analysis.confidence_level = 'medium';
  }
  
  return analysis;
}

function analyzeMotorIdentity(identityData, identityDocs, analysis) {
  // Check license plate format
  if (identityData.license_plate) {
    const platePattern = /^R[A-Z]{2}\s?\d{3}[A-Z]$/;
    if (platePattern.test(identityData.license_plate)) {
      analysis.positive_indicators.push('Valid license plate format');
    } else {
      analysis.issues_found.push('Invalid license plate format');
      analysis.risk_score += 0.3;
    }
  } else {
    analysis.issues_found.push('Missing license plate number');
    analysis.risk_score += 0.5;
  }
  
  // Check required documents
  const requiredDocs = ['vehicle_registration', 'insurance_policy'];
  const providedDocTypes = identityDocs.map(doc => doc.document_type);
  
  requiredDocs.forEach(reqDoc => {
    if (providedDocTypes.includes(reqDoc)) {
      analysis.positive_indicators.push(`${reqDoc} document provided`);
    } else {
      analysis.issues_found.push(`Missing ${reqDoc} document`);
      analysis.risk_score += 0.2;
    }
  });
  
  return analysis;
}

function analyzePropertyIdentity(identityData, identityDocs, analysis) {
  // Check UPI number format
  if (identityData.upi_number) {
    const upiPattern = /^\d{1}\/\d{2}\/\d{2}\/\d{2}\/\d+$/;
    if (upiPattern.test(identityData.upi_number)) {
      analysis.positive_indicators.push('Valid UPI number format');
    } else {
      analysis.issues_found.push('Invalid UPI number format');
      analysis.risk_score += 0.3;
    }
  } else {
    analysis.issues_found.push('Missing UPI number');
    analysis.risk_score += 0.5;
  }
  
  // Check required documents
  const requiredDocs = ['property_title', 'insurance_policy'];
  const providedDocTypes = identityDocs.map(doc => doc.document_type);
  
  requiredDocs.forEach(reqDoc => {
    if (providedDocTypes.includes(reqDoc)) {
      analysis.positive_indicators.push(`${reqDoc} document provided`);
    } else {
      analysis.issues_found.push(`Missing ${reqDoc} document`);
      analysis.risk_score += 0.2;
    }
  });
  
  return analysis;
}

function analyzeHealthIdentity(identityData, identityDocs, analysis) {
  // Check hospital/clinic name
  if (identityData.hospital_clinic && identityData.hospital_clinic.length > 5) {
    analysis.positive_indicators.push('Hospital/clinic name provided');
  } else {
    analysis.issues_found.push('Missing or invalid hospital/clinic name');
    analysis.risk_score += 0.3;
  }
  
  // Check medical records
  const providedDocTypes = identityDocs.map(doc => doc.document_type);
  if (providedDocTypes.includes('medical_records')) {
    analysis.positive_indicators.push('Medical records provided');
  } else {
    analysis.issues_found.push('Missing medical records');
    analysis.risk_score += 0.4;
  }
  
  return analysis;
}

function analyzeLifeIdentity(identityData, identityDocs, analysis) {
  // Check beneficiary information
  if (identityData.beneficiary_name && identityData.beneficiary_name.length > 2) {
    analysis.positive_indicators.push('Beneficiary name provided');
  } else {
    analysis.issues_found.push('Missing beneficiary name');
    analysis.risk_score += 0.2;
  }
  
  if (identityData.beneficiary_id) {
    const idPattern = /^\d{16}$/;
    if (idPattern.test(identityData.beneficiary_id)) {
      analysis.positive_indicators.push('Valid beneficiary ID format');
    } else {
      analysis.issues_found.push('Invalid beneficiary ID format');
      analysis.risk_score += 0.3;
    }
  } else {
    analysis.issues_found.push('Missing beneficiary ID');
    analysis.risk_score += 0.3;
  }
  
  // Check supporting documents
  const providedDocTypes = identityDocs.map(doc => doc.document_type);
  if (providedDocTypes.includes('supporting_documents')) {
    analysis.positive_indicators.push('Supporting documents provided');
  } else {
    analysis.issues_found.push('Missing supporting documents');
    analysis.risk_score += 0.2;
  }
  
  return analysis;
}

async function saveIdentityAnalysis(claimId, analysis) {
  const query = `
    INSERT INTO identity_analysis (claim_id, analysis_data, risk_score, recommendation, created_at)
    VALUES (?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE 
    analysis_data = VALUES(analysis_data),
    risk_score = VALUES(risk_score),
    recommendation = VALUES(recommendation),
    created_at = NOW()
  `;
  
  try {
    await db.promise().query(query, [
      claimId,
      JSON.stringify(analysis),
      analysis.risk_score,
      analysis.recommendation
    ]);
  } catch (error) {
    console.error('Failed to save identity analysis:', error);
  }
}
// Export the functions
module.exports = exports;