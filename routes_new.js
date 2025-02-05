const express = require('express');
const router = express.Router();
const auth = require('./auth/auth.js');
const ad = require('./Admin/admin.js');
const {authenticateUser} = require('./token/jwtUtils.js');
/*-------------------Authentication----------------------------*/
router.post('/register', auth.register);  //done
router.post('/login', auth.login);  //done
router.post('/forgot', auth.forgotPassword);
router.post('/resend-forgot', auth.resendResetToken);
router.post('/reset-password', auth.resetPassword);
router.get('/user', auth.getUserDetails);  //done

/*-------------Admin---------------------------------------------*/
/*----Machine CRUD------*/
router.post('/addMachine/:organizationId',authenticateUser, ad.addMachineDetails);  //done
router.put('/updateMachine/:machineId',authenticateUser, ad.updateMachineDetails);  //done
router.delete('/deleteMachine/:machineId',authenticateUser, ad.deleteMachine); //done
router.get('/getAllMachineDetails/:organizationId',authenticateUser, ad.getAllMachineDetails) //done
router.get('/getMachineDetails/:machineId',authenticateUser, ad.getMachineDetails);  //done
router.put('/updateStatus/:machineId',authenticateUser, ad.updateMachineStatus);  //done

/*----Users CRUD------*/
router.post('/addUser/:organizationId',authenticateUser, ad.addUser);  //done
router.put('/updateUser/:userId',authenticateUser, ad.updateUser);  //done
router.get('/getUserDetails/:userId',authenticateUser, ad.getUserDetails);  //
router.get('/getUsersByOrganization/:organizationId/:rolename',authenticateUser, ad.getUsersByOrganization);  //done
router.put('/toggleUserBlock/:userId',authenticateUser, ad.toggleUserBlock);  //done
router.delete('/deleteUser/:userId',authenticateUser, ad.deleteUser);  //done
router.post('/addRole',authenticateUser, ad.addRole);  //

/*----CheckPoints CRUD------*/
router.post('/addCheckpoint',authenticateUser, ad.addCheckpoint);
router.get('/getCheckpointDetails/:checkpointId',authenticateUser, ad.getCheckpointDetails);  //done
router.get('/getCheckpointsByMachineAndFrequency/:machineId/:frequency',authenticateUser, ad.getCheckpointsByMachineAndFrequency);  //done
router.get('/getCheckpointsByMachine/:machineId',authenticateUser, ad.getCheckpointsByMachine);  //done

/*----Submission-----*/
router.post('/submission',authenticateUser, ad.submission);
router.put('/submissionId/:submissionId',authenticateUser, ad.updateSubmissionMaintenance);
router.put('/toggleAdminStatus/:submissionId',authenticateUser, ad.toggleAdminStatus);  //done
router.get('/getCheckpointStatusCounts/:organizationId',authenticateUser, ad.getCheckpointStatusCounts); //done
router.get('/getMachineDailyCounts/:organizationId',authenticateUser, ad.getMachineDailyCounts);  //done
router.get('/getMachineWeeklyCounts/:organizationId',authenticateUser, ad.getMachineWeeklyCounts);  //done
router.get('/getMachineMonthlyCounts/:organizationId',authenticateUser, ad.getMachineMonthlyCounts);  //done
router.get('/getMachineYearlyCounts/:organizationId',authenticateUser, ad.getMachineYearlyCounts);  //done
router.get('/getMachineCounts/:organizationId/:frequency',authenticateUser, ad.getMachineCounts); 

router.get('/getMaintenanceCountsByDepartment/:organizationId',authenticateUser, ad.getMaintenanceCountsByDepartment);  //done
router.get('/getDetailedMaintenanceSubmissions/:organizationId',authenticateUser, ad.getDetailedMaintenanceSubmissions);  //done
router.get('/getDetailedMaintenanceMyWorkDoneSubmissions/:organizationId',authenticateUser, ad.getDetailedMaintenanceMyWorkDoneSubmissions);  //done
router.get('/getDetailedMaintenanceTodoSubmissions/:organizationId',authenticateUser, ad.getDetailedMaintenanceTodoSubmissions);  //done
router.get('/getStandardSubmissions/:userId',authenticateUser, ad.getStandardSubmissions);
router.get('/getAdminSubmissions/:organizationId',authenticateUser, ad.getAdminSubmissions);
router.get('/getSubmissionDetails/:submissionId',authenticateUser, ad.getSubmissionDetails);  //done

/*-------------*/
router.get('/getAllMachine/:organizationId',authenticateUser, ad.getAllMachine);
router.get('/getAllDepartments',authenticateUser, ad.getAllDepartments);  //done
router.get('/getOperatorsName/:organizationId',authenticateUser, ad.getOperatorsName);  //done
router.post('/addDepartment',authenticateUser, ad.addDepartment);
router.get('/fetchLatestFillSubmissions/:organizationId/:status',authenticateUser, ad.fetchLatestFillSubmissions);
router.get('/getMachinesWithPendingCheckpoints/:organizationId/:date',authenticateUser, ad.getMachinesWithPendingCheckpoints);
router.get('/getChecklistSummary/:organizationId/:month/:year',authenticateUser, ad.getChecklistSummary);
router.get('/getMachinesWithPendingChecklistsByFrequency/:organizationId/:date',authenticateUser, ad.getMachinesWithPendingChecklistsByFrequency);
router.get('/getDashboardCount/:organizationId/:startDate/:endDate',authenticateUser, ad.getDashboardCount); //done
router.get('/getChecklistCountsForDate/:organizationId/:date',authenticateUser, ad.getChecklistCountsForDate); //done

module.exports=router;