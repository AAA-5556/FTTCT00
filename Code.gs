// -------------------------------------------------------------------------------------------------
// --- AGMOSS - ATTENDANCE & GOVERNANCE MANAGEMENT & OVERSIGHT SOFTWARE SUITE ---
// --- BACKEND LOGIC (GOOGLE APPS SCRIPT) ---
// --- REVISION 3.4 - WORKING VERSION ---
// -------------------------------------------------------------------------------------------------

const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1oEN0HKPGNDvdSSMpQ8O7aXd9p7eQNPmZfoIlvQfSdUA/edit?";

let _spreadsheet = null;
const _sheetsCache = {};

function getSpreadsheet() {
    if (!_spreadsheet) {
        _spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    }
    return _spreadsheet;
}

function getSheet(name) {
    const ss = getSpreadsheet();
    if (!_sheetsCache[name]) {
        _sheetsCache[name] = ss.getSheetByName(name);
    }
    return _sheetsCache[name];
}

const ROLES = {
  ROOT_ADMIN: 'root_admin',
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  INSTITUTE: 'institute'
};

function getShamiTimestamp() { 
    return new Date().toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', hour12: false }); 
}

function doPost(e) { 
    try { 
        const request = JSON.parse(e.postData.contents); 
        const action = request.action; 
        
        if (action === 'login') { 
            const result = checkLogin(request.payload); 
            return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result })).setMimeType(ContentService.MimeType.JSON); 
        } 
        
        const token = request.token; 
        const session = validateToken(token); 
        const actor = session.actor;
        const subject = session.subject;
        
        let result; 
        
        switch (action) { 
            case 'getDashboardData': 
                result = getDashboardData(subject); 
                break; 
            case 'addUser': 
                result = addUser(session, request.payload); 
                break; 
            case 'archiveUser': 
                result = archiveUser(session, request.payload); 
                break; 
            case 'updateUserCredentials': 
                result = updateUserCredentials(session, request.payload); 
                break; 
            case 'impersonateUser': 
                result = impersonateUser(session, request.payload);
                return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result })).setMimeType(ContentService.MimeType.JSON);
            case 'getAdminData': 
                result = getAdminData(actor); 
                break; 
            case 'getMembers': 
                result = getMembers(subject); 
                break; 
            case 'addMembersBatch': 
                result = addMembersBatch(session, request.payload); 
                break; 
            case 'saveAttendance': 
                result = saveAttendance(session, request.payload); 
                break; 
            case 'getActionLog': 
                result = getActionLog(actor); 
                break; 
            case 'getLoginLog': 
                result = getLoginLog(actor); 
                break; 
            default: 
                throw new Error("Action not supported: " + action); 
        } 
        
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result })).setMimeType(ContentService.MimeType.JSON); 
    } catch (error) { 
        console.error(error.stack); 
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message })).setMimeType(ContentService.MimeType.JSON); 
    } 
}

function checkLogin(payload) {
    const { username, password } = payload;
    const usersData = getSheet("Users").getDataRange().getValues();
    
    for (let i = 1; i < usersData.length; i++) {
        const userRow = usersData[i];
        if (userRow[0] === username && userRow[1] == password && userRow[4] === 'Active') {
            const user = {
                username: userRow[0],
                role: userRow[2],
                userId: userRow[3],
                managerId: userRow[5]
            };
            
            const token = Utilities.getUuid();
            const expiry = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
            getSheet("Sessions").appendRow([token, expiry, user.userId, user.userId]);
            getSheet("LoginLog").appendRow([getShamiTimestamp(), user.username, user.role, 'ورود موفق']);
            
            return { token: token, user: user };
        }
    }
    
    getSheet("LoginLog").appendRow([getShamiTimestamp(), username, 'N/A', 'ورود ناموفق']);
    throw new Error("نام کاربری یا رمز عبور صحیح نیست.");
}

function validateToken(token) {
    if (!token) throw new Error("دسترسی غیرمجاز: توکن وجود ندارد.");
    
    const sessionsData = getSheet("Sessions").getDataRange().getValues();
    const now = new Date().getTime();
    
    for (let i = sessionsData.length - 1; i >= 1; i--) {
        const session = sessionsData[i];
        if (session[0] === token) {
            const expiry = new Date(session[1]).getTime();
            if (now > expiry) {
                getSheet("Sessions").deleteRow(i + 1);
                throw new Error("نشست شما منقضی شده است.");
            }
            
            const subjectUserId = session[2];
            const actorUserId = session[3];
            const subject = getUserById(subjectUserId);
            const actor = getUserById(actorUserId);
            
            if (!subject || !actor) throw new Error("کاربر مرتبط با این نشست یافت نشد.");
            
            actor.isImpersonating = (actor.userId !== subject.userId);
            actor.subject = subject;
            
            return { actor: actor, subject: subject };
        }
    }
    
    throw new Error("دسترسی غیرمجاز: توکن نامعتبر است.");
}

function getUserById(userId) {
    if (userId === null || userId === undefined) return null;
    
    const usersData = getSheet("Users").getDataRange().getValues();
    for (let i = 1; i < usersData.length; i++) {
        if (usersData[i][3] == userId) {
            return {
                username: usersData[i][0],
                role: usersData[i][2],
                userId: usersData[i][3],
                managerId: usersData[i][5]
            };
        }
    }
    return null;
}

function impersonateUser(session, payload) {
    const actor = session.actor;
    const { targetUserId } = payload;
    const targetUser = getUserById(targetUserId);
    
    if (!targetUser) throw new Error("کاربری برای ورود به پنل یافت نشد.");
    if (targetUser.managerId != actor.userId) throw new Error("شما فقط به پنل کاربران زیرمجموعه مستقیم خود دسترسی دارید.");
    
    const canImpersonate = 
        (actor.role === ROLES.ROOT_ADMIN && targetUser.role === ROLES.SUPER_ADMIN) ||
        (actor.role === ROLES.SUPER_ADMIN && targetUser.role === ROLES.ADMIN) ||
        (actor.role === ROLES.ADMIN && targetUser.role === ROLES.INSTITUTE);
    
    if (!canImpersonate) throw new Error("شما اجازه دسترسی به پنل این کاربر را ندارید.");
    
    const impersonationToken = Utilities.getUuid();
    const expiry = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
    getSheet("Sessions").appendRow([impersonationToken, expiry, targetUser.userId, actor.userId]);
    
    logAction(actor, 'ورود به پنل کاربر', `ورود به پنل کاربری: ${targetUser.username}`);
    
    return { token: impersonationToken, user: targetUser };
}

function getDashboardData(user) {
    const allUsers = getSheet("Users").getDataRange().getValues();
    const childRole = {
        'root_admin': ROLES.SUPER_ADMIN,
        'super_admin': ROLES.ADMIN,
        'admin': ROLES.INSTITUTE
    }[user.role];
    
    if (!childRole) return [];
    
    const subordinates = [];
    for (let i = 1; i < allUsers.length; i++) {
        const row = allUsers[i];
        if (row[2] === childRole && row[5] == user.userId && row[4] === 'Active') {
            const sub = {
                username: row[0],
                role: row[2],
                userId: row[3],
                managerId: row[5]
            };
            
            let stats = {};
            if (sub.role === ROLES.INSTITUTE) {
                const memberSheet = getSpreadsheet().getSheetByName(`Members_${sub.userId}`);
                if (memberSheet) {
                    const memberData = memberSheet.getDataRange().getValues();
                    let count = 0;
                    for (let j = 1; j < memberData.length; j++) {
                        if (memberData[j][3] === true) count++;
                    }
                    stats.memberCount = count;
                } else {
                    stats.memberCount = 0;
                }
            } else {
                let managedCount = 0;
                for (let j = 1; j < allUsers.length; j++) {
                    if (allUsers[j][5] == sub.userId && allUsers[j][4] === 'Active') {
                        managedCount++;
                    }
                }
                stats.managedUsers = managedCount;
            }
            
            subordinates.push({ id: sub.userId, name: sub.username, ...stats });
        }
    }
    
    return subordinates;
}

function getAdminData(actor) {
    const allUsers = getAllUsers();
    const visibleUserIds = getAllSubordinateIds(actor.userId);
    visibleUserIds.add(actor.userId);
    
    const institutions = [];
    const institutionNames = {};
    
    Object.keys(allUsers).forEach(function(key) {
        const u = allUsers[key];
        if (u.role === ROLES.INSTITUTE && visibleUserIds.has(u.userId)) {
            institutions.push(u);
            institutionNames[u.userId] = u.username;
        }
    });
    
    const attendanceData = getSheet("Attendance").getDataRange().getValues().slice(1);
    const records = [];
    
    for (let i = 0; i < attendanceData.length; i++) {
        const row = attendanceData[i];
        if (institutionNames[row[3]]) {
            records.push({
                date: row[0],
                memberId: row[1],
                status: row[2],
                institutionId: row[3]
            });
        }
    }
    
    return { records: records, institutionNames: institutionNames };
}

function getMembers(user) {
    if (user.role !== ROLES.INSTITUTE) return [];
    
    const memberSheet = getSpreadsheet().getSheetByName(`Members_${user.userId}`);
    if (!memberSheet) return [];
    
    const membersData = memberSheet.getDataRange().getValues().slice(1);
    const activeMembers = [];
    
    for (let i = 0; i < membersData.length; i++) {
        const row = membersData[i];
        if (row[3] === true) {
            activeMembers.push({ 
                memberId: row[0], 
                fullName: row[1] 
            });
        }
    }
    
    return activeMembers;
}

function addUser(session, payload) {
    const actor = session.actor;
    const { username, password, role } = payload;
    
    const canCreate = 
        (actor.role === ROLES.ROOT_ADMIN && role === ROLES.SUPER_ADMIN) ||
        (actor.role === ROLES.SUPER_ADMIN && role === ROLES.ADMIN) ||
        (actor.role === ROLES.ADMIN && role === ROLES.INSTITUTE);
    
    if (!canCreate) throw new Error(`شما اجازه ساخت کاربر با نقش "${role}" را ندارید.`);
    
    const usersData = getSheet("Users").getDataRange().getValues();
    
    for (let i = 1; i < usersData.length; i++) {
        if (usersData[i][0] === username) {
            throw new Error("این نام کاربری قبلاً استفاده شده است.");
        }
    }
    
    let maxId = 0;
    for (let i = 1; i < usersData.length; i++) {
        const currentId = parseInt(usersData[i][3]) || 0;
        if (currentId > maxId) maxId = currentId;
    }
    const newId = maxId + 1;
    
    getSheet("Users").appendRow([username, password, role, newId, 'Active', actor.userId, getShamiTimestamp(), actor.username]);
    
    if (role === ROLES.INSTITUTE) {
        const newSheet = getSpreadsheet().insertSheet(`Members_${newId}`);
        newSheet.getRange('A1:F1').setValues([['MemberID', 'FullName', 'CreationDate', 'IsActive', 'NationalID', 'Mobile']]);
    }
    
    logAction(actor, `افزودن کاربر (${role})`, `کاربر جدید "${username}" (ID: ${newId}) ایجاد شد.`);
    
    return { message: `کاربر '${username}' با موفقیت ایجاد شد.` };
}

function archiveUser(session, payload) {
    const actor = session.actor;
    const { userIdToArchive } = payload;
    const userToArchive = getUserById(userIdToArchive);
    
    if (!userToArchive) throw new Error("کاربر مورد نظر برای آرشیو یافت نشد.");
    if (userToArchive.managerId != actor.userId) throw new Error("شما فقط می‌توانید کاربران زیرمجموعه خود را آرشیو کنید.");
    
    const usersData = getSheet("Users").getDataRange().getValues();
    
    for (let i = 1; i < usersData.length; i++) {
        if (usersData[i][3] == userIdToArchive) {
            const rowIndex = i + 1;
            getSheet("Users").getRange(rowIndex, 5).setValue('Archived');
            logAction(actor, 'آرشیو کاربر', `کاربر "${userToArchive.username}" (ID: ${userIdToArchive}) آرشیو شد.`);
            return { message: "کاربر با موفقیت آرشیو شد." };
        }
    }
    
    throw new Error("خطا در پیدا کردن کاربر برای آرشیو.");
}

function updateUserCredentials(session, payload) {
    const actor = session.actor;
    const { userIdToUpdate, newUsername, newPassword } = payload;
    const userToUpdate = getUserById(userIdToUpdate);
    
    if (!userToUpdate) throw new Error("کاربر مورد نظر یافت نشد.");
    if (userToUpdate.managerId != actor.userId) throw new Error("شما اجازه ویرایش اطلاعات این کاربر را ندارید.");
    
    const usersData = getSheet("Users").getDataRange().getValues();
    
    for (let i = 1; i < usersData.length; i++) {
        if (usersData[i][3] == userIdToUpdate) {
            const rowIndex = i + 1;
            if (newUsername) getSheet("Users").getRange(rowIndex, 1).setValue(newUsername);
            if (newPassword) getSheet("Users").getRange(rowIndex, 2).setValue(newPassword);
            logAction(actor, 'ویرایش اطلاعات کاربر', `اطلاعات کاربر "${userToUpdate.username}" (ID: ${userIdToUpdate}) ویرایش شد.`);
            return { message: "اطلاعات با موفقیت به‌روزرسانی شد." };
        }
    }
    
    throw new Error("خطا در به‌روزرسانی اطلاعات کاربر.");
}

function addMembersBatch(session, payload) {
    const actor = session.actor;
    const subject = session.subject;
    
    if (subject.role !== ROLES.INSTITUTE) throw new Error("افزودن عضو فقط برای موسسات امکان‌پذیر است.");
    
    const { namesString } = payload;
    const names = namesString.split('\n').map(function(name) { return name.trim(); }).filter(Boolean);
    
    if (names.length === 0) throw new Error("لیست نام‌ها خالی است.");
    
    const memberSheet = getSpreadsheet().getSheetByName(`Members_${subject.userId}`);
    if (!memberSheet) throw new Error("شیت اعضای این موسسه یافت نشد.");
    
    const data = memberSheet.getDataRange().getValues();
    let lastId = subject.userId * 1000;
    
    for (let i = 1; i < data.length; i++) {
        const currentId = parseInt(data[i][0]) || 0;
        if (currentId > lastId) lastId = currentId;
    }
    
    const creationDate = getShamiTimestamp().split('،')[0];
    const newRows = [];
    
    for (let i = 0; i < names.length; i++) {
        lastId++;
        newRows.push([lastId, names[i], creationDate, true, '', '']);
    }
    
    if (newRows.length > 0) {
        memberSheet.getRange(memberSheet.getLastRow() + 1, 1, newRows.length, 6).setValues(newRows);
    }
    
    logAction(actor, 'افزودن عضو دسته‌جمعی', `${names.length} عضو جدید به موسسه "${subject.username}" اضافه شدند.`);
    
    return { message: `${newRows.length} عضو جدید با موفقیت اضافه شدند.` };
}

function saveAttendance(session, payload) {
    const actor = session.actor;
    const subject = session.subject;
    
    if (subject.role !== ROLES.INSTITUTE) throw new Error("ثبت حضور و غیاب فقط برای موسسات امکان‌پذیر است.");
    
    const institutionId = subject.userId;
    const todayDate = getShamiTimestamp().split('،')[0];
    const allSheetData = getSheet("Attendance").getDataRange().getValues();
    const rowsToDelete = [];
    
    for (let i = 0; i < allSheetData.length; i++) {
        const row = allSheetData[i];
        if (row[0] && row[0].toString().startsWith(todayDate) && row[3] == institutionId) {
            rowsToDelete.push(i + 1);
        }
    }
    
    for (let i = rowsToDelete.length - 1; i >= 0; i--) {
        getSheet("Attendance").deleteRow(rowsToDelete[i]);
    }
    
    const timestamp = getShamiTimestamp();
    const newRecords = payload.data;
    
    for (let i = 0; i < newRecords.length; i++) {
        const record = newRecords[i];
        getSheet("Attendance").appendRow([timestamp, record.memberId, record.status, institutionId]);
    }
    
    logAction(actor, 'ثبت حضور و غیاب', `حضور و غیاب برای ${newRecords.length} نفر در موسسه "${subject.username}" ثبت شد.`);
    
    return { message: "اطلاعات با موفقیت به‌روزرسانی شد." };
}

function getActionLog(actor) {
    if (actor.role === ROLES.INSTITUTE) throw new Error("شما دسترسی به این بخش را ندارید.");
    
    const allLogs = getSheet("ActionLog").getDataRange().getValues().slice(1);
    
    if (actor.role === ROLES.ROOT_ADMIN) {
        return allLogs.reverse().map(function(row) {
            return { timestamp: row[0], actor: row[1], role: row[2], type: row[3], desc: row[4] || '' };
        });
    }
    
    const subordinateIds = getAllSubordinateIds(actor.userId);
    const allUsers = getAllUsers();
    const visibleUsernames = {};
    
    Object.keys(allUsers).forEach(function(key) {
        const u = allUsers[key];
        if (subordinateIds.has(u.userId)) {
            visibleUsernames[u.username] = true;
        }
    });
    visibleUsernames[actor.username] = true;
    
    const filteredLogs = [];
    for (let i = 0; i < allLogs.length; i++) {
        const log = allLogs[i];
        const actorName = log[1].split(' ')[0];
        if (visibleUsernames[actorName]) {
            filteredLogs.push({ timestamp: log[0], actor: log[1], role: log[2], type: log[3], desc: log[4] || '' });
        }
    }
    
    return filteredLogs.reverse();
}

function getLoginLog(actor) {
    if (actor.role === ROLES.INSTITUTE) throw new Error("شما دسترسی به این بخش را ندارید.");
    
    const allLogs = getSheet("LoginLog").getDataRange().getValues().slice(1);
    
    if (actor.role === ROLES.ROOT_ADMIN) {
        return allLogs.reverse().map(function(row) {
            return { timestamp: row[0], username: row[1], role: row[2] };
        });
    }
    
    const subordinateIds = getAllSubordinateIds(actor.userId);
    const allUsers = getAllUsers();
    const visibleUsernames = {};
    
    Object.keys(allUsers).forEach(function(key) {
        const u = allUsers[key];
        if (subordinateIds.has(u.userId)) {
            visibleUsernames[u.username] = true;
        }
    });
    visibleUsernames[actor.username] = true;
    
    const filteredLogs = [];
    for (let i = 0; i < allLogs.length; i++) {
        const log = allLogs[i];
        if (visibleUsernames[log[1]]) {
            filteredLogs.push({ timestamp: log[0], username: log[1], role: log[2] });
        }
    }
    
    return filteredLogs.reverse();
}

function logAction(actor, actionType, description) {
    const actorDisplay = actor.isImpersonating
        ? `${actor.username} (به عنوان ${actor.subject.username})`
        : actor.username;
    getSheet("ActionLog").appendRow([getShamiTimestamp(), actorDisplay, actor.role, actionType, description]);
}

function getAllUsers() {
    const allUsersMap = {};
    const usersData = getSheet("Users").getDataRange().getValues().slice(1);
    
    for (let i = 0; i < usersData.length; i++) {
        const row = usersData[i];
        const user = {
            username: row[0],
            role: row[2],
            userId: row[3],
            managerId: row[5]
        };
        allUsersMap[user.userId] = user;
    }
    
    return allUsersMap;
}

function getAllSubordinateIds(managerId) {
    const users = getAllUsers();
    const usersList = [];
    Object.keys(users).forEach(function(key) {
        usersList.push(users[key]);
    });
    
    const subordinates = {};
    const queue = [managerId];
    
    while (queue.length > 0) {
        const currentManagerId = queue.shift();
        
        for (let i = 0; i < usersList.length; i++) {
            const u = usersList[i];
            if (u.managerId == currentManagerId) {
                if (!subordinates[u.userId]) {
                    subordinates[u.userId] = true;
                    queue.push(u.userId);
                }
            }
        }
    }
    
    const resultSet = new Set();
    Object.keys(subordinates).forEach(function(key) {
        resultSet.add(parseInt(key));
    });
    
    return resultSet;
}
