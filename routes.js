const express = require('express');
const router = express.Router();
const auth = require('./auth/auth.js');

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/forgot', auth.forgotPassword);
router.post('/resend-forgot', auth.resendResetToken);
router.post('/reset-password', auth.resetPassword);
router.get('/user', auth.getUserDetails);

module.exports=router;