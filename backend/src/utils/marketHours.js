// NSE trades 09:15 to 15:30 IST, Monday to Friday.
const OPEN_MINUTE = 9 * 60 + 15
const CLOSE_MINUTE = 15 * 60 + 30

/** The same instant expressed in Indian Standard Time (UTC+5:30). */
function istParts(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60000)
  return {
    day: ist.getUTCDay(),
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
    date: ist.toISOString().slice(0, 10),
  }
}

/** Today's date in India, as YYYY-MM-DD. */
function istDate(now = new Date()) {
  return istParts(now).date
}

/** Inside the weekday trading window. Says nothing about exchange holidays. */
function withinSession(now = new Date()) {
  const { day, minutes } = istParts(now)
  return day >= 1 && day <= 5 && minutes >= OPEN_MINUTE && minutes <= CLOSE_MINUTE
}

/**
 * Whether the exchange is really trading right now.
 *
 * The clock alone cannot tell a holiday from a normal weekday, so this also
 * asks the data: a quote carries the session its price belongs to, and if the
 * latest price is not from today then nothing has traded today whatever the
 * calendar says. That keeps holidays right without maintaining a holiday list
 * that would quietly go out of date.
 */
function isTrading(quotes = [], now = new Date()) {
  if (!withinSession(now)) return false

  const today = istDate(now)
  return quotes.some((quote) => quote && quote.asOf === today)
}

/** A short phrase for the UI, e.g. "Monday at 9:15 am". */
function nextOpenLabel(now = new Date()) {
  const { day, minutes } = istParts(now)
  const beforeOpen = day >= 1 && day <= 5 && minutes < OPEN_MINUTE
  if (beforeOpen) return 'today at 9:15 am'

  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  let next = (day + 1) % 7
  while (next === 0 || next === 6) next = (next + 1) % 7

  return `${next === (day + 1) % 7 ? 'tomorrow' : names[next]} at 9:15 am`
}

module.exports = { isTrading, withinSession, istDate, nextOpenLabel }
