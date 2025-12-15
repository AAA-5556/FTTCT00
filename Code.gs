// -------------------------------------------------------------------------------------------------
// --- AGMOSS - ATTENDANCE & GOVERNANCE MANAGEMENT & OVERSIGHT SOFTWARE SUITE ---
// --- BACKEND LOGIC (GOOGLE APPS SCRIPT) ---
// --- REVISION 3.0 - FEATURE RESTORATION & LOGGING FIX ---
// -------------------------------------------------------------------------------------------------

// --- GLOBAL CONFIGURATION ---
const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1bEM1Eq3EpqlyiEKqWvcEDvZt4bmME-nBne0nPpO8wLY/edit?gid=0#gid=0";
const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);

// Sheet Definitions
const usersSheet = ss.getSheetByName("Users");
const attendanceSheet = ss.getSheetByName("Attendance");
const sessionsSheet = ss.getSheetByName("Sessions");
const actionLogSheet = ss.getSheetByName("ActionLog");
const loginLogSheet = ss.getSheetByName("LoginLog");

// Role Constants
const ROLES = {
  ROOT_ADMIN: 'root_admin',
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  INSTITUTE: 'institute'
};

// --- CORE INFRASTRUCTURE ---
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const { action, payload, token } = request;

    if (action === 'login') {
      return createSuccessResponse(checkLogin(payload));
    }

    const session = validateToken(token);
    const { actor, subject } = session;

    let result;
    switch (action) {
      // Hierarchy-based actions
      case 'getDashboardData': result = getDashboardData(subject); break;
      case 'addUser': result = addUser(session, payload); break;
      case 'archiveUser': result = archiveUser(session, payload); break;
      case 'updateUserCredentials': result = updateUserCredentials(session, payload); break;
      case 'impersonateUser': return createSuccessResponse(impersonateUser(session, payload));

      // Preserved Legacy Actions
      case 'getAdminData': result = getAdminData(actor); break;
      case 'getMembers': result = getMembers(subject); break;
      case 'addMembersBatch': result = addMembersBatch(session, payload); break;
      case 'saveAttendance': result = saveAttendance(session, payload); break;

      // Logging Actions
      case 'getActionLog': result = getActionLog(actor); break;
      case 'getLoginLog': result = getLoginLog(actor); break;

      default: throw new Error(`Action not supported: ${action}`);
    }
    return createSuccessResponse(result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] doPost Error: ${error.stack}`);
    return createErrorResponse(error.message);
  }
}

// --- AUTHENTICATION & SESSION MANAGEMENT ---

function checkLogin(payload) {
  const { username, password } = payload;
  const usersData = usersSheet.getDataRange().getValues();
  const userRow = usersData.find(row => row[0] === username && row[1] == password && row[4] === 'Active');
  if (userRow) {
    const user = parseUserRow(userRow);
    const token = generateToken(user.userId, user.userId);
    loginLogSheet.appendRow([getShamiTimestamp(), user.username, user.role, 'ورود موفق']);
    return { token, user };
  } else {
    loginLogSheet.appendRow([getShamiTimestamp(), username, 'N/A', 'ورود ناموفق']);
    throw new Error("نام کاربری یا رمز عبور اشتباه است یا حساب شما غیرفعال شده است.");
  }
}

function validateToken(token) {
  if (!token) throw new Error("دسترسی غیرمجاز: توکن وجود ندارد.");
  const sessionsData = sessionsSheet.getDataRange().getValues();
  const sessionRow = sessionsData.find(row => row[0] === token);
  if (!sessionRow) throw new Error("دسترسی غیرمجاز: توکن نامعتبر است.");
  const expiry = new Date(sessionRow[1]).getTime();
  if (new Date().getTime() > expiry) throw new Error("نشست شما منقضی شده است.");
  const subjectUserId = sessionRow[2];
  const actorUserId = sessionRow[3];
  const subject = getUserById(subjectUserId);
  const actor = getUserById(actorUserId);
  if (!subject || !actor) throw new Error("کاربر مرتبط با این نشست یافت نشد.");
  actor.isImpersonating = (actor.userId !== subject.userId);
  actor.subject = subject;
  return { actor, subject };
}

function impersonateUser(session, payload) {
    const { actor } = session;
    const { targetUserId } = payload;
    const targetUser = getUserById(targetUserId);
    if (!targetUser) throw new Error("کاربری برای ورود به پنل یافت نشد.");
    if (targetUser.managerId != actor.userId) throw new Error("شما فقط به پنل کاربران زیرمجموعه مستقیم خود دسترسی دارید.");
    const canImpersonate =
        (actor.role === ROLES.ROOT_ADMIN && targetUser.role === ROLES.SUPER_ADMIN) ||
        (actor.role === ROLES.SUPER_ADMIN && targetUser.role === ROLES.ADMIN) ||
        (actor.role === ROLES.ADMIN && targetUser.role === ROLES.INSTITUTE);
    if (!canImpersonate) throw new Error("شما اجازه دسترسی به پنل این کاربر را ندارید.");
    const impersonationToken = generateToken(targetUser.userId, actor.userId);
    logAction(actor, 'ورود به پنل کاربر', `ورود به پنل کاربری: ${targetUser.username}`);
    return { token: impersonationToken, user: targetUser };
}

// --- DATA FETCHING & BUSINESS LOGIC ---

function getDashboardData(user) {
  const allUsers = usersSheet.getDataRange().getValues();
  const childRole = {
    [ROLES.ROOT_ADMIN]: ROLES.SUPER_ADMIN,
    [ROLES.SUPER_ADMIN]: ROLES.ADMIN,
    [ROLES.ADMIN]: ROLES.INSTITUTE
  }[user.role];
  if (!childRole) return [];
  const subordinates = allUsers.filter(row => row[2] === childRole && row[5] == user.userId && row[4] === 'Active');
  return subordinates.map(subRow => {
    const sub = parseUserRow(subRow);
    let stats = {};
    if (sub.role === ROLES.INSTITUTE) {
      const memberSheet = ss.getSheetByName(`Members_${sub.userId}`);
      stats.memberCount = memberSheet ? memberSheet.getDataRange().getValues().slice(1).filter(r => r[3] === true).length : 0;
    } else {
      stats.managedUsers = allUsers.filter(row => row[5] == sub.userId && row[4] === 'Active').length;
    }
    return { id: sub.userId, name: sub.username, ...stats };
  });
}

function getAdminData(actor) {
    const allUsers = getAllUsers();
    const visibleUserIds = getAllSubordinateIds(actor.userId);
    visibleUserIds.add(actor.userId);

    const institutions = Object.values(allUsers).filter(u => u.role === ROLES.INSTITUTE && visibleUserIds.has(u.userId));
    const institutionNames = {};
    institutions.forEach(inst => institutionNames[inst.userId] = inst.username);

    const attendanceData = attendanceSheet.getDataRange().getValues().slice(1);
    const records = attendanceData
        .filter(row => institutionNames[row[3]]) // Filter records for visible institutions
        .map(row => ({
            date: row[0],
            memberId: row[1],
            status: row[2],
            institutionId: row[3]
        }));

    return { records, institutionNames };
}

function getMembers(user) {
    if (user.role !== ROLES.INSTITUTE) return [];
    const memberSheet = ss.getSheetByName(`Members_${user.userId}`);
    if (!memberSheet) return [];
    return memberSheet.getDataRange().getValues().slice(1)
        .filter(row => row[3] === true)
        .map(row => ({ memberId: row[0], fullName: row[1] }));
}

// --- USER & DATA MANAGEMENT ---

function addUser(session, payload) {
  const { actor } = session;
  const { username, password, role } = payload;
  const canCreate =
    (actor.role === ROLES.ROOT_ADMIN && role === ROLES.SUPER_ADMIN) ||
    (actor.role === ROLES.SUPER_ADMIN && role === ROLES.ADMIN) ||
    (actor.role === ROLES.ADMIN && role === ROLES.INSTITUTE);
  if (!canCreate) throw new Error(`شما اجازه ساخت کاربر با نقش "${role}" را ندارید.`);
  const usersData = usersSheet.getDataRange().getValues();
  if (usersData.some(row => row[0] === username)) throw new Error("این نام کاربری قبلاً استفاده شده است.");
  const newId = (Math.max(0, ...usersData.slice(1).map(row => parseInt(row[3]) || 0))) + 1;
  usersSheet.appendRow([username, password, role, newId, 'Active', actor.userId, getShamiTimestamp(), actor.username]);
  if (role === ROLES.INSTITUTE) {
    const newSheet = ss.insertSheet(`Members_${newId}`);
    newSheet.getRange('A1:F1').setValues([['MemberID', 'FullName', 'CreationDate', 'IsActive', 'NationalID', 'Mobile']]);
  }
  logAction(actor, `افزودن کاربر (${role})`, `کاربر جدید "${username}" (ID: ${newId}) ایجاد شد.`);
  return { message: `کاربر '${username}' با موفقیت ایجاد شد.` };
}

function archiveUser(session, payload) {
    const { actor } = session;
    const { userIdToArchive } = payload;
    const userToArchive = getUserById(userIdToArchive);
    if (!userToArchive) throw new Error("کاربر مورد نظر برای آرشیو یافت نشد.");
    if (userToArchive.managerId != actor.userId) throw new Error("شما فقط می‌توانید کاربران زیرمجموعه خود را آرشیو کنید.");
    const usersData = usersSheet.getDataRange().getValues();
    const rowIndex = usersData.findIndex(row => row[3] == userIdToArchive) + 1;
    if (rowIndex > 0) {
        usersSheet.getRange(rowIndex, 5).setValue('Archived');
        logAction(actor, 'آرشیو کاربر', `کاربر "${userToArchive.username}" (ID: ${userIdToArchive}) آرشیو شد.`);
        return { message: "کاربر با موفقیت آرشیو شد." };
    }
    throw new Error("خطا در پیدا کردن کاربر برای آرشیو.");
}

function updateUserCredentials(session, payload) {
    const { actor } = session;
    const { userIdToUpdate, newUsername, newPassword } = payload;
    const userToUpdate = getUserById(userIdToUpdate);
    if (!userToUpdate) throw new Error("کاربر مورد نظر یافت نشد.");
    if (userToUpdate.managerId != actor.userId) throw new Error("شما اجازه ویرایش اطلاعات این کاربر را ندارید.");
    const usersData = usersSheet.getDataRange().getValues();
    const rowIndex = usersData.findIndex(row => row[3] == userIdToUpdate) + 1;
    if (rowIndex > 0) {
        if (newUsername) usersSheet.getRange(rowIndex, 1).setValue(newUsername);
        if (newPassword) usersSheet.getRange(rowIndex, 2).setValue(newPassword);
        logAction(actor, 'ویرایش اطلاعات کاربر', `اطلاعات کاربر "${userToUpdate.username}" (ID: ${userIdToUpdate}) ویرایش شد.`);
        return { message: "اطلاعات با موفقیت به‌روزرسانی شد." };
    }
    throw new Error("خطا در به‌روزرسانی اطلاعات کاربر.");
}

function addMembersBatch(session, payload) {
  const { actor, subject } = session;
  if (subject.role !== ROLES.INSTITUTE) throw new Error("افزودن عضو فقط برای موسسات امکان‌پذیر است.");
  const { namesString } = payload;
  const names = namesString.split('\n').map(name => name.trim()).filter(Boolean);
  if (names.length === 0) throw new Error("لیست نام‌ها خالی است.");
  const memberSheet = ss.getSheetByName(`Members_${subject.userId}`);
  if (!memberSheet) throw new Error("شیت اعضای این موسسه یافت نشد.");
  const data = memberSheet.getDataRange().getValues();
  let lastId = Math.max(subject.userId * 1000, ...data.slice(1).map(row => parseInt(row[0]) || 0));
  const creationDate = getShamiTimestamp().split('،')[0];
  const newRows = names.map(name => {
    lastId++;
    return [lastId, name, creationDate, true, '', ''];
  });
  if (newRows.length > 0) {
    memberSheet.getRange(memberSheet.getLastRow() + 1, 1, newRows.length, 6).setValues(newRows);
  }
  logAction(actor, 'افزودن عضو دسته‌جمعی', `${names.length} عضو جدید به موسسه "${subject.username}" اضافه شدند.`);
  return { message: `${newRows.length} عضو جدید با موفقیت اضافه شدند.` };
}

function saveAttendance(session, payload) {
  const { actor, subject } = session;
  if (subject.role !== ROLES.INSTITUTE) throw new Error("ثبت حضور و غیاب فقط برای موسسات امکان‌پذیر است.");
  const institutionId = subject.userId;
  const todayDate = getShamiTimestamp().split('،')[0];
  const allSheetData = attendanceSheet.getDataRange().getValues();
  const rowsToDelete = [];
  allSheetData.forEach((row, index) => {
    if (row[0].startsWith(todayDate) && row[3] == institutionId) {
      rowsToDelete.push(index + 1);
    }
  });
  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    attendanceSheet.deleteRow(rowsToDelete[i]);
  }
  const timestamp = getShamiTimestamp();
  const newRecords = payload.data.map(record => [timestamp, record.memberId, record.status, institutionId]);
  if (newRecords.length > 0) {
    attendanceSheet.getRange(attendanceSheet.getLastRow() + 1, 1, newRecords.length, 4).setValues(newRecords);
  }
  logAction(actor, 'ثبت حضور و غیاب', `حضور و غیاب برای ${newRecords.length} نفر در موسسه "${subject.username}" ثبت شد.`);
  return { message: "اطلاعات با موفقیت به‌روزرسانی شد." };
}

// --- LOGGING ---

function getActionLog(actor) {
  if (actor.role === ROLES.INSTITUTE) throw new Error("شما دسترسی به این بخش را ندارید.");
  const allLogs = actionLogSheet.getDataRange().getValues().slice(1).map(parseLogRow);
  if (actor.role === ROLES.ROOT_ADMIN) return allLogs.reverse();
  const subordinateIds = getAllSubordinateIds(actor.userId);
  const visibleUsernames = new Set(Object.values(getAllUsers()).filter(u => subordinateIds.has(u.userId)).map(u => u.username));
  visibleUsernames.add(actor.username);
  const filteredLogs = allLogs.filter(log => visibleUsernames.has(log.actor.split(' ')[0]));
  return filteredLogs.reverse();
}

function getLoginLog(actor) {
  if (actor.role === ROLES.INSTITUTE) throw new Error("شما دسترسی به این بخش را ندارید.");
  const allLogs = loginLogSheet.getDataRange().getValues().slice(1).map(row => ({timestamp: row[0], username: row[1], role: row[2]}));
  if (actor.role === ROLES.ROOT_ADMIN) return allLogs.reverse();
  const subordinateIds = getAllSubordinateIds(actor.userId);
  const visibleUsernames = new Set(Object.values(getAllUsers()).filter(u => subordinateIds.has(u.userId)).map(u => u.username));
  visibleUsernames.add(actor.username);
  const filteredLogs = allLogs.filter(log => visibleUsernames.has(log.username));
  return filteredLogs.reverse();
}

function logAction(actor, actionType, description) {
  const actorDisplay = actor.isImpersonating
    ? `${actor.username} (به عنوان ${actor.subject.username})`
    : actor.username;
  actionLogSheet.appendRow([getShamiTimestamp(), actorDisplay, actor.role, actionType, description]);
}

// --- HELPER FUNCTIONS ---
function createSuccessResponse(data) { return ContentService.createTextOutput(JSON.stringify({ status: 'success', data })).setMimeType(ContentService.MimeType.JSON); }
function createErrorResponse(message) { return ContentService.createTextOutput(JSON.stringify({ status: 'error', message })).setMimeType(ContentService.MimeType.JSON); }
function getShamiTimestamp() { return new Date().toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', hour12: false }); }
function generateToken(subjectUserId, actorUserId) {
  const token = Utilities.getUuid();
  const expiry = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
  sessionsSheet.appendRow([token, expiry, subjectUserId, actorUserId]);
  return token;
}
function parseUserRow(row) { return { username: row[0], role: row[2], userId: row[3], managerId: row[5] }; }
function getUserById(userId) {
  if (userId === null || userId === undefined) return null;
  const userRow = usersSheet.getDataRange().getValues().find(row => row[3] == userId);
  return userRow ? parseUserRow(userRow) : null;
}
let allUsersCache = null;
function getAllUsers() {
  if (allUsersCache) return allUsersCache;
  allUsersCache = {};
  usersSheet.getDataRange().getValues().slice(1).forEach(row => {
    const user = parseUserRow(row);
    allUsersCache[user.userId] = user;
  });
  return allUsersCache;
}
function getAllSubordinateIds(managerId) {
    const users = Object.values(getAllUsers());
    const subordinates = new Set();
    const queue = [managerId];
    while (queue.length > 0) {
        const currentManagerId = queue.shift();
        const children = users.filter(u => u.managerId == currentManagerId);
        for (const child of children) {
            if (!subordinates.has(child.userId)) {
                subordinates.add(child.userId);
                queue.push(child.userId);
            }
        }
    }
    return subordinates;
}
function parseLogRow(row) { return { timestamp: row[0], actor: row[1], role: row[2], type: row[3], desc: row[4] || '' }; }
