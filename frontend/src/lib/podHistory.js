export function filterDateOptions(options, dateFrom, dateTo) {
  return options.filter(({ date }) => (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo));
}

export function datedPath(path, date) {
  return date ? `${path}?date=${encodeURIComponent(date)}` : path;
}
