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
/*----Machine CRUD------*/
router.post('/addMachine', ad.addMachineDetails);
router.put('/updateMachine', ad.updateMachineDetails);
router.delete('/deleteMachine/:machineId', ad.deleteMachine);
router.get('/getAllMachineDetails/:organizationId', ad.getAllMachineDetails)
router.get('/getMachineDetails/:machineId', ad.getMachineDetails);
router.put('/updateStatus/:machineId', ad.updateMachineStatus);

/*----Users CRUD------*/
router.post('/addUser', ad.addUser);
router.put('/updateUser', ad.updateUser);
router.get('/getUserDetails/:userId', ad.getUserDetails);
router.get('/getUsersByOrganization/:organizationId', ad.getUsersByOrganization);
router.put('/toggleUserBlock/:userId', ad.toggleUserBlock);
router.delete('/deleteUser/:userId', ad.deleteUser);
router.post('/addRole', ad.addRole);

/*----CheckPoints CRUD------*/
router.post('/addCheckpoint', ad.addCheckpoint);
router.get('/getCheckpointDetails/:checkpointId', ad.getCheckpointDetails);
router.get('/getCheckpointsByMachineAndFrequency/:machineId/:frequency', ad.getCheckpointsByMachineAndFrequency);

/*----Submission-----*/
router.post('/submission', ad.submission);
router.put('/updateSubmissionMaintenance', ad.updateSubmissionMaintenance);
router.put('/toggleAdminStatus/:submissionId', ad.toggleAdminStatus);
router.get('/getCheckpointStatusCounts/:organizationId', ad.getCheckpointStatusCounts);
router.get('/getMachineDailyCounts/:organizationId', ad.getMachineDailyCounts);
router.get('/getMachineWeeklyCounts/:organizationId', ad.getMachineWeeklyCounts);
router.get('/getMachineMonthlyCounts/:organizationId', ad.getMachineMonthlyCounts);
router.get('/getMachineYearlyCounts/:organizationId', ad.getMachineYearlyCounts);

module.exports=router;