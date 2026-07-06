/**
 * Reports.gs
 * Dashboard summary + the Reports page (GST, revenue, outstanding invoices).
 */

function startOfDay_(d) {
  var x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay_(a, b) {
  var da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function activeJobs_() {
  return readAll_(SHEETS.JOBS).filter(function (j) { return j.Status !== JOB_STATUS.CANCELLED; });
}

/** Client entry point. */
function getDashboardData() {
  ensureDatabase_();
  var jobs = activeJobs_();
  var today = startOfDay_(new Date());
  var in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  var todaysShoots = jobs.filter(function (j) { return j.ShootDate && isSameDay_(j.ShootDate, today); });
  var upcomingShoots = jobs.filter(function (j) {
    if (!j.ShootDate) return false;
    var d = startOfDay_(j.ShootDate);
    return d > today && d <= in7Days;
  });
  var readyToDeliver = jobs.filter(function (j) { return j.DeliveryStatus === DELIVERY_STATUS.READY_TO_DELIVER; });
  var deliveredNotInvoiced = jobs.filter(function (j) {
    return j.DeliveryStatus === DELIVERY_STATUS.DELIVERED && j.PaymentStatus === PAYMENT_STATUS.NOT_INVOICED;
  });
  var invoiceSentUnpaid = jobs.filter(function (j) { return j.PaymentStatus === PAYMENT_STATUS.INVOICE_SENT; });
  var overdueInvoices = jobs.filter(function (j) {
    return (j.PaymentStatus === PAYMENT_STATUS.INVOICE_SENT || j.PaymentStatus === PAYMENT_STATUS.PART_PAID) &&
      j.DueDate && startOfDay_(j.DueDate) < today;
  });

  var thisMonthJobs = jobs.filter(function (j) {
    if (!j.ShootDate) return false;
    var d = new Date(j.ShootDate);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  });
  var monthRevenue = round2_(thisMonthJobs.reduce(function (s, j) { return s + (Number(j.TotalInclGST) || 0); }, 0));
  var gstCollected = round2_(thisMonthJobs.reduce(function (s, j) { return s + (Number(j.GST) || 0); }, 0));

  var totalUnpaid = round2_(jobs
    .filter(function (j) { return j.PaymentStatus !== PAYMENT_STATUS.PAID && j.PaymentStatus !== PAYMENT_STATUS.WRITTEN_OFF; })
    .reduce(function (s, j) { return s + (Number(j.BalanceDue) || 0); }, 0));

  var actionRequired = readyToDeliver.concat(deliveredNotInvoiced).concat(overdueInvoices);

  return {
    todaysShoots: todaysShoots,
    upcomingShoots: upcomingShoots.sort(function (a, b) { return new Date(a.ShootDate) - new Date(b.ShootDate); }),
    readyToDeliverCount: readyToDeliver.length,
    deliveredNotInvoicedCount: deliveredNotInvoiced.length,
    invoiceSentUnpaidCount: invoiceSentUnpaid.length,
    overdueInvoicesCount: overdueInvoices.length,
    monthRevenue: monthRevenue,
    gstCollected: gstCollected,
    totalUnpaid: totalUnpaid,
    actionRequired: actionRequired
  };
}

function getDateRangeForPreset_(preset, customFrom, customTo) {
  var now = new Date();
  var from, to;

  if (preset === 'lastMonth') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (preset === 'thisQuarter') {
    var q = Math.floor(now.getMonth() / 3);
    from = new Date(now.getFullYear(), q * 3, 1);
    to = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
  } else if (preset === 'thisFY') {
    var fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    from = new Date(fyStartYear, 3, 1);
    to = new Date(fyStartYear + 1, 2, 31, 23, 59, 59);
  } else if (preset === 'custom') {
    from = new Date(customFrom);
    to = new Date(customTo);
    to.setHours(23, 59, 59);
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }
  return { from: from, to: to };
}

function groupSum_(jobs, keyFn, amountFn) {
  var map = {};
  jobs.forEach(function (j) {
    var key = keyFn(j) || 'Unknown';
    if (!map[key]) map[key] = { key: key, revenue: 0, count: 0 };
    map[key].revenue += amountFn(j);
    map[key].count += 1;
  });
  return Object.keys(map).map(function (k) {
    map[k].revenue = round2_(map[k].revenue);
    return map[k];
  }).sort(function (a, b) { return b.revenue - a.revenue; });
}

/** Client entry point. filter: {preset, from, to} */
function getReportData(filter) {
  ensureDatabase_();
  filter = filter || {};
  var range = getDateRangeForPreset_(filter.preset, filter.from, filter.to);
  var allJobs = activeJobs_();

  var jobsInRange = allJobs.filter(function (j) {
    if (!j.ShootDate) return false;
    var d = new Date(j.ShootDate);
    return d >= range.from && d <= range.to;
  });

  var invoiced = jobsInRange.filter(function (j) { return !!j.InvoiceNumber; });
  var paid = jobsInRange.filter(function (j) { return j.PaymentStatus === PAYMENT_STATUS.PAID; });
  var today = startOfDay_(new Date());

  var totalSalesIncl = round2_(jobsInRange.reduce(function (s, j) { return s + (Number(j.TotalInclGST) || 0); }, 0));
  var totalGst = round2_(jobsInRange.reduce(function (s, j) { return s + (Number(j.GST) || 0); }, 0));
  var totalExGst = round2_(jobsInRange.reduce(function (s, j) { return s + (Number(j.AmountExGST) || 0); }, 0));
  var totalPaid = round2_(jobsInRange.reduce(function (s, j) { return s + (Number(j.AmountPaid) || 0); }, 0));
  var totalUnpaid = round2_(jobsInRange.reduce(function (s, j) { return s + (Number(j.BalanceDue) || 0); }, 0));

  var revenueByMonthMap = {};
  jobsInRange.forEach(function (j) {
    var d = new Date(j.ShootDate);
    var key = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    revenueByMonthMap[key] = round2_((revenueByMonthMap[key] || 0) + (Number(j.TotalInclGST) || 0));
  });
  var revenueByMonth = Object.keys(revenueByMonthMap).sort().map(function (k) {
    return { month: k, revenue: revenueByMonthMap[k] };
  });

  var outstandingInvoices = jobsInRange.filter(function (j) {
    return j.PaymentStatus === PAYMENT_STATUS.INVOICE_SENT || j.PaymentStatus === PAYMENT_STATUS.PART_PAID;
  });
  var overdueInvoices = outstandingInvoices.filter(function (j) { return j.DueDate && startOfDay_(j.DueDate) < today; });

  return {
    dateRange: { from: range.from, to: range.to },
    totalJobs: jobsInRange.length,
    totalInvoiced: round2_(invoiced.reduce(function (s, j) { return s + (Number(j.TotalInclGST) || 0); }, 0)),
    totalPaid: totalPaid,
    totalUnpaid: totalUnpaid,
    gstCollected: totalGst,
    salesExGST: totalExGst,
    totalSalesInclGST: totalSalesIncl,
    paidInvoiceCount: paid.length,
    unpaidInvoiceCount: outstandingInvoices.length,
    revenueByMonth: revenueByMonth,
    revenueByPackage: groupSum_(jobsInRange, function (j) { return j.PackageName; }, function (j) { return Number(j.TotalInclGST) || 0; }),
    revenueByAgent: groupSum_(jobsInRange, function (j) { return j.AgentName; }, function (j) { return Number(j.TotalInclGST) || 0; }),
    revenueByAgency: groupSum_(jobsInRange, function (j) { return j.AgencyName; }, function (j) { return Number(j.TotalInclGST) || 0; }),
    outstandingInvoices: outstandingInvoices,
    overdueInvoices: overdueInvoices
  };
}

/** Client entry point: returns CSV text for the current report filter. */
function exportReportCSV(filter) {
  var report = getReportData(filter);
  var lines = [];
  lines.push('PK Visuals Report');
  lines.push('From,' + formatDate_(report.dateRange.from));
  lines.push('To,' + formatDate_(report.dateRange.to));
  lines.push('');
  lines.push('Total Jobs,' + report.totalJobs);
  lines.push('Total Sales (incl GST),' + report.totalSalesInclGST);
  lines.push('Sales (ex GST),' + report.salesExGST);
  lines.push('GST Collected,' + report.gstCollected);
  lines.push('Total Invoiced,' + report.totalInvoiced);
  lines.push('Total Paid,' + report.totalPaid);
  lines.push('Total Unpaid,' + report.totalUnpaid);
  lines.push('');
  lines.push('Revenue By Month');
  lines.push('Month,Revenue');
  report.revenueByMonth.forEach(function (r) { lines.push(r.month + ',' + r.revenue); });
  lines.push('');
  lines.push('Revenue By Agent');
  lines.push('Agent,Revenue,Jobs');
  report.revenueByAgent.forEach(function (r) { lines.push(r.key + ',' + r.revenue + ',' + r.count); });
  lines.push('');
  lines.push('Revenue By Agency');
  lines.push('Agency,Revenue,Jobs');
  report.revenueByAgency.forEach(function (r) { lines.push(r.key + ',' + r.revenue + ',' + r.count); });
  lines.push('');
  lines.push('Revenue By Package');
  lines.push('Package,Revenue,Jobs');
  report.revenueByPackage.forEach(function (r) { lines.push(r.key + ',' + r.revenue + ',' + r.count); });
  return lines.join('\n');
}
