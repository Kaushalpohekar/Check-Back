const pool = require('../db');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const bcrypt = require('bcrypt');

/*------------Add Machine-----------*/
async function addMachineDetails(req, res) {
    const { machineName, machineDescription, machinelocation, status, machineImage } = req.body;
    const {organizationId} = req.params;

    const machineId = uuidv4();
    const imageId = uuidv4();
    const qrId = uuidv4();

    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // Ensure the status is a boolean
        if (typeof status !== 'boolean') {
            throw new Error('Status must be a boolean value');
        }

        const machineInsertQuery = `
            INSERT INTO public.machines (machineid, machinename, location, description, status, organizationid)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await client.query(machineInsertQuery, [machineId, machineName, machinelocation, machineDescription, status, organizationId]);

        const baseUrl = 'http://localhost:4000/machine';
        const qrUrl = `${baseUrl}?machineId=${machineId}`;
        const qrImagePath = path.join('qr_images', `${machineId}.png`); // Relative path

        if (!fs.existsSync(path.dirname(qrImagePath))) {
            fs.mkdirSync(path.dirname(qrImagePath), { recursive: true });
        }
        await QRCode.toFile(qrImagePath, qrUrl);

        const qrImageUrl = `/qr_images/${machineId}.png`; // URL for accessing the QR code

        const qrInsertQuery = `
            INSERT INTO public.qr_images (qrid, machineid, qrname, qrpath)
            VALUES ($1, $2, $3, $4)
        `;
        await client.query(qrInsertQuery, [qrId, machineId, `${machineId}.png`, qrImageUrl]);

        if (machineImage) {
            const base64Data = machineImage.split(';base64,').pop();
            const mimeType = machineImage.split(';')[0].split('/')[1];
            const validMimeTypes = ['jpeg', 'jpg', 'png', 'gif'];

            if (!validMimeTypes.includes(mimeType)) {
                throw new Error('Unsupported image format');
            }

            const imageExtension = mimeType === 'jpeg' ? 'jpg' : mimeType;
            const machineImagePath = path.join('images', `${machineId}.${imageExtension}`); // Relative path

            if (!fs.existsSync(path.dirname(machineImagePath))) {
                fs.mkdirSync(path.dirname(machineImagePath), { recursive: true });
            }

            fs.writeFileSync(machineImagePath, base64Data, 'base64');

            const machineImageUrl = `/images/${machineId}.${imageExtension}`; // URL for accessing the image

            const imageInsertQuery = `
                INSERT INTO public.machine_images (imageid, machineid, imagename, imagepath)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (machineid) DO UPDATE
                SET imagename = EXCLUDED.imagename,
                    imagepath = EXCLUDED.imagepath
            `;
            await client.query(imageInsertQuery, [uuidv4(), machineId, `${machineId}.${imageExtension}`, machineImageUrl]);
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Machine details, images, and QR code added successfully', machineId });
    } catch (error) {
        console.error('Error adding machine details:', error);

        if (client) {
            await client.query('ROLLBACK');
        }

        res.status(500).json({ message: 'Failed to add machine details' });
    } finally {
        if (client) {
            client.release();
        }
    }
}

/*------------Update Machine-----------*/
async function updateMachineDetails(req, res) {
    const { machineName, machineDescription, machinelocation, status, machineImage } = req.body;
    const { machineId } = req.params;

    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // Update machine details
        let updateQuery = 'UPDATE public.machines SET ';
        const updateValues = [];
        let index = 1;

        if (machineName) {
            updateQuery += `machinename = $${index++}, `;
            updateValues.push(machineName);
        }
        if (machinelocation) {
            updateQuery += `location = $${index++}, `;
            updateValues.push(machinelocation);
        }
        if (machineDescription) {
            updateQuery += `description = $${index++}, `;
            updateValues.push(machineDescription);
        }
        if (typeof status === 'boolean') {
            updateQuery += `status = $${index++}, `;
            updateValues.push(status);
        }

        // Remove trailing comma and space
        updateQuery = updateQuery.slice(0, -2);

        // Add the WHERE clause
        updateQuery += ` WHERE machineid = $${index++}`;
        updateValues.push(machineId);

        await client.query(updateQuery, updateValues);

        // Handle machine image update
        if (machineImage) {
            // Delete existing image if exists
            const existingImageQuery = `
                SELECT imagepath FROM public.machine_images WHERE machineid = $1
            `;
            const result = await client.query(existingImageQuery, [machineId]);

            if (result.rows.length > 0) {
                const existingImagePath = result.rows[0].imagepath;
                const fullPath = path.join(__dirname, '..', existingImagePath); // Go one directory up

                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            }

            // Save new image
            const base64Data = machineImage.split(';base64,').pop();
            const mimeType = machineImage.split(';')[0].split('/')[1];
            const validMimeTypes = ['jpeg', 'jpg', 'png', 'gif'];

            if (!validMimeTypes.includes(mimeType)) {
                throw new Error('Unsupported image format');
            }

            const imageExtension = mimeType === 'jpeg' ? 'jpg' : mimeType;
            const newImagePath = path.join('images', `${machineId}.${imageExtension}`); // Relative path
            const fullPath = path.join(__dirname, '..', newImagePath); // Go one directory up

            if (!fs.existsSync(path.dirname(fullPath))) {
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            }

            fs.writeFileSync(fullPath, base64Data, 'base64');

            const imageUrl = `/images/${machineId}.${imageExtension}`; // URL for accessing the image

            // Update or insert new image record
            const imageInsertQuery = `
                INSERT INTO public.machine_images (imageid, machineid, imagename, imagepath)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (machineid) DO UPDATE
                SET imagename = EXCLUDED.imagename,
                    imagepath = EXCLUDED.imagepath
            `;
            await client.query(imageInsertQuery, [uuidv4(), machineId, `${machineId}.${imageExtension}`, imageUrl]);
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Machine details updated successfully', machineId });
    } catch (error) {
        console.error('Error updating machine details:', error);

        if (client) {
            await client.query('ROLLBACK');
        }

        res.status(500).json({ message: 'Failed to update machine details' });
    } finally {
        if (client) {
            client.release();
        }
    }
}

/*------------Delete Machine-----------*/
async function deleteMachine(req, res) {
    const { machineId } = req.params; // Assuming machineId is provided as a URL parameter

    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // Get the image paths before deleting the records
        const imageQuery = `
            SELECT imagepath FROM public.machine_images WHERE machineid = $1
        `;
        const qrQuery = `
            SELECT qrpath FROM public.qr_images WHERE machineid = $1
        `;

        const [imageResult, qrResult] = await Promise.all([
            client.query(imageQuery, [machineId]),
            client.query(qrQuery, [machineId])
        ]);

        // Delete the machine record
        await client.query('DELETE FROM public.machines WHERE machineid = $1', [machineId]);

        // Delete the related images and QR codes
        await client.query('DELETE FROM public.machine_images WHERE machineid = $1', [machineId]);
        await client.query('DELETE FROM public.qr_images WHERE machineid = $1', [machineId]);

        // Remove the image files from the filesystem
        imageResult.rows.forEach(row => {
            if (fs.existsSync(row.imagepath)) {
                fs.unlinkSync(row.imagepath);
            }
        });

        // Remove the QR code files from the filesystem
        qrResult.rows.forEach(row => {
            if (fs.existsSync(row.qrpath)) {
                fs.unlinkSync(row.qrpath);
            }
        });

        await client.query('COMMIT');
        res.status(200).json({ message: 'Machine and related data deleted successfully' });
    } catch (error) {
        console.error('Error deleting machine:', error);

        if (client) {
            await client.query('ROLLBACK');
        }

        res.status(500).json({ message: 'Failed to delete machine' });
    } finally {
        if (client) {
            client.release();
        }
    }
}

/*------------------Get All Machines Using Oraganization Id----------------------*/
async function getAllMachineDetails(req, res) {
    const organizationId = req.params.organizationId;

    try {
        // Ensure required parameters are provided
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required' });
        }

        const query = `
            SELECT 
                m.machineid, m.machinename, m.location, m.description, m.status, 
                mi.imagename, mi.imagepath, qr.qrname, qr.qrpath
            FROM 
                machines m
                LEFT JOIN machine_images mi ON m.machineid = mi.machineid
                LEFT JOIN qr_images qr ON m.machineid = qr.machineid
            WHERE 
                m.organizationid = $1;
        `;

        const result = await pool.query(query, [organizationId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No machine details available for the specified organization ID' });
        }

        const machines = result.rows.reduce((acc, row) => {
            // Initialize or update machine entry in accumulator
            let machine = acc.find(m => m.machineid === row.machineid);

            if (!machine) {
                machine = {
                    machineid: row.machineid,
                    machinename: row.machinename,
                    location: row.location,
                    description: row.description,
                    status: row.status,
                    machineImage: null,
                    qrImage: null
                };
                acc.push(machine);
            }

            // Read machine image and convert to base64 if available
            if (row.imagepath) {
                try {
                    const fileBuffer = fs.readFileSync('.' + row.imagepath); // Use __dirname for relative paths
                    const base64File = fileBuffer.toString('base64');
                    const mimeType = mime.lookup(row.imagename);
                    machine.machineImage = `data:${mimeType || 'application/octet-stream'};base64,${base64File}`;
                } catch (err) {
                    console.error('Error reading machine image:', err);
                    machine.machineImage = null; // Set to null if error occurs
                }
            }

            // Read QR image and convert to base64 if available
            if (row.qrpath) {
                try {
                    const fileBuffer = fs.readFileSync('.' + row.qrpath); // Use __dirname for relative paths
                    const base64File = fileBuffer.toString('base64');
                    const mimeType = mime.lookup(row.qrname);
                    machine.qrImage = `data:${mimeType || 'application/octet-stream'};base64,${base64File}`;
                } catch (err) {
                    console.error('Error reading QR image:', err);
                    machine.qrImage = null; // Set to null if error occurs
                }
            }

            return acc;
        }, []);

        res.status(200).json(machines);
    } catch (err) {
        console.error('Error fetching machine details:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/*------------------Particular Machine Id----------------------*/
async function getMachineDetails(req, res) {
    const machineId = req.params.machineId;

    try {
        // Ensure required parameters are provided
        if (!machineId) {
            return res.status(400).json({ error: 'Machine ID is required' });
        }

        const query = `
            SELECT 
                m.machineid, m.machinename, m.location, m.description, m.status, 
                mi.imagename, mi.imagepath, qr.qrname, qr.qrpath
            FROM 
                machines m
                LEFT JOIN machine_images mi ON m.machineid = mi.machineid
                LEFT JOIN qr_images qr ON m.machineid = qr.machineid
            WHERE 
                m.machineid = $1;
        `;

        const result = await pool.query(query, [machineId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No machine details available for the specified ID' });
        }

        const machine = result.rows.map(row => {
            let machine = {
                machineid: row.machineid,
                machinename: row.machinename,
                location: row.location,
                description: row.description,
                status: row.status,
                machineImage: null,
                qrImage: null
            };

            if (row.imagepath) {
                try {
                    const fileBuffer = fs.readFileSync('.' + row.imagepath); // Use __dirname for relative paths
                    const base64File = fileBuffer.toString('base64');
                    const mimeType = mime.lookup(row.imagename);
                    machine.machineImage = `data:${mimeType || 'application/octet-stream'};base64,${base64File}`;
                } catch (err) {
                    console.error('Error reading machine image:', err);
                    machine.machineImage = null; // Set to null if error occurs
                }
            }

            // Read QR image and convert to base64 if available
            if (row.qrpath) {
                try {
                    const fileBuffer = fs.readFileSync('.' + row.qrpath); // Use __dirname for relative paths
                    const base64File = fileBuffer.toString('base64');
                    const mimeType = mime.lookup(row.qrname);
                    machine.qrImage = `data:${mimeType || 'application/octet-stream'};base64,${base64File}`;
                } catch (err) {
                    console.error('Error reading QR image:', err);
                    machine.qrImage = null; // Set to null if error occurs
                }
            }

            return machine;
        });

        res.status(200).json(machine);
    } catch (err) {
        console.error('Error fetching machine details:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/*-----------Active or Deactive the Machine--------------*/
async function updateMachineStatus(req, res) {
    const machineId = req.params.machineId;
    const status = req.body.status;

    try {
        // Ensure required parameters are provided
        if (!machineId || typeof status !== 'boolean') {
            return res.status(400).json({ error: 'Valid Machine ID and status (true or false) are required' });
        }

        const query = `
            UPDATE machines
            SET status = $1
            WHERE machineid = $2;
        `;

        const result = await pool.query(query, [status, machineId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'No machine found with the specified ID' });
        }

        res.status(200).json({ message: 'Machine status updated successfully' });
    } catch (err) {
        console.error('Error updating machine status:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}


async function addUser(req, res) {
    const {organizationId} = req.params;
    const {
        FirstName,
        LastName,
        PersonalEmail,
        password,
        ContactNO,
        rolename,
        designation,
    } = req.body;

    const user_id = uuidv4();
    const password_hash = await bcrypt.hash(password, 10);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const AdminUUIDQuery = `SELECT roleid FROM public.roles WHERE rolename = $1;`;
        const roleResult = await client.query(AdminUUIDQuery, [rolename]);

        if (roleResult.rows.length === 0) {
            throw new Error('Role not found');
        }

        const role_id = roleResult.rows[0].roleid;

        const CheckUserExistQuery = `SELECT * FROM public.users WHERE email = $1;`;
        const userResult = await client.query(CheckUserExistQuery, [PersonalEmail]);

        if (userResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'User Already Exists!' });
        }

        const InsertUserQuery = `
            INSERT INTO public.users 
            (userid, firstname, lastname, email, contact, designation, password, organizationid, roleid, created_at, verified, blocked) 
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, true, false);
        `;
        await client.query(InsertUserQuery, [
            user_id, FirstName, LastName, PersonalEmail, ContactNO, designation, password_hash, organizationId, role_id
        ]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'User registered successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error during registration:', error);
        res.status(500).json({ message: `Internal server error: ${error.message}` });

    } finally {
        client.release();
    }
}

async function updateUser(req, res) {
    const {userId} = req.params;
    const {
        FirstName,
        LastName,
        ContactNO,
        rolename,
        designation,
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Fetch the role ID for the provided role name
        const AdminUUIDQuery = `SELECT roleid FROM public.roles WHERE rolename = $1;`;
        const roleResult = await client.query(AdminUUIDQuery, [rolename]);

        if (roleResult.rows.length === 0) {
            throw new Error('Role not found');
        }

        const role_id = roleResult.rows[0].roleid;

        // Update user details excluding email, password, and organizationId
        const UpdateUserQuery = `
            UPDATE public.users
            SET firstname = $1, lastname = $2, contact = $3, designation = $4, roleid = $5
            WHERE userid = $6;
        `;
        const result = await client.query(UpdateUserQuery, [
            FirstName, LastName, ContactNO, designation, role_id, userId
        ]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User not found' });
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'User updated successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error during user update:', error);
        res.status(500).json({ message: `Internal server error: ${error.message}` });

    } finally {
        client.release();
    }
}

async function getUserDetails(req, res) {
    const { userId } = req.params;

    const client = await pool.connect();

    try {
        const GetUserQuery = `
            SELECT 
                u.userid, 
                u.firstname, 
                u.lastname, 
                u.email, 
                u.contact, 
                u.designation, 
                r.rolename, 
                u.organizationid, 
                u.created_at, 
                u.verified, 
                u.blocked
            FROM public.users u
            JOIN public.roles r ON u.roleid = r.roleid
            WHERE u.userid = $1;
        `;
        const result = await client.query(GetUserQuery, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ message: `Internal server error: ${error.message}` });

    } finally {
        client.release();
    }
}

async function getUsersByOrganization(req, res) {
    const { organizationId, rolename } = req.params;

    const client = await pool.connect();

    try {
        // Base query
        let GetUsersQuery = `
            SELECT 
                u.userid, 
                u.firstname, 
                u.lastname, 
                u.email, 
                u.contact, 
                u.designation, 
                r.rolename, 
                u.created_at, 
                u.verified, 
                u.blocked
            FROM public.users u
            JOIN public.roles r ON u.roleid = r.roleid
            WHERE u.organizationid = $1
        `;

        // Modify the query based on the rolename parameter
        if (rolename === 'Admin') {
            GetUsersQuery += ` AND r.rolename = 'Admin';`;
        } else if (rolename === 'Standard') {
            GetUsersQuery += ` AND r.rolename != 'Admin';`;
        } else {
            return res.status(400).json({ message: 'Invalid rolename provided' });
        }

        const result = await client.query(GetUsersQuery, [organizationId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No users found for this organization' });
        }

        res.status(200).json(result.rows);

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: `Internal server error: ${error.message}` });

    } finally {
        client.release();
    }
}

async function toggleUserBlock(req, res) {
    const { userId } = req.params;
    const { block } = req.body; // `block` should be a boolean: `true` to block, `false` to unblock

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const UpdateBlockStatusQuery = `
            UPDATE public.users
            SET blocked = $1
            WHERE userid = $2;
        `;
        const result = await client.query(UpdateBlockStatusQuery, [block, userId]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User not found' });
        }

        await client.query('COMMIT');
        const statusMessage = block ? 'User blocked successfully' : 'User unblocked successfully';
        res.status(200).json({ message: statusMessage });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error toggling user block status:', error);
        res.status(500).json({ message: `Internal server error: ${error.message}` });

    } finally {
        client.release();
    }
}

async function deleteUser(req, res) {
    const { userId } = req.params;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Delete related data in `user_profile`
        const DeleteUserProfileQuery = `DELETE FROM public.user_profile WHERE userid = $1;`;
        await client.query(DeleteUserProfileQuery, [userId]);

        // Delete related data in `reset_tokens`
        const DeleteResetTokensQuery = `DELETE FROM public.reset_tokens WHERE userid = $1;`;
        await client.query(DeleteResetTokensQuery, [userId]);

        // Delete the user
        const DeleteUserQuery = `DELETE FROM public.users WHERE userid = $1;`;
        const result = await client.query(DeleteUserQuery, [userId]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User not found' });
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'User and all related data deleted successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error during user deletion:', error);
        res.status(500).json({ message: `Internal server error: ${error.message}` });

    } finally {
        client.release();
    }
}


async function addRole(req, res) {
    const { rolename } = req.body;

    const role_id = uuidv4();

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Check if the role already exists
        const CheckRoleExistQuery = `SELECT * FROM public.roles WHERE rolename = $1;`;
        const roleResult = await client.query(CheckRoleExistQuery, [rolename]);

        if (roleResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Role Already Exists!' });
        }

        // Insert the new role
        const InsertRoleQuery = `
            INSERT INTO public.roles (roleid, rolename) 
            VALUES ($1, $2);
        `;
        await client.query(InsertRoleQuery, [role_id, rolename]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Role added successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error during role insertion:', error);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        client.release();
    }
}


async function addCheckpoint(req, res) {
    const {
        checkpointName,
        importantNote,
        frequency,
        machineId,
        departmentId,
        checkpointImage, // Base64 encoded image
    } = req.body;

    const checkpointId = uuidv4();
    const imageId = uuidv4();

    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // Insert new checkpoint
        const InsertCheckpointQuery = `
            INSERT INTO public.checklist
            (checkpointid, checkpointname, importantnote, frequency, machineid, departmentid)
            VALUES ($1, $2, $3, $4, $5, $6);
        `;
        await client.query(InsertCheckpointQuery, [
            checkpointId,
            checkpointName,
            importantNote,
            frequency,
            machineId,
            departmentId
        ]);

        // Process and save the image if provided
        if (checkpointImage) {
            const base64Data = checkpointImage.split(';base64,').pop();
            const mimeType = checkpointImage.split(';')[0].split('/')[1];
            const validMimeTypes = ['jpeg', 'jpg', 'png', 'gif'];

            if (!validMimeTypes.includes(mimeType)) {
                throw new Error('Unsupported image format');
            }

            const imageExtension = mimeType === 'jpeg' ? 'jpg' : mimeType;
            const imagePath = path.join('checklist_images', `${checkpointId}.${imageExtension}`); // Relative path

            if (!fs.existsSync(path.dirname(imagePath))) {
                fs.mkdirSync(path.dirname(imagePath), { recursive: true });
            }

            fs.writeFileSync(imagePath, base64Data, 'base64');

            const imageUrl = `/checklist_images/${checkpointId}.${imageExtension}`; // URL for accessing the image

            // Insert image information
            const InsertImageQuery = `
                INSERT INTO public.checklist_images
                (checkpointid, imageid, imagename, imagepath)
                VALUES ($1, $2, $3, $4);
            `;
            await client.query(InsertImageQuery, [checkpointId, imageId, `${checkpointId}.${imageExtension}`, imageUrl]);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Checkpoint and image added successfully', checkpointId });

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error adding checkpoint:', error);
        res.status(500).json({ message: `Internal server error: ${error.message}` });

    } finally {
        if (client) {
            client.release();
        }
    }
}

async function getCheckpointDetails(req, res) {
    const checkpointId = req.params.checkpointId;

    try {
        // Ensure required parameters are provided
        if (!checkpointId) {
            return res.status(400).json({ error: 'Checkpoint ID is required' });
        }

        const query = `
            SELECT 
                c.checkpointid, c.checkpointname, c.importantnote, c.frequency,
                c.machineid, c.departmentid, ci.imagename, ci.imagepath
            FROM 
                public.checklist c
                LEFT JOIN public.checklist_images ci ON c.checkpointid = ci.checkpointid
            WHERE 
                c.checkpointid = $1;
        `;

        const result = await pool.query(query, [checkpointId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No checkpoint details available for the specified ID' });
        }

        const checkpoint = result.rows.map(row => {
            let checkpoint = {
                checkpointid: row.checkpointid,
                checkpointname: row.checkpointname,
                importantnote: row.importantnote,
                frequency: row.frequency,
                machineid: row.machineid,
                departmentid: row.departmentid,
                checkpointImage: null
            };

            // Read checkpoint image and convert to base64 if available
            if (row.imagepath) {
                try {
                    const fileBuffer = fs.readFileSync('.' + row.imagepath); // Use __dirname for relative paths
                    const base64File = fileBuffer.toString('base64');
                    const mimeType = mime.lookup(row.imagename);
                    checkpoint.checkpointImage = `data:${mimeType || 'application/octet-stream'};base64,${base64File}`;
                } catch (err) {
                    console.error('Error reading checkpoint image:', err);
                    checkpoint.checkpointImage = null; // Set to null if error occurs
                }
            }

            return checkpoint;
        });

        res.status(200).json(checkpoint);
    } catch (err) {
        console.error('Error fetching checkpoint details:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getCheckpointsByMachineAndFrequency(req, res) {
    const { machineId, frequency } = req.params;

    try {
        // Ensure required parameters are provided
        if (!machineId || !frequency) {
            return res.status(400).json({ error: 'Machine ID and Frequency are required' });
        }

        const query = `
            SELECT 
                c.checkpointid, c.checkpointname, c.importantnote, c.frequency,
                ci.imagename, ci.imagepath
            FROM 
                public.checklist c
                LEFT JOIN public.checklist_images ci ON c.checkpointid = ci.checkpointid
            WHERE 
                c.machineid = $1 AND c.frequency = $2;
        `;

        const result = await pool.query(query, [machineId, frequency]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No checkpoints available for the specified machine and frequency' });
        }

        const checkpoints = result.rows.map(row => {
            let checkpoint = {
                checkpointid: row.checkpointid,
                checkpointname: row.checkpointname,
                importantnote: row.importantnote,
                frequency: row.frequency,
                checkpointImage: null
            };

            // Read checkpoint image and convert to base64 if available
            if (row.imagepath) {
                try {
                    const fileBuffer = fs.readFileSync('.' + row.imagepath); // Use __dirname for relative paths
                    const base64File = fileBuffer.toString('base64');
                    const mimeType = mime.lookup(row.imagename);
                    checkpoint.checkpointImage = `data:${mimeType || 'application/octet-stream'};base64,${base64File}`;
                } catch (err) {
                    console.error('Error reading checkpoint image:', err);
                    checkpoint.checkpointImage = null; // Set to null if error occurs
                }
            }

            return checkpoint;
        });

        res.status(200).json(checkpoints);
    } catch (err) {
        console.error('Error fetching checkpoints:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function submission(req, res) {
    const {
        machineId,
        departmentId,
        checkListId,
        userStatus,
        userRemarks,
        uploadedImage,
        frequency,
        submittedBy,
        organizationId
    } = req.body;

    const submissionId = uuidv4();
    const uploadedImageId = uuidv4(); // Image ID for the uploaded image

    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // Process and save the uploaded image if provided
        let uploadedImageUrl = null;
        if (uploadedImage) {
            const base64Data = uploadedImage.split(';base64,').pop();
            const mimeType = uploadedImage.split(';')[0].split('/')[1];
            const validMimeTypes = ['jpeg', 'jpg', 'png', 'gif'];

            if (!validMimeTypes.includes(mimeType)) {
                throw new Error('Unsupported image format');
            }

            const imageExtension = mimeType === 'jpeg' ? 'jpg' : mimeType;
            const imagePath = path.join('submission_images', `${uploadedImageId}.${imageExtension}`); // Relative path

            if (!fs.existsSync(path.dirname(imagePath))) {
                fs.mkdirSync(path.dirname(imagePath), { recursive: true });
            }

            fs.writeFileSync(imagePath, base64Data, 'base64');

            uploadedImageUrl = `/submission_images/${uploadedImageId}.${imageExtension}`; // URL for accessing the image

            // Insert uploaded image information
            const InsertSubmissionImageQuery = `
                INSERT INTO public.submission_images
                (imageid, imagename, imagepath)
                VALUES ($1, $2, $3);
            `;
            await client.query(InsertSubmissionImageQuery, [uploadedImageId, `${uploadedImageId}.${imageExtension}`, uploadedImageUrl]);
        }

        // Determine actual_checklist_imageid if checkpointId is provided
        let actualChecklistImageId = null;
        if (checkListId) {
            const CheckpointImageQuery = `
                SELECT imageid
                FROM public.checklist_images
                WHERE checkpointid = $1;
            `;
            const result = await client.query(CheckpointImageQuery, [checkListId]);
            if (result.rows.length > 0) {
                actualChecklistImageId = result.rows[0].imageid;
            }
        }

        // Insert into checklist_submissions table
        const InsertSubmissionQuery = `
            INSERT INTO public.checklist_submissions
            (submissionid, departmentid, machineid, submission_date, checklistid, user_remarks,
            actual_checklist_imageid, uploaded_checklist_imageid, maintenance_remarks, maintenance_imageid,
            frequency, admin_action, submittedby, organizationid, user_status, maintenance_status)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, NULL, NULL, $8, FALSE, $9, $10, $11, $12);
        `;
        await client.query(InsertSubmissionQuery, [
            submissionId,
            departmentId,
            machineId,
            checkListId,
            userRemarks,
            actualChecklistImageId, // Set actualChecklistImageId
            uploadedImageId,
            frequency,
            submittedBy,
            organizationId,
            userStatus,
            null // maintenance_status is set to NULL by default
        ]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Submission added successfully', submissionId });

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error adding submission:', error);
        res.status(500).json({ message: `Internal server error: ${error.message}` });

    } finally {
        if (client) {
            client.release();
        }
    }
}

async function updateSubmissionMaintenance(req, res) {
    const {
        maintenanceStatus,
        maintenanceRemarks,
        maintenanceImage
    } = req.body;

    const{
        submissionId,
    } = req.params;

    const maintenanceImageId = uuidv4(); // Image ID for the maintenance image

    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        let maintenanceImageUrl = null;
        if (maintenanceImage) {
            const base64Data = maintenanceImage.split(';base64,').pop();
            const mimeType = maintenanceImage.split(';')[0].split('/')[1];
            const validMimeTypes = ['jpeg', 'jpg', 'png', 'gif'];

            if (!validMimeTypes.includes(mimeType)) {
                throw new Error('Unsupported image format');
            }

            const imageExtension = mimeType === 'jpeg' ? 'jpg' : mimeType;
            const imagePath = path.join('maintenance_images', `${maintenanceImageId}.${imageExtension}`); // Relative path

            if (!fs.existsSync(path.dirname(imagePath))) {
                fs.mkdirSync(path.dirname(imagePath), { recursive: true });
            }

            fs.writeFileSync(imagePath, base64Data, 'base64');

            maintenanceImageUrl = `/maintenance_images/${maintenanceImageId}.${imageExtension}`; // URL for accessing the image

            // Insert maintenance image information
            const InsertMaintenanceImageQuery = `
                INSERT INTO public.maintenance_images
                (imageid, imagename, imagepath)
                VALUES ($1, $2, $3);
            `;
            await client.query(InsertMaintenanceImageQuery, [maintenanceImageId, `${maintenanceImageId}.${imageExtension}`, maintenanceImageUrl]);
        }

        // Update checklist submission with new values
        const UpdateSubmissionQuery = `
            UPDATE public.checklist_submissions
            SET maintenance_status = $1,
                maintenance_remarks = $2,
                maintenance_imageid = $3
            WHERE submissionid = $4;
        `;

        await client.query(UpdateSubmissionQuery, [
            maintenanceStatus,
            maintenanceRemarks,
            maintenanceImageId, // Set maintenanceImageId if provided
            submissionId
        ]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Submission updated successfully' });

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error updating submission:', error);
        res.status(500).json({ message: `Internal server error: ${error.message}` });

    } finally {
        if (client) {
            client.release();
        }
    }
}

async function toggleAdminStatus(req, res) {
    const { submissionId } = req.params;
    const { action } = req.body; // `active` should be a boolean: `true` to activate, `false` to deactivate

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const updateStatusQuery = `
            UPDATE public.checklist_submissions
            SET admin_action = $1
            WHERE submissionid = $2;
        `;
        const result = await client.query(updateStatusQuery, [action, submissionId]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Submission not found' });
        }

        await client.query('COMMIT');
        const statusMessage = action ? 'User activated successfully' : 'User deactivated successfully';
        res.status(200).json({ message: statusMessage });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error toggling user status:', error);
        res.status(500).json({ message: `Internal server error: ${error.message}` });

    } finally {
        client.release();
    }
}

async function getCheckpointStatusCounts(req, res) {
    const organizationId = req.params.organizationId;

    try {
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required' });
        }

        // Query to get total counts and counts by frequency
        const query = `
            SELECT
                COUNT(*) AS total_checkpoints,
                COUNT(CASE 
                    WHEN user_status = 'ok' AND maintenance_status = 'ok' AND user_status IS NOT NULL AND maintenance_status IS NOT NULL THEN 1 
                END) AS done_checkpoints,
                COUNT(CASE 
                    WHEN frequency = 'Daily' THEN 1 
                END) AS daily_count,
                COUNT(CASE 
                    WHEN frequency = 'Weekly' THEN 1 
                END) AS weekly_count,
                COUNT(CASE 
                    WHEN frequency = 'Monthly' THEN 1 
                END) AS monthly_count,
                COUNT(CASE 
                    WHEN frequency = 'Yearly' THEN 1 
                END) AS yearly_count
            FROM 
                public.checklist_submissions
            WHERE 
                organizationid = $1
        `;

        const result = await pool.query(query, [organizationId]);

        const row = result.rows[0];

        // Split the done checkpoints by frequency
        const doneCheckpointsByFrequency = await pool.query(`
            SELECT
                frequency,
                COUNT(*) AS done_count
            FROM
                public.checklist_submissions
            WHERE
                organizationid = $1
                AND user_status = 'ok'
                AND maintenance_status = 'ok'
                AND user_status IS NOT NULL
                AND maintenance_status IS NOT NULL
            GROUP BY
                frequency
        `, [organizationId]);

        // Convert the done checkpoints by frequency to an object
        const doneCounts = doneCheckpointsByFrequency.rows.reduce((acc, row) => {
            acc[row.frequency] = parseInt(row.done_count, 10);
            return acc;
        }, {});

        const counts = {
            Total: {
                total: parseInt(row.total_checkpoints, 10),
                done: parseInt(doneCounts['Daily'] || 0, 10) +
                    parseInt(doneCounts['Weekly'] || 0, 10) +
                    parseInt(doneCounts['Monthly'] || 0, 10) +
                    parseInt(doneCounts['Yearly'] || 0, 10)
            },
            Daily: {
                total: parseInt(row.daily_count, 10),
                done: parseInt(doneCounts['Daily'] || 0, 10)
            },
            Weekly: {
                total: parseInt(row.weekly_count, 10),
                done: parseInt(doneCounts['Weekly'] || 0, 10)
            },
            Monthly: {
                total: parseInt(row.monthly_count, 10),
                done: parseInt(doneCounts['Monthly'] || 0, 10)
            },
            Yearly: {
                total: parseInt(row.yearly_count, 10),
                done: parseInt(doneCounts['Yearly'] || 0, 10)
            }
        };

        // Calculate remaining counts for each period
        for (const period in counts) {
            counts[period].remaining = counts[period].total - counts[period].done;
        }

        res.status(200).json(counts);
    } catch (err) {
        console.error('Error fetching checkpoint status counts:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getMachineDailyCounts(req, res) {
    const organizationId = req.params.organizationId;

    try {
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required' });
        }

        // Query to get the total and done counts for daily frequency for each machine in the specified organization
        const query = `
            SELECT
                m.machineid AS machineId,
                m.machinename AS machineName,
                COALESCE(COUNT(cs.machineid), 0) AS totalDailyCount,
                COALESCE(COUNT(CASE 
                    WHEN cs.user_status = 'ok' AND cs.maintenance_status = 'ok' 
                    AND cs.user_status IS NOT NULL AND cs.maintenance_status IS NOT NULL 
                    THEN cs.machineid 
                END), 0) AS doneDailyCount
            FROM
                public.machines m
            LEFT JOIN
                public.checklist_submissions cs
            ON
                m.machineid = cs.machineid
                AND cs.frequency = 'Daily'
            WHERE
                m.organizationid = $1
            GROUP BY
                m.machineid, m.machinename;
        `;

        const result = await pool.query(query, [organizationId]);

        // Process the results with correct conversion
        const machineCounts = result.rows.map(row => ({
            machineId: row.machineid,
            machineName: row.machinename,
            totalDailyCount: parseInt(row.totaldailycount, 10) || 0,
            doneDailyCount: parseInt(row.donedailycount, 10) || 0,
            remainingDailyCount: (parseInt(row.totaldailycount, 10) || 0) - (parseInt(row.donedailycount, 10) || 0)
        }));

        res.status(200).json(machineCounts);
    } catch (err) {
        console.error('Error fetching machine daily counts:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getMachineWeeklyCounts(req, res) {
    const organizationId = req.params.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    try {
        // Query to get the total and done counts for Weekly frequency for each machine in the specified organization
        const query = `
            SELECT
                m.machineid AS machineId,
                m.machinename AS machineName,
                COALESCE(COUNT(cs.machineid), 0) AS totalWeeklyCount,
                COALESCE(COUNT(CASE 
                    WHEN cs.user_status = 'ok' AND cs.maintenance_status = 'ok' 
                    AND cs.user_status IS NOT NULL AND cs.maintenance_status IS NOT NULL 
                    THEN cs.machineid 
                END), 0) AS doneWeeklyCount
            FROM
                public.machines m
            LEFT JOIN
                public.checklist_submissions cs
            ON
                m.machineid = cs.machineid
                AND cs.frequency = 'Weekly'
            WHERE
                m.organizationid = $1
            GROUP BY
                m.machineid, m.machinename;
        `;

        const result = await pool.query(query, [organizationId]);

        // Process the results with correct conversion
        const machineCounts = result.rows.map(row => ({
            machineId: row.machineid,
            machineName: row.machinename,
            totalWeeklyCount: parseInt(row.totalweeklycount, 10) || 0,
            doneWeeklyCount: parseInt(row.doneweeklycount, 10) || 0,
            remainingWeeklyCount: (parseInt(row.totalweeklycount, 10) || 0) - (parseInt(row.doneweeklycount, 10) || 0)
        }));

        res.status(200).json(machineCounts);
    } catch (err) {
        console.error('Error fetching machine weekly counts:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getMachineMonthlyCounts(req, res) {
    const organizationId = req.params.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    try {
        // Query to get the total and done counts for Monthly frequency for each machine in the specified organization
        const query = `
            SELECT
                m.machineid AS machineId,
                m.machinename AS machineName,
                COALESCE(COUNT(cs.machineid), 0) AS totalMonthlyCount,
                COALESCE(COUNT(CASE 
                    WHEN cs.user_status = 'ok' AND cs.maintenance_status = 'ok' 
                    AND cs.user_status IS NOT NULL AND cs.maintenance_status IS NOT NULL 
                    THEN cs.machineid 
                END), 0) AS doneMonthlyCount
            FROM
                public.machines m
            LEFT JOIN
                public.checklist_submissions cs
            ON
                m.machineid = cs.machineid
                AND cs.frequency = 'Monthly'
            WHERE
                m.organizationid = $1
            GROUP BY
                m.machineid, m.machinename;
        `;

        const result = await pool.query(query, [organizationId]);

        // Process the results with correct conversion
        const machineCounts = result.rows.map(row => ({
            machineId: row.machineid,
            machineName: row.machinename,
            totalMonthlyCount: parseInt(row.totalmonthlycount, 10) || 0,
            doneMonthlyCount: parseInt(row.donemonthlycount, 10) || 0,
            remainingMonthlyCount: (parseInt(row.totalmonthlycount, 10) || 0) - (parseInt(row.donemonthlycount, 10) || 0)
        }));

        res.status(200).json(machineCounts);
    } catch (err) {
        console.error('Error fetching machine monthly counts:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getMachineYearlyCounts(req, res) {
    const organizationId = req.params.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    try {
        // Query to get the total and done counts for Yearly frequency for each machine in the specified organization
        const query = `
            SELECT
                m.machineid AS machineId,
                m.machinename AS machineName,
                COALESCE(COUNT(cs.machineid), 0) AS totalYearlyCount,
                COALESCE(COUNT(CASE 
                    WHEN cs.user_status = 'ok' AND cs.maintenance_status = 'ok' 
                    AND cs.user_status IS NOT NULL AND cs.maintenance_status IS NOT NULL 
                    THEN cs.machineid 
                END), 0) AS doneYearlyCount
            FROM
                public.machines m
            LEFT JOIN
                public.checklist_submissions cs
            ON
                m.machineid = cs.machineid
                AND cs.frequency = 'Yearly'
            WHERE
                m.organizationid = $1
            GROUP BY
                m.machineid, m.machinename;
        `;

        const result = await pool.query(query, [organizationId]);

        // Process the results with correct conversion
        const machineCounts = result.rows.map(row => ({
            machineId: row.machineid,
            machineName: row.machinename,
            totalYearlyCount: parseInt(row.totalyearlycount, 10) || 0,
            doneYearlyCount: parseInt(row.doneyearlycount, 10) || 0,
            remainingYearlyCount: (parseInt(row.totalyearlycount, 10) || 0) - (parseInt(row.doneyearlycount, 10) || 0)
        }));

        res.status(200).json(machineCounts);
    } catch (err) {
        console.error('Error fetching machine yearly counts:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getMaintenanceCountsByDepartment(req, res) {
    const organizationId = req.params.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    try {
        // SQL query to get maintenance counts for Electrical and Mechanical departments
        const query = `
            SELECT
                d.departmentname AS departmentname,
                COUNT(cs.submissionid) AS totalCount,
                COUNT(CASE 
                    WHEN cs.user_status = 'ok' AND cs.maintenance_status = 'ok' 
                    THEN cs.submissionid 
                END) AS doneCount
            FROM
                public.checklist_submissions cs
            JOIN
                public.departments d
            ON
                cs.departmentid = d.departmentid
            WHERE
                d.departmentname IN ('Electrical', 'Mechanical') AND cs.organizationid = $1
            GROUP BY
                d.departmentname;
        `;

        const result = await pool.query(query, [organizationId]);

        // Process the results
        const departmentCounts = result.rows.reduce((accumulator, row) => {
            const totalCount = parseInt(row.totalcount, 10) || 0;
            const doneCount = parseInt(row.donecount, 10) || 0;
            
            accumulator[row.departmentname] = {
                totalCount: totalCount,
                doneCount: doneCount,
                pendingCount: totalCount - doneCount
            };
        
            return accumulator;
        }, {});

        res.status(200).json(departmentCounts);
    } catch (err) {
        console.error('Error fetching maintenance counts by department:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getDetailedMaintenanceSubmissions(req, res) {
    const organizationId = req.params.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    try {
        // SQL query to get detailed checklist submissions with user and maintenance details
        const query = `
            SELECT
                cs.submissionid,
                d.departmentname,
                m.machinename,
                m."location" AS machine_location,
                m.description AS machine_description,
                c.checkpointname,
                c.importantnote,
                c.frequency,
                cs.user_status,
                cs.maintenance_status,
                cs.user_remarks,
                cs.maintenance_remarks,
                u.firstname || ' ' || u.lastname AS submitted_by,
                cs.submission_date as date_time
            FROM
                public.checklist_submissions cs
            JOIN
                public.departments d
            ON
                cs.departmentid = d.departmentid
            JOIN
                public.machines m
            ON
                cs.machineid = m.machineid
            JOIN
                public.checklist c
            ON
                cs.checklistid = c.checkpointid
            JOIN
                public.users u
            ON
                cs.submittedby = u.userid
            WHERE cs.organizationid = $1;
        `;

        const result = await pool.query(query, [organizationId]);

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching detailed maintenance submissions with user details:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}


async function getDetailedMaintenanceMyWorkDoneSubmissions(req, res) {
    const organizationId = req.params.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    try {
        const query = `
            SELECT
                cs.submissionid,
                d.departmentname,
                m.machinename,
                m."location" AS machine_location,
                m.description AS machine_description,
                c.checkpointname,
                c.importantnote,
                c.frequency,
                cs.user_status,
                cs.maintenance_status,
                cs.user_remarks,
                cs.maintenance_remarks,
                u.firstname || ' ' || u.lastname AS submitted_by,
                cs.submission_date as date_time,
                ci.imagename AS checkpoint_image_name,
                ci.imagepath AS checkpoint_image_path,
                si.imagename AS uploaded_image_name,
                si.imagepath AS uploaded_image_path,
                mi.imagename AS maintenance_image_name,
                mi.imagepath AS maintenance_image_path
            FROM
                public.checklist_submissions cs
            JOIN
                public.departments d ON cs.departmentid = d.departmentid
            JOIN
                public.machines m ON cs.machineid = m.machineid
            JOIN
                public.checklist c ON cs.checklistid = c.checkpointid
            JOIN
                public.users u ON cs.submittedby = u.userid
            LEFT JOIN
                public.checklist_images ci ON cs.actual_checklist_imageid = ci.imageid
            LEFT JOIN
                public.submission_images si ON cs.uploaded_checklist_imageid = si.imageid
            LEFT JOIN
                public.maintenance_images mi ON cs.maintenance_imageid = mi.imageid
            WHERE
                cs.organizationid = $1 AND cs.maintenance_status = 'ok';
        `;

        const result = await pool.query(query, [organizationId]);

        const submissions = result.rows.map(row => {
            const submission = {
                submissionid: row.submissionid,
                departmentname: row.departmentname,
                machinename: row.machinename,
                machine_location: row.machine_location,
                machine_description: row.machine_description,
                checkpointname: row.checkpointname,
                importantnote: row.importantnote,
                frequency: row.frequency,
                user_status: row.user_status,
                maintenance_status: row.maintenance_status,
                user_remarks: row.user_remarks,
                maintenance_remarks: row.maintenance_remarks,
                submitted_by: row.submitted_by,
                date_time: row.date_time,
                checkpointImage: null,
                uploadedImage: null,
                maintenanceImage: null
            };

            // Convert images to base64
            const convertImageToBase64 = (imagePath, imageName) => {
                if (imagePath) {
                    try {
                        const fileBuffer = fs.readFileSync('.' + imagePath); // Use __dirname for relative paths
                        const base64File = fileBuffer.toString('base64');
                        const mimeType = mime.lookup(imageName);
                        return `data:${mimeType || 'application/octet-stream'};base64,${base64File}`;
                    } catch (err) {
                        console.error(`Error reading image (${imageName}):`, err);
                        return null;
                    }
                }
                return null;
            };

            submission.checkpointImage = convertImageToBase64(row.checkpoint_image_path, row.checkpoint_image_name);
            submission.uploadedImage = convertImageToBase64(row.uploaded_image_path, row.uploaded_image_name);
            submission.maintenanceImage = convertImageToBase64(row.maintenance_image_path, row.maintenance_image_name);

            return submission;
        });

        res.status(200).json(submissions);
    } catch (err) {
        console.error('Error fetching detailed maintenance submissions with user details:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getDetailedMaintenanceTodoSubmissions(req, res) {
    const organizationId = req.params.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    try {
        const query = `
            SELECT
                cs.submissionid,
                d.departmentname,
                m.machinename,
                m."location" AS machine_location,
                m.description AS machine_description,
                c.checkpointname,
                c.importantnote,
                c.frequency,
                cs.user_status,
                cs.maintenance_status,
                cs.user_remarks,
                cs.maintenance_remarks,
                u.firstname || ' ' || u.lastname AS submitted_by,
                cs.submission_date as date_time,
                ci.imagename AS checkpoint_image_name,
                ci.imagepath AS checkpoint_image_path,
                si.imagename AS uploaded_image_name,
                si.imagepath AS uploaded_image_path,
                mi.imagename AS maintenance_image_name,
                mi.imagepath AS maintenance_image_path
            FROM
                public.checklist_submissions cs
            JOIN
                public.departments d ON cs.departmentid = d.departmentid
            JOIN
                public.machines m ON cs.machineid = m.machineid
            JOIN
                public.checklist c ON cs.checklistid = c.checkpointid
            JOIN
                public.users u ON cs.submittedby = u.userid
            LEFT JOIN
                public.checklist_images ci ON cs.actual_checklist_imageid = ci.imageid
            LEFT JOIN
                public.submission_images si ON cs.uploaded_checklist_imageid = si.imageid
            LEFT JOIN
                public.maintenance_images mi ON cs.maintenance_imageid = mi.imageid
            WHERE
                cs.organizationid = $1 AND (cs.maintenance_status IS NULL OR cs.maintenance_status <> 'ok');
        `;

        const result = await pool.query(query, [organizationId]);

        const submissions = result.rows.map(row => {
            const submission = {
                submissionid: row.submissionid,
                departmentname: row.departmentname,
                machinename: row.machinename,
                machine_location: row.machine_location,
                machine_description: row.machine_description,
                checkpointname: row.checkpointname,
                importantnote: row.importantnote,
                frequency: row.frequency,
                user_status: row.user_status,
                maintenance_status: row.maintenance_status,
                user_remarks: row.user_remarks,
                maintenance_remarks: row.maintenance_remarks,
                submitted_by: row.submitted_by,
                date_time: row.date_time,
                checkpointImage: null,
                uploadedImage: null,
                maintenanceImage: null
            };

            // Convert images to base64
            const convertImageToBase64 = (imagePath, imageName) => {
                if (imagePath) {
                    try {
                        const fileBuffer = fs.readFileSync('.' + imagePath); // Use __dirname for relative paths
                        const base64File = fileBuffer.toString('base64');
                        const mimeType = mime.lookup(imageName);
                        return `data:${mimeType || 'application/octet-stream'};base64,${base64File}`;
                    } catch (err) {
                        console.error(`Error reading image (${imageName}):`, err);
                        return null;
                    }
                }
                return null;
            };

            submission.checkpointImage = convertImageToBase64(row.checkpoint_image_path, row.checkpoint_image_name);
            submission.uploadedImage = convertImageToBase64(row.uploaded_image_path, row.uploaded_image_name);
            submission.maintenanceImage = convertImageToBase64(row.maintenance_image_path, row.maintenance_image_name);

            return submission;
        });

        res.status(200).json(submissions);
    } catch (err) {
        console.error('Error fetching detailed maintenance submissions with user details:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getStandardSubmissions(req, res) {
    const userId = req.params.userId;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const query = `
            SELECT
                d.departmentname,
                m.machinename,
                c.checkpointname,
                cs.frequency,
                cs.user_status,
                cs.submission_date as submitted_date,
                cs.maintenance_status,
                cs.admin_action
            FROM
                public.checklist_submissions cs
            JOIN
                public.departments d ON cs.departmentid = d.departmentid
            JOIN
                public.machines m ON cs.machineid = m.machineid
            JOIN
                public.checklist c ON cs.checklistid = c.checkpointid
            WHERE
                cs.submittedby = $1;
        `;

        const result = await pool.query(query, [userId]);

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching maintenance submissions:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getAdminSubmissions(req, res) {
    const { organizationId } = req.params;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    try {
        const query = `
            SELECT
                d.departmentname,
                m.machinename,
                c.checkpointname,
                cs.frequency,
                cs.user_status,
                cs.submission_date AS submitted_date,
                cs.maintenance_status,
                cs.admin_action,
                CONCAT(u.firstname, ' ', u.lastname) AS operator
            FROM
                public.checklist_submissions cs
            JOIN
                public.departments d ON cs.departmentid = d.departmentid
            JOIN
                public.machines m ON cs.machineid = m.machineid
            JOIN
                public.checklist c ON cs.checklistid = c.checkpointid
            JOIN
                public.users u ON cs.submittedby = u.userid
            WHERE
                cs.organizationid = $1;
        `;

        const result = await pool.query(query, [organizationId]);

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching maintenance submissions:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}


module.exports = {
    addMachineDetails,
    updateMachineDetails,
    deleteMachine,
    getMachineDetails,
    getAllMachineDetails,
    updateMachineStatus,
    addUser,
    updateUser,
    getUserDetails,
    getUsersByOrganization,
    toggleUserBlock,
    deleteUser,
    addRole,
    addCheckpoint,
    getCheckpointDetails,
    getCheckpointsByMachineAndFrequency,
    submission,
    updateSubmissionMaintenance,
    toggleAdminStatus,
    getCheckpointStatusCounts,
    getMachineDailyCounts,
    getMachineWeeklyCounts,
    getMachineMonthlyCounts,
    getMachineYearlyCounts,
    getMaintenanceCountsByDepartment,
    getDetailedMaintenanceSubmissions,
    getDetailedMaintenanceMyWorkDoneSubmissions,
    getDetailedMaintenanceTodoSubmissions,
    getStandardSubmissions,
    getAdminSubmissions
};
