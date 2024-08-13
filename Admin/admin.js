const pool = require('../db');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

/*------------Add Machine-----------*/
async function addMachineDetails(req, res) {
    const { machineName, machineDescription, machinelocation, status, organizationId, machineImage } = req.body;

    const machineId = uuidv4();
    const imageId = uuidv4();
    const qrId = uuidv4();

    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

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
            await client.query(imageInsertQuery, [uuidv4(), machineId, `${machineId}.${imageExtension}`, imageUrl]);

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
    const { machineId, machineName, machineDescription, machinelocation, status, machineImage } = req.body;

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
        if (status) {
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
    console.log(organizationId);

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
    console.log(machineId);

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

            // Read machine image and convert to base64 if available
            console.log(row.imagepath)
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
        if (!machineId || (status !== 0 && status !== 1)) {
            return res.status(400).json({ error: 'Valid Machine ID and status (0 or 1) are required' });
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

module.exports = {
    addMachineDetails,
    updateMachineDetails,
    deleteMachine,
    getMachineDetails,
    getAllMachineDetails,
    updateMachineStatus
};
