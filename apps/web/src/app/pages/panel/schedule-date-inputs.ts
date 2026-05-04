function parseDateInputValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDateInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDaysToDateInput(date: string, offset: number) {
  const parsedDate = parseDateInputValue(date);

  if (!parsedDate) {
    return "";
  }

  const nextDate = new Date(parsedDate);
  nextDate.setUTCDate(parsedDate.getUTCDate() + offset);

  return formatDateInputDate(nextDate);
}

export function getInclusiveDateRangeDayCount(startDate: string, endDate: string) {
  const parsedStartDate = parseDateInputValue(startDate);
  const parsedEndDate = parseDateInputValue(endDate);

  if (!parsedStartDate || !parsedEndDate || parsedEndDate < parsedStartDate) {
    return 1;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((parsedEndDate.getTime() - parsedStartDate.getTime()) / millisecondsPerDay) + 1;
}

export function getScheduleEndDateInputValue(firstDayDate: string, dayCount: number) {
  if (!firstDayDate) {
    return "";
  }

  return addDaysToDateInput(firstDayDate, Math.max(1, dayCount) - 1);
}
