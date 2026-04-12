let cachedHolidays: Record<string, {name: string, type: string}> | null = null;
let lastFetchTime = 0;

export async function fetchSriLankaHolidays(): Promise<Record<string, {name: string, type: string}>> {
  // Cache for 24 hours to avoid rate limits
  if (cachedHolidays && (Date.now() - lastFetchTime < 24 * 60 * 60 * 1000)) {
    return cachedHolidays;
  }

  try {
    const response = await fetch('https://calendar.google.com/calendar/ical/en.lk%23holiday%40group.v.calendar.google.com/public/basic.ics');
    const text = await response.text();
    
    const parsedHolidays: Record<string, {name: string, type: string}> = {};
    
    const events = text.split('BEGIN:VEVENT');
    for (let i = 1; i < events.length; i++) {
      const eventText = events[i];
      
      const dateMatch = eventText.match(/DTSTART(?:;VALUE=DATE)?:(\d{4})(\d{2})(\d{2})/);
      const summaryMatch = eventText.match(/SUMMARY(.*?):(.*?)(?:\r\n|\n)/);
      const descMatch = eventText.match(/DESCRIPTION:(.*?)(?:\r\n|\n)/);
      
      if (dateMatch && summaryMatch) {
        const [, year, month, day] = dateMatch;
        const dateStr = `${year}-${month}-${day}`;
        let summary = summaryMatch[2].trim();
        summary = summary.replace(/\\,/g, ',');
        
        let type = 'Public Holiday';
        if (summary.toLowerCase().includes('poya')) {
          type = 'Poya Day';
        } else if (summary.toLowerCase().includes('bank')) {
          type = 'Bank Holiday';
        }
        
        const desc = descMatch ? descMatch[1] : '';
        if (desc.includes('Observance') || summary.includes('Observance')) {
            // Skip non-public holidays like Mother's Day, Valentine's day, etc.
            continue;
        }
        
        parsedHolidays[dateStr] = {
          name: summary,
          type
        };
      }
    }
    
    cachedHolidays = parsedHolidays;
    lastFetchTime = Date.now();
    return parsedHolidays;
  } catch (error) {
    console.error("Failed to fetch holidays", error);
    // If offline, return an empty object to prevent app crash
    return cachedHolidays || {};
  }
}
