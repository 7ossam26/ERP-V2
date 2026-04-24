const arabicDateTimeFormatter = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const arabicDateFormatter = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatArabicDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return arabicDateTimeFormatter.format(date).replace("،", "");
}

export function formatArabicDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return arabicDateFormatter.format(date).replace("،", "");
}

export function formatEgyptianCurrency(value) {
  const amount = Number(value || 0);
  return `${amount.toFixed(2)} ج.م`;
}
