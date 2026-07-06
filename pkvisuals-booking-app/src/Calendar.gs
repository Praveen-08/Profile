/**
 * Calendar.gs
 */

function getCalendar_() {
  var calendarId = getSetting_('CalendarID', 'primary');
  if (!calendarId || calendarId === 'primary') return CalendarApp.getDefaultCalendar();
  var cal = CalendarApp.getCalendarById(calendarId);
  if (!cal) throw new Error('Calendar not found for CalendarID setting: ' + calendarId);
  return cal;
}

function combineDateTime_(dateStr, timeStr) {
  var d = new Date(dateStr);
  if (timeStr) {
    var parts = String(timeStr).split(':');
    d.setHours(Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0);
  }
  return d;
}

function buildCalendarEventUrl_(eventId, calendarId) {
  var cleanId = String(eventId).split('@')[0];
  var eid = Utilities.base64Encode(cleanId + ' ' + calendarId).replace(/=+$/, '');
  return 'https://calendar.google.com/calendar/event?eid=' + eid;
}

function buildEventDescription_(job) {
  return 'Agent: ' + job.AgentName + '\n' +
    'Phone: ' + job.AgentPhone + '\n' +
    'Email: ' + job.AgentEmail + '\n' +
    'Agency: ' + job.AgencyName + '\n\n' +
    'Package: ' + job.PackageName + '\n' +
    'Price incl GST: $' + Number(job.TotalInclGST).toFixed(2) + '\n\n' +
    'Property Address:\n' + job.PropertyAddress + '\n\n' +
    'Drive Folder:\n' + (job.DriveMainFolderLink || '') + '\n\n' +
    'Notes:\n' + (job.Notes || '');
}

function createCalendarEvent_(job) {
  var calendar = getCalendar_();
  var calendarId = getSetting_('CalendarID', 'primary');
  if (calendarId === 'primary') calendarId = Session.getEffectiveUser().getEmail();

  var start = combineDateTime_(job.ShootDate, job.StartTime);
  var end = combineDateTime_(job.ShootDate, job.EndTime);
  if (end <= start) end = new Date(start.getTime() + 30 * 60000);

  var guests = [job.AgentEmail, getSetting_('AdminEmail')].filter(function (e) { return !!e; });

  var event = calendar.createEvent(
    'PK Visuals Shoot - ' + job.PropertyAddress,
    start,
    end,
    {
      description: buildEventDescription_(job),
      location: job.PropertyAddress,
      guests: guests.join(','),
      sendInvites: true
    }
  );

  return {
    CalendarEventID: event.getId(),
    CalendarEventLink: buildCalendarEventUrl_(event.getId(), calendarId)
  };
}

function updateCalendarEvent_(job) {
  if (!job.CalendarEventID) return null;
  try {
    var calendar = getCalendar_();
    var event = calendar.getEventById(job.CalendarEventID);
    if (!event) return null;

    var start = combineDateTime_(job.ShootDate, job.StartTime);
    var end = combineDateTime_(job.ShootDate, job.EndTime);
    if (end <= start) end = new Date(start.getTime() + 30 * 60000);

    event.setTitle('PK Visuals Shoot - ' + job.PropertyAddress);
    event.setTime(start, end);
    event.setLocation(job.PropertyAddress);
    event.setDescription(buildEventDescription_(job));
    return { CalendarEventID: job.CalendarEventID, CalendarEventLink: job.CalendarEventLink };
  } catch (e) {
    return null;
  }
}

function deleteCalendarEvent_(job) {
  if (!job.CalendarEventID) return;
  try {
    var calendar = getCalendar_();
    var event = calendar.getEventById(job.CalendarEventID);
    if (event) event.deleteEvent();
  } catch (e) {
    // event already gone, nothing to do
  }
}
