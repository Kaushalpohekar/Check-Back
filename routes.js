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
router.post('/addMachine/:organizationId', ad.addMachineDetails);  //done
router.put('/updateMachine/:machineId', ad.updateMachineDetails);  //done
router.delete('/deleteMachine/:machineId', ad.deleteMachine); //done
router.get('/getAllMachineDetails/:organizationId', ad.getAllMachineDetails) //done
router.get('/getMachineDetails/:machineId', ad.getMachineDetails);  //done
router.put('/updateStatus/:machineId', ad.updateMachineStatus);  //done

/*----Users CRUD------*/
router.post('/addUser/:organizationId', ad.addUser);  //done
router.put('/updateUser/:userId', ad.updateUser);  //done
router.get('/getUserDetails/:userId', ad.getUserDetails);  //
router.get('/getUsersByOrganization/:organizationId/:rolename', ad.getUsersByOrganization);  //done
router.put('/toggleUserBlock/:userId', ad.toggleUserBlock);  //done
router.delete('/deleteUser/:userId', ad.deleteUser);  //done
router.post('/addRole', ad.addRole);  //

/*----CheckPoints CRUD------*/
router.post('/addCheckpoint', ad.addCheckpoint);
router.get('/getCheckpointDetails/:checkpointId', ad.getCheckpointDetails);  //done
router.get('/getCheckpointsByMachineAndFrequency/:machineId/:frequency', ad.getCheckpointsByMachineAndFrequency);  //done
router.get('/getCheckpointsByMachine/:machineId', ad.getCheckpointsByMachine);  //done

/*----Submission-----*/
router.post('/submission', ad.submission);
router.put('/submissionId/:submissionId', ad.updateSubmissionMaintenance);
router.put('/toggleAdminStatus/:submissionId', ad.toggleAdminStatus);  //done
router.get('/getCheckpointStatusCounts/:organizationId', ad.getCheckpointStatusCounts); //done
router.get('/getMachineDailyCounts/:organizationId', ad.getMachineDailyCounts);  //done
router.get('/getMachineWeeklyCounts/:organizationId', ad.getMachineWeeklyCounts);  //done
router.get('/getMachineMonthlyCounts/:organizationId', ad.getMachineMonthlyCounts);  //done
router.get('/getMachineYearlyCounts/:organizationId', ad.getMachineYearlyCounts);  //done
router.get('/getMachineCounts/:organizationId/:frequency', ad.getMachineCounts); 

router.get('/getMaintenanceCountsByDepartment/:organizationId', ad.getMaintenanceCountsByDepartment);  //done
router.get('/getDetailedMaintenanceSubmissions/:organizationId', ad.getDetailedMaintenanceSubmissions);  //done
router.get('/getDetailedMaintenanceMyWorkDoneSubmissions/:organizationId', ad.getDetailedMaintenanceMyWorkDoneSubmissions);  //done
router.get('/getDetailedMaintenanceTodoSubmissions/:organizationId', ad.getDetailedMaintenanceTodoSubmissions);  //done
router.get('/getStandardSubmissions/:userId', ad.getStandardSubmissions);
router.get('/getAdminSubmissions/:organizationId', ad.getAdminSubmissions);
router.get('/getSubmissionDetails/:submissionId', ad.getSubmissionDetails);  //done

/*-------------*/
router.get('/getAllMachine/:organizationId', ad.getAllMachine);
router.get('/getAllDepartments', ad.getAllDepartments);  //done
router.get('/getOperatorsName/:organizationId', ad.getOperatorsName);  //done
router.post('/addDepartment', ad.addDepartment);
router.get('/fetchLatestFillSubmissions/:organizationId/:status', ad.fetchLatestFillSubmissions);
router.get('/getMachinesWithPendingCheckpoints/:organizationId/:date', ad.getMachinesWithPendingCheckpoints);
router.get('/getChecklistSummary/:organizationId/:month/:year', ad.getChecklistSummary);
router.get('/getMachinesWithPendingChecklistsByFrequency/:organizationId/:date', ad.getMachinesWithPendingChecklistsByFrequency);
router.get('/getDashboardCount/:organizationId/:startDate/:endDate', ad.getDashboardCount); //done
router.get('/getChecklistCountsForDate/:organizationId/:date', ad.getChecklistCountsForDate); //done

module.exports=router;