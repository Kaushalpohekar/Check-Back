const express = require('express');
const router = express.Router();
const auth = require('./auth/auth.js');
const ad = require('./Admin/admin.js');


/*-------------------Authentication----------------------------*/
router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/forgot', auth.forgotPassword);
router.post('/resend-forgot', auth.resendResetToken);
router.post('/reset-password', auth.resetPassword);
router.get('/user', auth.getUserDetails);

/*-------------Admin---------------------------------------------*/
router.post('/addMachine', ad.addMachineDetails);
router.put('/updateMachine', ad.updateMachineDetails);
router.delete('/deleteMachine/:machineId', ad.deleteMachine);
router.get('/getAllMachineDetails/:organizationId', ad.getAllMachineDetails)
router.get('/getMachineDetails/:machineId', ad.getMachineDetails);
router.put('/updateStatus/:machineId', ad.updateMachineStatus);

module.exports=router;