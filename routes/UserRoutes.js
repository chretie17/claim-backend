const express = require('express');
const { 
    registerUser,
    loginUser, 
    getUsers, 
    updateUser, 
    deleteUser, 
    resetPassword, 
    createUserByAdmin, 
    forgotPassword, 
    verifyResetToken, 
    resetPasswordWithToken,
    forcePasswordReset
} = require('../controllers/userController');
const router = express.Router();

// Authentication routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Password management routes
router.post('/reset-password', resetPassword);
router.post('/forgot-password', forgotPassword);
router.get('/verify-reset-token/:token', verifyResetToken);
router.post('/reset-password-token', resetPasswordWithToken);
router.post('/force-password-reset', forcePasswordReset);

// User management routes
router.get('/', getUsers);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

// Admin routes
router.post('/admin/create-user', createUserByAdmin);

module.exports = router;