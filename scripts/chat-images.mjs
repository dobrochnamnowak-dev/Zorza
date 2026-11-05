export const CHAT_BODY_LIMIT=4500000;
export function chatImages(value){
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>3)throw new Error('Dodaj maksymalnie 3 zdjęcia');
 return value.map(url=>{
  if(typeof url!=='string'||url.length>1400000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(url))throw new Error('Niepoprawne zdjęcie lub zdjęcie jest za duże');
  const [header,encoded]=url.split(',');const bytes=Buffer.from(encoded,'base64');
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!(header.includes('/jpeg')&&jpeg||header.includes('/png')&&png||header.includes('/webp')&&webp))throw new Error('Niepoprawny format zdjęcia');
  return url;
 });
}
// Usuwanie dotyczy kopii załączników w historii Zorzy, dopiero po odpowiedzi.
export function finishScreenshotMessage(messages,{messageId,assistantId,status}){
 const message=messages.find(m=>m.id===messageId&&m.deleteImagesAfterReply===true);
 if(!message)return false;
 const reply=messages.find(m=>m.id===assistantId&&m.role==='assistant'&&typeof m.text==='string'&&m.text.trim());
 if(status==='completed'&&reply){delete message.images;message.screenshot_status='done';message.images_removed_at=new Date().toISOString();return true;}
 message.screenshot_status='failed';return false;
}
