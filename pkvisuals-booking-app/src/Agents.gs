/**
 * Agents.gs
 */

function getAgents() {
  ensureDatabase_();
  return readAll_(SHEETS.AGENTS);
}

function getAgentById(agentId) {
  ensureDatabase_();
  return getById_(SHEETS.AGENTS, 'AgentID', agentId);
}

/** Client entry point. Creates a new agent (and optionally a new agency) and returns the created record. */
function addAgent(agent) {
  ensureDatabase_();
  if (!agent.AgentName) throw new Error('Agent name is required.');
  if (!agent.AgencyID) throw new Error('Agency is required.');

  var agency = getAgencyById(agent.AgencyID);
  if (!agency) throw new Error('Agency not found: ' + agent.AgencyID);

  var rows = readAll_(SHEETS.AGENTS);
  var agentId = 'AGT-' + pad4_(rows.length + 1);

  var record = {
    AgentID: agentId,
    AgentName: agent.AgentName,
    AgencyID: agency.AgencyID,
    AgencyName: agency.AgencyName,
    Email: agent.Email || '',
    Phone: agent.Phone || '',
    Instagram: agent.Instagram || '',
    DefaultPackageID: agent.DefaultPackageID || '',
    Notes: agent.Notes || '',
    Active: agent.Active === false ? false : true,
    CreatedDate: new Date(),
    LastJobDate: '',
    TotalJobs: 0,
    TotalRevenue: 0
  };
  appendRow_(SHEETS.AGENTS, record);
  logAction_(null, 'Agent created', '', agent.AgentName);
  return record;
}

function updateAgent(agentId, updates) {
  ensureDatabase_();
  if (updates.AgencyID) {
    var agency = getAgencyById(updates.AgencyID);
    if (agency) updates.AgencyName = agency.AgencyName;
  }
  var ok = updateRow_(SHEETS.AGENTS, 'AgentID', agentId, updates);
  if (!ok) throw new Error('Agent not found: ' + agentId);
  logAction_(null, 'Agent updated', '', agentId);
  return getAgentById(agentId);
}

function deactivateAgent(agentId) {
  return updateAgent(agentId, { Active: false });
}

function getAgentJobs(agentId) {
  ensureDatabase_();
  return readAll_(SHEETS.JOBS).filter(function (j) { return String(j.AgentID) === String(agentId); });
}

function incrementAgentStats_(agentId, jobDelta, revenueDelta, lastJobDate) {
  var agent = getAgentById(agentId);
  if (!agent) return;
  var updates = {
    TotalJobs: (Number(agent.TotalJobs) || 0) + (jobDelta || 0),
    TotalRevenue: round2_((Number(agent.TotalRevenue) || 0) + (revenueDelta || 0))
  };
  if (lastJobDate) updates.LastJobDate = lastJobDate;
  updateRow_(SHEETS.AGENTS, 'AgentID', agentId, updates);
}
