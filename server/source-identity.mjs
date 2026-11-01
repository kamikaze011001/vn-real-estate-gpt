export const sourceLabels={voz:'VOZ',otofun:'OTOFUN',alonhadat:'ALONHADAT',rongbay:'RONGBAY'};
export function safeSourceIdentity(value,key){
  const url=new URL(value),parts=key.split(':'),[source,id,post]=parts;
  if(parts.length!==3||!/^\d{1,24}$/.test(id)||url.protocol!=='https:'||url.username||url.password||url.port||url.search||value.length>600)throw new Error('Invalid research source');
  if(source==='alonhadat'||source==='rongbay'){
    const host=source==='alonhadat'?'alonhadat.com.vn':'rongbay.com';
    const path=source==='alonhadat'?`^/[a-z0-9-]+-${id}\\.html$`:`^/Ha-Noi/[a-zA-Z0-9-]+-c15-raovat-${id}\\.html$`;
    if(url.hostname!==host||post!==`ad-${id}`||url.hash||!new RegExp(path).test(url.pathname))throw new Error('Invalid research source');
  }else{
    const hosts=source==='voz'?['voz.vn']:source==='otofun'?['www.otofun.net.vn','www.otofun.net']:[];
    if(!hosts.includes(url.hostname)||!/^post-\d+$/.test(post)||url.hash!==`#${post}`||!new RegExp(`^/(?:threads|t)/[^/]+\\.${id}/(?:page-\\d+)?$`).test(url.pathname))throw new Error('Invalid research source');
  }
  return url.href;
}
export function publicSourceUrl(value){
  try{
    const url=new URL(value);
    const ad=url.pathname.match(/-([0-9]{1,24})\.html$/);
    if(url.hostname==='alonhadat.com.vn'&&ad)return !!safeSourceIdentity(value,`alonhadat:${ad[1]}:ad-${ad[1]}`);
    if(url.hostname==='rongbay.com'&&ad)return !!safeSourceIdentity(value,`rongbay:${ad[1]}:ad-${ad[1]}`);
    const forum=url.pathname.match(/\.([0-9]{1,24})\//);
    return !!forum&&!!safeSourceIdentity(value,`${url.hostname==='voz.vn'?'voz':'otofun'}:${forum[1]}:${url.hash.slice(1)}`);
  }catch{return false;}
}
