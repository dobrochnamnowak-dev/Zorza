// Oficjalny kalendarz NYSE 2026–2028: https://www.nyse.com/trade/hours-calendars
const holidays={
 2026:['01-01','01-19','02-16','04-03','05-25','06-19','07-03','09-07','11-26','12-25'],
 2027:['01-01','01-18','02-15','03-26','05-31','06-18','07-05','09-06','11-25','12-24'],
 2028:['01-17','02-21','04-14','05-29','06-19','07-04','09-04','11-23','12-25']
};
const earlyClose={2026:['11-27','12-24'],2027:['11-26'],2028:['07-03','11-24']};
const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function usOpenSlot(now=new Date()){
 const p=Object.fromEntries(formatter.formatToParts(now).map(p=>[p.type,p.value]));
 if(!holidays[p.year]||['Sat','Sun'].includes(p.weekday)||holidays[p.year].includes(p.month+'-'+p.day))return null;
 const minute=Number(p.hour)*60+Number(p.minute),close=earlyClose[p.year]?.includes(p.month+'-'+p.day)?13*60:16*60;
 return minute>=9*60+35&&minute<close?`${p.year}-${p.month}-${p.day}/09:35-NY`:null;
}
export function usCalendarKnown(now=new Date()){return !!holidays[formatter.formatToParts(now).find(p=>p.type==='year').value];}
