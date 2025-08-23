// ============================================================================
// EMAIL COORDINATOR SERVICE
// ============================================================================

const nodemailer = require('nodemailer');
const db = require('../config/db');

// Email configuration
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'turashimyechretien@gmail.com',
    pass: process.env.SMTP_PASS || 'hovj wyno fbck uaal'
  }
};

// Create transporter
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// Verify email configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

const EMAIL_TEMPLATES = {
  claim_approved: {
    subject: '✅ Your Insurance Claim Has Been Approved - {{claim_number}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #28a745; margin: 0;">🎉 Claim Approved!</h1>
          </div>
          
          <h2 style="color: #333;">Dear {{user_name}},</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Great news! Your insurance claim has been <strong style="color: #28a745;">APPROVED</strong>.
          </p>
          
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #155724; margin-top: 0;">Claim Details:</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="margin: 8px 0;"><strong>Claim Number:</strong> {{claim_number}}</li>
              <li style="margin: 8px 0;"><strong>Insurance Type:</strong> {{insurance_type}}</li>
              <li style="margin: 8px 0;"><strong>Claim Amount:</strong> RWF {{claim_amount}}</li>
              <li style="margin: 8px 0;"><strong>Approved Payout:</strong> <span style="color: #28a745; font-weight: bold;">RWF {{payout_amount}}</span></li>
              <li style="margin: 8px 0;"><strong>Processing Date:</strong> {{processed_date}}</li>
            </ul>
          </div>
          
          {{#if decision_reason}}
          <div style="background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #333;">Approval Notes:</h4>
            <p style="margin: 0; color: #555;">{{decision_reason}}</p>
          </div>
          {{/if}}
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <h4 style="color: #856404; margin-top: 0;">💰 What happens next?</h4>
            <p style="margin: 0; color: #856404;">
              Your payout of <strong>RWF {{payout_amount}}</strong> will be processed within 3-5 business days. 
              You will receive a separate notification once the payment has been transferred.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; margin: 0;">
              Thank you for choosing our insurance services. If you have any questions, 
              please contact our support team.
            </p>
          </div>
        </div>
      </div>
    `
  },

  claim_rejected: {
    subject: '❌ Your Insurance Claim Has Been Rejected - {{claim_number}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc3545; margin: 0;">Claim Update</h1>
          </div>
          
          <h2 style="color: #333;">Dear {{user_name}},</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            We regret to inform you that your insurance claim has been <strong style="color: #dc3545;">REJECTED</strong> 
            after careful review.
          </p>
          
          <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #721c24; margin-top: 0;">Claim Details:</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="margin: 8px 0;"><strong>Claim Number:</strong> {{claim_number}}</li>
              <li style="margin: 8px 0;"><strong>Insurance Type:</strong> {{insurance_type}}</li>
              <li style="margin: 8px 0;"><strong>Claim Amount:</strong> RWF {{claim_amount}}</li>
              <li style="margin: 8px 0;"><strong>Processing Date:</strong> {{processed_date}}</li>
            </ul>
          </div>
          
          {{#if decision_reason}}
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #856404;">📋 Reason for Rejection:</h4>
            <p style="margin: 0; color: #856404;">{{decision_reason}}</p>
          </div>
          {{/if}}
          
          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <h4 style="color: #0c5460; margin-top: 0;">🔄 What can you do?</h4>
            <ul style="color: #0c5460; margin: 0;">
              <li>Review the rejection reason above</li>
              <li>Contact our support team if you need clarification</li>
              <li>Submit additional documentation if applicable</li>
              <li>File an appeal if you believe the decision was incorrect</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; margin: 0;">
              We understand this may be disappointing. Our support team is available to help 
              explain the decision and discuss your options.
            </p>
          </div>
        </div>
      </div>
    `
  },

  claim_under_review: {
    subject: '⏳ Your Claim is Under Review - {{claim_number}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #ffc107; margin: 0;">🔍 Under Review</h1>
          </div>
          
          <h2 style="color: #333;">Dear {{user_name}},</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Your insurance claim is currently <strong style="color: #ffc107;">UNDER REVIEW</strong> 
            by our claims assessment team.
          </p>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">Claim Details:</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="margin: 8px 0;"><strong>Claim Number:</strong> {{claim_number}}</li>
              <li style="margin: 8px 0;"><strong>Insurance Type:</strong> {{insurance_type}}</li>
              <li style="margin: 8px 0;"><strong>Claim Amount:</strong> RWF {{claim_amount}}</li>
              <li style="margin: 8px 0;"><strong>Review Started:</strong> {{processed_date}}</li>
            </ul>
          </div>
          
          {{#if admin_notes}}
          <div style="background-color: #f8f9fa; border-left: 4px solid #6c757d; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #333;">📝 Review Notes:</h4>
            <p style="margin: 0; color: #555;">{{admin_notes}}</p>
          </div>
          {{/if}}
          
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <h4 style="color: #155724; margin-top: 0;">⏰ Expected Timeline:</h4>
            <p style="margin: 0; color: #155724;">
              Our team will complete the review within 3-5 business days. 
              You will be notified immediately once a decision is made.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; margin: 0;">
              We appreciate your patience during the review process. 
              No action is required from you at this time.
            </p>
          </div>
        </div>
      </div>
    `
  },

  identity_verified: {
    subject: '✅ Identity Verified - {{claim_number}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #28a745; margin: 0;">🔐 Identity Verified</h1>
          </div>
          
          <h2 style="color: #333;">Dear {{user_name}},</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Your identity has been successfully <strong style="color: #28a745;">VERIFIED</strong> 
            for your insurance claim.
          </p>
          
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #155724; margin-top: 0;">Verification Details:</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="margin: 8px 0;"><strong>Claim Number:</strong> {{claim_number}}</li>
              <li style="margin: 8px 0;"><strong>Verification Date:</strong> {{verified_date}}</li>
              <li style="margin: 8px 0;"><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">Verified ✅</span></li>
            </ul>
          </div>
          
          {{#if identity_notes}}
          <div style="background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #333;">📝 Verification Notes:</h4>
            <p style="margin: 0; color: #555;">{{identity_notes}}</p>
          </div>
          {{/if}}
          
          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <h4 style="color: #0c5460; margin-top: 0;">🚀 Next Steps:</h4>
            <p style="margin: 0; color: #0c5460;">
              Your claim will now proceed to the final assessment stage. 
              We will notify you once a decision has been made.
            </p>
          </div>
        </div>
      </div>
    `
  },

  identity_rejected: {
    subject: '❌ Identity Verification Failed - {{claim_number}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc3545; margin: 0;">🔐 Identity Verification</h1>
          </div>
          
          <h2 style="color: #333;">Dear {{user_name}},</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Unfortunately, we were unable to verify your identity for claim {{claim_number}}. 
            Additional documentation is required.
          </p>
          
          <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #721c24; margin-top: 0;">Verification Details:</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="margin: 8px 0;"><strong>Claim Number:</strong> {{claim_number}}</li>
              <li style="margin: 8px 0;"><strong>Review Date:</strong> {{verified_date}}</li>
              <li style="margin: 8px 0;"><strong>Status:</strong> <span style="color: #dc3545; font-weight: bold;">Verification Failed ❌</span></li>
            </ul>
          </div>
          
          {{#if identity_notes}}
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #856404;">📋 Issues Found:</h4>
            <p style="margin: 0; color: #856404;">{{identity_notes}}</p>
          </div>
          {{/if}}
          
          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <h4 style="color: #0c5460; margin-top: 0;">🔄 Required Action:</h4>
            <ul style="color: #0c5460; margin: 0;">
              <li>Please review the issues mentioned above</li>
              <li>Submit clear, high-quality copies of required documents</li>
              <li>Ensure all information matches your claim details</li>
              <li>Contact support if you need assistance</li>
            </ul>
          </div>
        </div>
      </div>
    `
  },

  claim_assigned: {
    subject: '👤 Your Claim Has Been Assigned - {{claim_number}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #17a2b8; margin: 0;">👤 Claim Assigned</h1>
          </div>
          
          <h2 style="color: #333;">Dear {{user_name}},</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Your claim has been assigned to a claims specialist for processing.
          </p>
          
          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 5px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0c5460; margin-top: 0;">Assignment Details:</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="margin: 8px 0;"><strong>Claim Number:</strong> {{claim_number}}</li>
              <li style="margin: 8px 0;"><strong>Assigned Date:</strong> {{assigned_date}}</li>
              <li style="margin: 8px 0;"><strong>Claims Specialist:</strong> {{assigned_admin_name}}</li>
              <li style="margin: 8px 0;"><strong>Priority Level:</strong> {{priority}}</li>
            </ul>
          </div>
          
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <h4 style="color: #155724; margin-top: 0;">⏰ What's Next?</h4>
            <p style="margin: 0; color: #155724;">
              Your assigned specialist will review your claim details and may contact you 
              if additional information is needed. You'll be notified of any updates.
            </p>
          </div>
        </div>
      </div>
    `
  }
};

// ============================================================================
// EMAIL HELPER FUNCTIONS
// ============================================================================

// Simple template engine (basic {{variable}} replacement)
function renderTemplate(template, data) {
  let rendered = template;
  
  // Replace simple variables {{variable}}
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(regex, data[key] || '');
  });
  
  // Handle conditional blocks {{#if variable}}...{{/if}}
  rendered = rendered.replace(/{{#if\s+(\w+)}}(.*?){{\/if}}/gs, (match, variable, content) => {
    return data[variable] ? content : '';
  });
  
  return rendered;
}

// Format currency
function formatCurrency(amount) {
  if (!amount) return '0';
  return new Intl.NumberFormat('en-RW').format(amount);
}

// Format date
function formatDate(date) {
  if (!date) return new Date().toLocaleDateString();
  return new Date(date).toLocaleDateString('en-RW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ============================================================================
// CORE EMAIL FUNCTIONS
// ============================================================================

// Send email function
async function sendEmail(to, subject, html, text = '') {
  try {
    const mailOptions = {
      from: `"Insurance Claims System" <${process.env.SMTP_USER}>`,
      to: to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    
    // Log email to database
    await logEmailNotification(to, subject, 'sent', result.messageId);
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Email sending error:', error);
    
    // Log failed email to database
    await logEmailNotification(to, subject, 'failed', null, error.message);
    
    return { success: false, error: error.message };
  }
}

// Log email notifications to database
async function logEmailNotification(email, subject, status, messageId = null, error = null) {
  return new Promise((resolve) => {
    const query = `
      INSERT INTO email_notifications (email, subject, status, message_id, error_message, sent_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    db.query(query, [email, subject, status, messageId, error], (err, result) => {
      if (err) {
        console.error('Failed to log email notification:', err);
      }
      resolve(result);
    });
  });
}

// Get user email by user_id
async function getUserEmail(userId) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT name, email FROM users WHERE id = ?';
    
    db.query(query, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else if (results.length === 0) {
        reject(new Error('User not found'));
      } else {
        resolve(results[0]);
      }
    });
  });
}

// Get claim details
async function getClaimDetails(claimId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT c.*, u.name as user_name, u.email as user_email,
             admin.name as assigned_admin_name
      FROM claims c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN users admin ON c.assigned_to = admin.id
      WHERE c.id = ?
    `;
    
    db.query(query, [claimId], (err, results) => {
      if (err) {
        reject(err);
      } else if (results.length === 0) {
        reject(new Error('Claim not found'));
      } else {
        resolve(results[0]);
      }
    });
  });
}

// ============================================================================
// MAIN EMAIL COORDINATOR FUNCTIONS
// ============================================================================

// Send claim status update email
async function sendClaimStatusEmail(claimId, emailType, additionalData = {}) {
  try {
    // Get claim details
    const claim = await getClaimDetails(claimId);
    
    // Get email template
    const template = EMAIL_TEMPLATES[emailType];
    if (!template) {
      throw new Error(`Email template '${emailType}' not found`);
    }
    
    // Prepare template data
    const templateData = {
      user_name: claim.user_name,
      claim_number: claim.claim_number,
      insurance_type: claim.insurance_type,
      claim_amount: formatCurrency(claim.claim_amount),
      payout_amount: formatCurrency(claim.payout_amount),
      decision_reason: claim.decision_reason,
      admin_notes: claim.admin_notes,
      processed_date: formatDate(claim.processed_at || claim.updated_at),
      assigned_date: formatDate(claim.assigned_at),
      verified_date: formatDate(claim.identity_verified_at),
      assigned_admin_name: claim.assigned_admin_name,
      priority: claim.priority,
      identity_notes: claim.identity_notes,
      ...additionalData
    };
    
    // Render template
    const subject = renderTemplate(template.subject, templateData);
    const html = renderTemplate(template.html, templateData);
    
    // Send email
    const result = await sendEmail(claim.user_email, subject, html);
    
    if (result.success) {
      console.log(`${emailType} email sent successfully to ${claim.user_email}`);
      return { success: true, messageId: result.messageId };
    } else {
      console.error(`Failed to send ${emailType} email:`, result.error);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error('Error in sendClaimStatusEmail:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// INTEGRATION FUNCTIONS FOR ADMIN CONTROLLER
// ============================================================================

// Function to be called when claim is approved
async function notifyClaimApproved(claimId) {
  return await sendClaimStatusEmail(claimId, 'claim_approved');
}

// Function to be called when claim is rejected
async function notifyClaimRejected(claimId) {
  return await sendClaimStatusEmail(claimId, 'claim_rejected');
}

// Function to be called when claim is under review
async function notifyClaimUnderReview(claimId) {
  return await sendClaimStatusEmail(claimId, 'claim_under_review');
}

// Function to be called when identity is verified
async function notifyIdentityVerified(claimId) {
  return await sendClaimStatusEmail(claimId, 'identity_verified');
}

// Function to be called when identity verification fails
async function notifyIdentityRejected(claimId) {
  return await sendClaimStatusEmail(claimId, 'identity_rejected');
}

// Function to be called when claim is assigned
async function notifyClaimAssigned(claimId) {
  return await sendClaimStatusEmail(claimId, 'claim_assigned');
}

// ============================================================================
// BULK EMAIL FUNCTIONS
// ============================================================================

// Send bulk emails for multiple claims
async function sendBulkClaimEmails(claimIds, emailType) {
  const results = [];
  
  for (const claimId of claimIds) {
    try {
      const result = await sendClaimStatusEmail(claimId, emailType);
      results.push({
        claimId,
        success: result.success,
        error: result.error || null
      });
    } catch (error) {
      results.push({
        claimId,
        success: false,
        error: error.message
      });
    }
    
    // Add small delay between emails to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

// ============================================================================
// EMAIL STATISTICS AND MONITORING
// ============================================================================

// Get email statistics
async function getEmailStatistics(dateFrom = null, dateTo = null) {
  return new Promise((resolve, reject) => {
    let whereClause = '';
    const params = [];
    
    if (dateFrom) {
      whereClause += ' WHERE sent_at >= ?';
      params.push(dateFrom);
    }
    
    if (dateTo) {
      whereClause += whereClause ? ' AND sent_at <= ?' : ' WHERE sent_at <= ?';
      params.push(dateTo);
    }
    
    const query = `
      SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        COUNT(CASE WHEN subject LIKE '%Approved%' THEN 1 END) as approval_emails,
        COUNT(CASE WHEN subject LIKE '%Rejected%' THEN 1 END) as rejection_emails,
        COUNT(CASE WHEN subject LIKE '%Under Review%' THEN 1 END) as review_emails,
        COUNT(CASE WHEN subject LIKE '%Identity%' THEN 1 END) as identity_emails
      FROM email_notifications
      ${whereClause}
    `;
    
    db.query(query, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main notification functions
  notifyClaimApproved,
  notifyClaimRejected,
  notifyClaimUnderReview,
  notifyIdentityVerified,
  notifyIdentityRejected,
  notifyClaimAssigned,
  
  // Bulk operations
  sendBulkClaimEmails,
  
  // Utility functions
  sendClaimStatusEmail,
  sendEmail,
  getEmailStatistics,
  
  // Template management
  EMAIL_TEMPLATES,
  renderTemplate,
  
  // For testing
  transporter
};