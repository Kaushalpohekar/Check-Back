const express = require('express');
const router = express.Router();
const auth = require('./auth/auth.js');
const ad = require('./Admin/admin.js');


/*-------------------Authentication----------------------------*/
router.post('/register', auth.register);  //done
router.post('/login', auth.login);  //done
router.post('/forgot', auth.forgotPassword);
router.post('/resend-forgot', auth.resendResetToken);
router.post('/reset-password', auth.resetPassword);
router.get('/user', auth.getUserDetails);  //done

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
router.get('/getUsersByOrganization/:organizationId/:rolename', ad.getUsersByOrganization);  //done
router.put('/toggleUserBlock/:userId', ad.toggleUserBlock);  //done
router.delete('/deleteUser/:userId', ad.deleteUser);  //done
router.post('/addRole', ad.addRole);

/*----CheckPoints CRUD------*/
router.post('/addCheckpoint', ad.addCheckpoint);
router.get('/getCheckpointDetails/:checkpointId', ad.getCheckpointDetails);
router.get('/getCheckpointsByMachineAndFrequency/:machineId/:frequency', ad.getCheckpointsByMachineAndFrequency);

/*----Submission-----*/
router.post('/submission', ad.submission);
router.put('/updateSubmissionMaintenance', ad.updateSubmissionMaintenance);
router.put('/toggleAdminStatus/:submissionId', ad.toggleAdminStatus);
router.get('/getCheckpointStatusCounts/:organizationId', ad.getCheckpointStatusCounts); //done
router.get('/getMachineDailyCounts/:organizationId', ad.getMachineDailyCounts);  //done
router.get('/getMachineWeeklyCounts/:organizationId', ad.getMachineWeeklyCounts);  //done
router.get('/getMachineMonthlyCounts/:organizationId', ad.getMachineMonthlyCounts);  //done
router.get('/getMachineYearlyCounts/:organizationId', ad.getMachineYearlyCounts);  //done

module.exports=router;