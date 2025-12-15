// -------------------------------------------------------------------------------------------------
// --- AGMOSS - ATTENDANCE & GOVERNANCE MANAGEMENT & OVERSIGHT SOFTWARE SUITE ---
// --- BACKEND LOGIC (GOOGLE APPS SCRIPT) ---
// --- REVISION 3.0 - FEATURE RESTORATION & LOGGING FIX ---
// -------------------------------------------------------------------------------------------------

// --- GLOBAL CONFIGURATION ---
const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/19LVyD13NEmy2qVo2OH1ByuO0MuTZ3EZorQv0tBl3ajM/edit?gid=0#gid=0";
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

function validateToken(token) {
  if (!token) throw new Error("دسترسی غیرمجاز: توکن وجود ندارد.");

  const sessionsData = sessionsSheet.getDataRange().getValues();
  const sessionRow = sessions-Data.find(row => row[0] === token);

  if (!sessionRow) throw new Error("دسترسی غیرمجاز: توکن نامعتبر است.");

  const expiry = new Date(sessionRow[1]).getTime();
  if (new Date().getTime() > expiry) {
    throw new Error("نشست شما منقضی شده است.");
  }

  const subjectUserId = sessionRow[2];
  const actorUserId = sessionRow[3];

  const subject = getUserById(subjectUserId);
  const actor = getUserById(actorUserId);

  if (!subject || !actor) throw new Error("کاربر مرتبط با این نشست یافت نشد.");

  // **FIX:** Add isImpersonating flag for clear logic downstream
  actor.isImpersonating = (actor.userId !== subject.userId);
  actor.subject = subject; // Attach subject to actor for logging context

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


// --- LOGGING ---

/**
 * **FIXED:** Logs a user action with correct impersonation context.
 */
function logAction(actor, actionType, description) {
  const actorDisplay = actor.isImpersonating
    ? `${actor.username} (به عنوان ${actor.subject.username})`
    : actor.username;

  actionLogSheet.appendRow([getShamiTimestamp(), actorDisplay, actor.role, actionType, description]);
}

// ... [Rest of the functions from the previous version of Code.gs remain largely the same]
// ... [getDashboardData, addUser, archiveUser, getAdminData, etc.]

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
// ... [getAllUsers, getAllSubordinateIds, etc.]
