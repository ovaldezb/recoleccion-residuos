const { GoogleSpreadsheet } = require('google-spreadsheet');

let doc = null;
let isDocLoaded = false;

const getDoc = async () => {
    if (doc && isDocLoaded) return doc;

    try {
        doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);

        let privateKey = process.env.GOOGLE_PRIVATE_KEY;
        if (privateKey && privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.substring(1, privateKey.length - 1);
        }

        await doc.useServiceAccountAuth({
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: privateKey ? privateKey.replace(/\\n/g, '\n') : '',
        });

        await doc.loadInfo();
        isDocLoaded = true;
        return doc;
    } catch (error) {
        doc = null;
        isDocLoaded = false;
        throw error;
    }
};

// We assume:
// Sheet 0: "Sessions" (Header: Phone, State, Name, Location, Type, Day, Comment)
// Sheet 1: "Completed" (Header: Phone, Name, Location, Type, Day, Comment, Date)

const getSession = async (phoneNumber) => {
    const doc = await getDoc();
    const sheet = doc.sheetsByIndex[0]; // Sessions sheet
    const rows = await sheet.getRows();

    const userRow = rows.find(row => row.Phone === phoneNumber);

    if (userRow) {
        return {
            phone: userRow.Phone,
            state: userRow.State,
            name: userRow.Name,
            location: userRow.Location,
            type: userRow.Type,
            day: userRow.Day,
            comment: userRow.Comment,
            _row: userRow // Internal use
        };
    }
    return null;
};

const createSession = async (phoneNumber, name = '') => {
    const doc = await getDoc();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
        Phone: phoneNumber,
        State: 'INIT',
        Name: name,
        Location: '',
        Type: '',
        Day: '',
        Comment: ''
    });
};

const updateSession = async (phoneNumber, data) => {
    const doc = await getDoc();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const userRow = rows.find(row => row.Phone === phoneNumber);

    if (userRow) {
        if (data.state) userRow.State = data.state;
        if (data.name) userRow.Name = data.name;
        if (data.location) userRow.Location = data.location;
        if (data.type) userRow.Type = data.type;
        if (data.day) userRow.Day = data.day;
        if (data.comment) userRow.Comment = data.comment;
        await userRow.save();
    }
};

const archiveSession = async (phoneNumber) => {
    const session = await getSession(phoneNumber);
    if (!session) return;

    const doc = await getDoc();
    const completedSheet = doc.sheetsByIndex[1]; // Completed sheet

    // Add to completed
    await completedSheet.addRow({
        Phone: session.phone,
        Name: session.name,
        Location: session.location,
        Type: session.type,
        Day: session.day,
        Comment: session.comment || '',
        Date: new Date().toISOString()
    });

    // Delete from sessions
    await session._row.delete();
};

const resetSession = async (phoneNumber) => {
    const session = await getSession(phoneNumber);
    if (session) {
        await session._row.delete();
    }
};

module.exports = {
    getSession,
    createSession,
    updateSession,
    archiveSession,
    resetSession
};
