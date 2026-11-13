// Documentary title and index identifier are different fields. Only the known
// printed OPT grammar permits a descriptive suffix, separated by underscore.
// Never match arbitrary prefixes (PINI-22 must not match PINI-220).
export function documentaryOptCode(title) {
  if(typeof title!=='string'||title!==title.trim()||!title||/[\u0000-\u001f\u007f]/.test(title))return null;
  const match=title.match(/^(OPT\d{4}-\d{1,2}-\d+-[A-Z]+-\d+)(?:_|$)/);
  return match?match[1]:title;
}
export function indexedDocumentIdentity(titles,indexOpt) {
  if(!Array.isArray(titles)||!titles.length||new Set(titles).size!==1)return null;
  const title=titles[0],opt=documentaryOptCode(title);
  return opt&&opt===indexOpt?{opt,title}:null;
}
