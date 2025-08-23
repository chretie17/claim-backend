const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const SECRET_KEY = '3e3df6981536654df2f807e5ef586aa24a333e3a9822617e014a0a249a180e7b445c782776005d40364569e396dce4fa34496f416ec8e5688e33291e320e5d31';

// Frontend URL - Update this to match your production URL
const FRONTEND_URL = 'http://localhost:5173';

const EMAIL_CONFIG = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER || 'turashimyechretien@gmail.com',
        pass: process.env.SMTP_PASS || 'hovj wyno fbck uaal'
    }
};

// Create transporter for sending emails
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// Generate random password for admin-created users
const generateRandomPassword = () => {
    return crypto.randomBytes(8).toString('hex'); // 16 character password
};

// Send welcome email with temp password
const sendWelcomeEmail = async (email, username, tempPassword, adminName) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="color: #2563eb; margin: 0;">Welcome to ClaimGuard!</h2>
                </div>
                
                <p style="color: #374151; font-size: 16px;">Hello <strong>${username}</strong>,</p>
                <p style="color: #374151; font-size: 16px;">Your account has been created by administrator <strong>${adminName}</strong>.</p>
                
                <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2563eb;">
                    <p style="margin: 0; color: #1e40af;"><strong>Your temporary password:</strong></p>
                    <code style="background-color: #1e40af; color: white; padding: 8px 12px; border-radius: 5px; font-size: 14px; display: inline-block; margin-top: 5px;">${tempPassword}</code>
                </div>
                
                <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; color: #92400e;"><strong>⚠️ Important:</strong> You will be required to change this password on your first login for security.</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${FRONTEND_URL}/login" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Login to Your Account</a>
                </div>
                
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 25px;">
                    <p style="margin: 0; color: #6b7280; font-size: 14px;"><strong>Next Steps:</strong></p>
                    <ol style="color: #6b7280; font-size: 14px; margin: 5px 0;">
                        <li>Click the login button above</li>
                        <li>Use your email and temporary password to sign in</li>
                        <li>You'll be prompted to set a new password immediately</li>
                    </ol>
                </div>
                
                <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">Best regards,<br><strong>ClaimGuard Admin Team</strong></p>
                </div>
            </div>
        </div>
    `;

    await transporter.sendMail({
        from: EMAIL_CONFIG.auth.user,
        to: email,
        subject: '🔐 Welcome to ClaimGuard - Your Account Details',
        html: html
    });
};

// Send password reset email with reset link
const sendPasswordResetEmail = async (email, username, resetToken) => {
    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="color: #2563eb; margin: 0;">🔒 Password Reset Request</h2>
                </div>
                
                <p style="color: #374151; font-size: 16px;">Hello <strong>${username}</strong>,</p>
                <p style="color: #374151; font-size: 16px;">You requested to reset your password for your ClaimGuard account.</p>
                
                <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2563eb;">
                    <p style="margin: 0 0 10px 0; color: #1e40af; font-weight: bold;">Click the button below to reset your password:</p>
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset My Password</a>
                    </div>
                </div>
                
                <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; color: #92400e;"><strong>⏰ Important:</strong> This reset link will expire in 1 hour for security reasons.</p>
                </div>
                
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 25px 0;">
                    <p style="margin: 0 0 5px 0; color: #374151; font-size: 14px;"><strong>If the button doesn't work, copy and paste this link:</strong></p>
                    <p style="margin: 0; color: #2563eb; font-size: 14px; word-break: break-all;">${resetLink}</p>
                </div>
                
                <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ef4444;">
                    <p style="margin: 0; color: #dc2626; font-size: 14px;"><strong>Didn't request this?</strong> If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.</p>
                </div>
                
                <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">Best regards,<br><strong>ClaimGuard Security Team</strong></p>
                </div>
            </div>
        </div>
    `;

    await transporter.sendMail({
        from: EMAIL_CONFIG.auth.user,
        to: email,
        subject: '🔐 ClaimGuard - Reset Your Password',
        html: html
    });
};

// Send email notification when password is reset
const sendPasswordResetNotification = async (email, username) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="color: #16a34a; margin: 0;">✅ Password Reset Successful</h2>
                </div>
                
                <p style="color: #374151; font-size: 16px;">Hello <strong>${username}</strong>,</p>
                <p style="color: #374151; font-size: 16px;">Your password has been successfully reset.</p>
                
                <div style="background-color: #dcfce7; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #16a34a;">
                    <p style="margin: 0; color: #15803d; font-weight: bold;">🎉 Your account is now secure with your new password!</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${FRONTEND_URL}/login" style="background-color: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Login with New Password</a>
                </div>
                
                <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ef4444;">
                    <p style="margin: 0; color: #dc2626; font-size: 14px;"><strong>⚠️ Security Alert:</strong> If you did not make this change, please contact our support team immediately.</p>
                </div>
                
                <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">Best regards,<br><strong>ClaimGuard Security Team</strong></p>
                </div>
            </div>
        </div>
    `;

    await transporter.sendMail({
        from: EMAIL_CONFIG.auth.user,
        to: email,
        subject: '✅ ClaimGuard - Password Reset Successful',
        html: html
    });
};

// **NEW FUNCTIONS FOR FORGOT PASSWORD FLOW**

// Forgot Password - Send reset link
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    
    try {
        // Check if user exists
        db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // Always return success message for security (don't reveal if email exists)
            if (results.length === 0) {
                return res.json({ 
                    message: 'If an account with that email exists, we\'ve sent a password reset link.' 
                });
            }
            
            const user = results[0];
            
            // Generate reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now
            
            // Store reset token in database
            db.query(
                'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?',
                [resetToken, resetTokenExpiry, email],
                async (updateErr, result) => {
                    if (updateErr) return res.status(500).json({ error: updateErr.message });
                    
                    try {
                        // Send reset email
                        await sendPasswordResetEmail(email, user.username, resetToken);
                        res.json({ 
                            message: 'If an account with that email exists, we\'ve sent a password reset link.' 
                        });
                    } catch (emailError) {
                        console.error('Email sending failed:', emailError);
                        res.status(500).json({ 
                            message: 'Failed to send reset email. Please try again.' 
                        });
                    }
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Verify Reset Token
exports.verifyResetToken = async (req, res) => {
    const { token } = req.params;
    
    try {
        db.query(
            'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
            [token],
            (err, results) => {
                if (err) return res.status(500).json({ error: err.message });
                
                if (results.length === 0) {
                    return res.status(400).json({ 
                        message: 'Invalid or expired reset token.' 
                    });
                }
                
                res.json({ 
                    message: 'Reset token is valid.',
                    valid: true 
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Reset Password with Token
exports.resetPasswordWithToken = async (req, res) => {
    const { token, newPassword } = req.body;
    
    try {
        // Verify token and get user
        db.query(
            'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
            [token],
            async (err, results) => {
                if (err) return res.status(500).json({ error: err.message });
                
                if (results.length === 0) {
                    return res.status(400).json({ 
                        message: 'Invalid or expired reset token.' 
                    });
                }
                
                const user = results[0];
                
                // Hash new password
                const hashedPassword = await bcrypt.hash(newPassword, 10);
                
                // Update password, clear reset token, and update password tracking
                db.query(
                    'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL, must_reset_password = FALSE, password_last_changed = NOW() WHERE id = ?',
                    [hashedPassword, user.id],
                    async (updateErr, result) => {
                        if (updateErr) return res.status(500).json({ error: updateErr.message });
                        
                        try {
                            // Send confirmation email
                            await sendPasswordResetNotification(user.email, user.username);
                            res.json({ 
                                message: 'Password reset successful! You can now login with your new password.' 
                            });
                        } catch (emailError) {
                            console.error('Email sending failed:', emailError);
                            res.json({ 
                                message: 'Password reset successful, but confirmation email failed to send.' 
                            });
                        }
                    }
                );
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// **UPDATED FUNCTIONS**

exports.registerUser = async (req, res) => {
    const { username, name, email, password, role, phone, address } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
        
    db.query(
        'INSERT INTO users (username, name, email, password, role, phone, address, created_by_admin, must_reset_password, password_last_changed) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, FALSE, NOW())',
        [username, name, email, hashedPassword, role, phone, address],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'User registered successfully!' });
        }
    );
};

// Admin creates user with temporary password - UPDATED
exports.createUserByAdmin = async (req, res) => {
    const { username, name, email, role, phone, address } = req.body;
    const adminId = req.user?.id; // Assuming you have middleware to get current user
    
    try {
        // Get admin info for email
        const adminQuery = new Promise((resolve, reject) => {
            db.query('SELECT name FROM users WHERE id = ?', [adminId], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]?.name || 'Administrator');
            });
        });
        
        const adminName = await adminQuery;
        
        // Generate temporary password
        const tempPassword = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        db.query(
            'INSERT INTO users (username, name, email, password, role, phone, address, created_by_admin, must_reset_password, created_by_user_id, password_last_changed) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, ?, NOW())',
            [username, name, email, hashedPassword, role, phone, address, adminId],
            async (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                
                try {
                    // Send welcome email with temp password
                    await sendWelcomeEmail(email, username, tempPassword, adminName);
                    res.json({ 
                        message: 'User created successfully! Welcome email sent with temporary password.',
                        tempPassword: tempPassword // You can remove this in production
                    });
                } catch (emailError) {
                    console.error('Email sending failed:', emailError);
                    res.status(201).json({ 
                        message: 'User created successfully, but email sending failed.',
                        tempPassword: tempPassword
                    });
                }
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Force Password Reset - NEW FUNCTION
// Fixed Force Password Reset function - NO MIDDLEWARE NEEDED
exports.forcePasswordReset = async (req, res) => {
    const { newPassword } = req.body;
    const token = req.headers.authorization?.split(' ')[1]; // Get token from header
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        // Decode token to get user ID
        const decoded = jwt.verify(token, SECRET_KEY);
        const userId = decoded.id;
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password and clear must_reset_password flag
        db.query(
            'UPDATE users SET password = ?, must_reset_password = FALSE, password_last_changed = NOW() WHERE id = ?',
            [hashedPassword, userId],
            async (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                
                // Get user info for email notification
                db.query('SELECT email, username FROM users WHERE id = ?', [userId], async (userErr, userResults) => {
                    if (userErr) return res.status(500).json({ error: userErr.message });
                    
                    // FIX: Check if user exists
                    if (userResults.length === 0) {
                        return res.status(404).json({ error: 'User not found' });
                    }
                    
                    const user = userResults[0]; // Now user is properly defined
                    
                    try {
                        // Send notification email
                        await sendPasswordResetNotification(user.email, user.username);
                        res.json({ 
                            message: 'Password updated successfully! You can now use your new password.',
                            passwordChanged: true
                        });
                    } catch (emailError) {
                        console.error('Email sending failed:', emailError);
                        res.json({ 
                            message: 'Password updated successfully, but confirmation email failed to send.',
                            passwordChanged: true
                        });
                    }
                });
            }
        );
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};
// Simple password reset (for logged-in users) - UPDATED
exports.resetPassword = async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;
    
    try {
        // Get user from database
        db.query('SELECT * FROM users WHERE id = ?', [userId], async (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length === 0) return res.status(404).json({ message: 'User not found' });
            
            const user = results[0];
            
            // Verify current password (skip this for forced password reset)
            if (currentPassword) {
                const passwordMatch = await bcrypt.compare(currentPassword, user.password);
                if (!passwordMatch) return res.status(401).json({ message: 'Current password is incorrect' });
            }
            
            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            
            // Update password in database
            db.query(
                'UPDATE users SET password = ?, must_reset_password = FALSE, password_last_changed = NOW() WHERE id = ?',
                [hashedPassword, userId],
                async (updateErr, result) => {
                    if (updateErr) return res.status(500).json({ error: updateErr.message });
                    
                    try {
                        // Send email notification
                        await sendPasswordResetNotification(user.email, user.username);
                        res.json({ message: 'Password reset successfully! Notification email sent.' });
                    } catch (emailError) {
                        console.error('Email sending failed:', emailError);
                        res.json({ message: 'Password reset successfully, but email notification failed.' });
                    }
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Login User - UPDATED to handle forced password reset
// Fixed Login User function
exports.loginUser = (req, res) => {
    const { usernameOrEmail, password } = req.body;
    
    db.query('SELECT * FROM users WHERE email = ? OR username = ?', [usernameOrEmail, usernameOrEmail], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(401).json({ message: 'User not found' });
                
        const user = results[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) return res.status(401).json({ message: 'Invalid password' });
        
        // DEBUG: Add this to see what's happening
        console.log('User must_reset_password:', user.must_reset_password);
        console.log('User ID:', user.id);
        
        // Check if user must reset password
        if (user.must_reset_password === 1 || user.must_reset_password === true) {
            const token = jwt.sign({ 
                id: user.id, 
                role: user.role, 
                mustReset: true 
            }, SECRET_KEY, { expiresIn: '2h' });
            
            return res.json({
                message: 'Password reset required',
                token,
                mustResetPassword: true,
                user: { 
                    id: user.id, 
                    name: user.name, 
                    email: user.email, 
                    username: user.username 
                }
            });
        }
        
        // Normal login - generate clean token
        const token = jwt.sign({ 
            id: user.id, 
            role: user.role 
        }, SECRET_KEY, { expiresIn: '24h' });
        
        res.json({ 
            message: 'Login successful',
            token,
            role: user.role,
            mustResetPassword: false,
            user: { 
                id: user.id, 
                name: user.name, 
                email: user.email, 
                username: user.username, 
                phone: user.phone, 
                address: user.address 
            }
        });
    });
};

exports.getUsers = (req, res) => {
    db.query('SELECT id, username, name, email, role, phone, address, created_by_admin, must_reset_password, password_last_changed FROM users', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

exports.updateUser = (req, res) => {
    const { id } = req.params;
    const { username, name, email, phone, address } = req.body;
    db.query(
        'UPDATE users SET username = ?, name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
        [username, name, email, phone, address, id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'User updated successfully' });
        }
    );
};

exports.deleteUser = (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM users WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'User deleted successfully' });
    });
};