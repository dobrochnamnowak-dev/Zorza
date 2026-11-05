// Historical article summaries are retired; publications are covered by the brief.
export const ARTICLE_SUMMARIES_DISABLED='Osobne podsumowania artykułów są wyłączone. Publikacje opracowujemy w briefie.';
export function headlineStatus(){return {enabled:false,mode:'original',used:0,limit:0,pending:0};}
export function retireArticleSummaries(db,now=new Date()){
 return db.prepare("UPDATE jobs SET status='failed',error=?,finished_at=?,lease=NULL,lease_until=NULL WHERE status IN ('queued','running')").run(ARTICLE_SUMMARIES_DISABLED,now.toISOString()).changes;
}
export async function processPublicationWork(store){
 retireArticleSummaries(store.db);return {status:'disabled'};
}
